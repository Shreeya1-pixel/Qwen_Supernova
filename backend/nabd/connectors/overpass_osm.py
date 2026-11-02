"""OpenStreetMap Overpass — real buildings & roads in the flood AOI (keyless).

Falls back to a cached corridor extract when public Overpass mirrors are down,
so the Theme 04 demo never blanks.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import httpx

AOIS = {
    "hatta": (24.76, 56.05, 24.88, 56.20),
    "dubai-south": (24.85, 55.08, 24.95, 55.24),
}
MIRRORS = [
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
FALLBACK = Path(__file__).resolve().parents[1] / "data" / "osm_corridor_fallback.json"
CACHE_TTL_S = 12 * 3600
HEADERS = {
    "User-Agent": "NABD-Orbit/1.0 (Supernova Spacepoint hackathon; local demo)",
    "Accept": "application/json",
}
_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _ql(kind: str, south: float, west: float, north: float, east: float) -> str:
    bbox = f"{south},{west},{north},{east}"
    if kind == "buildings":
        return f"[out:json][timeout:15];way[\"building\"]({bbox});out center tags 40;"
    return (
        f"[out:json][timeout:15];"
        f"way[\"highway\"~\"primary|secondary|tertiary|trunk|residential\"]({bbox});"
        f"out geom tags 30;"
    )


def _fallback(reason: str) -> dict[str, Any]:
    raw = json.loads(FALLBACK.read_text())
    buildings = raw.get("buildings") or []
    roads = raw.get("roads") or []
    return {
        "ok": True,
        "live": False,
        "stale": True,
        "source": raw.get("source", "Cached corridor extract"),
        "aois": AOIS,
        "buildings": buildings,
        "roads": roads,
        "buildings_count": len(buildings),
        "roads_count": len(roads),
        "note": f"{raw.get('note', '')} Reason: {reason}",
        "error": reason,
    }


async def _fetch(client: httpx.AsyncClient, kind: str, bbox: tuple[float, float, float, float]) -> list[dict]:
    south, west, north, east = bbox
    last_exc: Exception | None = None
    for url in MIRRORS:
        try:
            r = await client.post(
                url,
                data={"data": _ql(kind, south, west, north, east)},
                headers=HEADERS,
            )
            r.raise_for_status()
            return list(r.json().get("elements") or [])
        except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
            last_exc = exc
            continue
    if last_exc:
        raise last_exc
    return []


async def assets(kind: str = "both") -> dict[str, Any]:
    key = kind
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        return hit[1]

    out: dict[str, Any] = {
        "ok": True,
        "live": True,
        "source": "OpenStreetMap via Overpass API",
        "aois": AOIS,
        "stale": False,
        "buildings": [],
        "roads": [],
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
            if kind in ("both", "buildings"):
                seen: set[int] = set()
                for bbox in AOIS.values():
                    for el in await _fetch(client, "buildings", bbox):
                        eid = el.get("id")
                        if eid in seen:
                            continue
                        seen.add(eid)
                        c = el.get("center") or {}
                        if "lat" not in c:
                            continue
                        tags = el.get("tags") or {}
                        out["buildings"].append({
                            "id": f"osm-b-{eid}",
                            "name": tags.get("name") or tags.get("building") or "building",
                            "use": tags.get("building", "yes"),
                            "lon": c["lon"],
                            "lat": c["lat"],
                        })
            if kind in ("both", "roads"):
                seen_r: set[int] = set()
                for bbox in AOIS.values():
                    for el in await _fetch(client, "roads", bbox):
                        eid = el.get("id")
                        if eid in seen_r:
                            continue
                        seen_r.add(eid)
                        geom = el.get("geometry") or []
                        if len(geom) < 2:
                            continue
                        tags = el.get("tags") or {}
                        out["roads"].append({
                            "id": f"osm-r-{eid}",
                            "name": tags.get("name") or tags.get("ref") or tags.get("highway", "road"),
                            "class": tags.get("highway", "road"),
                            "coords": [[g["lon"], g["lat"]] for g in geom],
                        })
        out["buildings_count"] = len(out["buildings"])
        out["roads_count"] = len(out["roads"])
        if out["buildings_count"] == 0 and out["roads_count"] == 0:
            out = _fallback("Overpass returned empty for both AOIs")
        else:
            out["note"] = (
                "Live OSM extract for Hatta + Dubai South. "
                "Orbit triage uses the compact demo asset set for scoring; "
                "this catalogue proves real map coverage for Theme 04."
            )
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        out = _fallback(str(exc))
    _cache[key] = (time.time(), out)
    return out
