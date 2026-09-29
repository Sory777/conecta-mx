from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..agents import antifraud, pipeline, profitability
from ..agents.profitability import FIELD_DEFS
from ..db import get_db
from ..models import (CATEGORIES, AutomationTask, DataPoint, DecisionLog, Evidence, Experiment, Opportunity, Platform,
                      PlatformChange, ResearchResult, Risk, RiskAssessment, Status, User, utcnow)
from ..security import current_user
from ..serializers import opportunity_summary, row
from ..services import web
from ..services.capital import capital_summary
from ..services.records import log_decision

router = APIRouter(prefix="/api", tags=["oportunidades"])


def _get_opp(db: Session, opp_id: int) -> Opportunity:
    opp = db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Oportunidad no encontrada")
    return opp


@router.get("/opportunities")
def list_opportunities(
    status: Optional[str] = None, category: Optional[str] = None, risk: Optional[str] = None,
    no_investment: bool = False, low_risk: bool = False, max_automation: bool = False,
    within_capital: bool = False, q: Optional[str] = None,
    sort: Literal["priority", "net", "net_per_hour", "recent"] = "priority",
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    stmt = select(Opportunity)
    if status:
        stmt = stmt.where(Opportunity.status == status)
    if category:
        stmt = stmt.where(Opportunity.category == category)
    if risk:
        stmt = stmt.where(Opportunity.risk_level == risk)
    if low_risk:  # MODO "BAJO RIESGO"
        stmt = stmt.where(Opportunity.risk_level == Risk.BAJO)
    if max_automation:  # MODO "AUTOMATIZACIÓN MÁXIMA"
        stmt = stmt.where(Opportunity.automation_level >= 75)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Opportunity.title.ilike(like), Opportunity.description.ilike(like)))
    items = [opportunity_summary(o) for o in db.scalars(stmt)]
    if no_investment:  # MODO "SIN INVERSIÓN": inversión inicial = $0 CONOCIDA (desconocida no cuenta)
        items = [i for i in items if i["initial_investment_mxn"] == 0]
    if within_capital:
        avail = capital_summary(db, user)["available_mxn"]
        items = [i for i in items if (i["initial_investment_mxn"] or 0) <= avail]
    keyfn = {
        "priority": lambda i: i["priority"] or 0,
        "net": lambda i: i["net_monthly_mxn"] if i["net_monthly_mxn"] is not None else float("-inf"),
        "net_per_hour": lambda i: i["net_per_hour_mxn"] if i["net_per_hour_mxn"] is not None else float("-inf"),
        "recent": lambda i: i["created_at"],
    }[sort]
    items.sort(key=keyfn, reverse=True)
    return items


