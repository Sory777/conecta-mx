from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Alert, Expense, Experiment, Opportunity, Status, Transaction, User
from ..security import current_user
from ..serializers import opportunity_summary, row
from ..services.capital import capital_summary

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    txs = list(db.scalars(select(Transaction).where(Transaction.user_id == user.id, Transaction.kind != "retiro")))
    investment_ids = set(db.scalars(select(Expense.transaction_id).where(Expense.is_investment.is_(True))))

    def window(start: date | None) -> dict:
        earned = sum(t.amount_mxn for t in txs if t.kind == "ingreso" and (start is None or t.occurred_on >= start.isoformat()))
        spent = sum(t.amount_mxn for t in txs if t.kind == "gasto" and t.id not in investment_ids
                    and (start is None or t.occurred_on >= start.isoformat()))
        return {"earned_mxn": round(earned, 2), "expenses_mxn": round(spent, 2), "net_mxn": round(earned - spent, 2)}

    # serie diaria de 30 días
    series = defaultdict(lambda: {"earned": 0.0, "expenses": 0.0})
    since = (today - timedelta(days=29)).isoformat()
    for t in txs:
        if t.occurred_on >= since:
            key = "earned" if t.kind == "ingreso" else "expenses"
            if key == "expenses" and t.id in investment_ids:
                continue
            series[t.occurred_on][key] += t.amount_mxn
    daily = [{"day": (today - timedelta(days=i)).isoformat(), **{k: round(v, 2) for k, v in
             series[(today - timedelta(days=i)).isoformat()].items()}} for i in range(29, -1, -1)]

    running = [o for o in db.scalars(select(Opportunity).where(Opportunity.status.in_([Status.ACTIVA, Status.EN_PRUEBA])))]
    est_month = sum(((o.metrics or {}).get("scenarios") or {}).get("base", {}).get("net_mxn", 0) or 0 for o in running)
    est_low = sum(((o.metrics or {}).get("scenarios") or {}).get("pesimista", {}).get("net_mxn", 0) or 0 for o in running)
    last30 = window(today - timedelta(days=29))

    counts = dict(db.execute(select(Opportunity.status, func.count(Opportunity.id)).group_by(Opportunity.status)).all())
    alerts = db.scalars(select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc()).limit(8))
    unread = db.scalar(select(func.count(Alert.id)).where(Alert.user_id == user.id, Alert.read.is_(False))) or 0
    top = sorted((opportunity_summary(o) for o in db.scalars(select(Opportunity).where(Opportunity.status != Status.DESCARTADA))),
                 key=lambda i: i["priority"] or 0, reverse=True)[:5]
    running_exps = db.scalar(select(func.count(Experiment.id)).where(Experiment.user_id == user.id,
                                                                     Experiment.status == "EN_CURSO")) or 0
    return {
        "income": {
            "today": window(today), "week": window(week_start), "month": window(month_start), "all_time": window(None),
            "estimated_monthly_mxn": round(est_month, 2), "estimated_monthly_low_mxn": round(est_low, 2),
            "real_last_30d_mxn": last30["net_mxn"],
            "estimate_note": ("Estimado = suma del escenario base de oportunidades ACTIVAS o EN PRUEBA. "
                              "Real = ingresos − gastos operativos registrados en los últimos 30 días."),
        },
        "daily": daily,
        "capital": capital_summary(db, user),
        "status_counts": {s: counts.get(s, 0) for s in Status.ALL},
        "alerts": [row(a) for a in alerts], "unread_alerts": unread,
        "top_opportunities": top, "running_experiments": running_exps,
    }
