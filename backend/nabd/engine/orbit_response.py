"""Theme 04 · First Responders from Orbit — flood mapping & damage assessment.

Maps inundation within hours (not days), scores roads/buildings at risk, and
replays the 16 April 2024 UAE floods as the reference case for Supernova ×
Spacepoint.

Honest labels:
  - Flood water masks are *prototype SAR-style extents* calibrated to
    reported April 2024 inundation corridors (Hatta wadi, Dubai South /
    airport approaches). They are not a live Sentinel-1 GEE pipeline.
  - Rainfall series prefer Open-Meteo archive when reachable; otherwise a
    published-event fallback for the same window is used.
  - Building/road inventories are synthetic asset layers placed on those
    corridors so responders can rehearse triage — not OSM dump extracts.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# April 2024 reference event
# ---------------------------------------------------------------------------

EVENT = {
    "id": "uae-flood-2024-04-16",
    "title": "16 April 2024 UAE floods",
    "theme": "04 · First Responders from Orbit",
    "hackathon": "Supernova × Spacepoint · BITS Pilani Dubai",
    "peak_local": "2024-04-16T12:00",
    "peak_rain_mm": 254.8,
    "peak_rain_place": "Khatm Al Shakla (NCM)",
    "summary": (
        "Heaviest rainfall in UAE records since 1949. Warnings existed; "
        "first responders still needed a map of *where water was* and "
        "*which roads and buildings were cut* within hours, not days."
    ),
    "sources": [
        "Meteosat / NCM rainfall reports (event totals)",
        "Open-Meteo archive precipitation (site series)",
        "NASA GIBS true-colour context",
        "Prototype Sentinel-1 style water-change extents (calibrated corridors)",
        "GPM IMERG-class rainfall framing (event totals)",
    ],
}

# Hours after first heavy rain when each product is ready in this prototype.
LATENCY = {
    "orbit_flood_mask_h": 4,
    "orbit_damage_triage_h": 6,
    "traditional_optical_h": 48,
    "traditional_field_survey_h": 72,
}

# ---------------------------------------------------------------------------
# Flood extents (prototype SAR water masks) — expand by phase
# ---------------------------------------------------------------------------

# Hatta wadi corridor (Hajar foothills flash-flood zone)
_HATTA_CORE = [
    [56.05, 24.78], [56.10, 24.76], [56.16, 24.79], [56.18, 24.83],
    [56.14, 24.86], [56.08, 24.85], [56.04, 24.82], [56.05, 24.78],
]
_HATTA_EXPANDED = [
    [56.02, 24.75], [56.12, 24.73], [56.20, 24.78], [56.22, 24.85],
    [56.16, 24.90], [56.06, 24.89], [56.00, 24.83], [56.02, 24.75],
]

# Dubai South / Al Maktoum approaches — standing water on flat desert pavement
_DUBAI_CORE = [
    [55.10, 24.86], [55.18, 24.85], [55.22, 24.89], [55.20, 24.93],
    [55.12, 24.94], [55.08, 24.90], [55.10, 24.86],
]
_DUBAI_EXPANDED = [
    [55.05, 24.84], [55.22, 24.82], [55.28, 24.88], [55.26, 24.96],
    [55.14, 24.98], [55.04, 24.92], [55.05, 24.84],
]


def _poly(coords: list[list[float]], props: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Polygon", "coordinates": [coords]},
    }


def _ring_area_km2(coords: list[list[float]]) -> float:
    """Shoelace on lon/lat → rough km² (adequate for triage KPIs)."""
    if len(coords) < 4:
        return 0.0
    lat0 = sum(c[1] for c in coords[:-1]) / (len(coords) - 1)
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * max(0.2, abs(math.cos(math.radians(lat0))))
    pts = [(c[0] * m_per_deg_lon, c[1] * m_per_deg_lat) for c in coords]
    area = 0.0
    for i in range(len(pts) - 1):
        x1, y1 = pts[i]
        x2, y2 = pts[i + 1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0 / 1e6


PHASES: list[dict[str, Any]] = [
    {
        "id": "t0",
        "label": "T+0 h · first heavy band",
        "hours_after_onset": 0,
        "local_time": "2024-04-15T18:00",
        "status": "watch",
        "note": "Meteosat / forecast band crosses Hatta. No water mask yet — pre-position crews.",
        "flood_km2": 0.0,
        "polygons": [],
    },
    {
        "id": "t4",
        "label": "T+4 h · orbit flood mask",
        "hours_after_onset": 4,
        "local_time": "2024-04-15T22:00",
        "status": "mapping",
        "note": "First Sentinel-1-style change mask: water in Hatta wadi + Dubai South depressions.",
        "polygons": [
            (_HATTA_CORE, {"zone": "hatta", "name": "Hatta wadi", "confidence": 0.78, "depth_class": "moderate"}),
            (_DUBAI_CORE, {"zone": "dubai-south", "name": "Dubai South flats", "confidence": 0.71, "depth_class": "shallow"}),
        ],
    },
    {
        "id": "t6",
        "label": "T+6 h · damage triage",
        "hours_after_onset": 6,
        "local_time": "2024-04-16T00:00",
        "status": "triage",
        "note": "Roads and buildings scored against the water mask. Dispatch list ready.",
        "polygons": [
            (_HATTA_CORE, {"zone": "hatta", "name": "Hatta wadi", "confidence": 0.82, "depth_class": "deep"}),
            (_DUBAI_CORE, {"zone": "dubai-south", "name": "Dubai South flats", "confidence": 0.76, "depth_class": "moderate"}),
        ],
    },
    {
        "id": "t12",
        "label": "T+12 h · peak inundation",
        "hours_after_onset": 12,
        "local_time": "2024-04-16T06:00",
        "status": "peak",
        "note": "Expanded mask as rain continues. Optical satellites still clouded out.",
        "polygons": [
            (_HATTA_EXPANDED, {"zone": "hatta", "name": "Hatta wadi expanded", "confidence": 0.88, "depth_class": "deep"}),
            (_DUBAI_EXPANDED, {"zone": "dubai-south", "name": "Dubai South expanded", "confidence": 0.84, "depth_class": "moderate"}),
        ],
    },
    {
        "id": "t24",
        "label": "T+24 h · standing water",
        "hours_after_onset": 24,
        "local_time": "2024-04-16T18:00",
        "status": "standing",
        "note": "Traditional optical mapping just becoming usable. Orbit triage already 18 h ahead.",
        "polygons": [
            (_HATTA_EXPANDED, {"zone": "hatta", "name": "Hatta standing", "confidence": 0.90, "depth_class": "moderate"}),
            (_DUBAI_EXPANDED, {"zone": "dubai-south", "name": "Dubai South standing", "confidence": 0.86, "depth_class": "shallow"}),
        ],
    },
]


# Asset layers for damage assessment (synthetic, corridor-aligned)
_BUILDINGS: list[dict[str, Any]] = [
    # Hatta
    {"id": "b-h1", "name": "Hatta Heritage area shops", "zone": "hatta", "lon": 56.11, "lat": 24.80, "use": "commercial"},
    {"id": "b-h2", "name": "Hatta school block", "zone": "hatta", "lon": 56.13, "lat": 24.82, "use": "school"},
    {"id": "b-h3", "name": "Wadi-side residences", "zone": "hatta", "lon": 56.09, "lat": 24.81, "use": "residential"},
    {"id": "b-h4", "name": "Clinic annex", "zone": "hatta", "lon": 56.15, "lat": 24.84, "use": "clinic"},
    {"id": "b-h5", "name": "Farm store east", "zone": "hatta", "lon": 56.17, "lat": 24.80, "use": "commercial"},
    {"id": "b-h6", "name": "Hill villas (dry)", "zone": "hatta", "lon": 56.19, "lat": 24.88, "use": "residential"},
    # Dubai South
    {"id": "b-d1", "name": "Logistics warehouse A", "zone": "dubai-south", "lon": 55.14, "lat": 24.89, "use": "industrial"},
    {"id": "b-d2", "name": "Worker accommodation", "zone": "dubai-south", "lon": 55.16, "lat": 24.91, "use": "residential"},
    {"id": "b-d3", "name": "Site office", "zone": "dubai-south", "lon": 55.12, "lat": 24.88, "use": "office"},
    {"id": "b-d4", "name": "Substation pad", "zone": "dubai-south", "lon": 55.19, "lat": 24.90, "use": "utility"},
    {"id": "b-d5", "name": "Retail strip", "zone": "dubai-south", "lon": 55.21, "lat": 24.93, "use": "commercial"},
    {"id": "b-d6", "name": "Dry yard sheds", "zone": "dubai-south", "lon": 55.07, "lat": 24.95, "use": "industrial"},
]

_ROADS: list[dict[str, Any]] = [
    {
        "id": "r-h1", "name": "E44 Hatta approach", "zone": "hatta",
        "coords": [[56.04, 24.80], [56.10, 24.81], [56.16, 24.82]],
        "class": "arterial",
    },
    {
        "id": "r-h2", "name": "Wadi crossing road", "zone": "hatta",
        "coords": [[56.10, 24.78], [56.12, 24.81], [56.13, 24.85]],
        "class": "local",
    },
    {
        "id": "r-h3", "name": "Ridge access (dry)", "zone": "hatta",
        "coords": [[56.18, 24.86], [56.20, 24.88], [56.21, 24.90]],
        "class": "local",
    },
    {
        "id": "r-d1", "name": "EXPO / Dubai South link", "zone": "dubai-south",
        "coords": [[55.08, 24.88], [55.14, 24.89], [55.20, 24.90]],
        "class": "arterial",
    },
    {
        "id": "r-d2", "name": "Al Maktoum service road", "zone": "dubai-south",
        "coords": [[55.12, 24.86], [55.16, 24.88], [55.18, 24.92]],
        "class": "service",
    },
    {
        "id": "r-d3", "name": "Desert perimeter track", "zone": "dubai-south",
        "coords": [[55.22, 24.94], [55.25, 24.95], [55.27, 24.97]],
        "class": "local",
    },
]


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    """Ray casting."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi):
            inside = not inside
        j = i
    return inside


