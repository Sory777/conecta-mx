"""Ayudantes para alertas, historial de decisiones y ejecuciones de agentes."""
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Agent, AgentRun, Alert, DecisionLog, User, utcnow

log = logging.getLogger("hub.records")


def create_alert(db: Session, kind: str, title: str, body: str = "", severity: str = "info",
                 user_id: Optional[int] = None, opportunity_id: Optional[int] = None,
                 platform_id: Optional[int] = None) -> list[Alert]:
    """Si user_id es None la alerta se replica para cada usuario (cada uno la marca como leída)."""
    user_ids = [user_id] if user_id is not None else list(db.scalars(select(User.id)))
    created = []
    for uid in user_ids:
        a = Alert(user_id=uid, kind=kind, title=title, body=body, severity=severity,
                  opportunity_id=opportunity_id, platform_id=platform_id)
        db.add(a)
        created.append(a)
    log.info("alerta %s: %s", kind, title)
    return created


def log_decision(db: Session, agent_key: str, action: str, sections: dict,
                 opportunity_id: Optional[int] = None, agent_run_id: Optional[int] = None) -> DecisionLog:
    clean = {k: v for k, v in sections.items() if v not in (None, "", [], {})}
    d = DecisionLog(agent_key=agent_key, action=action, sections=clean,
                    opportunity_id=opportunity_id, agent_run_id=agent_run_id)
    db.add(d)
    return d


class RunContext:
    """Registra una ejecución de agente (agent_runs) con estado, resumen y errores."""

    def __init__(self, db: Session, agent_key: str, user_id: Optional[int] = None,
                 trigger: str = "manual", input: Optional[dict] = None):
        self.db = db
        self.run = AgentRun(agent_key=agent_key, user_id=user_id, trigger=trigger, input=input)
        db.add(self.run)
        db.flush()

    def __enter__(self):
        return self.run

    def __exit__(self, exc_type, exc, tb):
        self.run.finished_at = utcnow()
        agent = self.db.scalar(select(Agent).where(Agent.key == self.run.agent_key))
        if agent:
            agent.last_run_at = self.run.finished_at
        if exc:
            r = self.run
            saved = dict(id=r.id, agent_key=r.agent_key, user_id=r.user_id, trigger=r.trigger, input=r.input,
                         started_at=r.started_at)
            self.db.rollback()
            # lo no confirmado se revirtió; si la ejecución ya se había confirmado se actualiza, si no se recrea
            run = self.db.get(AgentRun, saved["id"]) if saved["id"] else None
            if run is None:
                saved.pop("id")
                run = AgentRun(**saved)
                self.db.add(run)
            run.status, run.error, run.finished_at = "ERROR", f"{type(exc).__name__}: {exc}", utcnow()
            self.db.commit()
            log.error("agente %s falló: %s", saved.get("agent_key", run.agent_key), exc)
            return False
        self.run.status = "OK"
        self.db.commit()
        return False
