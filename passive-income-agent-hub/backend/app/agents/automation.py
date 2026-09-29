"""AGENTE DE AUTOMATIZACIÓN (Fase 1: solo evaluación, NO ejecuta nada).

Nivel = min(techo por categoría, lo que permiten los términos de servicio).
- Términos que prohíben bots ⇒ 0%.
- Términos sin verificar ⇒ 0% hasta verificarlos (NO VERIFICADA).
- Con API oficial se propone usar la API; nunca scraping de algo que tenga API.
"""
from typing import Optional

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models import AutomationTask, Opportunity
from ..services.records import log_decision

AGENT_KEY = "automatizacion"
LEVELS = [0, 25, 50, 75, 100]

# Nunca se construye nada de esto, sin importar lo que digan los datos.
FORBIDDEN = [
    "Bots para evadir o resolver CAPTCHA",
    "Bots para falsificar identidad o perfiles",
    "Crear múltiples cuentas donde esté prohibido",
    "Automatizar respuestas de encuestas o manipularlas",
    "Automatizar microtareas cuyo valor es el juicio humano (etiquetado, evaluación, transcripción)",
    "Evadir límites de uso, geobloqueos o detección",
    "Manipular métricas (clics, vistas, reseñas, referidos)",
    "Cualquier automatización que viole términos de servicio o sea fraude",
]

# techo (%), qué se puede automatizar, qué NO (y por qué). Son SUPOSICIONES de diseño explícitas.
CATEGORY_POLICY: dict[str, tuple[int, list[str], list[str]]] = {
    "encuestas": (0, ["Registro de ingresos y recordatorios"],
                  ["Responder encuestas: automatizarlo es fraude y falsifica datos de investigación"]),
    "microtareas": (0, ["Registro de ingresos, tiempos y recordatorios"],
                    ["Realizar las tareas: el pago es por juicio humano; automatizarlo es fraude"]),
    "investigacion_remunerada": (0, ["Registro de ingresos"], ["Participar en estudios: requiere a la persona real"]),
    "testing_apps": (0, ["Registro de ingresos"], ["Ejecutar las pruebas: se paga por la experiencia humana"]),
    "testing_web": (0, ["Registro de ingresos"], ["Ejecutar las pruebas: se paga por la experiencia humana"]),
    "crowdsourcing": (0, ["Registro de ingresos"], ["Aportar el trabajo solicitado"]),
    "cashback": (25, ["Seguimiento de saldos y avisos de retiro"], ["Generar compras o clics artificiales"]),
    "recompensas": (25, ["Seguimiento de saldos"], ["Completar ofertas o misiones con bots"]),
    "afiliados": (50, ["Borradores de contenido con IA revisados por humano", "Publicación programada vía API oficial",
                       "Reportes de comisiones vía API"], ["Publicar contenido masivo sin revisión (spam)",
                                                           "Generar clics o registros falsos"]),
    "contenido_automatico": (50, ["Generación de borradores", "Programación de publicaciones vía API oficial"],
                             ["Publicar sin revisión humana", "Inflar métricas"]),
    "productos_digitales": (75, ["Entrega automática del producto", "Facturación y soporte básico"],
                            ["Crear el producto sin validar demanda", "Reseñas falsas"]),
    "plantillas": (75, ["Entrega automática", "Listado vía API oficial del marketplace"], ["Reseñas falsas"]),
    "print_on_demand": (75, ["Sincronización de catálogo y pedidos vía API oficial"],
                        ["Copiar diseños con derechos de autor"]),
    "automatizacion_ia": (75, ["Flujos con APIs oficiales", "Monitoreo"], ["Uso de cuentas ajenas o scraping prohibido"]),
    "servicios_digitales": (50, ["Onboarding y entrega automatizados"], ["Venta y atención de casos complejos"]),
    "mineria": (100, ["Software oficial del pool/proyecto", "Monitoreo de temperatura y consumo"],
                ["Usar hardware o electricidad de terceros sin permiso"]),
    "depin": (100, ["Cliente/nodo oficial del proyecto", "Monitoreo de disponibilidad y recompensas"],
              ["Ejecutar múltiples nodos donde las reglas lo prohíban", "Falsear ubicación o datos de sensores"]),
    "computacion_distribuida": (100, ["Cliente oficial", "Monitoreo"], ["Ocultar el uso de recursos compartidos"]),
    "comparticion_recursos": (100, ["Cliente oficial"], ["Compartir recursos de una red que no es tuya"]),
    "hardware": (100, ["Cliente oficial", "Monitoreo"], []),
    "staking": (75, ["Seguimiento de recompensas vía API/explorador"], ["Delegar claves privadas a terceros"]),
    "web3": (50, ["Seguimiento vía APIs públicas"], ["Farming de airdrops con múltiples billeteras (sybil)"]),
    "licenciamiento_contenido": (75, ["Subida vía API oficial"], ["Subir contenido sin derechos"]),
}
DEFAULT_POLICY = (25, ["Registro de ingresos y recordatorios"], ["Todo lo que no esté permitido por los términos"])


def assess(opp: Opportunity) -> dict:
    ceiling, can, cannot = CATEGORY_POLICY.get(opp.category, DEFAULT_POLICY)
    p = opp.platform
    tos = None if p is None else p.tos_prohibits_automation
    api = None if p is None else p.has_official_api
    reasons = [f"Techo para la categoría '{opp.category}': {ceiling}% (SUPOSICIÓN de diseño)."]
    cannot = list(cannot)
    if tos is True:
        level = 0
        reasons.append("Los términos de servicio PROHÍBEN bots/automatización ⇒ 0%.")
        cannot.append("Cualquier automatización de la actividad principal (prohibido por términos)")
    elif tos is None:
        level = 0
        reasons.append("Términos de servicio NO VERIFICADOS respecto a automatización ⇒ 0% hasta verificarlos.")
    else:
        level = ceiling
        reasons.append("Los términos revisados no prohíben automatización.")
    method = "api_oficial" if api else ("cliente_oficial" if opp.category in {"mineria", "depin", "computacion_distribuida", "comparticion_recursos", "hardware"} else "manual")
    if api:
        reasons.append("Existe API oficial: toda automatización debe usarla.")
    return {"level": level, "ceiling": ceiling, "method": method, "can_automate": can if level > 0 else
            [c for c in can if "Registro" in c or "Seguimiento" in c or "Monitoreo" in c],
            "cannot_automate": cannot, "reasons": reasons, "forbidden_always": FORBIDDEN}


def run(db: Session, opp: Opportunity, agent_run_id: Optional[int] = None) -> dict:
    a = assess(opp)
    opp.automation_level = a["level"]
    db.execute(delete(AutomationTask).where(AutomationTask.opportunity_id == opp.id, AutomationTask.status != "EJECUTANDO"))
    for c in a["can_automate"]:
        db.add(AutomationTask(opportunity_id=opp.id, description=c, method=a["method"], allowed=True,
                              policy_reason="; ".join(a["reasons"]), status="PROPUESTA"))
    for c in a["cannot_automate"]:
        db.add(AutomationTask(opportunity_id=opp.id, description=c, method="ninguno", allowed=False,
                              policy_reason="Prohibido por política o términos de servicio", status="BLOQUEADA"))
    log_decision(db, AGENT_KEY, "evaluacion_automatizacion", {
        "can_automate": a["can_automate"],
        "cannot_automate": a["cannot_automate"],
        "conclusion": f"Automatización {a['level']}%. " + " ".join(a["reasons"]),
    }, opportunity_id=opp.id, agent_run_id=agent_run_id)
    return a
