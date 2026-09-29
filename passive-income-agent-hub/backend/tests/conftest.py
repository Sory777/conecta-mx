import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["SECRET_KEY"] = "test-secret-key-0123456789abcdef0123456789"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["BRAVE_API_KEY"] = ""
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["RATE_LIMIT_PER_MINUTE"] = "10000"
os.environ["LOGIN_RATE_LIMIT_PER_MINUTE"] = "10000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import fx, web  # noqa: E402


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Los tests nunca salen a Internet: RDAP sin datos y tasa USD fija conocida."""
    monkeypatch.setattr(web, "rdap_domain_created", lambda domain: None)
    monkeypatch.setattr(fx, "_fetch_fiat", lambda cur: (20.0, "test", "2026-01-01"))
    monkeypatch.setattr(fx, "_fetch_crypto", lambda cur: (1_000_000.0, "test", "2026-01-01"))


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        r = c.post("/api/auth/register", json={"email": "yo@example.com", "password": "contrasena-segura-123"})
        assert r.status_code == 200, r.text
        yield c
