"""AGENTE INVESTIGADOR DE OPORTUNIDADES (+ buscador).

1. Busca en la web con datos actuales (Claude web_search, o Brave Search API como alternativa).
2. Guarda cada fuente consultada en research_results (URL, fecha, proveedor, contenido).
3. Con Claude, extrae candidatos estructurados; cada dato conserva su tipo de evidencia y su fuente.
4. Reglas anti-alucinación aplicadas por código (no por confianza en el modelo):
   - dato sin fuente, o con fuente que NO está entre las URLs realmente consultadas ⇒ NO_VERIFICADA;
   - un candidato sin ninguna fuente consultada se descarta.
5. Cada candidato nuevo entra como INVESTIGANDO y pasa por antifraude → automatización → rentabilidad.
   Nunca se activa una oportunidad automáticamente.
"""
import logging
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import CATEGORIES, AgentRun, DataPoint, Evidence, Opportunity, Platform, ResearchResult, Risk, Status, utcnow
from ..services import llm, web
from ..services.records import create_alert, log_decision
from . import pipeline

AGENT_KEY = "investigador"
log = logging.getLogger("hub.researcher")


def _norm_url(u: Optional[str]) -> str:
    return (u or "").strip().rstrip("/").lower()


def _find_platform(db: Session, name: str, url: Optional[str]) -> Optional[Platform]:
    domain = web.domain_of(url)
    if domain:
        p = db.scalar(select(Platform).where(Platform.domain == domain))
        if p:
            return p
    return db.scalar(select(Platform).where(func.lower(Platform.name) == name.strip().lower()))


def store_hits(db: Session, run: AgentRun, query: str, outcome: web.SearchOutcome) -> list[ResearchResult]:
    rows = []
    for h in outcome.hits:
        rr = ResearchResult(agent_run_id=run.id, query=query, url=h.url, title=h.title[:500], source=h.source or outcome.provider,
                            content=h.snippet, page_age=h.page_age)
        db.add(rr)
        rows.append(rr)
    db.flush()
    return rows


def ingest_candidate(db: Session, run: AgentRun, query: str, c: "llm.ExtractedCandidate",
                     consulted: set[str], hits_by_url: dict[str, ResearchResult]) -> tuple[Optional[Opportunity], str]:
    valid_sources = [u for u in c.source_urls if _norm_url(u) in consulted]
    if not valid_sources:
        return None, f"'{c.name}' ignorado: ninguna de sus fuentes está entre las URLs consultadas."

    category = c.category if c.category in CATEGORIES else "otra"
    platform = _find_platform(db, c.name, c.official_url)
    is_new_platform = platform is None
    if platform is None:
        platform = Platform(name=c.name[:200], url=c.official_url, domain=web.domain_of(c.official_url), category=category)
        db.add(platform)
    # solo se rellenan campos vacíos; nunca se sobrescribe un dato existente con uno del modelo
    for attr in ("countries", "mexico_available", "payment_methods", "min_payout", "min_payout_currency",
                 "requirements", "tos_url", "tos_prohibits_automation", "has_official_api", "api_docs_url"):
        val = getattr(c, attr)
        if val is not None and getattr(platform, attr) is None:
            setattr(platform, attr, val)
    if platform.url is None and c.official_url:
        platform.url, platform.domain = c.official_url, web.domain_of(c.official_url)
    if not platform.monitored_url:
        platform.monitored_url = platform.tos_url or platform.url
    db.flush()

    existing = db.scalar(select(Opportunity).where(Opportunity.platform_id == platform.id))
    if existing:
        opp, created = existing, False
    else:
        opp = Opportunity(title=c.name[:250], platform_id=platform.id, category=category, description=c.description,
                          status=Status.INVESTIGANDO, discovered_by=AGENT_KEY, discovery_reason=c.why_found)
        db.add(opp)
        created = True
    db.flush()

    for u in valid_sources:
        rr = hits_by_url.get(_norm_url(u))
        if rr and rr.opportunity_id is None:
            rr.opportunity_id, rr.platform_id = opp.id, platform.id

    downgraded = []
    for dp in c.data_points:
        evidence = dp.evidence_type
        src = dp.source_url
        if not src or _norm_url(src) not in consulted:
            if evidence != Evidence.NO_VERIFICADA:
                downgraded.append(dp.field)
            evidence = Evidence.NO_VERIFICADA
        db.add(DataPoint(opportunity_id=opp.id, field=dp.field, value=dp.value, value_low=dp.value_low,
                         value_high=dp.value_high, currency=dp.currency, evidence_type=evidence, source_url=src,
                         retrieved_at=utcnow(), note=dp.quote, created_by=AGENT_KEY))
    db.flush()

    log_decision(db, AGENT_KEY, "oportunidad_encontrada" if created else "oportunidad_actualizada", {
        "found_because": f"Búsqueda «{query}»: {c.why_found}",
        "data_used": [f"Fuente: {u}" for u in valid_sources] +
                     [f"{dp.field} = {dp.value:g} {dp.currency or ''} ({dp.evidence_type})" for dp in c.data_points],
        "risks": c.risk_notes + ([f"Datos degradados a NO_VERIFICADA por fuente no consultada: {', '.join(downgraded)}"]
                                 if downgraded else []),
        "conclusion": ("Plataforma nueva registrada como NO VERIFICADA. " if is_new_platform else "")
                      + "Entra como INVESTIGANDO; requiere revisión humana antes de probarla.",
    }, opportunity_id=opp.id, agent_run_id=run.id)
    return opp, ("nueva" if created else "actualizada")