def _road_flooded(coords: list[list[float]], rings: list[list[list[float]]]) -> str:
    hits = 0
    for lon, lat in coords:
        if any(_point_in_ring(lon, lat, r) for r in rings):
            hits += 1
    if hits == 0:
        return "clear"
    if hits == len(coords):
        return "impassable"
    return "partial"


def _depth_score(depth_class: str) -> float:
    return {"shallow": 0.35, "moderate": 0.65, "deep": 0.95}.get(depth_class, 0.5)


def _phase_payload(phase: dict[str, Any]) -> dict[str, Any]:
    polys = []
    rings: list[list[list[float]]] = []
    flood_km2 = 0.0
    for coords, props in phase.get("polygons") or []:
        flood_km2 += _ring_area_km2(coords)
        rings.append(coords)
        polys.append(_poly(coords, {**props, "phase": phase["id"]}))

    buildings = []
    for b in _BUILDINGS:
        flooded = any(_point_in_ring(b["lon"], b["lat"], r) for r in rings)
        # depth from containing polygon if any
        depth = "none"
        conf = 0.0
        for coords, props in phase.get("polygons") or []:
            if _point_in_ring(b["lon"], b["lat"], coords):
                depth = props.get("depth_class", "moderate")
                conf = props.get("confidence", 0.7)
                break
        severity = "safe"
        if flooded:
            severity = "critical" if depth == "deep" or b["use"] in ("school", "clinic", "residential") else "impacted"
        buildings.append({
            **b,
            "flooded": flooded,
            "depth_class": depth,
            "confidence": conf,
            "severity": severity,
            "damage_score": round(_depth_score(depth) if flooded else 0.0, 2),
        })

    roads = []
    road_km_cut = 0.0
    for r in _ROADS:
        status = _road_flooded(r["coords"], rings) if rings else "clear"
        length_km = 0.0
        for i in range(len(r["coords"]) - 1):
            lon1, lat1 = r["coords"][i]
            lon2, lat2 = r["coords"][i + 1]
            dy = (lat2 - lat1) * 111.32
            dx = (lon2 - lon1) * 111.32 * math.cos(math.radians((lat1 + lat2) / 2))
            length_km += math.hypot(dx, dy)
        if status != "clear":
            road_km_cut += length_km * (1.0 if status == "impassable" else 0.5)
        roads.append({
            "id": r["id"],
            "name": r["name"],
            "zone": r["zone"],
            "class": r["class"],
            "status": status,
            "length_km": round(length_km, 2),
            "geometry": {"type": "LineString", "coordinates": r["coords"]},
        })

    critical = sum(1 for b in buildings if b["severity"] == "critical")
    impacted = sum(1 for b in buildings if b["flooded"])

    return {
        "id": phase["id"],
        "label": phase["label"],
        "hours_after_onset": phase["hours_after_onset"],
        "local_time": phase["local_time"],
        "status": phase["status"],
        "note": phase["note"],
        "kpis": {
            "flood_km2": round(flood_km2 if flood_km2 else phase.get("flood_km2", 0.0), 2),
            "buildings_impacted": impacted,
            "buildings_critical": critical,
            "roads_km_affected": round(road_km_cut, 2),
            "zones_active": len({props["zone"] for _, props in phase.get("polygons") or []}),
        },
        "flood": {"type": "FeatureCollection", "features": polys},
        "buildings": buildings,
        "roads": roads,
        "geojson_buildings": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {k: v for k, v in b.items() if k not in ("lon", "lat")},
                    "geometry": {"type": "Point", "coordinates": [b["lon"], b["lat"]]},
                }
                for b in buildings
            ],
        },
        "geojson_roads": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {k: v for k, v in r.items() if k != "geometry"},
                    "geometry": r["geometry"],
                }
                for r in roads
            ],
        },
    }


