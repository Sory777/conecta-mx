"""AGENTE ANTIFRAUDE.

Toda oportunidad pasa por aquí antes de poder marcarse EN_PRUEBA o ACTIVA.
Resultado: BAJO / MEDIO / ALTO / DESCARTAR. Una señal CRÍTICA ⇒ DESCARTAR y estado DESCARTADA.

Escepticismo por diseño: la ausencia de señales NO basta para riesgo BAJO. BAJO exige además
verificaciones positivas (dominio con antigüedad comprobada ≥ 2 años, HTTPS, términos de servicio
localizados, plataforma verificada y sin inversión obligatoria).
"""
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import DataPoint, Opportunity, Platform, ResearchResult, Risk, RiskAssessment, Status, utcnow
from ..services import web
from ..services.records import create_alert, log_decision

AGENT_KEY = "antifraude"


@dataclass(frozen=True)
class Rule:
    code: str
    severity: str  # CRITICO, ALTO, MEDIO
    pattern: str
    detail: str


RULES = [
    Rule("rentabilidad_garantizada", "CRITICO",
         r"(rentabilidad|ganancias?|ingresos?|retornos?)\s+garantizad[oa]s?|guaranteed\s+(profits?|returns?|income|earnings)|sin\s+riesgo\s+de\s+p[eé]rdida|risk[- ]free\s+(profit|return|income)",
         "Promete rentabilidad garantizada: ninguna fuente legítima de ingresos puede garantizarla."),
    Rule("rendimiento_diario_fijo", "CRITICO",
         r"\b\d+(?:[.,]\d+)?\s*%\s*(diari[oa]|al\s+d[ií]a|daily|per\s+day|a\s+day)",
         "Rendimiento fijo diario: patrón típico de esquemas Ponzi/HYIP."),
    Rule("multiplica_dinero", "CRITICO",
         r"(duplica|triplica|multiplica)\s+tu\s+(dinero|inversi[oó]n|bitcoin|cripto)|double\s+your\s+(money|bitcoin|crypto|investment)",
         "Promete multiplicar el dinero."),
    Rule("deposito_para_retirar", "CRITICO",
         r"(dep[oó]sito|pago|comisi[oó]n|cuota)\s+(\w+\s+){0,4}para\s+(retirar|desbloquear|liberar)|(deposit|pay)\s+(\w+\s+){0,4}(to|before\s+you\s+can)\s+(withdraw|unlock)|unlock\s+fee|tarifa\s+de\s+desbloqueo",
         "Exige un pago o depósito para poder retirar."),
    Rule("frase_semilla", "CRITICO",
         r"(frase\s+semilla|seed\s+phrase|recovery\s+phrase|clave\s+privada|private\s+key)",
         "Menciona frase semilla/clave privada: una plataforma legítima nunca la solicita."),
    Rule("reclutamiento_obligatorio", "ALTO",
         r"(invita|recluta|refiere)\s+(\w+\s+){0,5}para\s+(ganar|retirar|desbloquear|activar)|(refer|invite|recruit)\s+(\w+\s+){0,5}(to\s+)?(unlock|withdraw|activate|earn)|multinivel|multi-level|\bmlm\b|matriz\s+de\s+pago|binary\s+plan|plan\s+binario",
         "Ingresos condicionados al reclutamiento (estructura piramidal/multinivel)."),
    Rule("apy_extremo", "ALTO",
         r"\b(\d{3,}(?:[.,]\d+)?)\s*%\s*(apy|apr|anual|annual)",
         "APY/APR de tres cifras o más: insostenible salvo emisión inflacionaria del token."),
    Rule("urgencia", "MEDIO",
         r"(s[oó]lo\s+hoy|[uú]ltim[oa]s?\s+lugares|plazas\s+limitadas|only\s+today|limited\s+spots|act\s+now)",
         "Presión de urgencia artificial."),
    Rule("datos_innecesarios", "ALTO",
         r"(contraseña|password)\s+de\s+(tu|su)\s+(banco|correo|email|cuenta)|(your|tu)\s+(bank|banking)\s+password",
         "Solicita credenciales de otros servicios."),
    Rule("pago_por_empezar", "MEDIO",
         r"(kit\s+de\s+inicio|starter\s+kit|membres[ií]a\s+(obligatoria|requerida)|registration\s+fee|cuota\s+de\s+inscripci[oó]n)",
         "Cobra por empezar a trabajar: frecuente en estafas de 'trabajo desde casa'."),
]


