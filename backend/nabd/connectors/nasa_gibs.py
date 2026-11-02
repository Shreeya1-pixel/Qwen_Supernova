"""NASA GIBS — live WMS satellite imagery over the UAE (keyless).

Dramatic layers for Theme 04 / April 2024: flood water product, false-colour
bands, night lights, aerosols, SST, water vapour.
"""
from __future__ import annotations

from datetime import date, timedelta
from urllib.parse import urlencode

# UAE bbox — WMS 1.3.0 EPSG:4326 order (lat_min, lon_min, lat_max, lon_max)
BBOX = (22.45, 51.4, 26.35, 57.0)
# Tighter zoom on Dubai–Hatta flood corridor for “wow” tiles
FLOOD_BBOX = (24.55, 54.85, 25.55, 56.45)
GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
EVENT_DAY = date(2024, 4, 16)

# kind → (layer_id, mime, default_day_offset_from_event, title, vibe)
LAYERS: dict[str, tuple[str, str, int, str, str]] = {
    "flood_2day": (
        "MODIS_Combined_Flood_2-Day",
        "image/png",
        1,
        "MODIS flood water · 2-day",
        "NASA’s own flood product — standing water after the storm",
    ),
    "false_721": (
        "MODIS_Aqua_CorrectedReflectance_Bands721",
        "image/jpeg",
        1,
        "MODIS Aqua · bands 7-2-1",
        "False colour: sediment & wet ground light up after rain",
    ),
    "false_367": (
        "MODIS_Terra_CorrectedReflectance_Bands367",
        "image/jpeg",
        0,
        "MODIS Terra · bands 3-6-7",
        "Shortwave false colour — land / water contrast",
    ),
    "viirs_swir": (
        "VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1",
        "image/jpeg",
        0,
        "VIIRS NOAA-20 · SWIR false colour",
        "Crisp day pass over the Gulf & Hajar",
    ),
    "truecolor": (
        "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
        "image/jpeg",
        0,
        "VIIRS NOAA-20 · true colour",
        "What the satellite saw in natural colour",
    ),
    "night_lights": (
        "VIIRS_SNPP_DayNightBand_ENCC",
        "image/png",
        -1,
        "VIIRS · night lights (Day/Night Band)",
        "Cities glowing — power & urban footprint through the storm week",
    ),
    "aerosol": (
        "MODIS_Terra_Aerosol",
        "image/png",
        0,
        "MODIS Terra · aerosols",
        "Dust & haze over the peninsula",
    ),
    "vapor": (
        "MODIS_Terra_Water_Vapor_5km_Night",
        "image/png",
        0,
        "MODIS · water vapour (night)",
        "Moisture field the night of the rains",
    ),
    "sst": (
        "GHRSST_L4_MUR_Sea_Surface_Temperature",
        "image/png",
        0,
        "MUR sea-surface temperature",
        "Gulf SST — thermal context for the event",
    ),
}


def _url(layer: str, fmt: str, day: date, width: int, bbox: tuple[float, float, float, float]) -> str:
    height = max(256, round(width * (bbox[2] - bbox[0]) / (bbox[3] - bbox[1]) / 0.91))
    return GIBS + "?" + urlencode({
        "SERVICE": "WMS",
        "REQUEST": "GetMap",
        "VERSION": "1.3.0",
        "LAYERS": layer,
        "CRS": "EPSG:4326",
        "BBOX": ",".join(map(str, bbox)),
        "WIDTH": width,
        "HEIGHT": height,
        "FORMAT": fmt,
        "TRANSPARENT": "true",
        "TIME": day.isoformat(),
    })


def _tile(kind: str, day: date | None = None, *, tight: bool = True, width: int = 1280) -> dict:
    layer, fmt, offset, title, vibe = LAYERS[kind]
    when = day or (EVENT_DAY + timedelta(days=offset))
    bbox = FLOOD_BBOX if tight else BBOX
    return {
        "id": kind,
        "title": title,
        "vibe": vibe,
        "layer": layer,
        "date": when.isoformat(),
        "format": fmt,
        "url": _url(layer, fmt, when, width, bbox),
        "url_uae": _url(layer, fmt, when, width, BBOX),
        "source": "NASA GIBS WMS",
        "bbox": {"lat": [bbox[0], bbox[2]], "lon": [bbox[1], bbox[3]]},
    }


def april_2024_context() -> dict:
    """Full NASA satellite wall for the April 2024 UAE floods."""
    gallery = [_tile(k, width=1400) for k in LAYERS]
    # Before → peak → after sequence on flood + false colour
    sequence = [
        _tile("truecolor", EVENT_DAY - timedelta(days=3), width=1100),
        _tile("false_721", EVENT_DAY, width=1100),
        _tile("flood_2day", EVENT_DAY + timedelta(days=1), width=1100),
        _tile("night_lights", EVENT_DAY - timedelta(days=1), width=1100),
        _tile("vapor", EVENT_DAY, width=1100),
    ]
    return {
        "ok": True,
        "connected": True,
        "source": "NASA GIBS WMS (live, keyless)",
        "endpoint": GIBS,
        "event": "uae-flood-2024-04-16",
        "date": EVENT_DAY.isoformat(),
        "bbox_uae": {"lat": [BBOX[0], BBOX[2]], "lon": [BBOX[1], BBOX[3]]},
        "bbox_flood": {"lat": [FLOOD_BBOX[0], FLOOD_BBOX[2]], "lon": [FLOOD_BBOX[1], FLOOD_BBOX[3]]},
        "gallery": gallery,
        "sequence": sequence,
        "hero": _tile("flood_2day", EVENT_DAY + timedelta(days=1), width=1600),
        "layers": {k: _tile(k) for k in LAYERS},  # backward compatible
        "note": (
            "Connected to NASA GIBS — live GetMap WMS, no API key. "
            "Includes MODIS flood water, VIIRS night lights, false-colour SWIR, "
            "aerosols, water vapour and sea-surface temperature for 14–17 Apr 2024."
        ),
        "theme_split": {
            "nasa": [meta[3] for meta in LAYERS.values()],
            "copernicus_theme04": ["Sentinel-1 radar", "Sentinel-2", "Copernicus DEM"],
        },
    }
