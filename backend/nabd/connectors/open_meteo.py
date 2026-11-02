"""Live environmental data from Open-Meteo (no API key required).

Three endpoints are merged into one hourly frame per site:
  forecast     temperature, humidity, wet-bulb, wind, radiation, UV, soil moisture, precipitation
  air-quality  PM10, PM2.5, dust, aerosol optical depth, US AQI
  marine       sea-surface temperature, wave height (coastal sites only)

Responses are cached in memory and on disk. Open-Meteo free tier rate-limits
aggressively on Render cold starts, so we:
  - serialise outbound calls (global semaphore)
  - retry briefly on HTTP 429
  - fall back to disk cache, then a synthetic UAE summer frame
so the overview never stays a blank loading screen.
"""
from __future__ import annotations

import asyncio
import json
import math
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

CACHE_TTL_S = 1800  # 30 min — fewer cold-start stampedes
CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache"
TIMEOUT = httpx.Timeout(20.0, connect=8.0)

# One Open-Meteo call at a time across the whole process (free-tier friendly).
_http_sem = asyncio.Semaphore(1)
_http_lock = asyncio.Lock()
_last_http_at = 0.0
_MIN_GAP_S = 0.35


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


async def _throttle() -> None:
    """Space outbound Open-Meteo calls so cold starts don't 429."""
    global _last_http_at
    async with _http_lock:
        gap = _MIN_GAP_S - (time.time() - _last_http_at)
        if gap > 0:
            await asyncio.sleep(gap)
        _last_http_at = time.time()


async def _get(client: httpx.AsyncClient, url: str, params: dict[str, Any]) -> dict[str, Any]:
    last_exc: Exception | None = None
    for attempt in range(3):
        await _throttle()
        async with _http_sem:
            try:
                response = await client.get(url, params=params)
                if response.status_code == 429:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    last_exc = httpx.HTTPStatusError(
                        "429 Too Many Requests", request=response.request, response=response
                    )
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as exc:
                last_exc = exc
                await asyncio.sleep(0.8 * (attempt + 1))
    assert last_exc is not None
    raise last_exc


def _now_index(times: list[str], utc_offset_s: int) -> int:
    local_now = time.strftime("%Y-%m-%dT%H:00", time.gmtime(time.time() + utc_offset_s))
    if local_now in times:
        return times.index(local_now)
    earlier = [i for i, t in enumerate(times) if t <= local_now]
    return earlier[-1] if earlier else 0


def _replay_window(replay: str) -> tuple[str, str]:
    at = datetime.fromisoformat(replay)
    return (at - timedelta(days=21)).date().isoformat(), (at + timedelta(days=1)).date().isoformat()


