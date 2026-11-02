"""NASA EONET natural-event feed (dust storms, floods, wildfires, …) around the UAE."""
from __future__ import annotations

import time
from typing import Any

import httpx

EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"
# lon_min, lat_max, lon_max, lat_min — Arabian Peninsula + Gulf of Oman
REGION_BBOX = "44,32,62,14"
_cache: dict[str, Any] = {"at": 0.0, "events": []}


async def regional_events(days: int = 30) -> list[dict[str, Any]]:
    if time.time() - _cache["at"] < 1800:
        return _cache["events"]
    params = {"status": "all", "days": days, "bbox": REGION_BBOX, "limit": 25}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(EONET_URL, params=params)
            response.raise_for_status()
            raw = response.json().get("events", [])
    except httpx.HTTPError:
        return _cache["events"]

    events = []
    for e in raw:
        geometry = (e.get("geometry") or [{}])[-1]
        events.append({
            "id": e.get("id"),
            "title": e.get("title"),
            "category": ", ".join(c.get("title", "") for c in e.get("categories", [])),
            "date": geometry.get("date"),
            "coordinates": geometry.get("coordinates"),
            "source": (e.get("sources") or [{}])[0].get("url"),
        })
    _cache.update(at=time.time(), events=events)
    return events
