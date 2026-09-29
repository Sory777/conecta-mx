from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..agents.profitability import FIELD_DEFS
from ..config import INSECURE_DEFAULT_SECRET, get_settings
from ..db import get_db
from ..models import CATEGORIES, Evidence, Risk, Status, User
from ..security import current_user
from ..serializers import row
from ..services import fx
from ..services.capital import capital_summary

router = APIRouter(prefix="/api", tags=["settings"])


class SettingsIn(BaseModel):
    capital_limit_mxn: Optional[float] = Field(None, ge=0)
    min_hourly_rate_mxn: Optional[float] = Field(None, ge=0)
    investment_alert_threshold_mxn: Optional[float] = Field(None, ge=0)
    display_name: Optional[str] = None


@router.get("/settings")
def get_settings_(user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = get_settings()
    return {
        "user": row(user),
        "capital": capital_summary(db, user),
        # solo se expone si cada integración está configurada, nunca el valor de las claves
        "integrations": {
            "anthropic": bool(s.anthropic_api_key), "anthropic_model": s.anthropic_model,
            "brave": bool(s.brave_api_key), "coingecko_key": bool(s.coingecko_demo_api_key),
            "scheduler_enabled": s.scheduler_enabled,
            "monitor_interval_hours": s.monitor_interval_hours, "research_interval_hours": s.research_interval_hours,
            "max_agent_runs_per_day": s.max_agent_runs_per_day,
            "insecure_secret_key": s.secret_key == INSECURE_DEFAULT_SECRET,
        },
    }


@router.put("/settings")
def put_settings(data: SettingsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    db.commit()
    return get_settings_(user, db)


@router.get("/meta")
def meta(_: User = Depends(current_user)):
    return {
        "categories": CATEGORIES, "statuses": Status.ALL, "risks": Risk.ALL, "evidence_types": Evidence.ALL,
        "currencies": fx.supported_currencies(),
        "fields": [{"field": k, "label": v[0], "unit": v[1], "monetary": v[2]} for k, v in FIELD_DEFS.items()],
    }


@router.get("/fx/{currency}")
def fx_rate(currency: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        r = fx.get_rate(db, currency)
        db.commit()
    except fx.FxUnavailable as e:
        raise HTTPException(503, str(e))
    return {"currency": currency.upper(), "rate_to_mxn": r.rate_to_mxn, "source": r.source, "source_url": r.source_url,
            "rate_date": r.rate_date, "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None}