class PlatformIn(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    countries: Optional[str] = None
    mexico_available: Optional[bool] = None
    payment_methods: Optional[str] = None
    min_payout: Optional[float] = None
    min_payout_currency: Optional[str] = None
    fees_note: Optional[str] = None
    requirements: Optional[str] = None
    tos_url: Optional[str] = None
    tos_prohibits_automation: Optional[bool] = None
    has_official_api: Optional[bool] = None
    api_docs_url: Optional[str] = None
    monitored_url: Optional[str] = None
    verification_status: Optional[Literal["NO_VERIFICADA", "VERIFICADA_PARCIAL", "VERIFICADA"]] = None
    notes: Optional[str] = None


class OpportunityIn(BaseModel):
    title: str = Field(min_length=2, max_length=250)
    category: str = "otra"
    description: str = ""
    discovery_reason: str = ""
    platform: Optional[PlatformIn] = None


@router.post("/opportunities")
def create_opportunity(data: OpportunityIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if data.category not in CATEGORIES:
        raise HTTPException(422, f"Categoría inválida. Opciones: {', '.join(CATEGORIES)}")
    platform = None
    if data.platform and data.platform.name:
        pd = data.platform.model_dump(exclude_unset=True)
        domain = web.domain_of(pd.get("url"))
        platform = db.scalar(select(Platform).where(Platform.domain == domain)) if domain else None
        if platform is None:
            platform = Platform(category=data.category, domain=domain, **pd)
            platform.monitored_url = platform.monitored_url or platform.tos_url or platform.url
            db.add(platform)
            db.flush()
    opp = Opportunity(title=data.title, category=data.category, description=data.description,
                      discovery_reason=data.discovery_reason or "Agregada manualmente por el usuario",
                      discovered_by="usuario", platform_id=platform.id if platform else None)
    db.add(opp)
    db.flush()
    log_decision(db, "usuario", "oportunidad_creada", {"found_because": opp.discovery_reason}, opportunity_id=opp.id)
    pipeline.evaluate(db, opp)
    db.commit()
    return opportunity_summary(opp)


@router.get("/opportunities/{opp_id}")
def get_opportunity(opp_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    opp = _get_opp(db, opp_id)
    q = lambda M, order: db.scalars(select(M).where(M.opportunity_id == opp_id).order_by(order))  # noqa: E731
    changes = []
    if opp.platform_id:
        changes = [row(c) for c in db.scalars(select(PlatformChange).where(PlatformChange.platform_id == opp.platform_id)
                                              .order_by(PlatformChange.detected_at.desc()))]
    return {
        "opportunity": opportunity_summary(opp),
        "metrics": opp.metrics,
        "platform": row(opp.platform),
        "data_points": [row(d) for d in q(DataPoint, DataPoint.created_at.desc())],
        "risk_assessments": [row(r) for r in q(RiskAssessment, RiskAssessment.created_at.desc())],
        "automation_tasks": [row(t) for t in q(AutomationTask, AutomationTask.id)],
        "decisions": [row(d) for d in q(DecisionLog, DecisionLog.created_at.desc())],
        "research_results": [row(r) for r in q(ResearchResult, ResearchResult.retrieved_at.desc())],
        "experiments": [row(e) for e in db.scalars(select(Experiment).where(Experiment.opportunity_id == opp_id,
                                                                          Experiment.user_id == user.id))],
        "platform_changes": changes,
    }


class OpportunityPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    discard_reason: Optional[str] = None
    acknowledge_high_risk: bool = False


def check_status_gate(opp: Opportunity, new_status: str, acknowledge_high_risk: bool = False) -> None:
    """Ninguna oportunidad se presenta como viable sin pasar por el antifraude."""
    if new_status not in (Status.EN_PRUEBA, Status.ACTIVA):
        return
    if opp.risk_level is None:
        raise HTTPException(409, "Primero debe evaluarla el agente antifraude.")
    if opp.risk_level == Risk.DESCARTAR:
        raise HTTPException(409, "El antifraude la marcó DESCARTAR. Revisa las señales antes de continuar.")
    if opp.risk_level == Risk.ALTO and not acknowledge_high_risk:
        raise HTTPException(409, "Riesgo ALTO: confirma explícitamente que aceptas el riesgo (acknowledge_high_risk).")


@router.patch("/opportunities/{opp_id}")
def patch_opportunity(opp_id: int, data: OpportunityPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    opp = _get_opp(db, opp_id)
    changes = data.model_dump(exclude_unset=True, exclude={"acknowledge_high_risk"})
    if "status" in changes:
        if changes["status"] not in Status.ALL:
            raise HTTPException(422, "Estado inválido")
        check_status_gate(opp, changes["status"], data.acknowledge_high_risk)
        if changes["status"] == Status.DESCARTADA and not (changes.get("discard_reason") or opp.discard_reason):
            raise HTTPException(422, "Indica la razón del descarte (transparencia).")
    if "category" in changes and changes["category"] not in CATEGORIES:
        raise HTTPException(422, "Categoría inválida")
    old_status = opp.status
    for k, v in changes.items():
        setattr(opp, k, v)
    if changes.get("status") and changes["status"] != old_status:
        log_decision(db, "usuario", "cambio_estado", {
            "conclusion": f"Estado {old_status} → {changes['status']}",
            "discard_reason": changes.get("discard_reason") if changes["status"] == Status.DESCARTADA else None,
        }, opportunity_id=opp.id)
    db.commit()
    return opportunity_summary(opp)


@router.put("/platforms/{platform_id}")
def update_platform(platform_id: int, data: PlatformIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(Platform, platform_id)
    if not p:
        raise HTTPException(404, "Plataforma no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    if data.url:
        p.domain = web.domain_of(data.url)
        p.domain_created_at = None
    db.flush()
    for opp in db.scalars(select(Opportunity).where(Opportunity.platform_id == p.id)):
        log_decision(db, "usuario", "plataforma_actualizada", {
            "data_used": [f"{k}: {v}" for k, v in data.model_dump(exclude_unset=True).items()],
            "conclusion": "Datos de plataforma editados por el usuario; se re-evalúa la oportunidad.",
        }, opportunity_id=opp.id)
        pipeline.evaluate(db, opp)
    db.commit()
    return row(p)


class DataPointIn(BaseModel):
    field: str
    value: float
    value_low: Optional[float] = None
    value_high: Optional[float] = None
    currency: Optional[str] = None
    evidence_type: str = Evidence.SUPOSICION
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    note: Optional[str] = None


@router.post("/opportunities/{opp_id}/data-points")
def add_data_point(opp_id: int, data: DataPointIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    opp = _get_opp(db, opp_id)
    if data.field not in FIELD_DEFS:
        raise HTTPException(422, f"Campo inválido. Opciones: {', '.join(FIELD_DEFS)}")
    if data.evidence_type not in Evidence.ALL:
        raise HTTPException(422, "Tipo de evidencia inválido")
    if data.evidence_type in (Evidence.ESTIMACION, Evidence.PROMESA_PLATAFORMA, Evidence.OBSERVADO) and not (data.source_url or data.note):
        raise HTTPException(422, f"Un dato {data.evidence_type} necesita fuente (URL) o una nota que explique su origen.")
    if FIELD_DEFS[data.field][2] and not data.currency:
        data.currency = "MXN"
    lo, hi = data.value_low, data.value_high
    if (lo is not None and lo > data.value) or (hi is not None and hi < data.value):
        raise HTTPException(422, "Debe cumplirse mínimo ≤ valor ≤ máximo.")
    dp = DataPoint(opportunity_id=opp.id, created_by="usuario", retrieved_at=utcnow() if data.source_url else None,
                   **data.model_dump())
    db.add(dp)
    db.flush()
    profitability.run(db, opp, pipeline.converter(db))
    db.commit()
    return {"data_point": row(dp), "opportunity": opportunity_summary(opp)}


@router.delete("/data-points/{dp_id}")
def delete_data_point(dp_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    dp = db.get(DataPoint, dp_id)
    if not dp:
        raise HTTPException(404, "Dato no encontrado")
    opp = _get_opp(db, dp.opportunity_id)
    db.delete(dp)
    db.flush()
    profitability.run(db, opp, pipeline.converter(db))
    db.commit()
    return {"ok": True}


@router.post("/opportunities/{opp_id}/evaluate")
def evaluate(opp_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    opp = _get_opp(db, opp_id)
    result = pipeline.evaluate(db, opp)
    db.commit()
    return {**result, "opportunity": opportunity_summary(opp)}


class DismissIn(BaseModel):
    code: str
    reason: str = Field(min_length=10, description="Por qué es un falso positivo")


@router.post("/opportunities/{opp_id}/dismiss-flag")
def dismiss_flag(opp_id: int, data: DismissIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    opp = _get_opp(db, opp_id)
    opp.dismissed_flags = [*(opp.dismissed_flags or []), {"code": data.code, "reason": data.reason, "at": utcnow().isoformat()}]
    log_decision(db, "usuario", "senal_descartada", {
        "conclusion": f"El usuario marcó la señal '{data.code}' como falso positivo: {data.reason}",
    }, opportunity_id=opp.id)
    if opp.status == Status.DESCARTADA and (opp.discard_reason or "").startswith("Antifraude"):
        opp.status, opp.discard_reason = Status.INVESTIGANDO, None
    antifraud.run(db, opp)
    profitability.run(db, opp, pipeline.converter(db))
    db.commit()
    return opportunity_summary(opp)
