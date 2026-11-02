"""Brent and diesel futures from Yahoo's public chart endpoint — no key.

Used for one thing: pricing the playbook. A cooling shelter on a remote site
runs on a diesel generator, so "stop work and cool" has a cost in AED/hour.
"""
from __future__ import annotations

import asyncio
import time

import httpx

CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
SYMBOLS = {"brent": ("BZ=F", "USD/bbl"), "diesel": ("HO=F", "USD/gal")}
AED_PER_USD = 3.6725  # fixed peg
LITRES_PER_GALLON = 3.785
GENERATOR_L_PER_HOUR = 6.0  # ~60 kVA set running a shelter's AC at ~70% load
TTL = 900
_cache: dict = {"at": 0.0, "data": None}


async def _quote(client: httpx.AsyncClient, key: str, symbol: str, unit: str) -> dict:
    r = await client.get(CHART_URL.format(symbol=symbol), params={"range": "1mo", "interval": "1d"})
    r.raise_for_status()
    res = r.json()["chart"]["result"][0]
    closes = [c for c in res["indicators"]["quote"][0]["close"] if c is not None]
    price = res["meta"]["regularMarketPrice"]
    prev = closes[-2] if len(closes) > 1 else price
    return {"key": key, "symbol": symbol, "unit": unit, "price": round(price, 3),
            "change_pct": round(100 * (price - prev) / prev, 2) if prev else 0.0,
            "series": [round(c, 3) for c in closes]}


async def quotes() -> dict:
    if _cache["data"] and time.time() - _cache["at"] < TTL:
        return _cache["data"]
    try:
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "Mozilla/5.0"}) as client:
            rows = await asyncio.gather(*(_quote(client, k, s, u) for k, (s, u) in SYMBOLS.items()))
    except (httpx.HTTPError, KeyError, IndexError, TypeError):
        return _cache["data"] or {"quotes": [], "cooling_aed_per_hour": None, "stale": True, "source": "yahoo"}

    diesel = next(r for r in rows if r["key"] == "diesel")
    aed_per_litre = diesel["price"] / LITRES_PER_GALLON * AED_PER_USD
    data = {"quotes": rows, "aed_per_litre_wholesale": round(aed_per_litre, 2),
            "cooling_aed_per_hour": round(aed_per_litre * GENERATOR_L_PER_HOUR, 1),
            "stale": False, "source": "yahoo finance (futures)"}
    _cache.update(at=time.time(), data=data)
    return data