def _synthetic_frame(site: Site, replay: str | None = None) -> SiteFrame:
    """Plausible UAE summer hourly series when Open-Meteo is rate-limited / offline."""
    if replay:
        centre = datetime.fromisoformat(replay)
    else:
        # Asia/Dubai ≈ UTC+4 (no tzdata dependency on slim images)
        centre = datetime.utcnow() + timedelta(hours=4)
        centre = centre.replace(minute=0, second=0, microsecond=0)
    start = centre - timedelta(hours=71)
    times = [(start + timedelta(hours=i)).strftime("%Y-%m-%dT%H:00") for i in range(84)]
    series: dict[str, list[float | None]] = {}
    for i, t in enumerate(times):
        hour = int(t[11:13])
        # Diurnal curves centred on a hot Gulf summer day.
        temp = 34 + 8 * math.sin((hour - 8) / 24 * 2 * math.pi)
        rh = 55 - 15 * math.sin((hour - 8) / 24 * 2 * math.pi)
        wbgt = temp - 4 + (100 - rh) * -0.02
        feel = temp + 2
        series.setdefault("temperature_2m", []).append(round(temp, 1))
        series.setdefault("relative_humidity_2m", []).append(round(rh, 1))
        series.setdefault("apparent_temperature", []).append(round(feel, 1))
        series.setdefault("wet_bulb_temperature_2m", []).append(round(wbgt, 1))
        series.setdefault("wind_speed_10m", []).append(12.0)
        series.setdefault("shortwave_radiation", []).append(max(0.0, 900 * math.sin(max(0, hour - 6) / 12 * math.pi)))
        series.setdefault("uv_index", []).append(round(max(0.0, 9 * math.sin(max(0, hour - 6) / 12 * math.pi)), 1))
        series.setdefault("soil_moisture_0_to_1cm", []).append(0.08)
        series.setdefault("precipitation", []).append(0.0)
        series.setdefault("pm10", []).append(80.0)
        series.setdefault("pm2_5", []).append(35.0)
        series.setdefault("dust", []).append(40.0)
        series.setdefault("aerosol_optical_depth", []).append(0.35)
        series.setdefault("us_aqi", []).append(95.0)
        if site.coastal:
            series.setdefault("sea_surface_temperature", []).append(32.5)
            series.setdefault("wave_height", []).append(0.6)
    now_index = 71
    return SiteFrame(
        site_id=_key(site.id, replay),
        fetched_at=time.time(),
        stale=True,
        time=times,
        now_index=now_index,
        series=series,
        sources=["synthetic:uae-summer-fallback"],
    )


async def _fetch(site: Site, replay: str | None = None) -> SiteFrame:
    base: dict[str, Any] = {"latitude": site.lat, "longitude": site.lon, "timezone": "Asia/Dubai"}
    if replay:
        start, end = _replay_window(replay)
        base |= {"start_date": start, "end_date": end}
    else:
        # Shorter window = lighter responses; still enough for 72h charts.
        base |= {"past_days": 7, "forecast_days": 2}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Sequential within a site too — avoid 2–3 parallel hits per site.
        forecast = await _get(
            client,
            HISTORICAL_URL if replay else FORECAST_URL,
            {**base, "hourly": ",".join(FORECAST_HOURLY)},
        )
        try:
            air = await _get(client, AIR_URL, {**base, "hourly": ",".join(AIR_HOURLY)})
        except httpx.HTTPError:
            air = None
        marine = None
        if site.coastal:
            try:
                marine = await _get(client, MARINE_URL, {**base, "hourly": ",".join(MARINE_HOURLY)})
            except httpx.HTTPError:
                marine = None

    times: list[str] = forecast["hourly"]["time"]
    series: dict[str, list[float | None]] = {k: forecast["hourly"].get(k, []) for k in FORECAST_HOURLY}
    sources = ["open-meteo:forecast"]

    for payload, keys, label in (
        (air, AIR_HOURLY, "open-meteo:air-quality"),
        (marine, MARINE_HOURLY, "open-meteo:marine"),
    ):
        if payload is None:
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
    return SiteFrame(
        site_id=_key(site.id, replay),
        fetched_at=time.time(),
        stale=False,
        time=times,
        now_index=now_index,
        series=series,
        sources=sources,
    )


def _key(site_id: str, replay: str | None) -> str:
    return f"{site_id}@{replay.replace(':', '')}" if replay else site_id


def _disk_path(site_id: str) -> Path:
    return CACHE_DIR / f"{site_id}.json"


def _save(frame: SiteFrame) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _disk_path(frame.site_id).write_text(json.dumps(asdict(frame)))
    except OSError:
        pass


def _load(site_id: str) -> SiteFrame | None:
    path = _disk_path(site_id)
    if not path.exists():
        return None
    try:
        frame = SiteFrame(**json.loads(path.read_text()))
        frame.stale = True
        return frame
    except (OSError, json.JSONDecodeError, TypeError, KeyError):
        return None


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
        except (httpx.HTTPError, KeyError, ValueError, IndexError, TypeError):
            frame = cached or _load(key) or _synthetic_frame(site, replay)
            frame.stale = True
        _memory[key] = frame
        return frame
