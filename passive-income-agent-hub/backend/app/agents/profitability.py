"""AGENTE DE RENTABILIDAD.

Calcula métricas a partir de datos con procedencia (data_points) y de resultados observados
(experimentos y transacciones). No produce una "puntuación" arbitraria: cada número sale de una
fórmula visible, en tres escenarios (pesimista / base / optimista), con nivel de confianza derivado
del tipo de evidencia de cada dato. Si faltan datos de ingreso, NO calcula: devuelve DATOS_INSUFICIENTES.
"""
import math
import statistics
from collections import defaultdict
from dataclasses import dataclass
from typing import Callable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (DataPoint, Evidence, Expense, Experiment, ExperimentLog, Opportunity, Risk, Transaction,
                      utcnow)
from ..services.records import create_alert, log_decision

AGENT_KEY = "rentabilidad"
DAYS_PER_MONTH = 30.4

# campo -> (etiqueta, unidad, es_monetario)
FIELD_DEFS: dict[str, tuple[str, str, bool]] = {
    "initial_investment": ("Inversión inicial", "moneda", True),
    "monthly_fixed_cost": ("Costo fijo mensual (suscripciones, internet, etc.)", "moneda/mes", True),
    "fee_pct": ("Comisión de la plataforma", "% del ingreso bruto", False),
    "gross_monthly": ("Ingreso bruto mensual", "moneda/mes", True),
    "gross_per_unit": ("Pago por tarea/unidad", "moneda", True),
    "units_per_month": ("Tareas/unidades por mes", "unidades/mes", False),
    "minutes_per_unit": ("Minutos por tarea", "min", False),
    "hours_per_month": ("Horas de trabajo al mes", "h/mes", False),
    "power_watts": ("Consumo eléctrico del equipo", "W", False),
    "hours_on_per_day": ("Horas encendido por día", "h/día", False),
    "electricity_price_kwh": ("Tarifa eléctrica", "moneda/kWh", True),
    "hardware_value": ("Valor del hardware (para depreciación)", "moneda", True),
    "hardware_life_months": ("Vida útil del hardware", "meses", False),
    "maintenance_monthly": ("Mantenimiento mensual", "moneda/mes", True),
    "reward_token_price_volatility_pct": ("Volatilidad del token de recompensa", "% (+/-)", False),
}

EVIDENCE_WEIGHT = {
    Evidence.OBSERVADO: 1.0,
    Evidence.ESTIMACION: 0.6,
    Evidence.SUPOSICION: 0.3,
    Evidence.PROMESA_PLATAFORMA: 0.15,
    Evidence.NO_VERIFICADA: 0.0,
}
RISK_FACTOR = {Risk.BAJO: 1.0, Risk.MEDIO: 0.6, Risk.ALTO: 0.25, Risk.DESCARTAR: 0.0, None: 0.5}
SUPERVISION_HOURS_ASSUMPTION = 1.0  # toda oportunidad requiere supervisión mínima (SUPOSICIÓN explícita)


@dataclass
class Input:
    field: str
    low: float
    mid: float
    high: float
    evidence: str
    source_url: Optional[str] = None
    original: Optional[str] = None  # descripción del valor original y su moneda


def _fmt(x: Optional[float]) -> str:
    return "—" if x is None else f"${x:,.2f}"


def confidence_label(score: float) -> str:
    if score >= 0.8:
        return "ALTA"
    if score >= 0.5:
        return "MEDIA"
    if score >= 0.25:
        return "BAJA"
    return "MUY_BAJA"


