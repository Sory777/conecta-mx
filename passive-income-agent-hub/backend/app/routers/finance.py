from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..agents import pipeline, profitability
from ..db import get_db
from ..models import Earning, Expense, Experiment, Opportunity, Transaction, User, Withdrawal
from ..security import current_user
from ..serializers import row
from ..services import fx
from ..services.capital import capital_summary
from ..services.records import create_alert

router = APIRouter(prefix="/api/transactions", tags=["finanzas"])


class TxBase(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "MXN"
    manual_rate: Optional[float] = Field(None, gt=0, description="Tasa a MXN si no hay tasa automática")
    occurred_on: date = Field(default_factory=date.today)
    opportunity_id: Optional[int] = None
    experiment_id: Optional[int] = None
    description: str = ""


class EarningIn(TxBase):
    status: Literal["PENDIENTE", "CONFIRMADO"] = "PENDIENTE"
    tasks_count: Optional[int] = Field(None, ge=0)
    minutes_spent: Optional[float] = Field(None, ge=0)


class ExpenseIn(TxBase):
    category: Literal["electricidad", "comisiones", "suscripcion", "hardware", "mantenimiento", "otro"] = "otro"
    is_investment: bool = False


class WithdrawalIn(TxBase):
    method: str = ""
    status: Literal["SOLICITADO", "RECIBIDO", "RECHAZADO"] = "SOLICITADO"
    fee_mxn: float = Field(0.0, ge=0)


def _make_tx(db: Session, user: User, kind: str, data: TxBase) -> Transaction:
    if data.experiment_id:
        exp = db.get(Experiment, data.experiment_id)
        if not exp or exp.user_id != user.id:
            raise HTTPException(404, "Experimento no encontrado")
        data.opportunity_id = data.opportunity_id or exp.opportunity_id
    if data.opportunity_id and not db.get(Opportunity, data.opportunity_id):
        raise HTTPException(404, "Oportunidad no encontrada")
    try:
        amount_mxn, rate, source = fx.to_mxn(db, data.amount, data.currency, data.manual_rate)
    except fx.FxUnavailable as e:
        raise HTTPException(422, str(e))
    tx = Transaction(user_id=user.id, kind=kind, occurred_on=data.occurred_on.isoformat(), amount=data.amount,
                     currency=data.currency.upper(), fx_rate_to_mxn=rate, fx_source=source, amount_mxn=round(amount_mxn, 2),
                     description=data.description, opportunity_id=data.opportunity_id, experiment_id=data.experiment_id)
    db.add(tx)
    db.flush()
    return tx


def _recompute(db: Session, opp_id: Optional[int]) -> None:
    if opp_id:
        opp = db.get(Opportunity, opp_id)
        if opp:
            profitability.run(db, opp, pipeline.converter(db))


def pending_balance_mxn(db: Session, user: User, opp_id: int) -> float:
    earned = db.scalar(select(func.sum(Transaction.amount_mxn)).join(Earning, Earning.transaction_id == Transaction.id)
                       .where(Transaction.user_id == user.id, Transaction.opportunity_id == opp_id)) or 0.0
    withdrawn = db.scalar(select(func.sum(Transaction.amount_mxn)).join(Withdrawal, Withdrawal.transaction_id == Transaction.id)
                          .where(Transaction.user_id == user.id, Transaction.opportunity_id == opp_id,
                                 Withdrawal.status != "RECHAZADO")) or 0.0
    return earned - withdrawn


@router.post("/earnings")
def add_earning(data: EarningIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    tx = _make_tx(db, user, "ingreso", data)
    db.add(Earning(transaction_id=tx.id, status=data.status, tasks_count=data.tasks_count, minutes_spent=data.minutes_spent))
    if tx.opportunity_id:
        opp = db.get(Opportunity, tx.opportunity_id)
        p = opp.platform if opp else None
        if p and p.min_payout:
            try:
                min_mxn = fx.to_mxn(db, p.min_payout, p.min_payout_currency or "MXN")[0]
                balance = pending_balance_mxn(db, user, opp.id)
                if balance >= min_mxn > balance - tx.amount_mxn:
                    create_alert(db, "retiro_disponible", f"Retiro disponible en {p.name}",
                                 f"Saldo registrado ${balance:,.2f} MXN ≥ mínimo ${min_mxn:,.2f} MXN. "
                                 "Retirar pronto confirma que la plataforma realmente paga.", "info",
                                 user_id=user.id, opportunity_id=opp.id)
            except fx.FxUnavailable:
                pass
    if tx.experiment_id:
        from .experiments import totals
        exp = db.get(Experiment, tx.experiment_id)
        db.flush()
        net = totals(db, exp)["net_operating"]
        if exp.status == "EN_CURSO" and exp.target_net_mxn > 0 and net >= exp.target_net_mxn > net - tx.amount_mxn:
            create_alert(db, "objetivo", f"Objetivo alcanzado en '{exp.name}'",
                         f"Neto acumulado ${net:,.2f} MXN ≥ objetivo ${exp.target_net_mxn:,.2f}.", "info",
                         user_id=user.id, opportunity_id=exp.opportunity_id)
    _recompute(db, tx.opportunity_id)
    db.commit()
    return row(tx)


@router.post("/expenses")
def add_expense(data: ExpenseIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    before = capital_summary(db, user)
    tx = _make_tx(db, user, "gasto", data)
    db.add(Expense(transaction_id=tx.id, category=data.category, is_investment=data.is_investment))
    db.flush()
    if data.is_investment:
        # Un gasto real ya ocurrió: se registra, pero se alerta si rebasa el capital o el umbral.
        if tx.amount_mxn > before["available_mxn"]:
            create_alert(db, "inversion_limite", "Una inversión superó tu capital disponible",
                         f"Inversión de ${tx.amount_mxn:,.2f} MXN con solo ${before['available_mxn']:,.2f} disponibles.",
                         "critica", user_id=user.id, opportunity_id=tx.opportunity_id)
        elif user.investment_alert_threshold_mxn and tx.amount_mxn >= user.investment_alert_threshold_mxn:
            create_alert(db, "inversion_limite", "Inversión por encima de tu umbral de alerta",
                         f"${tx.amount_mxn:,.2f} MXN ≥ umbral ${user.investment_alert_threshold_mxn:,.2f}.",
                         "aviso", user_id=user.id, opportunity_id=tx.opportunity_id)
    _recompute(db, tx.opportunity_id)
    db.commit()
    return row(tx)


@router.post("/withdrawals")
def add_withdrawal(data: WithdrawalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    tx = _make_tx(db, user, "retiro", data)
    db.add(Withdrawal(transaction_id=tx.id, method=data.method, status=data.status, fee_mxn=data.fee_mxn))
    if data.fee_mxn > 0:
        fee = ExpenseIn(amount=data.fee_mxn, occurred_on=data.occurred_on, opportunity_id=tx.opportunity_id,
                        experiment_id=data.experiment_id, description=f"Comisión de retiro #{tx.id}", category="comisiones")
        fee_tx = _make_tx(db, user, "gasto", fee)
        db.add(Expense(transaction_id=fee_tx.id, category="comisiones", is_investment=False))
    _recompute(db, tx.opportunity_id)
    db.commit()
    return row(tx)


class WithdrawalStatusIn(BaseModel):
    status: Literal["SOLICITADO", "RECIBIDO", "RECHAZADO"]


@router.patch("/withdrawals/{tx_id}")
def update_withdrawal(tx_id: int, data: WithdrawalStatusIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    tx = db.get(Transaction, tx_id)
    w = db.scalar(select(Withdrawal).where(Withdrawal.transaction_id == tx_id))
    if not tx or tx.user_id != user.id or not w:
        raise HTTPException(404, "Retiro no encontrado")
    w.status = data.status
    if data.status == "RECHAZADO":
        create_alert(db, "problema_cuenta", "Retiro rechazado", f"El retiro #{tx.id} fue rechazado. Posible problema con la cuenta o la plataforma.",
                     "critica", user_id=user.id, opportunity_id=tx.opportunity_id)
    elif data.status == "RECIBIDO" and tx.opportunity_id:
        # un retiro recibido confirma los ingresos previos de esa oportunidad
        for e in db.scalars(select(Earning).join(Transaction, Earning.transaction_id == Transaction.id)
                            .where(Transaction.opportunity_id == tx.opportunity_id, Transaction.user_id == user.id,
                                   Transaction.occurred_on <= tx.occurred_on)):
            e.status = "CONFIRMADO"
    db.commit()
    return {"ok": True}


@router.get("")
def list_transactions(kind: Optional[str] = None, opportunity_id: Optional[int] = None, experiment_id: Optional[int] = None,
                      limit: int = 200, user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Transaction).where(Transaction.user_id == user.id)
    if kind:
        stmt = stmt.where(Transaction.kind == kind)
    if opportunity_id:
        stmt = stmt.where(Transaction.opportunity_id == opportunity_id)
    if experiment_id:
        stmt = stmt.where(Transaction.experiment_id == experiment_id)
    out = []
    for tx in db.scalars(stmt.order_by(Transaction.occurred_on.desc(), Transaction.id.desc()).limit(min(limit, 1000))):
        d = row(tx)
        if tx.kind == "ingreso":
            d["detail"] = row(db.scalar(select(Earning).where(Earning.transaction_id == tx.id)))
        elif tx.kind == "gasto":
            d["detail"] = row(db.scalar(select(Expense).where(Expense.transaction_id == tx.id)))
        else:
            d["detail"] = row(db.scalar(select(Withdrawal).where(Withdrawal.transaction_id == tx.id)))
        opp = db.get(Opportunity, tx.opportunity_id) if tx.opportunity_id else None
        d["opportunity_title"] = opp.title if opp else None
        out.append(d)
    return out


@router.delete("/{tx_id}")
def delete_transaction(tx_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    tx = db.get(Transaction, tx_id)
    if not tx or tx.user_id != user.id:
        raise HTTPException(404, "Movimiento no encontrado")
    opp_id = tx.opportunity_id
    db.delete(tx)
    db.flush()
    _recompute(db, opp_id)
    db.commit()
    return {"ok": True}
