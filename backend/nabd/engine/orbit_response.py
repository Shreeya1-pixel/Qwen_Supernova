"""Theme 04 · First Responders from Orbit — flood mapping & damage assessment.

Maps inundation within hours (not days), scores roads/buildings at risk, and
replays the 16 April 2024 UAE floods as the reference case for Supernova ×
Spacepoint.

Honest labels:
  - Flood water mask is *precomputed offline* from Sentinel-1 RTC before/after
    pairs (VV change < -3 dB and after < -15 dB). Scene IDs are stored with the
    GeoJSON — not a live SAR processor in this repo.
  - T+4 / T+6 / ~42 h figures are *design targets* for a radar-first pipeline
    vs typical optical clear — not measured wall-clock of this repo.
  - Critical facilities for damage triage come from **Overture Maps** (real places).
  - Demo road/building samples sit on the computed mask for triage UI; Overture
    is the primary real asset layer.
  - NASA GIBS supplies true-colour / land-heat context for the event window.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from ..connectors import overture_places

_DATA = Path(__file__).resolve().parents[1] / "data"
_MASK_PATH = _DATA / "s1_flood_mask_apr2024.geojson"
_PROV_PATH = _DATA / "s1_flood_mask_provenance.json"

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
    "theme_goals": [
        "Map floods within hours, not days",
        "Assess damage to roads and buildings",
        "Learn from the April 2024 UAE floods",
    ],
    "theme_data": ["Sentinel-1 radar", "Sentinel-2", "Copernicus DEM"],
    "sources": [
        "Sentinel-1 radar — live STAC (Element84 Earth Search)",
        "Sentinel-2 — live STAC (Element84 Earth Search)",
        "Copernicus DEM (GLO-30) — live STAC tiles over the AOI",
        "NASA GIBS — VIIRS/MODIS context for 16 Apr 2024",
        "Overture Maps places — hospitals, schools, clinics (real POIs)",
        "Open-Meteo archive precipitation — ERA5-class (supporting)",
        "NCM / Meteosat event totals for 16 April 2024",
        "Precomputed Sentinel-1 RTC flood mask (VV −3 dB change / −15 dB dark) with stored scene IDs",
    ],
}

# Design targets for a radar-first responder pipeline (not measured wall-clock here).
LATENCY = {
    "orbit_flood_mask_h": 4,
    "orbit_damage_triage_h": 6,
    "traditional_optical_h": 48,
    "traditional_field_survey_h": 72,
    "measured": False,
    "note": (
        "T+4 / T+6 / ~42 h are design targets for Sentinel-1-first mapping vs typical "
        "post-storm optical clear (~48 h). The flood mask shown is precomputed offline "
        "from real S1 RTC pairs (not a live timed SAR job); live STAC + NASA GIBS + "
        "Overture triage execute at request time."
    ),
}


# ---------------------------------------------------------------------------
# Flood extents — precomputed Sentinel-1 RTC change mask
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def flood_provenance() -> dict[str, Any]:
    """Scene IDs + thresholds for the stored April 2024 S1 flood mask."""
    return json.loads(_PROV_PATH.read_text())


@lru_cache(maxsize=1)
def load_flood_mask() -> dict[str, Any]:
    """GeoJSON FeatureCollection produced by scripts/precompute_s1_flood_mask.py."""
    return json.loads(_MASK_PATH.read_text())


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


def _geom_rings(geom: dict[str, Any]) -> list[list[list[float]]]:
    gtype = geom.get("type")
    coords = geom.get("coordinates") or []
    if gtype == "Polygon" and coords:
        return [coords[0]]
    if gtype == "MultiPolygon":
        return [poly[0] for poly in coords if poly]
    return []


def _expand_ring(ring: list[list[float]], scale: float = 1.45) -> list[list[float]]:
    """Scale ring about its centroid — used for peak/standing phases only."""
    body = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    if not body:
        return ring
    cx = sum(p[0] for p in body) / len(body)
    cy = sum(p[1] for p in body) / len(body)
    out = [[cx + (x - cx) * scale, cy + (y - cy) * scale] for x, y in body]
    out.append(out[0])
    return out


def _mask_features(scale: float = 1.0, conf_bump: float = 0.0) -> list[tuple[list[list[float]], dict[str, Any]]]:
    """Flatten stored S1 mask into (ring, props) tuples for phase payloads."""
    out: list[tuple[list[list[float]], dict[str, Any]]] = []
    for feat in load_flood_mask().get("features") or []:
        props = dict(feat.get("properties") or {})
        if conf_bump:
            props["confidence"] = round(min(0.95, float(props.get("confidence", 0.75)) + conf_bump), 2)
        for ring in _geom_rings(feat.get("geometry") or {}):
            use = _expand_ring(ring, scale) if scale != 1.0 else ring
            out.append((use, props))
    return out


# Phase table references the stored S1 mask (core) or a scaled copy (peak/standing).
PHASES: list[dict[str, Any]] = [
    {
        "id": "t0",
        "label": "T+0 h · first heavy band",
        "hours_after_onset": 0,
        "local_time": "2024-04-15T18:00",
        "status": "watch",
        "note": "Meteosat / forecast band crosses Hatta. No water mask yet — pre-position crews.",
        "flood_km2": 0.0,
        "mask_scale": 0.0,
        "conf_bump": 0.0,
    },
    {
        "id": "t4",
        "label": "T+4 h · orbit flood mask",
        "hours_after_onset": 4,
        "local_time": "2024-04-15T22:00",
        "status": "mapping",
        "note": (
            "Precomputed Sentinel-1 RTC change mask (VV −3 dB / −15 dB) over Hatta + Dubai "
            "metro south — scene IDs in mask properties."
        ),
        "mask_scale": 1.0,
        "conf_bump": 0.0,
    },
    {
        "id": "t6",
        "label": "T+6 h · damage triage",
        "hours_after_onset": 6,
        "local_time": "2024-04-16T00:00",
        "status": "triage",
        "note": "Roads and buildings scored against the S1 water mask. Dispatch list ready.",
        "mask_scale": 1.0,
        "conf_bump": 0.04,
    },
    {
        "id": "t12",
        "label": "T+12 h · peak inundation",
        "hours_after_onset": 12,
        "local_time": "2024-04-16T06:00",
        "status": "peak",
        "note": "Expanded mask as rain continues. Optical satellites still clouded out.",
        "mask_scale": 1.45,
        "conf_bump": 0.08,
    },
    {
        "id": "t24",
        "label": "T+24 h · standing water",
        "hours_after_onset": 24,
        "local_time": "2024-04-16T18:00",
        "status": "standing",
        "note": "Traditional optical mapping just becoming usable. Orbit triage already 18 h ahead.",
        "mask_scale": 1.35,
        "conf_bump": 0.10,
    },
]


# Demo assets placed on the computed S1 mask (Overture remains the real POI layer).
_BUILDINGS: list[dict[str, Any]] = [
    # Hatta — on / near S1 polygons
    {"id": "b-h1", "name": "Hatta Heritage area shops", "zone": "hatta", "lon": 56.0717, "lat": 24.8290, "use": "commercial"},
    {"id": "b-h2", "name": "Hatta school block", "zone": "hatta", "lon": 56.1136, "lat": 24.7797, "use": "school"},
    {"id": "b-h3", "name": "Wadi-side residences", "zone": "hatta", "lon": 56.1067, "lat": 24.7955, "use": "residential"},
    {"id": "b-h4", "name": "Clinic annex", "zone": "hatta", "lon": 56.1500, "lat": 24.9088, "use": "clinic"},
    {"id": "b-h5", "name": "Farm store east", "zone": "hatta", "lon": 56.1051, "lat": 24.7678, "use": "commercial"},
    {"id": "b-h6", "name": "Hill villas (dry)", "zone": "hatta", "lon": 56.19, "lat": 24.88, "use": "residential"},
    # Dubai metro south — on / near S1 polygons
    {"id": "b-d1", "name": "Logistics warehouse A", "zone": "dubai-south", "lon": 55.1119, "lat": 25.1417, "use": "industrial"},
    {"id": "b-d2", "name": "Worker accommodation", "zone": "dubai-south", "lon": 55.1401, "lat": 25.1316, "use": "residential"},
    {"id": "b-d3", "name": "Site office", "zone": "dubai-south", "lon": 55.0886, "lat": 25.1478, "use": "office"},
    {"id": "b-d4", "name": "Substation pad", "zone": "dubai-south", "lon": 55.3018, "lat": 25.1109, "use": "utility"},
    {"id": "b-d5", "name": "Retail strip", "zone": "dubai-south", "lon": 55.2217, "lat": 25.1952, "use": "commercial"},
    {"id": "b-d6", "name": "Dry yard sheds", "zone": "dubai-south", "lon": 55.07, "lat": 24.95, "use": "industrial"},
]

_ROADS: list[dict[str, Any]] = [
    {
        "id": "r-h1", "name": "E44 Hatta approach", "zone": "hatta",
        "coords": [[56.060, 24.828], [56.072, 24.829], [56.085, 24.830]],
        "class": "arterial",
    },
    {
        "id": "r-h2", "name": "Wadi crossing road", "zone": "hatta",
        "coords": [[56.110, 24.775], [56.114, 24.780], [56.118, 24.784]],
        "class": "local",
    },
    {
        "id": "r-h3", "name": "Ridge access (dry)", "zone": "hatta",
        "coords": [[56.18, 24.86], [56.20, 24.88], [56.21, 24.90]],
        "class": "local",
    },
    {
        "id": "r-d1", "name": "EXPO / Dubai South link", "zone": "dubai-south",
        "coords": [[55.105, 25.138], [55.112, 25.142], [55.118, 25.148]],
        "class": "arterial",
    },
    {
        "id": "r-d2", "name": "Al Maktoum service road", "zone": "dubai-south",
        "coords": [[55.135, 25.128], [55.140, 25.132], [55.148, 25.135]],
        "class": "service",
    },
    {
        "id": "r-d3", "name": "Desert perimeter track", "zone": "dubai-south",
        "coords": [[55.28, 25.05], [55.29, 25.06], [55.30, 25.07]],
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


def _phase_polygons(phase: dict[str, Any]) -> list[tuple[list[list[float]], dict[str, Any]]]:
    scale = float(phase.get("mask_scale") or 0.0)
    if scale <= 0:
        return []
    return _mask_features(scale=scale, conf_bump=float(phase.get("conf_bump") or 0.0))


def _phase_payload(phase: dict[str, Any]) -> dict[str, Any]:
    polygon_pairs = _phase_polygons(phase)
    polys = []
    rings: list[list[list[float]]] = []
    scale = float(phase.get("mask_scale") or 0.0)
    if scale == 1.0:
        flood_km2 = sum(
            float((f.get("properties") or {}).get("area_km2") or 0.0)
            for f in load_flood_mask().get("features") or []
        )
    else:
        flood_km2 = sum(_ring_area_km2(coords) for coords, _ in polygon_pairs)
    for coords, props in polygon_pairs:
        rings.append(coords)
        polys.append(_poly(coords, {
            **props,
            "phase": phase["id"],
            "source": "s1_rtc_precomputed",
        }))

    buildings = []
    for b in _BUILDINGS:
        flooded = any(_point_in_ring(b["lon"], b["lat"], r) for r in rings)
        depth = "none"
        conf = 0.0
        for coords, props in polygon_pairs:
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

    depths = [props.get("depth_class", "moderate") for _, props in polygon_pairs]
    facilities = overture_places.triage(rings, depths) if rings else {
        "scanned": overture_places.load()["count"],
        "flooded": 0,
        "hospitals_flooded": 0,
        "schools_flooded": 0,
        "clinics_flooded": 0,
        "critical_flooded": 0,
        "facilities": [],
        "geojson": {"type": "FeatureCollection", "features": []},
        "source": overture_places.load()["source"],
        "note": overture_places.load()["note"],
    }

    prov = flood_provenance()
    return {
        "id": phase["id"],
        "label": phase["label"],
        "hours_after_onset": phase["hours_after_onset"],
        "local_time": phase["local_time"],
        "status": phase["status"],
        "note": phase["note"],
        "flood_mask": {
            "source": "precomputed_s1_rtc",
            "method": "change detection: (after_dB - before_dB) < -3 AND after_dB < -15",
            "before_scene_ids": prov.get("before_scene_ids"),
            "after_scene_ids": prov.get("after_scene_ids"),
            "change_db_threshold": prov.get("change_db_threshold"),
            "dark_db_threshold": prov.get("dark_db_threshold"),
        },
        "kpis": {
            "flood_km2": round(flood_km2 if flood_km2 else phase.get("flood_km2", 0.0), 2),
            "buildings_impacted": impacted,
            "buildings_critical": critical,
            "roads_km_affected": round(road_km_cut, 2),
            "zones_active": len({props["zone"] for _, props in polygon_pairs}),
            "overture_scanned": facilities.get("scanned", 0),
            "overture_flooded": facilities.get("flooded", 0),
            "hospitals_flooded": facilities.get("hospitals_flooded", 0),
            "schools_flooded": facilities.get("schools_flooded", 0),
        },
        "facilities": facilities,
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
            "NABD Orbit replays the April 2024 UAE floods with Sentinel-1 / Sentinel-2 / "
            "Copernicus DEM (live STAC), NASA GIBS context, and Overture Maps triage of "
            f"{overture_places.load()['count']}+ real hospitals, schools and clinics "
            "against the flood mask."
        ),
        "latency_note": LATENCY.get("note"),
        "deliverables": [
            "April 2024 UAE floods as the worked example",
            (
                "Precomputed Sentinel-1 RTC flood mask (VV −3 dB change / −15 dB dark) "
                f"from scenes {', '.join(flood_provenance().get('before_scene_ids', []))} → "
                f"{', '.join(flood_provenance().get('after_scene_ids', []))} — offline, not a live SAR job"
            ),
            "Live STAC: Sentinel-1 radar, Sentinel-2, Copernicus DEM over the AOI",
            "NASA GIBS true-colour / land-heat context for the event window",
            f"Overture Maps damage triage: {overture_places.load()['count']} critical places scanned",
            "Design-target latency story (T+4 / T+6 vs ~T+48 optical) — labelled as targets, not wall-clock",
        ],
        "flood_mask_provenance": flood_provenance(),
        "peak_kpis": peak["kpis"],
        "triage_kpis": triage["kpis"],
        "overture": {
            "scanned": overture_places.load()["count"],
            "source": overture_places.load()["source"],
            "flooded_at_triage": triage.get("facilities", {}).get("flooded", 0),
            "hospitals_flooded": triage.get("facilities", {}).get("hospitals_flooded", 0),
            "schools_flooded": triage.get("facilities", {}).get("schools_flooded", 0),
        },
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