def scan_text(text: str) -> list[dict]:
    flags = []
    for rule in RULES:
        m = re.search(rule.pattern, text, flags=re.IGNORECASE)
        if m:
            if rule.code == "apy_extremo" and float(m.group(1).replace(",", ".")) < 100:
                continue
            start = max(m.start() - 60, 0)
            flags.append({"code": rule.code, "severity": rule.severity, "detail": rule.detail,
                          "evidence": text[start:m.end() + 60].replace("\n", " ").strip(), "origin": "regla"})
    return flags


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def classify(flags: list[dict], checks: dict) -> tuple[str, str]:
    sev = [f["severity"] for f in flags]
    if "CRITICO" in sev:
        return Risk.DESCARTAR, "Hay al menos una señal crítica."
    if sev.count("ALTO") >= 1 or sev.count("MEDIO") >= 3:
        return Risk.ALTO, "Señales de riesgo alto (o 3+ señales medias)."
    prerequisites = {
        "dominio_antiguedad_2_anios": checks.get("domain_age_days") is not None and checks["domain_age_days"] >= 730,
        "https": checks.get("https") is True,
        "terminos_localizados": bool(checks.get("tos_url")),
        "plataforma_verificada": checks.get("platform_verified") is True,
        "sin_inversion_obligatoria": checks.get("requires_investment") is False,
    }
    unmet = [k for k, ok in prerequisites.items() if not ok]
    if sev or unmet:
        why = []
        if sev:
            why.append(f"{len(sev)} señal(es) de riesgo medio")
        if unmet:
            why.append("verificaciones pendientes para riesgo BAJO: " + ", ".join(unmet))
        return Risk.MEDIO, "; ".join(why) + "."
    return Risk.BAJO, "Sin señales y con todas las verificaciones positivas completadas."


def gather_text(db: Session, opp: Opportunity) -> str:
    parts = [opp.title, opp.description or "", opp.discovery_reason or ""]
    if opp.platform:
        p = opp.platform
        parts += [p.requirements or "", p.fees_note or "", p.notes or ""]
    for dp in db.scalars(select(DataPoint).where(DataPoint.opportunity_id == opp.id)):
        parts.append(dp.note or "")
    for rr in db.scalars(select(ResearchResult).where(ResearchResult.opportunity_id == opp.id)):
        parts += [rr.title or "", rr.content or ""]
    return "\n".join(x for x in parts if x)