def compute_scenarios(inputs: dict[str, Input]) -> dict:
    """Cálculo puro (sin BD). Todos los montos ya están en MXN."""
    missing, assumptions = [], []
    g = inputs.get

    # ---- ingreso bruto
    if g("gross_monthly"):
        gm = g("gross_monthly")
        gross = {"low": gm.low, "mid": gm.mid, "high": gm.high}
        revenue_inputs = [gm]
        gross_formula = "ingreso bruto mensual (dato directo)"
    elif g("gross_per_unit") and g("units_per_month"):
        pu, un = g("gross_per_unit"), g("units_per_month")
        gross = {"low": pu.low * un.low, "mid": pu.mid * un.mid, "high": pu.high * un.high}
        revenue_inputs = [pu, un]
        gross_formula = "pago por tarea × tareas por mes"
    else:
        missing.append("ingreso: se necesita 'gross_monthly' o bien 'gross_per_unit' + 'units_per_month'")
        return {"status": "DATOS_INSUFICIENTES", "missing": missing}

    if g("reward_token_price_volatility_pct"):
        v = g("reward_token_price_volatility_pct").mid / 100
        gross["low"] *= max(1 - v, 0)
        gross["high"] *= 1 + v
        assumptions.append(f"Rango de ingreso ampliado ±{v*100:.0f}% por volatilidad del token.")

    # ---- horas
    if g("hours_per_month"):
        h = g("hours_per_month")
        hours = {"low": h.low, "mid": h.mid, "high": h.high}
        time_inputs = [h]
    elif g("minutes_per_unit") and g("units_per_month"):
        m, un = g("minutes_per_unit"), g("units_per_month")
        # las horas se calculan por escenario con las MISMAS tareas que generan el ingreso (ver bucle)
        hours = {"low": m.low * un.mid / 60, "mid": m.mid * un.mid / 60, "high": m.high * un.mid / 60}
        time_inputs = [m, un]
    else:
        hours = {k: SUPERVISION_HOURS_ASSUMPTION for k in ("low", "mid", "high")}
        time_inputs = []
        assumptions.append(f"Sin datos de tiempo: se SUPONE {SUPERVISION_HOURS_ASSUMPTION} h/mes de supervisión.")
    hours = {k: max(v, SUPERVISION_HOURS_ASSUMPTION) for k, v in hours.items()}

    # ---- costos (pesimista = costos altos)
    def val(field: str, which: str) -> float:
        i = g(field)
        return getattr(i, which) if i else 0.0

    electricity_ok = True
    if g("power_watts") or g("hours_on_per_day"):
        if not (g("power_watts") and g("hours_on_per_day") and g("electricity_price_kwh")):
            electricity_ok = False
            missing.append("electricidad: se necesita consumo (W), horas encendido por día y tarifa por kWh")

    if g("hardware_value") and not g("hardware_life_months"):
        missing.append("depreciación: falta la vida útil del hardware (hardware_life_months)")

    if missing:
        return {"status": "DATOS_INSUFICIENTES", "missing": missing}

    scenarios = {}
    for name, rev_k, cost_k, hours_k in (("pesimista", "low", "high", "high"), ("base", "mid", "mid", "mid"),
                                         ("optimista", "high", "low", "low")):
        gross_v = gross[rev_k]
        fee_pct = val("fee_pct", cost_k)
        fees = gross_v * fee_pct / 100
        electricity = 0.0
        if g("power_watts") and electricity_ok:
            kwh = val("power_watts", cost_k) / 1000 * val("hours_on_per_day", cost_k) * DAYS_PER_MONTH
            electricity = kwh * val("electricity_price_kwh", cost_k)
        depreciation = 0.0
        if g("hardware_value"):
            # costos altos ⇒ vida útil corta
            life_k = {"high": "low", "low": "high"}.get(cost_k, "mid")
            depreciation = val("hardware_value", cost_k) / max(val("hardware_life_months", life_k), 1)
        maintenance = val("maintenance_monthly", cost_k)
        fixed = val("monthly_fixed_cost", cost_k)
        total_costs = fees + electricity + depreciation + maintenance + fixed
        net = gross_v - total_costs
        hrs = hours[hours_k]
        if not g("hours_per_month") and g("minutes_per_unit") and g("units_per_month"):
            hrs = max(getattr(g("minutes_per_unit"), hours_k) * getattr(g("units_per_month"), rev_k) / 60,
                      SUPERVISION_HOURS_ASSUMPTION)
        investment = val("initial_investment", cost_k)
        roi = ((net * 12 - investment) / investment) if investment > 0 else None
        payback = (investment / net) if investment > 0 and net > 0 else None
        scenarios[name] = {
            "gross_mxn": round(gross_v, 2),
            "costs": {"comisiones": round(fees, 2), "electricidad": round(electricity, 2),
                      "depreciacion": round(depreciation, 2), "mantenimiento": round(maintenance, 2),
                      "costos_fijos": round(fixed, 2)},
            "total_costs_mxn": round(total_costs, 2),
            "net_mxn": round(net, 2),
            "hours": round(hrs, 2),
            "net_per_hour_mxn": round(net / hrs, 2),
            "initial_investment_mxn": round(investment, 2),
            "roi_12m_pct": None if roi is None else round(roi * 100, 1),
            "payback_months": None if payback is None else round(payback, 1),
        }

    rev_w = min(EVIDENCE_WEIGHT[i.evidence] for i in revenue_inputs)
    others = [i for f, i in inputs.items() if i not in revenue_inputs]
    other_w = statistics.mean(EVIDENCE_WEIGHT[i.evidence] for i in others) if others else rev_w
    score = rev_w * 0.7 + other_w * 0.3
    if not time_inputs:
        score *= 0.9
    reasons = [f"Ingreso basado en: {', '.join(f'{i.field}={i.evidence}' for i in revenue_inputs)} (peso {rev_w:.2f})."]
    if any(i.evidence == Evidence.PROMESA_PLATAFORMA for i in revenue_inputs):
        reasons.append("El ingreso proviene de lo que la plataforma PROMETE; no es un dato independiente.")
    if any(i.evidence == Evidence.NO_VERIFICADA for i in revenue_inputs):
        reasons.append("Hay datos de ingreso NO VERIFICADOS: la estimación no es confiable.")

    return {
        "status": "OK",
        "gross_formula": gross_formula,
        "scenarios": scenarios,
        "confidence": {"score": round(score, 2), "label": confidence_label(score), "reasons": reasons},
        "assumptions": assumptions,
        "formulas": {
            "ingreso_neto_mensual": "bruto − comisiones − electricidad − depreciación − mantenimiento − costos fijos",
            "electricidad": "W / 1000 × horas/día × 30.4 × tarifa kWh",
            "depreciacion": "valor del hardware / vida útil (meses)",
            "ingreso_neto_por_hora": "neto mensual / horas reales al mes (mínimo 1 h de supervisión)",
            "roi_12m": "(neto × 12 − inversión) / inversión",
            "recuperacion": "inversión / neto mensual",
        },
    }


