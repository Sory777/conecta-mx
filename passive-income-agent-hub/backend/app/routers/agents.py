import logging
from datetime import datetime, time
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..agents import monitor, pipeline, researcher
from ..agents.registry import RESEARCH_AGENTS, agent_defs
from ..config import get_settings
from ..db import SessionLocal, get_db
from ..models import CATEGORIES, Agent, AgentRun, DecisionLog, Opportunity, PlatformChange, ResearchResult, Status, User
from ..security import current_user
from ..serializers import row
from ..services.records import RunContext
from ..services.web import available_search_provider

router = APIRouter(prefix="/api", tags=["agentes"])
log = logging.getLogger("hub.agents")


@router.get("/agents")
def list_agents(user: User = Depends(current_user), db: Session = Depends(get_db)):
    defs = agent_defs()
    out = []
    for a in db.scalars(select(Agent).order_by(Agent.id)):
        runs = db.scalar(select(func.count(AgentRun.id)).where(AgentRun.agent_key == a.key)) or 0
        d = {**row(a), **{k: v for k, v in defs.get(a.key, {}).items() if k in ("category", "preset_queries")},
             "runs": runs, "runnable": a.key in RESEARCH_AGENTS or a.key in ("monitor", "rentabilidad", "antifraude", "automatizacion")}
        out.append(d)
    return {"agents": out, "search_provider": available_search_provider(), "runs_today": runs_today(db),
            "max_runs_per_day": get_settings().max_agent_runs_per_day}


def runs_today(db: Session) -> int:
    start = datetime.combine(datetime.utcnow().date(), time.min)
    return db.scalar(select(func.count(AgentRun.id)).where(AgentRun.started_at >= start,
                                                           AgentRun.agent_key.in_(RESEARCH_AGENTS))) or 0


class RunIn(BaseModel):
    query: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = None


def execute(agent_key: str, user_id: Optional[int], payload: dict, trigger: str = "manual") -> None:
    """Se ejecuta en segundo plano con su propia sesión de BD."""
    db = SessionLocal()
    try:
        with RunContext(db, agent_key, user_id, trigger, payload) as run:
            if agent_key in RESEARCH_AGENTS:
                researcher.run(db, run, payload["query"], payload.get("category"))
            elif agent_key == "monitor":
                monitor.run(db, run)
            else:  # re-evaluar todas las oportunidades no descartadas (antifraude/automatización/rentabilidad)
                n = 0
                for opp in db.scalars(select(Opportunity).where(Opportunity.status != Status.DESCARTADA)):
                    pipeline.evaluate(db, opp, agent_run_id=run.id)
                    n += 1
                run.summary = f"{n} oportunidades re-evaluadas"
    except Exception:  # noqa: BLE001 - ya quedó registrado en agent_runs
        log.exception("ejecución de %s falló", agent_key)
    finally:
        db.close()


@router.post("/agents/{key}/run")
def run_agent(key: str, data: RunIn, background: BackgroundTasks, user: User = Depends(current_user),
              db: Session = Depends(get_db)):
    defs = agent_defs()
    if key not in defs:
        raise HTTPException(404, "Agente no encontrado")
    agent = db.scalar(select(Agent).where(Agent.key == key))
    if agent and not agent.enabled:
        raise HTTPException(409, "Agente desactivado")
    payload: dict = {}
    if key in RESEARCH_AGENTS:
        if available_search_provider() is None:
            raise HTTPException(409, "Configura ANTHROPIC_API_KEY o BRAVE_API_KEY en el .env para buscar en la web.")
        if runs_today(db) >= get_settings().max_agent_runs_per_day:
            raise HTTPException(429, "Límite diario de ejecuciones de investigación alcanzado (MAX_AGENT_RUNS_PER_DAY).")
        category = data.category or defs[key]["category"]
        if category and category not in CATEGORIES:
            raise HTTPException(422, "Categoría inválida")
        query = (data.query or "").strip() or (defs[key]["preset_queries"] or [""])[0]
        if not query:
            raise HTTPException(422, "Indica qué buscar.")
        payload = {"query": query, "category": category}
    background.add_task(execute, key, user.id, payload)
    return {"queued": True, "agent": key, "input": payload}


@router.get("/agent-runs")
def list_runs(agent: Optional[str] = None, limit: int = 50, user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(AgentRun).order_by(AgentRun.started_at.desc()).limit(min(limit, 200))
    if agent:
        stmt = stmt.where(AgentRun.agent_key == agent)
    return [row(r) for r in db.scalars(stmt)]


@router.get("/research-results")
def list_research(opportunity_id: Optional[int] = None, run_id: Optional[int] = None, limit: int = 100,
                  user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(ResearchResult).order_by(ResearchResult.retrieved_at.desc()).limit(min(limit, 500))
    if opportunity_id:
        stmt = stmt.where(ResearchResult.opportunity_id == opportunity_id)
    if run_id:
        stmt = stmt.where(ResearchResult.agent_run_id == run_id)
    return [row(r) for r in db.scalars(stmt)]


@router.get("/decisions")
def list_decisions(opportunity_id: Optional[int] = None, agent: Optional[str] = None, limit: int = 100,
                   user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(DecisionLog).order_by(DecisionLog.created_at.desc()).limit(min(limit, 500))
    if opportunity_id:
        stmt = stmt.where(DecisionLog.opportunity_id == opportunity_id)
    if agent:
        stmt = stmt.where(DecisionLog.agent_key == agent)
    out = []
    for d in db.scalars(stmt):
        r = row(d)
        opp = db.get(Opportunity, d.opportunity_id) if d.opportunity_id else None
        r["opportunity_title"] = opp.title if opp else None
        out.append(r)
    return out


@router.get("/platform-changes")
def list_changes(limit: int = 100, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [row(c) for c in db.scalars(select(PlatformChange).order_by(PlatformChange.detected_at.desc()).limit(min(limit, 500)))]
