"""Human exposure at a point: live conditions → how long someone can stay in the sun → alert text.

Conditions come from Open-Meteo (current hour, keyless). WBGT is the same estimate the index uses, and the
sun limit is the work/rest table from the playbooks (minutes of heavy outdoor work per hour).
"""
from __future__ import annotations

import asyncio
import time

import httpx

from ..automation.playbooks import work_rest
from ..connectors.open_meteo import site_frame
from ..sites import SITES
from .hazards import estimate_wbgt

FORECAST = "https://api.open-meteo.com/v1/forecast"
CURRENT = ("temperature_2m,relative_humidity_2m,apparent_temperature,wet_bulb_temperature_2m,"
           "shortwave_radiation,wind_speed_10m,uv_index,is_day")
_cache: dict[tuple[float, float], tuple[float, dict]] = {}
TTL_S = 600

SUN_ALERT = {
    "hi": "आप {m} मिनट से धूप में हैं। अभी छाया में जाएँ और पानी पिएँ।",
    "ur": "آپ {m} منٹ سے دھوپ میں ہیں۔ ابھی سائے میں جائیں اور پانی پئیں۔",
    "ml": "നിങ്ങൾ {m} മിനിറ്റായി വെയിലത്താണ്. ഇപ്പോൾ തണലിലേക്ക് മാറി വെള്ളം കുടിക്കുക.",
    "tl": "{m} minuto ka na sa araw. Pumunta sa lilim ngayon at uminom ng tubig.",
    "ta": "நீங்கள் {m} நிமிடமாக வெயிலில் இருக்கிறீர்கள். இப்போதே நிழலுக்குச் சென்று தண்ணீர் குடியுங்கள்.",
    "bn": "আপনি {m} মিনিট ধরে রোদে আছেন। এখনই ছায়ায় যান এবং পানি পান করুন।",
    "ar": "أنت تحت الشمس منذ {m} دقيقة. انتقل إلى الظل الآن واشرب الماء.",
}
HEAT_ALERT = {
    "hi": "आप {m} मिनट से बाहर गर्मी में हैं। अभी ठंडी जगह पर जाएँ और पानी पिएँ।",
    "ur": "آپ {m} منٹ سے باہر گرمی میں ہیں۔ ابھی ٹھنڈی جگہ جائیں اور پانی پئیں۔",
    "ml": "നിങ്ങൾ {m} മിനിറ്റായി പുറത്ത് ചൂടിലാണ്. ഇപ്പോൾ തണുത്ത സ്ഥലത്തേക്ക് മാറി വെള്ളം കുടിക്കുക.",
    "tl": "{m} minuto ka na sa labas sa init. Pumunta sa malamig na lugar ngayon at uminom ng tubig.",
    "ta": "நீங்கள் {m} நிமிடமாக வெளியே வெப்பத்தில் இருக்கிறீர்கள். இப்போதே குளிர்ந்த இடத்திற்குச் சென்று தண்ணீர் குடியுங்கள்.",
    "bn": "আপনি {m} মিনিট ধরে বাইরে গরমে আছেন। এখনই ঠান্ডা জায়গায় যান এবং পানি পান করুন।",
    "ar": "أنت في الخارج في الحر منذ {m} دقيقة. انتقل إلى مكان بارد الآن واشرب الماء.",
}
SUN_ALERT_EN = ("NABD heat alert: you've been in the sun for {m} min. Safe limit right now is {l} min "
                "(WBGT {w}°C). Move to shade now and drink water.")
HEAT_ALERT_EN = ("NABD heat alert: you've been working outdoors in the heat for {m} min. Safe limit right now is "
                 "{l} min (WBGT {w}°C). Move somewhere cool now and drink water.")


def _build(c: dict, source: str) -> dict:
    wbgt = estimate_wbgt(c["temperature_2m"], c["wet_bulb_temperature_2m"], c["shortwave_radiation"], c["wind_speed_10m"])
    rule = work_rest(wbgt)
    return {
        "time": c["time"],
        "temp_c": c["temperature_2m"],
        "humidity": c["relative_humidity_2m"],
        "feels_c": c["apparent_temperature"],
        "uv": c.get("uv_index") or 0.0,
        "wind_kmh": c["wind_speed_10m"],
        "is_day": bool(c["is_day"]),
        "wbgt": round(wbgt, 1),
        "rule": rule["rule"],
        "sun_limit_min": rule["work_minutes_per_hour"],
        "source": source,
    }


async def _nearest_site(lat: float, lng: float) -> dict:
    """Fallback: the nearest monitored site's hourly frame (has its own disk cache)."""
    site = min(SITES.values(), key=lambda s: (s.lat - lat) ** 2 + (s.lon - lng) ** 2)
    frame = await site_frame(site)
    c = {k: frame.current(k) for k in ("temperature_2m", "relative_humidity_2m", "apparent_temperature",
                                         "wet_bulb_temperature_2m", "shortwave_radiation", "wind_speed_10m", "uv_index")}
    if any(c[k] is None for k in ("temperature_2m", "wet_bulb_temperature_2m", "shortwave_radiation", "wind_speed_10m")):
        raise ValueError("no fallback data")
    c["time"] = frame.time[frame.now_index] if frame.time else ""
    c["is_day"] = (c["shortwave_radiation"] or 0) > 0
    stale = " · cached" if frame.stale else ""
    return _build(c, f"Open-Meteo via nearest site ({site.name}){stale} · WBGT estimated")


async def conditions(lat: float, lng: float) -> dict:
    key = (round(lat, 2), round(lng, 2))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < TTL_S:
        return hit[1]
    params = {"latitude": key[0], "longitude": key[1], "current": CURRENT, "timezone": "Asia/Dubai"}
    async with httpx.AsyncClient(timeout=10) as client:
        for attempt in range(2):
            try:
                r = await client.get(FORECAST, params=params)
                r.raise_for_status()
                out = _build(r.json()["current"], "Open-Meteo (current hour) · WBGT estimated")
                _cache[key] = (time.time(), out)
                return out
            except (httpx.HTTPError, KeyError, ValueError):
                if attempt == 0:
                    await asyncio.sleep(1)
    if hit:
        return {**hit[1], "source": hit[1]["source"] + " · last reading"}
    return await _nearest_site(lat, lng)


def sun_alert(language: str, minutes: int, limit: int, wbgt: float, sun: bool = True) -> str:
    en = (SUN_ALERT_EN if sun else HEAT_ALERT_EN).format(m=minutes, l=limit, w=wbgt)
    local = (SUN_ALERT if sun else HEAT_ALERT).get(language)
    return f"{local.format(m=minutes)}\n\n{en}" if local else en
