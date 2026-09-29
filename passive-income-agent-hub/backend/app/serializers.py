"""Conversión de modelos ORM a dicts JSON para la API."""
from datetime import datetime
from typing import Any

from sqlalchemy.inspection import inspect

HIDDEN = {"password_hash", "content_snapshot"}


def row(obj: Any, exclude: set[str] = frozenset()) -> dict:
    if obj is None:
        return None
    out = {}
    for c in inspect(obj).mapper.column_attrs:
        k = c.key
        if k in HIDDEN or k in exclude:
            continue
        v = getattr(obj, k)
        out[k] = v.isoformat() if isinstance(v, datetime) else v
    return out


def opportunity_summary(o) -> dict:
    m = o.metrics or {}
    obs = m.get("observed") or None
    base = (m.get("scenarios") or {}).get("base") or {}
    return {
        **row(o, exclude={"metrics"}),
        "platform_name": o.platform.name if o.platform else None,
        "platform_url": o.platform.url if o.platform else None,
        "mexico_available": o.platform.mexico_available if o.platform else None,
        "metrics_status": m.get("status"),
        "initial_investment_mxn": base.get("initial_investment_mxn"),
        "gross_monthly_mxn": base.get("gross_mxn"),
        "costs_monthly_mxn": base.get("total_costs_mxn"),
        "net_monthly_mxn": base.get("net_mxn"),
        "net_monthly_low_mxn": ((m.get("scenarios") or {}).get("pesimista") or {}).get("net_mxn"),
        "net_monthly_high_mxn": ((m.get("scenarios") or {}).get("optimista") or {}).get("net_mxn"),
        "hours_monthly": base.get("hours"),
        "net_per_hour_mxn": base.get("net_per_hour_mxn"),
        "confidence": (m.get("confidence") or {}).get("label"),
        "observed_monthly_mxn": obs["monthly_projection_mxn"] if obs else None,
        "observed_days": obs["days"] if obs else 0,
    }
