"""Esquema de base de datos.

Tablas de conocimiento (compartidas): platforms, opportunities, data_points, research_results,
risk_assessments, automation_tasks, platform_changes, decision_logs, agents, agent_runs, fx_rates.
Tablas del usuario (aisladas por user_id): experiments, experiment_logs, transactions, earnings,
expenses, withdrawals, alerts.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------- Enumeraciones (como texto)
class Status:
    ACTIVA = "ACTIVA"
    EN_PRUEBA = "EN_PRUEBA"
    INVESTIGANDO = "INVESTIGANDO"
    REQUIERE_ACCION = "REQUIERE_ACCION"
    DESCARTADA = "DESCARTADA"
    ALL = [ACTIVA, EN_PRUEBA, INVESTIGANDO, REQUIERE_ACCION, DESCARTADA]


class Risk:
    BAJO = "BAJO"
    MEDIO = "MEDIO"
    ALTO = "ALTO"
    DESCARTAR = "DESCARTAR"
    ALL = [BAJO, MEDIO, ALTO, DESCARTAR]


class Evidence:
    """Tipo de evidencia de cada dato. Es la base del principio de escepticismo."""
    OBSERVADO = "OBSERVADO"                 # medido por nosotros (experimentos, transacciones)
    ESTIMACION = "ESTIMACION"               # cálculo a partir de datos con fuente verificable
    SUPOSICION = "SUPOSICION"               # supuesto explícito del usuario o del sistema
    PROMESA_PLATAFORMA = "PROMESA_PLATAFORMA"  # lo que la plataforma dice de sí misma
    NO_VERIFICADA = "NO_VERIFICADA"         # sin fuente o fuente no comprobable
    ALL = [OBSERVADO, ESTIMACION, SUPOSICION, PROMESA_PLATAFORMA, NO_VERIFICADA]


CATEGORIES = [
    "microtareas", "encuestas", "testing_apps", "testing_web", "crowdsourcing", "recompensas",
    "cashback", "afiliados", "productos_digitales", "automatizacion_ia", "servicios_digitales",
    "mineria", "depin", "hardware", "computacion_distribuida", "comparticion_recursos", "staking",
    "web3", "investigacion_remunerada", "contenido_automatico", "licenciamiento_contenido",
    "plantillas", "print_on_demand", "otra",
]


# ---------------------------------------------------------------- Usuarios
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120), default="")
    capital_limit_mxn: Mapped[float] = mapped_column(Float, default=0.0)
    min_hourly_rate_mxn: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    investment_alert_threshold_mxn: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------------------------------------------------------------- Conocimiento
class Platform(Base):
    __tablename__ = "platforms"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    category: Mapped[str] = mapped_column(String(60), default="otra")
    countries: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mexico_available: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)  # None = no verificado
    payment_methods: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    min_payout: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_payout_currency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    fees_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tos_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    tos_prohibits_automation: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    has_official_api: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    api_docs_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(30), default=Evidence.NO_VERIFICADA)
    domain_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    monitored_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    content_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Opportunity(Base):
    __tablename__ = "opportunities"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(250))
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str] = mapped_column(String(60), default="otra", index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default=Status.INVESTIGANDO, index=True)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # None = sin evaluar
    automation_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    priority: Mapped[float] = mapped_column(Float, default=0.0)
    discovered_by: Mapped[str] = mapped_column(String(60), default="usuario")
    discovery_reason: Mapped[str] = mapped_column(Text, default="")
    discard_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # salida del agente de rentabilidad
    # señales antifraude que el usuario revisó y marcó como falso positivo: [{code, reason, at}]
    dismissed_flags: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    platform: Mapped[Optional[Platform]] = relationship()


class DataPoint(Base):
    """Un dato con su procedencia. Todas las cifras de rentabilidad salen de aquí."""
    __tablename__ = "data_points"
    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    field: Mapped[str] = mapped_column(String(60), index=True)
    value: Mapped[float] = mapped_column(Float)
    value_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    value_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    evidence_type: Mapped[str] = mapped_column(String(30), default=Evidence.NO_VERIFICADA)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    source_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    retrieved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(60), default="usuario")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ResearchResult(Base):
    __tablename__ = "research_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    agent_run_id: Mapped[Optional[int]] = mapped_column(ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True)
    opportunity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"), nullable=True)
    query: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    url: Mapped[str] = mapped_column(String(1000))
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source: Mapped[str] = mapped_column(String(60))  # anthropic_web_search, brave, rss, fetch, manual
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    page_age: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    risk_level: Mapped[str] = mapped_column(String(20))
    flags: Mapped[list] = mapped_column(JSON, default=list)       # [{code, severity, detail, evidence}]
    checks: Mapped[list] = mapped_column(JSON, default=list)      # verificaciones realizadas y su resultado
    reasoning: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AutomationTask(Base):
    __tablename__ = "automation_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(Text)
    method: Mapped[str] = mapped_column(String(40))  # api_oficial, cliente_oficial, recordatorio, registro, manual
    allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    policy_reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="PROPUESTA")  # PROPUESTA, BLOQUEADA
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PlatformChange(Base):
    __tablename__ = "platform_changes"
    id: Mapped[int] = mapped_column(primary_key=True)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    change_type: Mapped[str] = mapped_column(String(60))  # contenido, automatizacion, pais, pagos, inaccesible
    summary: Mapped[str] = mapped_column(Text)
    diff_excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    phase: Mapped[int] = mapped_column(Integer, default=1)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class AgentRun(Base):
    __tablename__ = "agent_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    agent_key: Mapped[str] = mapped_column(String(60), index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    trigger: Mapped[str] = mapped_column(String(30), default="manual")  # manual, programado, encadenado
    input: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="EN_CURSO")  # EN_CURSO, OK, ERROR
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class DecisionLog(Base):
    """Historial de decisiones: por qué cada agente hizo lo que hizo (sin cajas negras)."""
    __tablename__ = "decision_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    agent_key: Mapped[str] = mapped_column(String(60), index=True)
    agent_run_id: Mapped[Optional[int]] = mapped_column(ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True)
    opportunity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(60))
    # Secciones: found_because, data_used, risks, can_automate, cannot_automate, discard_reason, conclusion
    sections: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FxRate(Base):
    __tablename__ = "fx_rates"
    id: Mapped[int] = mapped_column(primary_key=True)
    currency: Mapped[str] = mapped_column(String(10), index=True)
    rate_to_mxn: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    rate_date: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------------------------------------------------------------- Datos del usuario
class Experiment(Base):
    __tablename__ = "experiments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    hypothesis: Mapped[str] = mapped_column(Text, default="")
    duration_days: Mapped[int] = mapped_column(Integer, default=7)
    target_net_mxn: Mapped[float] = mapped_column(Float, default=0.0)
    budget_mxn: Mapped[float] = mapped_column(Float, default=0.0)
    planned_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="EN_CURSO")  # EN_CURSO, FINALIZADO, CANCELADO
    estimate_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # métricas estimadas al iniciar
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    recommendation: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # CONTINUAR, MODIFICAR, ABANDONAR
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    opportunity: Mapped[Opportunity] = relationship()
    logs: Mapped[list["ExperimentLog"]] = relationship(back_populates="experiment", cascade="all, delete-orphan",
                                                       order_by="ExperimentLog.day")


class ExperimentLog(Base):
    __tablename__ = "experiment_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    day: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    minutes_used: Mapped[float] = mapped_column(Float, default=0)
    tasks_available: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tasks_completed: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    problems: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    experiment: Mapped[Experiment] = relationship(back_populates="logs")


class Transaction(Base):
    """Libro mayor: todo movimiento de dinero. earnings/expenses/withdrawals guardan el detalle."""
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    experiment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("experiments.id", ondelete="SET NULL"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(20))  # ingreso, gasto, retiro
    occurred_on: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="MXN")
    fx_rate_to_mxn: Mapped[float] = mapped_column(Float, default=1.0)
    fx_source: Mapped[str] = mapped_column(String(200), default="base")
    amount_mxn: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Earning(Base):
    __tablename__ = "earnings"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDIENTE")  # PENDIENTE (saldo en plataforma), CONFIRMADO
    tasks_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    minutes_spent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class Expense(Base):
    __tablename__ = "expenses"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"), unique=True)
    category: Mapped[str] = mapped_column(String(40))  # electricidad, comisiones, suscripcion, hardware, mantenimiento, otro
    is_investment: Mapped[bool] = mapped_column(Boolean, default=False)  # capital inicial (cuenta contra el límite)


class Withdrawal(Base):
    __tablename__ = "withdrawals"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"), unique=True)
    method: Mapped[str] = mapped_column(String(60), default="")
    status: Mapped[str] = mapped_column(String(20), default="SOLICITADO")  # SOLICITADO, RECIBIDO, RECHAZADO
    fee_mxn: Mapped[float] = mapped_column(Float, default=0.0)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # None = para todos
    kind: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(10), default="info")  # info, aviso, critica
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text, default="")
    opportunity_id: Mapped[Optional[int]] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="CASCADE"), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
