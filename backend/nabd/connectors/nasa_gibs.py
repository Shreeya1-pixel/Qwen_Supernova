"""NASA GIBS — live WMS satellite imagery over the UAE (keyless).

Gallery is reflectance-only for 14–17 Apr 2024: full-frame JPEG tiles that
actually render over the Dubai–Hatta corridor. Sparse / empty products
(aerosol, night lights, vapour, SST, flood flags) are omitted so the wall
never shows black blanks.
"""
from __future__ import annotations

from datetime import date, timedelta
from urllib.parse import urlencode

# UAE bbox — WMS 1.3.0 EPSG:4326 order (lat_min, lon_min, lat_max, lon_max)
BBOX = (22.45, 51.4, 26.35, 57.0)
# Tighter zoom on Dubai–Hatta flood corridor
FLOOD_BBOX = (24.55, 54.85, 25.55, 56.45)
GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
EVENT_DAY = date(2024, 4, 16)

# kind → (layer_id, mime, day_offset, title, vibe)
LAYERS: dict[str, tuple[str, str, int, str, str]] = {
    "false_721": (
        "MODIS_Aqua_CorrectedReflectance_Bands721",
        "image/jpeg",
        1,
        "MODIS Aqua · bands 7-2-1",
        "False colour: sediment & wet ground light up after rain",
    ),
    "aqua_true": (
        "MODIS_Aqua_CorrectedReflectance_TrueColor",
        "image/jpeg",
        1,
        "MODIS Aqua · true colour",
        "Natural-colour pass the day after peak rain",
    ),
    "false_367": (
        "MODIS_Terra_CorrectedReflectance_Bands367",
        "image/jpeg",
        0,
        "MODIS Terra · bands 3-6-7",
        "Shortwave false colour — land / water contrast",
    ),
    "terra_721": (
        "MODIS_Terra_CorrectedReflectance_Bands721",
        "image/jpeg",
        1,
        "MODIS Terra · bands 7-2-1",
        "Second false-colour look — Terra pass after the storm",
    ),
    "viirs_swir": (
        "VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1",
        "image/jpeg",
        1,
        "VIIRS SNPP · SWIR false colour",
        "Crisp day pass over the Gulf & Hajar",
    ),
    "viirs_true": (
        "VIIRS_SNPP_CorrectedReflectance_TrueColor",
        "image/jpeg",
        1,
        "VIIRS SNPP · true colour",
        "Natural colour the day after the rains",
    ),
}

GALLERY_ORDER = [
    "false_721",
    "aqua_true",
    "false_367",
    "terra_721",
    "viirs_swir",
    "viirs_true",
]


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
        "TRANSPARENT": "false",
        "TIME": day.isoformat(),
    })


def _tile(kind: str, day: date | None = None, *, width: int = 1280, tight: bool = True) -> dict:
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
        "sparse": False,
        "url": _url(layer, fmt, when, width, bbox),
        "url_uae": _url(layer, fmt, when, width, BBOX),
        "source": "NASA GIBS WMS",
        "bbox": {"lat": [bbox[0], bbox[2]], "lon": [bbox[1], bbox[3]]},
    }


def april_2024_context() -> dict:
    """NASA satellite wall — only tiles that fill the frame for Apr 2024 UAE."""
    gallery = [_tile(k, width=1400) for k in GALLERY_ORDER]
    sequence = [
        _tile("viirs_true", EVENT_DAY - timedelta(days=2), width=1100),
        _tile("false_367", EVENT_DAY, width=1100),
        _tile("false_721", EVENT_DAY + timedelta(days=1), width=1100),
        _tile("aqua_true", EVENT_DAY + timedelta(days=1), width=1100),
        _tile("terra_721", EVENT_DAY + timedelta(days=1), width=1100),
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
        "hero": _tile("false_721", EVENT_DAY + timedelta(days=1), width=1600),
        "layers": {k: _tile(k) for k in GALLERY_ORDER},
        "note": (
            "Connected to NASA GIBS — live GetMap WMS, no API key. "
            "Gallery is reflectance-only (full-frame tiles). Sparse products "
            "(aerosol, night lights, vapour, SST, flood flags) removed — they "
            "were empty or mostly transparent over this AOI for 16 Apr 2024."
        ),
        "theme_split": {
            "nasa": [LAYERS[k][3] for k in GALLERY_ORDER],
            "copernicus_theme04": ["Sentinel-1 radar", "Sentinel-2", "Copernicus DEM"],
        },
    }
