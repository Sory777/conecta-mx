"""Agentes continuos. Desactivados por defecto (SCHEDULER_ENABLED=false) porque consumen APIs de pago.

Monitor: cada MONITOR_INTERVAL_HOURS. Investigación: cada RESEARCH_INTERVAL_HOURS con RESEARCH_DEFAULT_QUERIES.
"""
import asyncio
import logging

from .config import get_settings

log = logging.getLogger("hub.scheduler")


async def _loop(name: str, interval_hours: float, job) -> None:
    while True:
        try:
            await asyncio.to_thread(job)
        except Exception:  # noqa: BLE001
            log.exception("tarea programada %s falló", name)
        await asyncio.sleep(max(interval_hours, 0.25) * 3600)


def start() -> list[asyncio.Task]:
    s = get_settings()
    if not s.scheduler_enabled:
        return []
    from .routers.agents import execute
    from .services.web import available_search_provider

    tasks = [asyncio.create_task(_loop("monitor", s.monitor_interval_hours,
                                       lambda: execute("monitor", None, {}, "programado")))]

    def research():
        if available_search_provider() is None:
            log.info("investigación programada omitida: sin proveedor de búsqueda")
            return
        for q in s.research_queries:
            execute("investigador", None, {"query": q, "category": None}, "programado")

    if s.research_queries:
        tasks.append(asyncio.create_task(_loop("investigador", s.research_interval_hours, research)))
    log.info("scheduler activo: %d tareas", len(tasks))
    return tasks