def run(db: Session, opp: Opportunity, agent_run_id: Optional[int] = None,
        rdap: Optional[Callable[[str], Optional[datetime]]] = None,
        llm_review: Optional[Callable[[str], list[dict]]] = None,
        manual_flags: Optional[list[dict]] = None) -> RiskAssessment:
    rdap = rdap or web.rdap_domain_created
    db.flush()
    text = gather_text(db, opp)
    flags = scan_text(text)

    if llm_review:
        seen = {f["code"] for f in flags}
        normalized_text = _norm(text)
        for s in llm_review(text):
            # anti-alucinación: la cita debe existir literalmente en el material
            if s.get("quote") and _norm(s["quote"]) in normalized_text and s["code"] not in seen:
                flags.append({"code": s["code"], "severity": s["severity"], "detail": s["detail"],
                              "evidence": s["quote"], "origin": "revision_ia"})
    for mf in manual_flags or []:
        flags.append({**mf, "origin": "usuario"})

    checks: dict = {}
    p: Optional[Platform] = opp.platform
    if p:
        checks["platform_verified"] = p.verification_status == "VERIFICADA"
        checks["tos_url"] = p.tos_url
        checks["https"] = bool(p.url and p.url.lower().startswith("https://")) if p.url else None
        if p.url and p.url.lower().startswith("http://"):
            flags.append({"code": "sin_https", "severity": "MEDIO", "detail": "El sitio oficial no usa HTTPS.",
                          "evidence": p.url, "origin": "verificacion"})
        domain = p.domain or web.domain_of(p.url)
        if domain:
            if not p.domain_created_at:
                p.domain_created_at = rdap(domain)
            if p.domain_created_at:
                age = (utcnow() - p.domain_created_at).days
                checks["domain_age_days"] = age
                if age < 180:
                    flags.append({"code": "dominio_reciente", "severity": "ALTO",
                                  "detail": f"Dominio registrado hace {age} días (RDAP).", "evidence": domain,
                                  "origin": "verificacion"})
                elif age < 365:
                    flags.append({"code": "dominio_joven", "severity": "MEDIO",
                                  "detail": f"Dominio registrado hace {age} días (RDAP).", "evidence": domain,
                                  "origin": "verificacion"})
            else:
                checks["domain_age_days"] = None
                checks["domain_age_note"] = "RDAP no devolvió fecha de registro: NO VERIFICADA"
    else:
        checks["platform_verified"] = False
        checks["note"] = "Sin plataforma asociada: no se pudo verificar dominio ni términos."

    inv = db.scalar(select(DataPoint).where(DataPoint.opportunity_id == opp.id, DataPoint.field == "initial_investment")
                    .order_by(DataPoint.created_at.desc()))
    checks["requires_investment"] = None if inv is None else inv.value > 0

    # señales que el usuario revisó como falso positivo: se conservan visibles pero no cuentan
    dismissed = {d["code"]: d.get("reason", "") for d in (opp.dismissed_flags or [])}
    for f in flags:
        if f["code"] in dismissed and f.get("origin") != "usuario":
            f["dismissed"] = True
            f["dismissed_reason"] = dismissed[f["code"]]
    active_flags = [f for f in flags if not f.get("dismissed")]

    level, reason = classify(active_flags, checks)
    ra = RiskAssessment(opportunity_id=opp.id, risk_level=level, flags=flags,
                        checks=[{"check": k, "value": v} for k, v in checks.items()], reasoning=reason)
    db.add(ra)
    previous = opp.risk_level
    opp.risk_level = level

    sections = {
        "data_used": [f"{len(text)} caracteres de descripción, notas y resultados de investigación",
                      *[f"{k}: {v}" for k, v in checks.items()]],
        "risks": [f"[{f['severity']}{' · DESCARTADA POR USUARIO' if f.get('dismissed') else ''}] {f['detail']} — «{f['evidence'][:200]}»"
                  for f in flags] or ["Sin señales detectadas."],
        "conclusion": f"Riesgo {level}. {reason}",
    }
    if level == Risk.DESCARTAR:
        opp.status = Status.DESCARTADA
        opp.discard_reason = "Antifraude: " + "; ".join(f["detail"] for f in active_flags if f["severity"] == "CRITICO")
        sections["discard_reason"] = opp.discard_reason
        create_alert(db, "sospechosa", f"'{opp.title}' fue DESCARTADA por el antifraude", opp.discard_reason,
                     "critica", opportunity_id=opp.id)
    elif level == Risk.ALTO and previous != Risk.ALTO:
        create_alert(db, "sospechosa", f"'{opp.title}' marcada como riesgo ALTO", reason, "aviso", opportunity_id=opp.id)

    log_decision(db, AGENT_KEY, "evaluacion_riesgo", sections, opportunity_id=opp.id, agent_run_id=agent_run_id)
    return ra
