"""Configuración centralizada. Todos los secretos vienen de variables de entorno (.env)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "dev-insecure-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Seguridad
    secret_key: str = INSECURE_DEFAULT_SECRET
    access_token_minutes: int = 60 * 12
    allow_registration: bool = False
    cookie_secure: bool = False

    # Base de datos
    database_url: str = "sqlite:///./data/hub.db"

    # Proveedores externos (opcionales)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    brave_api_key: str = ""
    coingecko_demo_api_key: str = ""

    # Límites
    max_agent_runs_per_day: int = 30
    rate_limit_per_minute: int = 120
    login_rate_limit_per_minute: int = 10
    http_timeout_seconds: float = 20.0

    # Agentes continuos
    scheduler_enabled: bool = False
    monitor_interval_hours: float = 24
    research_interval_hours: float = 72
    research_default_queries: str = ""

    # Moneda base
    base_currency: str = "MXN"
    fx_cache_minutes: int = 60

    @property
    def research_queries(self) -> list[str]:
        return [q.strip() for q in self.research_default_queries.split("|") if q.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
