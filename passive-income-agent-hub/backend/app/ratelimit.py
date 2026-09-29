"""Límite de peticiones en memoria (ventana deslizante de 60 s por IP).

Suficiente para un despliegue de una sola instancia. Para varias instancias usar Redis.
"""
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .config import get_settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.hits: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)
        s = get_settings()
        ip = request.client.host if request.client else "desconocido"
        is_login = request.url.path in ("/api/auth/login", "/api/auth/register")
        key = f"{ip}:{'login' if is_login else 'api'}"
        limit = s.login_rate_limit_per_minute if is_login else s.rate_limit_per_minute
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= limit:
            return JSONResponse({"detail": "Demasiadas peticiones; intenta en un minuto."}, status_code=429)
        q.append(now)
        return await call_next(request)
