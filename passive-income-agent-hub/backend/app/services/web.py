"""Acceso web: descarga de páginas oficiales, RDAP de dominios, búsqueda (Claude web search / Brave).

Toda consulta queda registrada con URL, fecha y fuente en research_results.
"""
import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from ..config import get_settings

log = logging.getLogger("hub.web")
USER_AGENT = "PassiveIncomeAgentHub/0.1 (investigacion personal; respeta robots y ToS)"


@dataclass
class SearchHit:
    url: str
    title: str = ""
    snippet: str = ""
    page_age: Optional[str] = None
    source: str = ""


@dataclass
class SearchOutcome:
    provider: str
    hits: list[SearchHit] = field(default_factory=list)
    summary: str = ""  # texto con el que el proveedor resumió lo encontrado (si aplica)


def domain_of(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    host = urlparse(url if "://" in url else "https://" + url).hostname or ""
    return host.lower().removeprefix("www.") or None


def fetch_text(url: str, max_chars: int = 60000) -> tuple[str, int]:
    """Descarga una página y devuelve (texto visible normalizado, status)."""
    s = get_settings()
    r = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=s.http_timeout_seconds, follow_redirects=True)
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in soup.get_text("\n").splitlines()]
    text = "\n".join(ln for ln in lines if ln)
    return text[:max_chars], r.status_code


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def rdap_domain_created(domain: str) -> Optional[datetime]:
    """Fecha de registro del dominio vía RDAP (protocolo público estándar, rdap.org redirige al registro)."""
    s = get_settings()
    try:
        r = httpx.get(f"https://rdap.org/domain/{domain}", timeout=s.http_timeout_seconds, follow_redirects=True,
                      headers={"Accept": "application/rdap+json"})
        if r.status_code != 200:
            return None
        for ev in r.json().get("events", []):
            if ev.get("eventAction") == "registration":
                return datetime.fromisoformat(ev["eventDate"].replace("Z", "+00:00")).replace(tzinfo=None)
    except (httpx.HTTPError, ValueError, KeyError) as e:
        log.info("RDAP falló para %s: %s", domain, e)
    return None


def brave_search(query: str, count: int = 10) -> SearchOutcome:
    """Brave Search API: GET https://api.search.brave.com/res/v1/web/search, cabecera X-Subscription-Token."""
    s = get_settings()
    r = httpx.get("https://api.search.brave.com/res/v1/web/search",
                  params={"q": query, "count": count},
                  headers={"Accept": "application/json", "X-Subscription-Token": s.brave_api_key},
                  timeout=s.http_timeout_seconds)
    r.raise_for_status()
    hits = [SearchHit(url=x["url"], title=x.get("title", ""), snippet=x.get("description", ""),
                      page_age=x.get("age"), source="brave")
            for x in r.json().get("web", {}).get("results", [])]
    return SearchOutcome(provider="brave", hits=hits)


def available_search_provider() -> Optional[str]:
    s = get_settings()
    if s.anthropic_api_key:
        return "anthropic_web_search"
    if s.brave_api_key:
        return "brave"
    return None
