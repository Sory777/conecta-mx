"""Catálogo de agentes. Los agentes especializados son, en Fase 1, perfiles del Agente Investigador:
misma maquinaria de búsqueda con fuentes + extracción + antifraude, pero con consultas y categoría propias.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Agent

AGENTS = [
    # key, nombre, descripción, fase, categoría, consultas predefinidas
    ("investigador", "Investigador de oportunidades",
     "Busca en la web oportunidades legítimas en cualquier categoría, incluidas categorías nuevas.", 1, None,
     ["nuevas formas legítimas de ingresos complementarios disponibles en México"]),
    ("antifraude", "Antifraude",
     "Revisa señales de fraude (garantías, pirámides, depósitos, dominios recientes) y asigna riesgo.", 1, None, []),
    ("rentabilidad", "Rentabilidad",
     "Calcula ingreso neto, neto por hora, ROI y recuperación en 3 escenarios con nivel de confianza.", 1, None, []),
    ("automatizacion", "Automatización (evaluación)",
     "Determina qué % puede automatizarse respetando términos de servicio. En Fase 1 no ejecuta nada.", 1, None, []),
    ("monitor", "Investigación continua (monitor)",
     "Revisa periódicamente las páginas de términos/oficiales y detecta cambios de condiciones.", 1, None, []),
    ("microtareas", "Microtareas",
     "Plataformas de etiquetado, transcripción, evaluación de buscadores y entrenamiento de IA.", 1, "microtareas",
     ["plataformas de microtareas y etiquetado de datos para IA que acepten trabajadores de México: pago, mínimo de retiro y términos"]),
    ("encuestas", "Encuestas",
     "Plataformas de encuestas remuneradas: disponibilidad en México, pago por hora y reputación.", 1, "encuestas",
     ["plataformas de encuestas remuneradas disponibles en México: pago promedio, mínimo de retiro y métodos de pago"]),
    ("mineria", "Minería y computación",
     "Minería, renta de GPU/CPU y almacenamiento. Nunca asume rentabilidad: exige consumo y tarifa eléctrica.", 1, "mineria",
     ["renta de GPU o CPU ociosa para computación distribuida: plataformas, pagos y requisitos de hardware"]),
    ("depin", "DePIN",
     "Proyectos de infraestructura física descentralizada: token, liquidez, costo de entrada y retiros.", 1, "depin",
     ["proyectos DePIN activos: recompensas actuales, token, costo del hardware y cómo se retiran recompensas"]),
    ("afiliados", "Afiliados",
     "Programas de afiliados legítimos (software, IA, hosting, educación): comisión, cookie y requisitos.", 1, "afiliados",
     ["programas de afiliados de software e IA que acepten afiliados de México: comisión, duración de cookie y pagos"]),
    ("productos_digitales", "Productos digitales",
     "Plantillas, guías, prompts, micro-SaaS: demanda, competencia, precio y margen antes de crear.", 1, "productos_digitales",
     ["marketplaces para vender plantillas y productos digitales: comisiones, demanda y requisitos para vendedores en México"]),
    ("ia", "Oportunidades con IA",
     "Servicios y sistemas con IA que puedan operar con poca intervención humana, sin spam.", 1, "automatizacion_ia",
     ["servicios de automatización con IA para pequeños negocios con demanda comprobable"]),
]


def agent_defs() -> dict[str, dict]:
    return {k: {"key": k, "name": n, "description": d, "phase": ph, "category": cat, "preset_queries": q}
            for k, n, d, ph, cat, q in AGENTS}


RESEARCH_AGENTS = {k for k, *_rest, q in AGENTS if q}


def sync_agents(db: Session) -> None:
    for key, name, desc, phase, _cat, _q in AGENTS:
        a = db.scalar(select(Agent).where(Agent.key == key))
        if a is None:
            db.add(Agent(key=key, name=name, description=desc, phase=phase))
        else:
            a.name, a.description, a.phase = name, desc, phase
    db.commit()
