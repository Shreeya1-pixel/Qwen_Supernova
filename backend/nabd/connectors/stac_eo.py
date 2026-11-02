"""Live Earth-observation catalogue search (keyless).

Uses Element84 Earth Search STAC to list real Sentinel-1 / Sentinel-2 scenes
over the UAE April 2024 flood window — so the hackathon demo can show
*which* space assets cover the event, not only a static water mask.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

STAC = "https://earth-search.aws.element84.com/v1/search"
# Hatta + Dubai South corridor
BBOX = [55.0, 24.70, 56.30, 24.98]
EVENT_WINDOW = "2024-04-14T00:00:00Z/2024-04-18T23:59:59Z"
CACHE_TTL_S = 6 * 3600
_cache: dict[str, tuple[float, dict[str, Any]]] = {}


async def _search(collections: list[str], limit: int = 8, *, timed: bool = True) -> dict[str, Any]:
    key = f"{','.join(collections)}|timed={timed}"
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        return hit[1]

    # Do not send sortby — Earth Search rejects sort on datetime for some S1 indexes.
    # Copernicus DEM is a static mosaic — no event datetime filter.
    body: dict[str, Any] = {
        "collections": collections,
        "bbox": BBOX,
        "limit": limit,
    }
    if timed:
        body["datetime"] = EVENT_WINDOW
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=8.0)) as client:
            r = await client.post(STAC, json=body)
            r.raise_for_status()
            data = r.json()
        features = []
        for f in data.get("features") or []:
            props = f.get("properties") or {}
            assets = f.get("assets") or {}
            thumb = None
            for name in ("thumbnail", "overview", "visual"):
                if name in assets and assets[name].get("href"):
                    thumb = assets[name]["href"]
                    break
            features.append({
                "id": f.get("id"),
                "collection": f.get("collection"),
                "datetime": props.get("datetime") or props.get("start_datetime"),
                "platform": props.get("platform"),
                "sar_instrument_mode": props.get("sar:instrument_mode"),
                "eo_cloud_cover": props.get("eo:cloud_cover"),
                "thumbnail": thumb,
                "bbox": f.get("bbox"),
            })
        features.sort(key=lambda x: x.get("datetime") or "")
        out = {
            "ok": True,
            "source": "Element84 Earth Search STAC (AWS)",
            "endpoint": STAC,
            "bbox": BBOX,
            "datetime": EVENT_WINDOW,
            "collections": collections,
            "count": len(features),
            "matched": data.get("numberMatched", len(features)),
            "scenes": features,
            "stale": False,
            "note": (
                "Live catalogue hits for the April 2024 UAE flood window. "
                "These are real Sentinel products over the AOI; /orbit loads a "
                "precomputed S1 RTC change mask (stored scene IDs) — not a live SAR job."
            ),
        }
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        out = {
            "ok": False,
            "source": "Element84 Earth Search STAC (AWS)",
            "endpoint": STAC,
            "bbox": BBOX,
            "datetime": EVENT_WINDOW,
            "collections": collections,
            "count": 0,
            "matched": 0,
            "scenes": [],
            "stale": True,
            "error": str(exc),
            "note": "STAC unreachable — demo still works from cached orbit phases.",
        }
    _cache[key] = (time.time(), out)
    return out


async def flood_event_scenes() -> dict[str, Any]:
    """Theme 04 data stack: Sentinel-1 radar, Sentinel-2, Copernicus DEM."""
    s1 = await _search(["sentinel-1-grd"], limit=6)
    s2 = await _search(["sentinel-2-l2a"], limit=6)
    dem = await _search(["cop-dem-glo-30"], limit=4, timed=False)
    return {
        "event": "uae-flood-2024-04-16",
        "theme": "04 · First Responders from Orbit · Disaster response",
        "theme_data": ["Sentinel-1 radar", "Sentinel-2", "Copernicus DEM"],
        "sentinel1": s1,
        "sentinel2": s2,
        "copernicus_dem": dem,
        "why": (
            "Theme 04 data: Sentinel-1 radar sees flood water through storm cloud; "
            "Sentinel-2 is optical (slower to clear); Copernicus DEM shapes runoff "
            "and which roads/buildings sit in low ground — hours, not days."
        ),
    }
