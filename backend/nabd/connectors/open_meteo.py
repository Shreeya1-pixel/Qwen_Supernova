"""Live environmental data from Open-Meteo (no API key required).

Three endpoints are merged into one hourly frame per site:
  forecast     temperature, humidity, wet-bulb, wind, radiation, UV, soil moisture, precipitation
  air-quality  PM10, PM2.5, dust, aerosol optical depth, US AQI
  marine       sea-surface temperature, wave height (coastal sites only)

Responses are cached in memory and on disk. If the network is down the last
snapshot is served and flagged `stale=True`, so a demo never shows an empty screen.
"""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import httpx

from ..sites import Site

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HISTORICAL_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"

FORECAST_HOURLY = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature", "wet_bulb_temperature_2m",
    "wind_speed_10m", "shortwave_radiation", "uv_index", "soil_moisture_0_to_1cm", "precipitation",
]
AIR_HOURLY = ["pm10", "pm2_5", "dust", "aerosol_optical_depth", "us_aqi"]
MARINE_HOURLY = ["sea_surface_temperature", "wave_height"]

CACHE_TTL_S = 600
CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache"
TIMEOUT = httpx.Timeout(12.0, connect=6.0)


@dataclass
class SiteFrame:
    site_id: str
    fetched_at: float
    stale: bool
    time: list[str]
    now_index: int
    series: dict[str, list[float | None]] = field(default_factory=dict)
    sources: list[str] = field(default_factory=list)

    def current(self, key: str) -> float | None:
        values = self.series.get(key) or []
        for i in range(min(self.now_index, len(values) - 1), -1, -1):
            if values[i] is not None:
                return values[i]
        return None

    def history(self, key: str, hours: int = 48) -> list[float]:
        values = self.series.get(key) or []
        end = self.now_index + 1
        return [v for v in values[max(0, end - hours):end] if v is not None]

    def forecast(self, key: str, hours: int = 12) -> list[float | None]:
        values = self.series.get(key) or []
        return values[self.now_index + 1:self.now_index + 1 + hours]


_memory: dict[str, SiteFrame] = {}
_locks: dict[str, asyncio.Lock] = {}


async def _get(client: httpx.AsyncClient, url: str, params: dict[str, Any]) -> dict[str, Any]:
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()


def _now_index(times: list[str], utc_offset_s: int) -> int:
    local_now = time.strftime("%Y-%m-%dT%H:00", time.gmtime(time.time() + utc_offset_s))
    if local_now in times:
        return times.index(local_now)
    earlier = [i for i, t in enumerate(times) if t <= local_now]
    return earlier[-1] if earlier else 0


def _replay_window(replay: str) -> tuple[str, str]:
    at = datetime.fromisoformat(replay)
    return (at - timedelta(days=21)).date().isoformat(), (at + timedelta(days=1)).date().isoformat()


async def _fetch(site: Site, replay: str | None = None) -> SiteFrame:
    base: dict[str, Any] = {"latitude": site.lat, "longitude": site.lon, "timezone": "Asia/Dubai"}
    if replay:
        start, end = _replay_window(replay)
        base |= {"start_date": start, "end_date": end}
    else:
        base |= {"past_days": 21, "forecast_days": 2}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        calls = [
            _get(client, HISTORICAL_URL if replay else FORECAST_URL, {**base, "hourly": ",".join(FORECAST_HOURLY)}),
            _get(client, AIR_URL, {**base, "hourly": ",".join(AIR_HOURLY)}),
        ]
        if site.coastal:
            calls.append(_get(client, MARINE_URL, {**base, "hourly": ",".join(MARINE_HOURLY)}))
        results = await asyncio.gather(*calls, return_exceptions=True)

    forecast = results[0]
    if isinstance(forecast, BaseException):
        raise forecast
    times: list[str] = forecast["hourly"]["time"]
    series: dict[str, list[float | None]] = {k: forecast["hourly"].get(k, []) for k in FORECAST_HOURLY}
    sources = ["open-meteo:forecast"]

    for payload, keys, label in ((results[1], AIR_HOURLY, "open-meteo:air-quality"),
                                 (results[2] if site.coastal else None, MARINE_HOURLY, "open-meteo:marine")):
        if payload is None or isinstance(payload, BaseException):
            continue
        by_time = dict(zip(payload["hourly"]["time"], range(len(payload["hourly"]["time"]))))
        for key in keys:
            raw = payload["hourly"].get(key, [])
            series[key] = [raw[by_time[t]] if t in by_time and by_time[t] < len(raw) else None for t in times]
        sources.append(label)

    if replay:
        hour = datetime.fromisoformat(replay).strftime("%Y-%m-%dT%H:00")
        now_index = times.index(hour) if hour in times else len(times) - 1
    else:
        now_index = _now_index(times, forecast.get("utc_offset_seconds", 14400))
    return SiteFrame(site_id=_key(site.id, replay), fetched_at=time.time(), stale=False, time=times,
                     now_index=now_index, series=series, sources=sources)


def _key(site_id: str, replay: str | None) -> str:
    return f"{site_id}@{replay.replace(':', '')}" if replay else site_id


def _disk_path(site_id: str) -> Path:
    return CACHE_DIR / f"{site_id}.json"


def _save(frame: SiteFrame) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _disk_path(frame.site_id).write_text(json.dumps(asdict(frame)))


def _load(site_id: str) -> SiteFrame | None:
    path = _disk_path(site_id)
    if not path.exists():
        return None
    frame = SiteFrame(**json.loads(path.read_text()))
    frame.stale = True
    return frame


async def site_frame(site: Site, force: bool = False, replay: str | None = None) -> SiteFrame:
    """Live frame, or a historical one centred on `replay` (ISO local time, e.g. 2025-07-15T13:00)."""
    key = _key(site.id, replay)
    ttl = float("inf") if replay else CACHE_TTL_S
    cached = _memory.get(key)
    if cached and not force and time.time() - cached.fetched_at < ttl:
        return cached
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        cached = _memory.get(key)
        if cached and not force and time.time() - cached.fetched_at < ttl:
            return cached
        try:
            frame = await _fetch(site, replay)
            _save(frame)
        except (httpx.HTTPError, KeyError, ValueError):
            frame = cached or _load(key)
            if frame is None:
                raise
            frame.stale = True
        _memory[key] = frame
        return frame