def phases() -> list[dict[str, Any]]:
    return [_phase_payload(p) for p in PHASES]


def phase_by_id(phase_id: str) -> dict[str, Any]:
    for p in PHASES:
        if p["id"] == phase_id:
            return _phase_payload(p)
    raise KeyError(f"unknown phase '{phase_id}'. Known: {[p['id'] for p in PHASES]}")


async def rainfall_series(lat: float = 24.80, lon: float = 56.12) -> dict[str, Any]:
    """Hourly precipitation around the event — Open-Meteo archive when online."""
    start = "2024-04-14"
    end = "2024-04-17"
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "hourly": "precipitation",
        "timezone": "Asia/Dubai",
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        times = data["hourly"]["time"]
        precip = data["hourly"]["precipitation"]
        total = round(sum(v or 0 for v in precip), 1)
        peak_i = max(range(len(precip)), key=lambda i: precip[i] or 0)
        return {
            "source": "Open-Meteo archive (ERA5-class reanalysis)",
            "stale": False,
            "lat": lat,
            "lon": lon,
            "start": start,
            "end": end,
            "total_mm": total,
            "peak_mm": precip[peak_i],
            "peak_at": times[peak_i],
            "hourly": [{"t": t, "mm": v} for t, v in zip(times, precip)],
            "note": "Site series for Hatta. Event-max 254.8 mm was recorded at Khatm Al Shakla (NCM), not this grid cell.",
        }
    except (httpx.HTTPError, KeyError, ValueError, IndexError):
        # Fallback: schematic hourly curve peaking overnight 15–16 Apr
        base = datetime.fromisoformat("2024-04-14T00:00")
        hourly = []
        for h in range(96):
            t = base + timedelta(hours=h)
            # bump around 15 Apr evening → 16 Apr midday
            age = (t - datetime.fromisoformat("2024-04-15T18:00")).total_seconds() / 3600
            mm = max(0.0, 18 * (1 - abs(age) / 18)) if abs(age) < 18 else 0.0
            if 6 < age < 20:
                mm = max(mm, 8.0)
            hourly.append({"t": t.strftime("%Y-%m-%dT%H:00"), "mm": round(mm, 1)})
        return {
            "source": "fallback schematic (archive unreachable)",
            "stale": True,
            "lat": lat,
            "lon": lon,
            "start": start,
            "end": end,
            "total_mm": round(sum(x["mm"] for x in hourly), 1),
            "peak_mm": max(x["mm"] for x in hourly),
            "peak_at": max(hourly, key=lambda x: x["mm"])["t"],
            "hourly": hourly,
            "note": "Offline fallback. Live demos should use the archive API.",
        }


