import logging
import os
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import scheduler
from .agents.registry import sync_agents
from .config import INSECURE_DEFAULT_SECRET, get_settings
from .db import Base, SessionLocal, engine
from .ratelimit import RateLimitMiddleware
from .routers import agents, alerts, auth, dashboard, experiments, finance, opportunities, settings


def setup_logging() -> None:
    os.makedirs("logs", exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    root = logging.getLogger()
    if any(isinstance(h, RotatingFileHandler) for h in root.handlers):
        return
    fh = RotatingFileHandler("logs/app.log", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
    fh.setFormatter(fmt)
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    root.addHandler(fh)
    root.addHandler(sh)
    root.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    log = logging.getLogger("hub")
    if get_settings().secret_key == INSECURE_DEFAULT_SECRET:
        log.warning("SECRET_KEY por defecto: configura uno aleatorio en .env antes de exponer la app.")
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        sync_agents(db)
    finally:
        db.close()
    tasks = scheduler.start()
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(title="Passive Income Agent Hub", version="0.1.0", lifespan=lifespan)
app.add_middleware(RateLimitMiddleware)

for r in (auth, settings, dashboard, opportunities, experiments, finance, agents, alerts):
    app.include_router(r.router)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logging.getLogger("hub").exception("error no controlado en %s", request.url.path)
    return JSONResponse({"detail": "Error interno. Revisa logs/app.log."}, status_code=500)


@app.get("/api/health")
def health():
    return {"ok": True}


# Frontend compilado (npm run build) servido por el mismo proceso
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        target = DIST / path
        if path and target.is_file() and DIST in target.resolve().parents:
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
