from app.agents import monitor, researcher
from app.db import SessionLocal
from app.models import AgentRun, DataPoint, Opportunity, Platform, Status
from app.services import llm, web


def make_opp(client, title="Plataforma de prueba", category="microtareas", description="Pago por tarea", **platform):
    body = {"title": title, "category": category, "description": description}
    if platform:
        body["platform"] = {"name": title, **platform}
    r = client.post("/api/opportunities", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_auth_required_and_registration_closed(client):
    client.post("/api/auth/logout")
    assert client.get("/api/dashboard").status_code == 401
    r = client.post("/api/auth/register", json={"email": "otro@example.com", "password": "otra-contrasena-123"})
    assert r.status_code == 403
    assert client.post("/api/auth/login", json={"email": "yo@example.com", "password": "mala-contrasena"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "yo@example.com", "password": "contrasena-segura-123"}).status_code == 200
    me = client.get("/api/auth/me").json()
    assert "password_hash" not in me


def test_fraud_opportunity_is_discarded_and_cannot_be_tested(client):
    o = make_opp(client, title="CryptoMax", category="web3",
                 description="Rentabilidad garantizada del 2% diario. Invita a 3 amigos para retirar.")
    assert o["status"] == "DESCARTADA" and o["risk_level"] == "DESCARTAR"
    r = client.patch(f"/api/opportunities/{o['id']}", json={"status": "EN_PRUEBA"})
    assert r.status_code == 409
    detail = client.get(f"/api/opportunities/{o['id']}").json()
    assert any(d["sections"].get("discard_reason") for d in detail["decisions"])
    alerts = client.get("/api/alerts").json()
    assert any(a["kind"] == "sospechosa" for a in alerts)


def test_data_points_drive_metrics_and_filters(client):
    o = make_opp(client, url="https://ejemplo-microtareas.com")
    assert o["metrics_status"] == "DATOS_INSUFICIENTES"
    # dato con evidencia ESTIMACION sin fuente ⇒ rechazado
    r = client.post(f"/api/opportunities/{o['id']}/data-points",
                    json={"field": "gross_per_unit", "value": 0.5, "currency": "USD", "evidence_type": "ESTIMACION"})
    assert r.status_code == 422
    for body in (
        {"field": "gross_per_unit", "value": 0.5, "value_low": 0.3, "value_high": 0.6, "currency": "USD",
         "evidence_type": "PROMESA_PLATAFORMA", "source_url": "https://ejemplo-microtareas.com/pagos"},
        {"field": "units_per_month", "value": 200, "evidence_type": "SUPOSICION"},
        {"field": "minutes_per_unit", "value": 3, "evidence_type": "SUPOSICION"},
        {"field": "initial_investment", "value": 0, "evidence_type": "SUPOSICION"},
    ):
        assert client.post(f"/api/opportunities/{o['id']}/data-points", json=body).status_code == 200
    detail = client.get(f"/api/opportunities/{o['id']}").json()
    base = detail["metrics"]["scenarios"]["base"]
    assert base["gross_mxn"] == 0.5 * 20 * 200  # USD convertido con la tasa (20 en test)
    assert detail["metrics"]["confidence"]["label"] in ("BAJA", "MUY_BAJA")
    ids = {i["id"] for i in client.get("/api/opportunities?no_investment=true").json()}
    assert o["id"] in ids
    assert o["id"] not in {i["id"] for i in client.get("/api/opportunities?max_automation=true").json()}
    assert o["id"] not in {i["id"] for i in client.get("/api/opportunities?low_risk=true").json()}


def test_capital_guard_and_experiment_lifecycle(client):
    o = make_opp(client, url="https://ejemplo-test.com")
    client.post(f"/api/opportunities/{o['id']}/data-points",
                json={"field": "gross_monthly", "value": 3000, "evidence_type": "SUPOSICION"})
    client.post(f"/api/opportunities/{o['id']}/data-points",
                json={"field": "hours_per_month", "value": 30, "evidence_type": "SUPOSICION"})
    # sin capital configurado ⇒ un presupuesto > 0 se bloquea
    r = client.post("/api/experiments", json={"opportunity_id": o["id"], "name": "Prueba", "budget_mxn": 500})
    assert r.status_code == 409 and "disponibles" in r.json()["detail"]
    client.put("/api/settings", json={"capital_limit_mxn": 5000})
    r = client.post("/api/experiments", json={"opportunity_id": o["id"], "name": "Prueba", "budget_mxn": 500,
                                              "duration_days": 7, "target_net_mxn": 100})
    assert r.status_code == 200, r.text
    exp = r.json()
    cap = client.get("/api/settings").json()["capital"]
    assert cap["committed_mxn"] == 500 and cap["available_mxn"] == 4500

    for day, earned, minutes in (("2026-01-01", 60, 90), ("2026-01-02", 40, 60), ("2026-01-03", 50, 60)):
        assert client.post(f"/api/experiments/{exp['id']}/logs",
                           json={"day": day, "minutes_used": minutes, "tasks_completed": 10}).status_code == 200
        assert client.post("/api/transactions/earnings", json={"amount": earned, "occurred_on": day,
                                                               "experiment_id": exp["id"]}).status_code == 200
    client.post("/api/transactions/expenses", json={"amount": 20, "occurred_on": "2026-01-03", "experiment_id": exp["id"],
                                                    "category": "comisiones"})
    assert any(a["kind"] == "objetivo" for a in client.get("/api/alerts").json())

    r = client.post(f"/api/experiments/{exp['id']}/finish")
    res = r.json()
    assert res["status"] == "FINALIZADO"
    assert res["result"]["actual_net_mxn"] == 130
    assert res["recommendation"] == "CONTINUAR"
    assert res["result"]["actual_vs_estimate_ratio"] is not None
    assert any("ningún retiro" in x for x in res["result"]["reasons"])
    detail = client.get(f"/api/opportunities/{o['id']}").json()
    assert detail["opportunity"]["status"] == "ACTIVA"
    assert detail["metrics"]["observed"]["days"] == 3
    assert detail["metrics"]["calibration"]["experiments"] == 1

    dash = client.get("/api/dashboard").json()
    assert dash["income"]["all_time"]["net_mxn"] == 130
    assert dash["capital"]["committed_mxn"] == 0


def test_foreign_currency_transaction_conversion(client):
    r = client.post("/api/transactions/earnings", json={"amount": 10, "currency": "USD"})
    tx = r.json()
    assert tx["amount_mxn"] == 200 and "test" in tx["fx_source"]
    r = client.post("/api/transactions/earnings", json={"amount": 10, "currency": "XYZ"})
    assert r.status_code == 422
    r = client.post("/api/transactions/earnings", json={"amount": 10, "currency": "XYZ", "manual_rate": 2})
    assert r.json()["amount_mxn"] == 20


def test_researcher_rejects_unconsulted_sources(client):
    db = SessionLocal()
    run = AgentRun(agent_key="investigador")
    db.add(run)
    db.flush()
    consulted = {"https://oficial.example.org"}
    good = llm.ExtractedCandidate(
        name="Oficial Example", official_url="https://oficial.example.org", category="microtareas",
        description="d", why_found="w", source_urls=["https://oficial.example.org/"],
        data_points=[
            llm.ExtractedDataPoint(field="gross_monthly", value=100, currency="USD", evidence_type="ESTIMACION",
                                   source_url="https://inventada.example.com"),
            llm.ExtractedDataPoint(field="hours_per_month", value=10, evidence_type="PROMESA_PLATAFORMA",
                                   source_url="https://oficial.example.org"),
        ])
    bad = llm.ExtractedCandidate(name="Fantasma", category="otra", description="d", why_found="w",
                                 source_urls=["https://no-consultada.example.com"])
    opp, what = researcher.ingest_candidate(db, run, "q", good, consulted, {})
    assert what == "nueva" and opp.status == Status.INVESTIGANDO
    evs = {d.field: d.evidence_type for d in db.query(DataPoint).filter_by(opportunity_id=opp.id)}
    assert evs == {"gross_monthly": "NO_VERIFICADA", "hours_per_month": "PROMESA_PLATAFORMA"}
    assert db.get(Platform, opp.platform_id).verification_status == "NO_VERIFICADA"
    none, msg = researcher.ingest_candidate(db, run, "q", bad, consulted, {})
    assert none is None and "ignorado" in msg
    db.rollback()
    db.close()


def test_monitor_detects_tos_change(client):
    o = make_opp(client, title="Nodo DePIN", category="depin", url="https://depin.example.net",
                 tos_url="https://depin.example.net/terms")
    client.patch(f"/api/opportunities/{o['id']}", json={"status": "EN_PRUEBA"})
    db = SessionLocal()
    p = db.get(Platform, db.get(Opportunity, o["id"]).platform_id)
    pages = iter([("Términos\nPagos mensuales", 200), ("Términos\nPagos mensuales\nQueda prohibido el uso de bots", 200)])
    assert monitor.check_platform(db, p, fetch=lambda url: next(pages)) is None  # línea base
    ch = monitor.check_platform(db, p, fetch=lambda url: next(pages))
    assert ch is not None and "automatizacion" in ch.change_type
    db.commit()
    assert db.get(Opportunity, o["id"]).status == Status.REQUIERE_ACCION
    db.close()


def test_agents_listed_and_search_requires_provider(client):
    data = client.get("/api/agents").json()
    keys = {a["key"] for a in data["agents"]}
    assert {"investigador", "antifraude", "rentabilidad", "monitor", "depin", "encuestas"} <= keys
    assert data["search_provider"] is None
    assert client.post("/api/agents/investigador/run", json={"query": "x"}).status_code == 409
    assert web.available_search_provider() is None
