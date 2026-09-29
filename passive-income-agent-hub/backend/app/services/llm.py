"""Integración con Claude (SDK oficial `anthropic`).

Dos usos, ambos opcionales (sin ANTHROPIC_API_KEY la app funciona sin IA):
1. search(): búsqueda web actual con la herramienta de servidor web_search de la API de Claude.
2. extract_candidates() / review_fraud_signals(): salida estructurada validada con Pydantic.

Reglas anti-alucinación que se aplican DESPUÉS de la respuesta del modelo (ver agentes):
- un dato cuya source_url no está entre las URLs realmente consultadas se degrada a NO_VERIFICADA;
- una señal de fraude cuya cita textual no aparece en el texto fuente se descarta.
"""
import logging
from typing import Literal, Optional

import anthropic
from pydantic import BaseModel, Field

from ..config import get_settings
from .web import SearchHit, SearchOutcome

log = logging.getLogger("hub.llm")

WEB_SEARCH_TOOL = {"type": "web_search_20260209", "name": "web_search", "max_uses": 8}

DATA_FIELDS = Literal[
    "initial_investment", "monthly_fixed_cost", "fee_pct", "gross_monthly", "gross_per_unit",
    "units_per_month", "minutes_per_unit", "hours_per_month", "power_watts", "hours_on_per_day",
    "hardware_value", "hardware_life_months", "maintenance_monthly", "reward_token_price_volatility_pct",
]
EVIDENCE = Literal["ESTIMACION", "PROMESA_PLATAFORMA", "NO_VERIFICADA"]


class LLMUnavailable(Exception):
    pass


def _client() -> anthropic.Anthropic:
    key = get_settings().anthropic_api_key
    if not key:
        raise LLMUnavailable("ANTHROPIC_API_KEY no configurada")
    return anthropic.Anthropic(api_key=key)


SEARCH_SYSTEM = (
    "Eres el Agente Investigador de un sistema escéptico que busca formas LEGÍTIMAS de generar ingresos "
    "complementarios desde México. Usa la búsqueda web para encontrar fuentes actuales: prioriza páginas "
    "oficiales, términos de servicio, documentación oficial, APIs oficiales y fuentes independientes "
    "reconocidas. Resume solo lo que dicen las fuentes, citándolas. Distingue siempre entre lo que la "
    "plataforma promete de sí misma y lo que reportan terceros. Nunca inventes plataformas, cifras ni APIs; "
    "si algo no aparece en las fuentes dilo explícitamente. Señala cualquier indicio de fraude, esquema "
    "piramidal, depósitos obligatorios, o términos que prohíban bots o automatización."
)