def briefing() -> dict[str, Any]:
    mapped = phases()
    peak = next(p for p in mapped if p["id"] == "t12")
    triage = next(p for p in mapped if p["id"] == "t6")
    return {
        "event": EVENT,
        "latency": LATENCY,
        "advantage_hours": LATENCY["traditional_optical_h"] - LATENCY["orbit_damage_triage_h"],
        "one_liner": (
            "NABD Orbit maps flood water from space in ~4 h and scores roads "
            f"and buildings by ~{LATENCY['orbit_damage_triage_h']} h — "
            f"~{LATENCY['traditional_optical_h'] - LATENCY['orbit_damage_triage_h']} h "
            "before optical clearing after the April 2024 UAE storms."
        ),
        "deliverables": [
            "Flood extent within hours (prototype Sentinel-1 style water mask)",
            "Rainfall estimate for the event window (archive / GPM-class framing)",
            "Damage triage: roads impassable / partial / clear; buildings critical / impacted / safe",
            "April 2024 UAE floods as the worked example",
        ],
        "peak_kpis": peak["kpis"],
        "triage_kpis": triage["kpis"],
        "phases": [{"id": p["id"], "label": p["label"], "hours_after_onset": p["hours_after_onset"], "kpis": p["kpis"]} for p in mapped],
    }


def overview(phase_id: str = "t6") -> dict[str, Any]:
    return {
        "event": EVENT,
        "latency": LATENCY,
        "advantage_hours": LATENCY["traditional_optical_h"] - LATENCY["orbit_damage_triage_h"],
        "phase": phase_by_id(phase_id),
        "phase_ids": [p["id"] for p in PHASES],
    }
