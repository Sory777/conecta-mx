"""Conversión de moneda a MXN con tasas actualizadas.

Fuentes (APIs públicas reales):
- Fiat: Frankfurter (tasas de referencia del Banco Central Europeo), https://api.frankfurter.app
- Cripto: CoinGecko /simple/price, https://api.coingecko.com/api/v3/simple/price

Si no hay tasa disponible NO se inventa: se lanza FxUnavailable y el usuario debe dar la tasa manual.
"""
import logging
from datetime import timedelta
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import FxRate, utcnow

log = logging.getLogger("hub.fx")

FIAT = {"USD", "EUR", "GBP", "CAD", "JPY", "CHF", "BRL"}
# símbolo -> id de CoinGecko
CRYPTO_IDS = {
    "BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana", "USDT": "tether", "USDC": "usd-coin",
    "LTC": "litecoin", "XMR": "monero", "HNT": "helium", "FIL": "filecoin", "AR": "arweave",
    "RNDR": "render-token", "AKT": "akash-network",
}
FRANKFURTER_URL = "https://api.frankfurter.app/latest"
COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"


class FxUnavailable(Exception):
    pass


def supported_currencies() -> list[str]:
    return ["MXN", *sorted(FIAT), *sorted(CRYPTO_IDS)]


def _fetch_fiat(cur: str) -> tuple[float, str, str]:
    s = get_settings()
    r = httpx.get(FRANKFURTER_URL, params={"base": cur, "symbols": "MXN"}, timeout=s.http_timeout_seconds)
    r.raise_for_status()
    data = r.json()
    return float(data["rates"]["MXN"]), "Frankfurter (BCE)", data.get("date", "")


def _fetch_crypto(cur: str) -> tuple[float, str, str]:
    s = get_settings()
    headers = {"x-cg-demo-api-key": s.coingecko_demo_api_key} if s.coingecko_demo_api_key else {}
    cg_id = CRYPTO_IDS[cur]
    r = httpx.get(COINGECKO_URL, params={"ids": cg_id, "vs_currencies": "mxn"}, headers=headers,
                  timeout=s.http_timeout_seconds)
    r.raise_for_status()
    return float(r.json()[cg_id]["mxn"]), "CoinGecko", utcnow().date().isoformat()


def get_rate(db: Session, currency: str, max_age_minutes: Optional[int] = None) -> FxRate:
    cur = currency.upper()
    if cur == "MXN":
        return FxRate(currency="MXN", rate_to_mxn=1.0, source="base", fetched_at=utcnow())
    max_age = max_age_minutes if max_age_minutes is not None else get_settings().fx_cache_minutes
    cached = db.scalar(select(FxRate).where(FxRate.currency == cur).order_by(FxRate.fetched_at.desc()))
    if cached and cached.fetched_at > utcnow() - timedelta(minutes=max_age):
        return cached
    try:
        if cur in FIAT:
            rate, source, date = _fetch_fiat(cur)
            url = FRANKFURTER_URL
        elif cur in CRYPTO_IDS:
            rate, source, date = _fetch_crypto(cur)
            url = COINGECKO_URL
        else:
            raise FxUnavailable(f"Moneda {cur} no soportada; proporciona la tasa manualmente.")
    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("no se pudo obtener tasa %s: %s", cur, e)
        if cached:
            return cached  # se devuelve la última conocida; su fecha queda visible en fx_source
        raise FxUnavailable(f"No se pudo obtener la tasa {cur}/MXN ({e}). Proporciona la tasa manualmente.")
    fx = FxRate(currency=cur, rate_to_mxn=rate, source=source, source_url=url, rate_date=date)
    db.add(fx)
    db.flush()
    return fx


def to_mxn(db: Session, amount: float, currency: str, manual_rate: Optional[float] = None) -> tuple[float, float, str]:
    """Devuelve (monto_mxn, tasa, descripción_de_la_fuente)."""
    cur = currency.upper()
    if cur == "MXN":
        return amount, 1.0, "base"
    if manual_rate:
        return amount * manual_rate, manual_rate, "manual (usuario)"
    fx = get_rate(db, cur)
    return amount * fx.rate_to_mxn, fx.rate_to_mxn, f"{fx.source} {fx.rate_date or ''} consultado {fx.fetched_at:%Y-%m-%d %H:%M} UTC".strip()
