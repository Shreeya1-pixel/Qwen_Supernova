"""Overture Maps places — hospitals, schools, clinics for flood damage triage.

Cached extract from Overture release 2026-10-21.0 (public S3 GeoParquet) for the
Dubai–Sharjah–Hatta corridor. Refresh with `python -m nabd.connectors.overture_places`.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

DATA = Path(__file__).resolve().parents[1] / "data" / "overture_facilities_uae.json"
RELEASE = "2026-10-21.0"
AOI = {"west": 54.9, "south": 24.6, "east": 56.5, "north": 25.5}

# Categories treated as first-responder critical (hospitals, schools, clinics, …).
CRITICAL_SUBSTRINGS = (
    "hospital", "school", "clinic", "college", "university", "preschool",
    "elementary", "high_school", "place_of_learning", "pharmacy",
    "emergency", "fire_station", "outpatient",
)
EXCLUDE_SUBSTRINGS = ("dental", "vision", "behavioral", "mental", "family_service")

_cache: dict[str, Any] | None = None
_cache_at = 0.0
CACHE_TTL_S = 3600


def _is_critical(category: str | None) -> bool:
    c = (category or "").lower()
    if any(x in c for x in EXCLUDE_SUBSTRINGS):
        return False
    return any(x in c for x in CRITICAL_SUBSTRINGS)


def load() -> dict[str, Any]:
    global _cache, _cache_at
    if _cache and time.time() - _cache_at < CACHE_TTL_S:
        return _cache
    raw = json.loads(DATA.read_text())
    facilities = [f for f in raw.get("facilities") or [] if _is_critical(f.get("category"))]
    out = {
        "ok": True,
        "live": False,
        "source": raw.get("source") or f"Overture Maps places {RELEASE}",
        "release": RELEASE,
        "bbox": raw.get("bbox") or [AOI["west"], AOI["south"], AOI["east"], AOI["north"]],
        "raw_count": raw.get("count", len(raw.get("facilities") or [])),
        "count": len(facilities),
        "facilities": facilities,
        "note": (
            "Real places from Overture Maps (public GeoParquet). "
            "Filtered to hospitals, schools, clinics, pharmacies and related critical amenities "
            f"({len(facilities)} of {raw.get('count')} in AOI). "
            "Flooded status is computed against the orbit water mask per phase."
        ),
    }
    _cache, _cache_at = out, time.time()
    return out


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / ((yj - yi) + 1e-15) + xi):
            inside = not inside
        j = i
    return inside


def triage(flood_rings: list[list[list[float]]], depth_by_ring: list[str] | None = None) -> dict[str, Any]:
    """Score each critical facility against flood polygon rings."""
    base = load()
    depth_by_ring = depth_by_ring or ["moderate"] * len(flood_rings)
    hit = []
    for f in base["facilities"]:
        lon, lat = f["lon"], f["lat"]
        flooded = False
        depth = "none"
        for ring, d in zip(flood_rings, depth_by_ring):
            if point_in_ring(lon, lat, ring):
                flooded = True
                depth = d
                break
        if flooded:
            cat = (f.get("category") or "").lower()
            severity = "critical" if any(k in cat for k in ("hospital", "school", "preschool", "elementary", "college", "university", "emergency", "fire")) else "impacted"
            hit.append({
                **f,
                "flooded": True,
                "depth_class": depth,
                "severity": severity,
            })
    hospitals = sum(1 for x in hit if "hospital" in (x.get("category") or "").lower())
    schools = sum(1 for x in hit if any(k in (x.get("category") or "").lower() for k in ("school", "preschool", "college", "university", "place_of_learning", "education")))
    clinics = sum(1 for x in hit if "clinic" in (x.get("category") or "").lower() or "outpatient" in (x.get("category") or "").lower())
    return {
        "source": base["source"],
        "scanned": base["count"],
        "flooded": len(hit),
        "hospitals_flooded": hospitals,
        "schools_flooded": schools,
        "clinics_flooded": clinics,
        "critical_flooded": sum(1 for x in hit if x["severity"] == "critical"),
        "facilities": hit[:200],  # cap payload for UI
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {k: v for k, v in x.items() if k not in ("lon", "lat")},
                    "geometry": {"type": "Point", "coordinates": [x["lon"], x["lat"]]},
                }
                for x in hit[:500]
            ],
        },
        "note": base["note"],
    }


def refresh_from_s3() -> dict[str, Any]:
    """Re-download AOI facilities from Overture S3 (needs duckdb + network)."""
    import duckdb

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    con.execute("SET s3_region='us-west-2';")
    path = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*"
    rows = con.execute(f"""
        SELECT id, names.primary AS name,
               coalesce(basic_category, taxonomy.primary) AS category,
               round(ST_X(geometry), 5) AS lon, round(ST_Y(geometry), 5) AS lat
        FROM read_parquet('{path}', hive_partitioning=1)
        WHERE bbox.xmin >= {AOI['west']} AND bbox.xmax <= {AOI['east']}
          AND bbox.ymin >= {AOI['south']} AND bbox.ymax <= {AOI['north']}
          AND (
            lower(coalesce(basic_category,'')) LIKE '%hospital%'
            OR lower(coalesce(basic_category,'')) LIKE '%school%'
            OR lower(coalesce(basic_category,'')) LIKE '%clinic%'
            OR lower(coalesce(basic_category,'')) LIKE '%pharmacy%'
            OR lower(coalesce(basic_category,'')) LIKE '%college%'
            OR lower(coalesce(taxonomy.primary,'')) LIKE '%hospital%'
            OR lower(coalesce(taxonomy.primary,'')) LIKE '%school%'
            OR lower(coalesce(names.primary,'')) LIKE '%hospital%'
            OR lower(coalesce(names.primary,'')) LIKE '%school%'
          )
    """).fetchall()
    facilities = [
        {"id": r[0], "name": r[1] or r[2], "category": r[2], "lon": r[3], "lat": r[4]}
        for r in rows
    ]
    payload = {
        "source": f"Overture Maps places {RELEASE}",
        "bbox": [AOI["west"], AOI["south"], AOI["east"], AOI["north"]],
        "count": len(facilities),
        "facilities": facilities,
    }
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(json.dumps(payload))
    global _cache, _cache_at
    _cache, _cache_at = None, 0.0
    return {"ok": True, "count": len(facilities), "path": str(DATA)}


if __name__ == "__main__":
    print(refresh_from_s3())