def compute_observed(daily: dict[str, dict]) -> Optional[dict]:
    """daily: {fecha: {net, minutes, tasks}} de experimentos/transacciones reales."""
    if not daily:
        return None
    days = sorted(daily)
    nets = [daily[d]["net"] for d in days]
    minutes = sum(daily[d]["minutes"] for d in days)
    tasks = sum(daily[d]["tasks"] for d in days)
    total_net = sum(nets)
    n = len(days)
    mean = total_net / n
    monthly = mean * DAYS_PER_MONTH
    interval = None
    if n >= 2:
        sd = statistics.stdev(nets)
        half = 1.96 * sd / math.sqrt(n) * DAYS_PER_MONTH
        interval = [round(monthly - half, 2), round(monthly + half, 2)]
    hours = minutes / 60
    per_task = total_net / tasks if tasks else None
    min_per_task = minutes / tasks if tasks else None
    txt = f"Durante {n} día(s) con registro (del {days[0]} al {days[-1]}) se observaron "
    txt += f"{tasks} tareas, " if tasks else ""
    txt += f"un ingreso neto total de {_fmt(total_net)} MXN y {hours:.1f} h de trabajo. "
    if per_task is not None:
        txt += f"Promedio {_fmt(per_task)} MXN por tarea y {min_per_task:.1f} min por tarea. "
    txt += f"Extrapolando el promedio diario, la estimación mensual es {_fmt(monthly)} MXN"
    if interval:
        txt += (f", con un intervalo aproximado de {_fmt(interval[0])} a {_fmt(interval[1])} MXN "
                f"(aprox. normal, poco fiable con menos de ~14 días)")
    else:
        txt += "; con un solo día no es posible estimar la variabilidad"
    txt += ". Supone que la disponibilidad de tareas y pagos se mantiene igual, lo cual NO está garantizado."
    return {
        "days": n, "first_day": days[0], "last_day": days[-1], "tasks": tasks,
        "total_net_mxn": round(total_net, 2), "hours": round(hours, 2),
        "net_per_hour_mxn": round(total_net / hours, 2) if hours > 0 else None,
        "avg_per_task_mxn": None if per_task is None else round(per_task, 2),
        "minutes_per_task": None if min_per_task is None else round(min_per_task, 1),
        "monthly_projection_mxn": round(monthly, 2), "monthly_interval_mxn": interval,
        "narrative": txt,
    }


def compute_priority(metrics: dict, risk_level: Optional[str]) -> dict:
    rf = RISK_FACTOR.get(risk_level, 0.5)
    obs = metrics.get("observed")
    if obs and obs["days"] >= 3 and obs.get("net_per_hour_mxn") is not None:
        rate = obs["net_per_hour_mxn"]
        conf = min(1.0, obs["days"] / 7)
        basis = f"observado ({obs['days']} días; factor de muestra {conf:.2f})"
    elif metrics.get("status") == "OK":
        sc = metrics.get("calibrated_scenarios") or metrics["scenarios"]
        rate = sc["pesimista"]["net_per_hour_mxn"]
        conf = metrics["confidence"]["score"]
        basis = "estimación pesimista" + (" calibrada con historial" if metrics.get("calibrated_scenarios") else "")
    else:
        return {"value": 0.0, "formula": "sin datos suficientes", "explanation": "No se puede priorizar sin datos de ingreso."}
    value = rate * conf * rf
    return {
        "value": round(value, 2),
        "formula": "ingreso neto por hora (MXN/h) × confianza × factor de riesgo",
        "explanation": f"{rate:,.2f} MXN/h ({basis}) × {conf:.2f} confianza × {rf:.2f} riesgo ({risk_level or 'sin evaluar'})",
    }


