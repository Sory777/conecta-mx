"""Orquestador: una oportunidad siempre se evalúa en el orden antifraude → automatización → rentabilidad."""
from typing import Optional

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Opportunity, Status
from ..services import fx
from . import antifraud, automation, profitability


def converter(db: Session):
    def convert(amount: float, currency: str) -> float:
        return fx.to_mxn(db, amount, currency)[0]
    return convert


def llm_fraud_reviewer():
    if not get_settings().anthropic_api_key:
        return None
    from ..services import llm

    def review(text: str) -> list[dict]:
        return [s.model_dump() for s in llm.review_fraud_signals(text).signals]
    return review


def evaluate(db: Session, opp: Opportunity, agent_run_id: Optional[int] = None, use_llm: bool = False) -> dict:
    ra = antifraud.run(db, opp, agent_run_id=agent_run_id, llm_review=llm_fraud_reviewer() if use_llm else None)
    auto = automation.run(db, opp, agent_run_id=agent_run_id)
    metrics = profitability.run(db, opp, converter(db), agent_run_id=agent_run_id, force_log=True)
    return {"risk": ra.risk_level, "automation": auto["level"], "metrics_status": metrics["status"],
            "discarded": opp.status == Status.DESCARTADA}
