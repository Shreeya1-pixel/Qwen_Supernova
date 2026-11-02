"""Turn raw environmental readings into normalised hazard intensities (0..1)."""
from __future__ import annotations

import math
from dataclasses import dataclass

from ..connectors.open_meteo import SiteFrame

HAZARDS = ("heat", "dust", "air", "sea_warming", "uv", "flood")

HAZARD_LABELS = {
    "heat": "Heat stress (WBGT)",
    "dust": "Dust load (PM10)",
    "air": "Air quality (AQI)",
    "sea_warming": "Sea warming (SST)",
    "uv": "UV exposure",
    "flood": "Flash-flood rain",
}


def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def estimate_wbgt(temp_c: float, wet_bulb_c: float, radiation_wm2: float, wind_kmh: float) -> float:
    """Outdoor WBGT = 0.7·Tw + 0.2·Tg + 0.1·Ta.

    Globe temperature is approximated from solar radiation and wind (black-globe
    gains ≈ radiation, losses grow with wind). This is an estimate, labelled as such
    in the API; a field kit with a globe thermometer replaces it.
    """
    wind_ms = max(wind_kmh / 3.6, 0.5)
    globe = temp_c + 0.0175 * radiation_wm2 / math.sqrt(wind_ms)
    return 0.7 * wet_bulb_c + 0.2 * globe + 0.1 * temp_c


@dataclass
class HourHazards:
    time: str
    wbgt: float | None
    values: dict[str, float]


def hour_hazards(frame: SiteFrame, i: int) -> HourHazards:
    s = frame.series

    def at(key: str) -> float | None:
        values = s.get(key) or []
        return values[i] if i < len(values) else None

    temp, tw = at("temperature_2m"), at("wet_bulb_temperature_2m")
    rad, wind = at("shortwave_radiation") or 0.0, at("wind_speed_10m") or 0.0
    wbgt = estimate_wbgt(temp, tw, rad, wind) if temp is not None and tw is not None else None

    pm10, aqi, sst, uv = at("pm10"), at("us_aqi"), at("sea_surface_temperature"), at("uv_index")
    rain_6h = sum(v for v in (s.get("precipitation") or [])[max(0, i - 5):i + 1] if v is not None)

    values = {
        "heat": heat_from_wbgt(wbgt),
        "dust": dust_from_pm10(pm10),
        "air": clamp01((aqi - 100.0) / 150.0) if aqi is not None else 0.0,
        "sea_warming": clamp01((sst - 31.0) / 5.0) if sst is not None else 0.0,
        "uv": clamp01((uv - 8.0) / 4.0) if uv is not None else 0.0,
        "flood": clamp01(rain_6h / 25.0),
    }
    return HourHazards(time=frame.time[i] if i < len(frame.time) else "", wbgt=wbgt, values=values)


def heat_from_wbgt(wbgt: float | None) -> float:
    """0 at WBGT 26 (heavy work still unrestricted) → 1 at 33 (stop heavy work)."""
    return clamp01((wbgt - 26.0) / 7.0) if wbgt is not None else 0.0


def dust_from_pm10(pm10: float | None) -> float:
    return clamp01((pm10 - 100.0) / 400.0) if pm10 is not None else 0.0


def current_hazards(frame: SiteFrame) -> HourHazards:
    return hour_hazards(frame, frame.now_index)