# ------------------------------------------------------------------ acceso a BD
Converter = Callable[[float, str], float]


def load_inputs(db: Session, opp: Opportunity, convert: Converter) -> tuple[dict[str, Input], list[str]]:
    """El dato más reciente por campo gana. Los montos se convierten a MXN con tasas actuales."""
    latest: dict[str, DataPoint] = {}
    for dp in db.scalars(select(DataPoint).where(DataPoint.opportunity_id == opp.id).order_by(DataPoint.created_at)):
        latest[dp.field] = dp
    inputs, warnings = {}, []
    for f, dp in latest.items():
        if f not in FIELD_DEFS:
            continue
        monetary = FIELD_DEFS[f][2]
        vals = [dp.value_low if dp.value_low is not None else dp.value, dp.value,
                dp.value_high if dp.value_high is not None else dp.value]
        original = None
        if monetary and dp.currency and dp.currency.upper() != "MXN":
            try:
                rate = convert(1.0, dp.currency)
            except Exception as e:  # noqa: BLE001 - tasa no disponible
                warnings.append(f"No se pudo convertir {f} desde {dp.currency}: {e}")
                continue
            original = f"{dp.value:g} {dp.currency} (tasa {rate:,.4f})"
            vals = [v * rate for v in vals]
        inputs[f] = Input(field=f, low=min(vals), mid=vals[1], high=max(vals), evidence=dp.evidence_type,
                          source_url=dp.source_url, original=original)
    return inputs, warnings


def load_observed(db: Session, opp: Opportunity) -> Optional[dict]:
    daily: dict[str, dict] = defaultdict(lambda: {"net": 0.0, "minutes": 0.0, "tasks": 0})
    txs = db.scalars(select(Transaction).where(Transaction.opportunity_id == opp.id))
    for t in txs:
        if t.kind == "ingreso":
            daily[t.occurred_on]["net"] += t.amount_mxn
        elif t.kind == "gasto":
            exp = db.scalar(select(Expense).where(Expense.transaction_id == t.id))
            if exp and not exp.is_investment:
                daily[t.occurred_on]["net"] -= t.amount_mxn
    logs = db.scalars(select(ExperimentLog).join(Experiment).where(Experiment.opportunity_id == opp.id))
    for lg in logs:
        daily[lg.day]["minutes"] += lg.minutes_used or 0
        daily[lg.day]["tasks"] += lg.tasks_completed or 0
    return compute_observed(dict(daily))


def load_calibration(db: Session, category: str) -> Optional[dict]:
    """Aprendizaje histórico: cuánto se desviaron las estimaciones de la realidad en esta categoría."""
    ratios = []
    for exp in db.scalars(select(Experiment).join(Opportunity).where(Opportunity.category == category,
                                                                      Experiment.status == "FINALIZADO")):
        r = (exp.result or {}).get("actual_vs_estimate_ratio")
        if r is not None:
            ratios.append(max(min(r, 3.0), -3.0))
    if not ratios:
        return None
    ratio = statistics.mean(ratios)
    return {"category": category, "experiments": len(ratios), "ratio": round(ratio, 2),
            "explanation": (f"En {len(ratios)} experimento(s) finalizados de '{category}', el resultado real fue en "
                            f"promedio {ratio:.2f}× lo estimado. Se aplica como factor de calibración.")}


