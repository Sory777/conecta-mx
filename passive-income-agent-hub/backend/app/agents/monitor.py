"""AGENTE DE INVESTIGACIÓN CONTINUA — monitor de cambios en plataformas conocidas.

Descarga periódicamente la página monitoreada (términos o página oficial) de cada plataforma,
compara contra la versión anterior y registra cambios en platform_changes con un extracto del diff.
Detecta palabras clave de cambios relevantes (automatización, países, pagos, comisiones).
No reinterpreta con IA: muestra el cambio literal para que lo revises.
"""
import difflib
import logging
import re
from typing import Callable, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AgentRun, Opportunity, Platform, PlatformChange, Status, utcnow
from ..services import web
from ..services.records import create_alert, log_decision

AGENT_KEY = "monitor"
log = logging.getLogger("hub.monitor")

KEYWORDS = {
    "automatizacion": r"\b(bots?|automat\w*|scripts?|scraping|scrap\w*|macros?)\b",
    "pais": r"\b(m[eé]xico|mexico|pa[ií]ses|countries|countr(y|ies)|region(es)?|disponible en|available in)\b",
    "pagos": r"\b(pago m[ií]nimo|minimum (payout|withdrawal)|paypal|payoneer|retiro|withdraw\w*|payout)\b",
    "comisiones": r"\b(comisi[oó]n|fee|fees|tarifa)\b",
    "recompensas": r"\b(recompensa\w*|rewards?|apy|apr|emisi[oó]n|emission)\b",
}


def classify_diff(changed_lines: list[str]) -> list[str]:
    text = "\n".join(changed_lines)
    return [k for k, pat in KEYWORDS.items() if re.search(pat, text, re.IGNORECASE)]


def check_platform(db: Session, p: Platform, run_id: Optional[int] = None,
                   fetch: Optional[Callable[[str], tuple[str, int]]] = None) -> Optional[PlatformChange]:
    fetch = fetch or web.fetch_text
    url = p.monitored_url or p.tos_url or p.url
    if not url:
        return None
    try:
        text, status = fetch(url)
    except httpx.HTTPError as e:
        text, status = "", 0
        log.info("monitor: %s inaccesible: %s", url, e)
    p.last_checked_at = utcnow()
    if status >= 400 or status == 0:
        ch = PlatformChange(platform_id=p.id, url=url, change_type="inaccesible",
                            summary=f"La página respondió {status or 'sin conexión'}; podría haber cerrado o bloquear el acceso.")
        db.add(ch)
        create_alert(db, "cambio_plataforma", f"{p.name}: página inaccesible ({status or 'error'})", ch.summary,
                     "aviso", platform_id=p.id)
        return ch
    new_hash = web.content_hash(text)
    if p.content_hash is None:
        p.content_hash, p.content_snapshot = new_hash, text
        return None  # primera observación: línea base
    if new_hash == p.content_hash:
        return None
    old_lines = (p.content_snapshot or "").splitlines()
    new_lines = text.splitlines()
    diff = [ln for ln in difflib.unified_diff(old_lines, new_lines, lineterm="", n=0)
            if (ln.startswith("+") or ln.startswith("-")) and not ln.startswith(("+++", "---"))]
    kinds = classify_diff(diff)
    ch = PlatformChange(platform_id=p.id, url=url, change_type=",".join(kinds) or "contenido",
                        summary=f"{len(diff)} línea(s) cambiaron" + (f"; temas: {', '.join(kinds)}" if kinds else ""),
                        diff_excerpt="\n".join(diff[:80])[:8000])
    db.add(ch)
    p.content_hash, p.content_snapshot = new_hash, text
    severity = "aviso" if kinds else "info"
    create_alert(db, "cambio_plataforma", f"{p.name} cambió su página ({ch.change_type})",
                 "Revisa si cambiaron condiciones, pagos, países o reglas de automatización. " + ch.summary,
                 severity, platform_id=p.id)
    if "automatizacion" in kinds or "pais" in kinds:
        for opp in db.scalars(select(Opportunity).where(Opportunity.platform_id == p.id,
                                                        Opportunity.status.in_([Status.ACTIVA, Status.EN_PRUEBA]))):
            opp.status = Status.REQUIERE_ACCION
            log_decision(db, AGENT_KEY, "requiere_accion", {
                "found_because": f"Cambio detectado en {url}",
                "risks": [f"Temas afectados: {', '.join(kinds)}"],
                "conclusion": "Se marca REQUIERE ACCIÓN hasta que revises los nuevos términos.",
            }, opportunity_id=opp.id, agent_run_id=run_id)
    return ch


def run(db: Session, run: AgentRun, fetch: Optional[Callable[[str], tuple[str, int]]] = None) -> dict:
    checked = changes = 0
    for p in db.scalars(select(Platform)):
        if not (p.monitored_url or p.tos_url or p.url):
            continue
        checked += 1
        if check_platform(db, p, run.id, fetch):
            changes += 1
    run.summary = f"{checked} plataformas revisadas · {changes} cambios"
    return {"checked": checked, "changes": changes}
