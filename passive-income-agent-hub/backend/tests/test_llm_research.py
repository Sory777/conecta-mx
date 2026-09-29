"""Flujo del investigador con la API de Claude simulada (sin red)."""
from types import SimpleNamespace as NS

from app.agents import researcher
from app.config import get_settings
from app.db import SessionLocal
from app.models import AgentRun, Opportunity, ResearchResult
from app.services import llm


class FakeMessages:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def create(self, **kw):
        self.calls.append(kw)
        return self.responses.pop(0)


def test_search_parses_results_citations_and_pause_turn(monkeypatch):
    paused = NS(stop_reason="pause_turn", content=[
        NS(type="server_tool_use"),
        NS(type="web_search_tool_result", content=[
            NS(type="web_search_result", url="https://a.example.com", title="A", page_age="2 days")]),
    ])
    done = NS(stop_reason="end_turn", content=[
        NS(type="text", text="A paga por tarea.", citations=[
            NS(url="https://a.example.com", title="A", cited_text="Pagamos 0.10 USD por tarea"),
            NS(url="https://b.example.com", title="B", cited_text="Reseña independiente")]),
    ])
    fake = FakeMessages([paused, done])
    monkeypatch.setattr(llm, "_client", lambda: NS(beta=NS(messages=fake)))
    out = llm.search("microtareas", "microtareas")
    assert {h.url for h in out.hits} == {"https://a.example.com", "https://b.example.com"}
    assert "0.10 USD" in next(h for h in out.hits if h.url == "https://a.example.com").snippet
    assert len(fake.calls) == 2  # reanudó el turno pausado
    first = fake.calls[0]
    assert first["tools"][0]["type"] == "web_search_20260209"
    assert first["model"] == get_settings().anthropic_model
    assert first["fallbacks"] == "default"


def test_researcher_run_end_to_end(client, monkeypatch):
    from app.services import web
    monkeypatch.setattr(web, "available_search_provider", lambda: "anthropic_web_search")
    outcome = web.SearchOutcome(provider="anthropic_web_search", summary="resumen", hits=[
        web.SearchHit(url="https://tareas.example.com", title="Tareas", snippet="Pagamos por tarea", source="anthropic_web_search"),
        web.SearchHit(url="https://estafa.example.com", title="Estafa", snippet="Rentabilidad garantizada", source="anthropic_web_search"),
    ])
    monkeypatch.setattr(llm, "search", lambda q, c=None: outcome)
    extraction = llm.ExtractionResult(candidates=[
        llm.ExtractedCandidate(name="Tareas Example", official_url="https://tareas.example.com", category="microtareas",
                               description="Microtareas de etiquetado", why_found="Acepta México según su FAQ",
                               mexico_available=True, source_urls=["https://tareas.example.com"],
                               data_points=[llm.ExtractedDataPoint(field="gross_per_unit", value=0.1, currency="USD",
                                                                   evidence_type="PROMESA_PLATAFORMA",
                                                                   source_url="https://tareas.example.com")]),
        llm.ExtractedCandidate(name="Estafa Example", official_url="https://estafa.example.com", category="web3",
                               description="Rentabilidad garantizada del 5% diario", why_found="Apareció en la búsqueda",
                               source_urls=["https://estafa.example.com"]),
    ], new_categories=["renta de espacio publicitario en vehículos"])
    monkeypatch.setattr(llm, "extract_candidates", lambda q, o, c: extraction)

    db = SessionLocal()
    run = AgentRun(agent_key="investigador")
    db.add(run)
    db.flush()
    summary = researcher.run(db, run, "microtareas México")
    db.commit()
    assert summary["new"] == 2 and summary["discarded"] == 1
    assert db.query(ResearchResult).count() == 2
    scam = db.query(Opportunity).filter_by(title="Estafa Example").one()
    assert scam.status == "DESCARTADA"
    ok = db.query(Opportunity).filter_by(title="Tareas Example").one()
    assert ok.status == "INVESTIGANDO" and ok.risk_level == "MEDIO"
    db.close()
    alerts = client.get("/api/alerts").json()
    assert any(a["kind"] == "nueva_oportunidad" for a in alerts)
    decisions = client.get("/api/decisions?agent=investigador").json()
    assert any("categorías emergentes" in (d["sections"].get("conclusion", "").lower()) for d in decisions)