def run(db: Session, opp: Opportunity, convert: Converter, agent_run_id: Optional[int] = None,
        alert: bool = True, force_log: bool = False) -> dict:
    db.flush()  # la sesión no hace autoflush: los cambios pendientes deben verse en las consultas
    inputs, warnings = load_inputs(db, opp, convert)
    metrics = compute_scenarios(inputs)
    metrics["warnings"] = warnings
    metrics["inputs"] = [
        {"field": i.field, "label": FIELD_DEFS[i.field][0], "unit": FIELD_DEFS[i.field][1],
         "low_mxn": round(i.low, 4), "mid_mxn": round(i.mid, 4), "high_mxn": round(i.high, 4),
         "evidence_type": i.evidence, "source_url": i.source_url, "original": i.original}
        for i in inputs.values()
    ]
    calibration = load_calibration(db, opp.category)
    metrics["calibration"] = calibration
    if calibration and metrics["status"] == "OK":
        cal = {}
        for name, sc in metrics["scenarios"].items():
            net = sc["net_mxn"] * calibration["ratio"]
            cal[name] = {**sc, "net_mxn": round(net, 2), "net_per_hour_mxn": round(net / sc["hours"], 2)}
        metrics["calibrated_scenarios"] = cal
    metrics["observed"] = load_observed(db, opp)
    metrics["priority"] = compute_priority(metrics, opp.risk_level)
    metrics["computed_at"] = utcnow().isoformat()
    metrics["narrative"] = _narrative(metrics)

    previous = opp.metrics or {}
    prev_net = (previous.get("scenarios") or {}).get("base", {}).get("net_mxn")
    new_net = (metrics.get("scenarios") or {}).get("base", {}).get("net_mxn")
    if metrics["observed"] and metrics["observed"]["days"] >= 3:
        prev_net = (previous.get("observed") or {}).get("monthly_projection_mxn", prev_net)
        new_net = metrics["observed"]["monthly_projection_mxn"]

    opp.metrics = metrics
    opp.priority = metrics["priority"]["value"]

    if alert and prev_net is not None and new_net is not None and prev_net > 0 >= new_net:
        create_alert(db, "no_rentable", f"'{opp.title}' dejó de ser rentable",
                     f"Ingreso neto mensual pasó de {_fmt(prev_net)} a {_fmt(new_net)} MXN.", "aviso",
                     opportunity_id=opp.id)

    # Se registra en el historial solo si el resultado cambió materialmente o si se pidió explícitamente,
    # para que cada ingreso/gasto registrado no inunde el historial de decisiones.
    if force_log or _material_change(previous, metrics):
        log_decision(db, AGENT_KEY, "calculo_rentabilidad", {
            "data_used": [f"{x['label']}: {x['mid_mxn']:,.2f} ({x['evidence_type']}"
                          + (f", fuente {x['source_url']}" if x["source_url"] else "") + ")" for x in metrics["inputs"]],
            "conclusion": metrics["narrative"],
            "risks": metrics.get("missing") or metrics.get("assumptions"),
        }, opportunity_id=opp.id, agent_run_id=agent_run_id)
    return metrics


def _headline(m: dict) -> Optional[float]:
    obs = m.get("observed")
    if obs and obs["days"] >= 3:
        return obs["monthly_projection_mxn"]
    return (m.get("scenarios") or {}).get("base", {}).get("net_mxn")


def _material_change(prev: dict, new: dict) -> bool:
    """Cambio de estado, de confianza, de signo, o > 10% en el neto mensual de referencia."""
    if not prev or prev.get("status") != new.get("status"):
        return True
    if (prev.get("confidence") or {}).get("label") != (new.get("confidence") or {}).get("label"):
        return True
    a, b = _headline(prev), _headline(new)
    if a is None or b is None:
        return a != b
    if (a > 0) != (b > 0):
        return True
    return abs(b - a) > 0.10 * max(abs(a), 1.0)


def _narrative(m: dict) -> str:
    parts = []
    if m.get("observed"):
        parts.append("DATOS OBSERVADOS: " + m["observed"]["narrative"])
    if m["status"] != "OK":
        parts.append("ESTIMACIÓN: no calculable. Falta: " + "; ".join(m.get("missing", [])) + ".")
    else:
        b, p, o = (m["scenarios"][k] for k in ("base", "pesimista", "optimista"))
        conf = m["confidence"]
        parts.append(
            f"ESTIMACIÓN (confianza {conf['label']}, {conf['score']:.2f}): ingreso neto mensual base "
            f"{_fmt(b['net_mxn'])} MXN (rango {_fmt(p['net_mxn'])} a {_fmt(o['net_mxn'])}), "
            f"{b['hours']:.1f} h/mes → {_fmt(b['net_per_hour_mxn'])} MXN/h. " + " ".join(conf["reasons"]))
        if m.get("calibrated_scenarios"):
            parts.append(f"CALIBRACIÓN HISTÓRICA: {m['calibration']['explanation']} Base calibrada: "
                         f"{_fmt(m['calibrated_scenarios']['base']['net_mxn'])} MXN/mes.")
        if m.get("assumptions"):
            parts.append("SUPOSICIONES: " + " ".join(m["assumptions"]))
    return "\n".join(parts)
