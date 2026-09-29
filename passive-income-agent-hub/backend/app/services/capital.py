"""Sistema de capital: cuánto dinero hay disponible, comprometido, invertido y recuperado."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Expense, Experiment, Transaction, User


def _sum(db: Session, stmt) -> float:
    return float(db.scalar(stmt) or 0.0)


def capital_summary(db: Session, user: User) -> dict:
    uid = user.id
    invested = _sum(db, select(func.sum(Transaction.amount_mxn)).join(Expense, Expense.transaction_id == Transaction.id)
                    .where(Transaction.user_id == uid, Expense.is_investment.is_(True)))
    operating = _sum(db, select(func.sum(Transaction.amount_mxn)).join(Expense, Expense.transaction_id == Transaction.id)
                     .where(Transaction.user_id == uid, Expense.is_investment.is_(False)))
    earned = _sum(db, select(func.sum(Transaction.amount_mxn))
                  .where(Transaction.user_id == uid, Transaction.kind == "ingreso"))

    # Comprometido: presupuesto de experimentos en curso que aún no se ha gastado como inversión
    committed = 0.0
    for exp in db.scalars(select(Experiment).where(Experiment.user_id == uid, Experiment.status == "EN_CURSO")):
        spent = _sum(db, select(func.sum(Transaction.amount_mxn)).join(Expense, Expense.transaction_id == Transaction.id)
                     .where(Transaction.experiment_id == exp.id, Expense.is_investment.is_(True)))
        committed += max(exp.budget_mxn - spent, 0.0)

    net_operating = earned - operating                 # lo que generaron las oportunidades tras gastos operativos
    recovered = min(max(net_operating, 0.0), invested)  # parte del capital invertido que ya regresó
    result = net_operating - invested
    limit = user.capital_limit_mxn or 0.0
    available = limit - committed - (invested - recovered)
    return {
        "limit_mxn": round(limit, 2),
        "available_mxn": round(available, 2),
        "committed_mxn": round(committed, 2),
        "invested_mxn": round(invested, 2),
        "recovered_mxn": round(recovered, 2),
        "profit_mxn": round(max(result, 0.0), 2),
        "loss_mxn": round(max(-result, 0.0), 2),
        "earned_mxn": round(earned, 2),
        "operating_expenses_mxn": round(operating, 2),
        "explanation": (
            "Disponible = límite − comprometido − (invertido − recuperado). "
            "Recuperado = ingresos − gastos operativos, hasta el monto invertido. "
            "Ganancia/pérdida = ingresos − gastos operativos − inversión."
        ),
    }


class CapitalExceeded(Exception):
    pass


def ensure_capital(db: Session, user: User, amount_mxn: float, what: str) -> None:
    """Bloquea cualquier compromiso automático que exceda el capital disponible."""
    summary = capital_summary(db, user)
    if amount_mxn > summary["available_mxn"] + 1e-9:
        raise CapitalExceeded(
            f"{what} requiere ${amount_mxn:,.2f} MXN pero solo hay ${summary['available_mxn']:,.2f} MXN disponibles "
            f"(límite ${summary['limit_mxn']:,.2f}). Ajusta tu capital en Configuración o reduce el monto."
        )