def search(query: str, category: Optional[str] = None) -> SearchOutcome:
    s = get_settings()
    client = _client()
    prompt = f"Investiga: {query}"
    if category:
        prompt += f"\nCategoría de interés: {category}"
    prompt += ("\nPara cada plataforma u oportunidad encontrada indica: nombre, URL oficial, disponibilidad en "
               "México, métodos y mínimo de pago, requisitos, costos, cifras de ingreso con su fuente, si los "
               "términos prohíben automatización y riesgos o señales de alerta.")
    messages: list = [{"role": "user", "content": prompt}]
    hits: dict[str, SearchHit] = {}
    texts: list[str] = []
    for _ in range(4):  # reanuda turnos pausados (pause_turn) como máximo 3 veces
        resp = client.beta.messages.create(
            model=s.anthropic_model,
            max_tokens=16000,
            system=SEARCH_SYSTEM,
            tools=[WEB_SEARCH_TOOL],
            messages=messages,
            output_config={"effort": "medium"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if resp.stop_reason == "refusal":
            raise LLMUnavailable("El modelo declinó la solicitud de búsqueda.")
        for block in resp.content:
            if block.type == "web_search_tool_result" and isinstance(block.content, list):
                for r in block.content:
                    if getattr(r, "type", "") == "web_search_result":
                        hits.setdefault(r.url, SearchHit(url=r.url, title=r.title or "", page_age=getattr(r, "page_age", None),
                                                         source="anthropic_web_search"))
            elif block.type == "text":
                texts.append(block.text)
                for c in getattr(block, "citations", None) or []:
                    url = getattr(c, "url", None)
                    if url:
                        h = hits.setdefault(url, SearchHit(url=url, title=getattr(c, "title", "") or "",
                                                           source="anthropic_web_search"))
                        cited = getattr(c, "cited_text", "") or ""
                        if cited and cited not in h.snippet:
                            h.snippet = (h.snippet + "\n" + cited).strip()[:4000]
        if resp.stop_reason != "pause_turn":
            break
        messages.append({"role": "assistant", "content": resp.content})
    return SearchOutcome(provider="anthropic_web_search", hits=list(hits.values()), summary="\n".join(texts))


# ------------------------------------------------------------------ extracción estructurada
class ExtractedDataPoint(BaseModel):
    field: DATA_FIELDS
    value: float
    value_low: Optional[float] = None
    value_high: Optional[float] = None
    currency: Optional[str] = Field(None, description="MXN, USD, EUR, BTC... o null si no es monetario")
    evidence_type: EVIDENCE = Field(description="PROMESA_PLATAFORMA si lo dice la propia plataforma; "
                                                "ESTIMACION si viene de un tercero con fuente; NO_VERIFICADA si no hay fuente")
    source_url: Optional[str] = None
    quote: Optional[str] = Field(None, description="Fragmento textual de la fuente que respalda el dato")


class ExtractedCandidate(BaseModel):
    name: str
    official_url: Optional[str] = None
    category: str
    description: str
    why_found: str = Field(description="Por qué esta oportunidad es relevante para la búsqueda")
    countries: Optional[str] = None
    mexico_available: Optional[bool] = Field(None, description="null si las fuentes no lo confirman")
    payment_methods: Optional[str] = None
    min_payout: Optional[float] = None
    min_payout_currency: Optional[str] = None
    requirements: Optional[str] = None
    tos_url: Optional[str] = None
    tos_prohibits_automation: Optional[bool] = Field(None, description="null si no se encontró en los términos")
    has_official_api: Optional[bool] = None
    api_docs_url: Optional[str] = None
    data_points: list[ExtractedDataPoint] = Field(default_factory=list)
    risk_notes: list[str] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)


class ExtractionResult(BaseModel):
    candidates: list[ExtractedCandidate]
    new_categories: list[str] = Field(default_factory=list, description="Categorías de ingreso no listadas que aparecieron")
    caveats: str = ""


EXTRACT_SYSTEM = (
    "Conviertes resultados de investigación en registros estructurados. Reglas estrictas: "
    "1) Solo incluye plataformas/oportunidades que aparecen en el material proporcionado. "
    "2) Cada cifra debe llevar source_url tomada de la lista de fuentes y, si es posible, una cita textual. "
    "3) Si una cifra la afirma la plataforma sobre sí misma es PROMESA_PLATAFORMA; si la reporta un tercero es "
    "ESTIMACION; si no tiene fuente clara es NO_VERIFICADA. 4) Deja en null lo que no esté en las fuentes; "
    "no rellenes con conocimiento previo. 5) fee_pct es porcentaje 0-100. 6) Excluye esquemas que prometan "
    "rentabilidad garantizada solo si son claramente fraudulentos; de lo contrario inclúyelos con risk_notes."
)


def extract_candidates(query: str, outcome: SearchOutcome, categories: list[str]) -> ExtractionResult:
    s = get_settings()
    client = _client()
    sources = "\n".join(f"- {h.url} | {h.title} | {h.snippet[:800]}" for h in outcome.hits)
    content = (f"Consulta: {query}\nCategorías válidas: {', '.join(categories)}\n\n"
               f"FUENTES CONSULTADAS:\n{sources}\n\nRESUMEN DE LA INVESTIGACIÓN:\n{outcome.summary[:30000]}")
    resp = client.messages.parse(
        model=s.anthropic_model,
        max_tokens=16000,
        system=EXTRACT_SYSTEM,
        messages=[{"role": "user", "content": content}],
        output_config={"effort": "medium"},
        output_format=ExtractionResult,
    )
    if resp.stop_reason == "refusal" or resp.parsed_output is None:
        raise LLMUnavailable("No se obtuvo una extracción estructurada válida.")
    return resp.parsed_output


class FraudSignal(BaseModel):
    code: str
    severity: Literal["MEDIO", "ALTO", "CRITICO"]
    detail: str
    quote: str = Field(description="Cita TEXTUAL exacta del material que demuestra la señal")


class FraudReview(BaseModel):
    signals: list[FraudSignal]


FRAUD_SYSTEM = (
    "Eres un analista antifraude escéptico. Revisa el material y enumera SOLO señales de fraude presentes: "
    "rentabilidad garantizada, esquemas piramidales/ponzi, depósitos obligatorios para retirar, necesidad de "
    "reclutar, retiros imposibles, solicitud de datos innecesarios (contraseñas, frases semilla), condiciones "
    "abusivas, reseñas falsas, software sospechoso. Cada señal DEBE incluir una cita textual exacta del material. "
    "Si no hay señales devuelve una lista vacía. No especules."
)


def review_fraud_signals(text: str) -> FraudReview:
    s = get_settings()
    client = _client()
    resp = client.messages.parse(
        model=s.anthropic_model,
        max_tokens=8000,
        system=FRAUD_SYSTEM,
        messages=[{"role": "user", "content": text[:40000]}],
        output_config={"effort": "low"},
        output_format=FraudReview,
    )
    if resp.parsed_output is None:
        return FraudReview(signals=[])
    return resp.parsed_output
