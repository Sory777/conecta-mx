"""SISTEMA DE EXPERIMENTOS: cada oportunidad se prueba con duración, objetivo y presupuesto acotados."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agents import pipeline, profitability
from ..db import get_db
from ..models import (Earning, Expense, Experiment, ExperimentLog, Opportunity, Status, Transaction, User, Withdrawal,
                      utcnow)
from ..security import current_user
from ..serializers import row
from ..services.capital import CapitalExceeded, ensure_capital
from ..services.records import create_alert, log_decision
from .opportunities import check_status_gate

router = APIRouter(prefix="/api/experiments", tags=["experimentos"])


class ExperimentIn(BaseModel):
    opportunity_id: int
    name: str = Field(min_length=2, max_length=200)
    hypothesis: str = ""
    duration_days: int = Field(7, ge=1, le=365)
    target_net_mxn: float = Field(0, ge=0)
    budget_mxn: float = Field(0, ge=0)
    planned_hours: Optional[float] = Field(None, ge=0)
    acknowledge_high_risk: bool = False


class LogIn(BaseModel):
    day: date = Field(default_factory=date.today)
    minutes_used: float = Field(0, ge=0)
    tasks_available: Optional[int] = Field(None, ge=0)
    tasks_completed: Optional[int] = Field(None, ge=0)
    problems: Optional[str] = None
    blocked: bool = False
    notes: Optional[str] = None


def _get(db: Session, user: User, exp_id: int) -> Experiment:
    exp = db.get(Experiment, exp_id)
    if not exp or exp.user_id != user.id:
        raise HTTPException(404, "Experimento no encontrado")
    return exp


def totals(db: Session, exp: Experiment) -> dict:
    t = {"earned": 0.0, "operating": 0.0, "investment": 0.0, "withdrawn_received": 0.0, "withdrawals_rejected": 0}
    for tx in db.scalars(select(Transaction).where(Transaction.experiment_id == exp.id)):
        if tx.kind == "ingreso":
            t["earned"] += tx.amount_mxn
        elif tx.kind == "gasto":
            e = db.scalar(select(Expense).where(Expense.transaction_id == tx.id))
            t["investment" if e and e.is_investment else "operating"] += tx.amount_mxn
        else:
            w = db.scalar(select(Withdrawal).where(Withdrawal.transaction_id == tx.id))
            if w and w.status == "RECIBIDO":
                t["withdrawn_received"] += tx.amount_mxn
            elif w and w.status == "RECHAZADO":
                t["withdrawals_rejected"] += 1
    logs = list(exp.logs)
    t["minutes"] = sum(lg.minutes_used or 0 for lg in logs)
    t["tasks_completed"] = sum(lg.tasks_completed or 0 for lg in logs)
    t["tasks_available"] = sum(lg.tasks_available or 0 for lg in logs)
    t["days_logged"] = len({lg.day for lg in logs})
    t["blocked_days"] = sum(1 for lg in logs if lg.blocked)
    t["problems"] = [f"{lg.day}: {lg.problems}" for lg in logs if lg.problems]
    t["net_operating"] = t["earned"] - t["operating"]
    t["net_after_investment"] = t["net_operating"] - t["investment"]
    t = {k: (round(v, 2) if isinstance(v, float) else v) for k, v in t.items()}
    return t


def _serialize(db: Session, exp: Experiment) -> dict:
    d = row(exp)
    d["opportunity_title"] = exp.opportunity.title if exp.opportunity else None
    d["logs"] = [row(lg) for lg in exp.logs]
    d["totals"] = totals(db, exp)
    return d


@router.get("")
def list_experiments(user: User = Depends(current_user), db: Session = Depends(get_db)):
    exps = db.scalars(select(Experiment).where(Experiment.user_id == user.id).order_by(Experiment.started_at.desc()))
    return [_serialize(db, e) for e in exps]


@router.post("")
def create_experiment(data: ExperimentIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    opp = db.get(Opportunity, data.opportunity_id)
    if not opp:
        raise HTTPException(404, "Oportunidad no encontrada")
    check_status_gate(opp, Status.EN_PRUEBA, data.acknowledge_high_risk)
    try:
        ensure_capital(db, user, data.budget_mxn, f"El experimento '{data.name}'")
    except CapitalExceeded as e:
        raise HTTPException(409, str(e))
    exp = Experiment(user_id=user.id, opportunity_id=opp.id, name=data.name, hypothesis=data.hypothesis,
                     duration_days=data.duration_days, target_net_mxn=data.target_net_mxn, budget_mxn=data.budget_mxn,
                     planned_hours=data.planned_hours,
                     estimate_snapshot=profitability.run(db, opp, pipeline.converter(db), alert=False))
    db.add(exp)
    opp.status = Status.EN_PRUEBA
    db.flush()
    log_decision(db, "usuario", "experimento_iniciado", {
        "found_because": data.hypothesis or "Validar la estimación con datos reales.",
        "data_used": [f"Duración {data.duration_days} días", f"Objetivo neto ${data.target_net_mxn:,.2f} MXN",
                      f"Presupuesto ${data.budget_mxn:,.2f} MXN (comprometido contra el capital)"],
        "conclusion": "Estimación congelada al inicio para compararla contra el resultado real.",
    }, opportunity_id=opp.id)
    db.commit()
    return _serialize(db, exp)


@router.get("/{exp_id}")
def get_experiment(exp_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _serialize(db, _get(db, user, exp_id))


@router.post("/{exp_id}/logs")
def add_log(exp_id: int, data: LogIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exp = _get(db, user, exp_id)
    if exp.status != "EN_CURSO":
        raise HTTPException(409, "El experimento ya no está en curso.")
    lg = ExperimentLog(experiment_id=exp.id, day=data.day.isoformat(), minutes_used=data.minutes_used,
                       tasks_available=data.tasks_available, tasks_completed=data.tasks_completed,
                       problems=data.problems, blocked=data.blocked, notes=data.notes)
    db.add(lg)
    db.flush()
    db.refresh(exp)
    if data.blocked:
        create_alert(db, "problema_cuenta", f"Bloqueo reportado en '{exp.name}'",
                     data.problems or "Se reportó un bloqueo de cuenta o acceso.", "critica",
                     user_id=user.id, opportunity_id=exp.opportunity_id)
    profitability.run(db, exp.opportunity, pipeline.converter(db))
    db.commit()
    return _serialize(db, exp)


def evaluate_result(exp: Experiment, t: dict, min_hourly: Optional[float]) -> tuple[dict, str, list[str]]:
    hours = t["minutes"] / 60
    actual_rate = t["net_operating"] / hours if hours > 0 else None
    snap = exp.estimate_snapshot or {}
    est_period = None
    if snap.get("status") == "OK":
        factor = exp.duration_days / profitability.DAYS_PER_MONTH
        est_period = {k: round(v["net_mxn"] * factor, 2) for k, v in snap["scenarios"].items()}
    ratio = (t["net_operating"] / est_period["base"]) if est_period and est_period["base"] > 0 else None
    reasons = []
    if t["blocked_days"] or t["withdrawals_rejected"]:
        rec = "ABANDONAR"
        reasons.append(f"{t['blocked_days']} día(s) con bloqueo y {t['withdrawals_rejected']} retiro(s) rechazado(s).")
    elif t["net_operating"] <= 0:
        rec = "ABANDONAR"
        reasons.append("El ingreso neto real fue ≤ 0.")
    elif t["net_operating"] >= exp.target_net_mxn and (min_hourly is None or (actual_rate or 0) >= min_hourly):
        rec = "CONTINUAR"
        reasons.append(f"Se alcanzó el objetivo (${t['net_operating']:,.2f} ≥ ${exp.target_net_mxn:,.2f}).")
    else:
        rec = "MODIFICAR"
        if t["net_operating"] < exp.target_net_mxn:
            reasons.append(f"Neto ${t['net_operating']:,.2f} por debajo del objetivo ${exp.target_net_mxn:,.2f}.")
        if min_hourly is not None and (actual_rate or 0) < min_hourly:
            reasons.append(f"Ingreso por hora ${actual_rate or 0:,.2f} menor a tu mínimo ${min_hourly:,.2f}.")
    if t["earned"] > 0 and t["withdrawn_received"] == 0:
        reasons.append("ADVERTENCIA: ningún retiro recibido; los ingresos siguen sin confirmarse con dinero real.")
    result = {
        "actual_net_mxn": t["net_operating"], "actual_net_after_investment_mxn": t["net_after_investment"],
        "hours": round(hours, 2), "actual_net_per_hour_mxn": None if actual_rate is None else round(actual_rate, 2),
        "estimated_period_net_mxn": est_period,
        "estimated_net_per_hour_mxn": (snap.get("scenarios") or {}).get("base", {}).get("net_per_hour_mxn"),
        "actual_vs_estimate_ratio": None if ratio is None else round(ratio, 2),
        "target_net_mxn": exp.target_net_mxn, "target_met": t["net_operating"] >= exp.target_net_mxn,
        "totals": t, "reasons": reasons,
    }
    return result, rec, reasons


@router.post("/{exp_id}/finish")
def finish(exp_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exp = _get(db, user, exp_id)
    if exp.status != "EN_CURSO":
        raise HTTPException(409, "El experimento ya terminó.")
    t = totals(db, exp)
    result, rec, reasons = evaluate_result(exp, t, user.min_hourly_rate_mxn)
    exp.status, exp.result, exp.recommendation, exp.finished_at = "FINALIZADO", result, rec, utcnow()
    opp = exp.opportunity
    if rec == "CONTINUAR":
        opp.status = Status.ACTIVA
    elif rec == "MODIFICAR":
        opp.status = Status.REQUIERE_ACCION
    else:
        opp.status = Status.DESCARTADA
        opp.discard_reason = f"Experimento '{exp.name}': " + " ".join(reasons)
    est = result["estimated_period_net_mxn"]
    comparison = (f"Estimado (base) ${est['base']:,.2f} vs real ${t['net_operating']:,.2f} MXN"
                  + (f" → {result['actual_vs_estimate_ratio']}× lo estimado" if result["actual_vs_estimate_ratio"] is not None else "")
                  if est else "No había estimación calculable al iniciar; solo hay datos observados.")
    log_decision(db, "rentabilidad", "resultado_experimento", {
        "data_used": [f"{t['days_logged']} días registrados, {result['hours']} h, {t['tasks_completed']} tareas",
                      f"Ingresos ${t['earned']:,.2f}, gastos operativos ${t['operating']:,.2f}, inversión ${t['investment']:,.2f}",
                      comparison],
        "conclusion": f"Recomendación: {rec}. " + " ".join(reasons),
        "discard_reason": opp.discard_reason if rec == "ABANDONAR" else None,
    }, opportunity_id=opp.id)
    if result["target_met"]:
        create_alert(db, "objetivo", f"Objetivo alcanzado: {exp.name}", comparison, "info", user_id=user.id,
                     opportunity_id=opp.id)
    profitability.run(db, opp, pipeline.converter(db), force_log=True)  # incorpora observado + calibración histórica
    db.commit()
    return _serialize(db, exp)


@router.post("/{exp_id}/cancel")
def cancel(exp_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exp = _get(db, user, exp_id)
    if exp.status != "EN_CURSO":
        raise HTTPException(409, "El experimento ya terminó.")
    exp.status, exp.finished_at = "CANCELADO", utcnow()
    if exp.opportunity.status == Status.EN_PRUEBA:
        exp.opportunity.status = Status.INVESTIGANDO
    db.commit()
    return _serialize(db, exp)