def run(db: Session, run: AgentRun, query: str, category: Optional[str] = None) -> dict:
    provider = web.available_search_provider()
    if provider is None:
        raise RuntimeError("No hay proveedor de búsqueda configurado (ANTHROPIC_API_KEY o BRAVE_API_KEY).")

    outcome = llm.search(query, category) if provider == "anthropic_web_search" else web.brave_search(
        query + (f" {category}" if category else ""))
    rows = store_hits(db, run, query, outcome)
    db.commit()  # las fuentes consultadas se conservan aunque falle la extracción
    consulted = {_norm_url(h.url) for h in outcome.hits}
    hits_by_url = {_norm_url(r.url): r for r in rows}
    summary = {"provider": provider, "sources": len(rows), "new": 0, "updated": 0, "ignored": [], "discarded": 0,
               "new_categories": []}

    if provider != "anthropic_web_search":
        summary["note"] = ("Brave solo devuelve resultados; sin ANTHROPIC_API_KEY no se extraen oportunidades "
                           "automáticamente. Revisa las fuentes y crea oportunidades manualmente.")
        run.summary = f"{len(rows)} fuentes guardadas (Brave)."
        return summary

    extraction = llm.extract_candidates(query, outcome, CATEGORIES)
    summary["new_categories"] = extraction.new_categories
    for c in extraction.candidates:
        opp, what = ingest_candidate(db, run, query, c, consulted, hits_by_url)
        if opp is None:
            summary["ignored"].append(what)
            continue
        summary["new" if what == "nueva" else "updated"] += 1
        result = pipeline.evaluate(db, opp, agent_run_id=run.id, use_llm=True)
        if result["discarded"]:
            summary["discarded"] += 1
        elif what == "nueva" and opp.risk_level in (Risk.BAJO, Risk.MEDIO):
            create_alert(db, "nueva_oportunidad", f"Nueva oportunidad: {opp.title}",
                         f"Categoría {opp.category}. Riesgo {opp.risk_level}. Encontrada con «{query}». "
                         "Datos NO VERIFICADOS hasta que los revises.", "info", opportunity_id=opp.id)
    if extraction.new_categories:
        log_decision(db, AGENT_KEY, "categorias_nuevas", {
            "found_because": f"Búsqueda «{query}»",
            "conclusion": "Categorías emergentes detectadas: " + ", ".join(extraction.new_categories),
        }, agent_run_id=run.id)
    run.summary = (f"{summary['sources']} fuentes · {summary['new']} nuevas · {summary['updated']} actualizadas · "
                   f"{summary['discarded']} descartadas · {len(summary['ignored'])} ignoradas")
    return summary
