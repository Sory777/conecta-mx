from app.agents.profitability import Input, compute_observed, compute_priority, compute_scenarios
from app.models import Evidence


def inp(field, mid, low=None, high=None, ev=Evidence.ESTIMACION):
    return Input(field=field, low=low if low is not None else mid, mid=mid, high=high if high is not None else mid, evidence=ev)


def test_insufficient_without_revenue():
    m = compute_scenarios({"hours_per_month": inp("hours_per_month", 10)})
    assert m["status"] == "DATOS_INSUFICIENTES"
    assert "ingreso" in m["missing"][0]


def test_per_unit_revenue_fees_and_hours():
    m = compute_scenarios({
        "gross_per_unit": inp("gross_per_unit", 10, 8, 12),
        "units_per_month": inp("units_per_month", 100),
        "minutes_per_unit": inp("minutes_per_unit", 6),
        "fee_pct": inp("fee_pct", 10),
    })
    base = m["scenarios"]["base"]
    assert base["gross_mxn"] == 1000
    assert base["costs"]["comisiones"] == 100
    assert base["net_mxn"] == 900
    assert base["hours"] == 10
    assert base["net_per_hour_mxn"] == 90
    assert m["scenarios"]["pesimista"]["net_mxn"] == 720  # 800 - 80
    # las horas del escenario usan las mismas tareas que su ingreso
    assert m["scenarios"]["pesimista"]["hours"] == 10
    assert base["roi_12m_pct"] is None  # sin inversión el ROI no aplica


def test_hours_follow_units_of_the_scenario():
    m = compute_scenarios({
        "gross_per_unit": inp("gross_per_unit", 1),
        "units_per_month": inp("units_per_month", 300, 100, 400),
        "minutes_per_unit": inp("minutes_per_unit", 4, 3, 6),
    })
    assert m["scenarios"]["pesimista"]["hours"] == 10   # 100 tareas × 6 min
    assert m["scenarios"]["optimista"]["hours"] == 20   # 400 tareas × 3 min


def test_electricity_requires_tariff_never_assumed():
    m = compute_scenarios({"gross_monthly": inp("gross_monthly", 500), "power_watts": inp("power_watts", 300),
                           "hours_on_per_day": inp("hours_on_per_day", 24)})
    assert m["status"] == "DATOS_INSUFICIENTES"
    assert any("electricidad" in x for x in m["missing"])


def test_mining_style_costs_roi_and_payback():
    m = compute_scenarios({
        "gross_monthly": inp("gross_monthly", 1000),
        "power_watts": inp("power_watts", 250), "hours_on_per_day": inp("hours_on_per_day", 24),
        "electricity_price_kwh": inp("electricity_price_kwh", 3.0, ev=Evidence.SUPOSICION),
        "hardware_value": inp("hardware_value", 12000), "hardware_life_months": inp("hardware_life_months", 24),
        "initial_investment": inp("initial_investment", 12000),
    })
    base = m["scenarios"]["base"]
    # 0.25 kW × 24 h × 30.4 d = 182.4 kWh × 3 = 547.2
    assert base["costs"]["electricidad"] == 547.2
    assert base["costs"]["depreciacion"] == 500
    assert base["net_mxn"] == round(1000 - 547.2 - 500, 2)
    assert base["net_mxn"] < 0 and base["payback_months"] is None  # nunca recupera con estos datos


def test_platform_promise_gives_low_confidence():
    m = compute_scenarios({"gross_monthly": inp("gross_monthly", 5000, ev=Evidence.PROMESA_PLATAFORMA)})
    assert m["confidence"]["label"] in ("BAJA", "MUY_BAJA")
    assert any("PROMETE" in r for r in m["confidence"]["reasons"])


def test_observed_narrative_and_interval():
    obs = compute_observed({"2026-01-01": {"net": 50, "minutes": 60, "tasks": 10},
                            "2026-01-02": {"net": 70, "minutes": 60, "tasks": 12}})
    assert obs["days"] == 2 and obs["tasks"] == 22
    assert obs["net_per_hour_mxn"] == 60
    assert obs["monthly_interval_mxn"] is not None
    assert "Durante 2 día(s)" in obs["narrative"] and "NO está garantizado" in obs["narrative"]


def test_priority_formula_uses_pessimistic_and_risk():
    m = compute_scenarios({"gross_monthly": inp("gross_monthly", 1000, 500, 1500), "hours_per_month": inp("hours_per_month", 10)})
    p_low = compute_priority(m, "BAJO")["value"]
    p_high = compute_priority(m, "ALTO")["value"]
    assert p_low > p_high > 0
    assert compute_priority(m, "DESCARTAR")["value"] == 0
