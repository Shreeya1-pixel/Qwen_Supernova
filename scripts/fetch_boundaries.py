"""Fetch real district boundaries for Scenario mode presets (run once, offline demo uses the saved file).

    pip install requests
    python scripts/fetch_boundaries.py            # boundaries + OSM building counts
    python scripts/fetch_boundaries.py --no-buildings

Boundaries come from Nominatim (OpenStreetMap contributors, ODbL). Building counts come from
Overpass at prep time so the frontend never calls either service at runtime.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import requests

# (id, search query, label EN, label AR, fallback OSM id for when the search returns a point)
AREAS = [
    ("academic-city", "Academic City, Dubai", "Academic City", "المدينة الأكاديمية", "R18471831"),
    ("silicon-oasis", "Dubai Silicon Oasis", "Silicon Oasis", "واحة دبي للسيليكون", None),
    # OSM's relation named "International City" (R18471686) actually covers Silicon Oasis; the real
    # International City is the Warsan 1 neighbourhood polygon.
    ("international-city", "International City, Dubai", "International City (Warsan 1)", "المدينة العالمية (ورسان 1)", "W100108364"),
    ("mirdif", "Mirdif, Dubai", "Mirdif", "مردف", None),
]
NOMINATIM = "https://nominatim.openstreetmap.org/search"
LOOKUP = "https://nominatim.openstreetmap.org/lookup"
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
# Nominatim rejects placeholder contact addresses (example.com) with 403; add a real email if you have one.
HEADERS = {"User-Agent": "NABD/1.0 (scenario-mode boundary prep)"}
OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "data" / "areas.json"


def outer_rings(geom: dict) -> list[list[list[float]]]:
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


def inside(x: float, y: float, ring: list[list[float]]) -> bool:
    hit = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


def count_buildings(geom: dict) -> int | None:
    rings = outer_rings(geom)
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    q = f'[out:json][timeout:90];way["building"]({min(ys)},{min(xs)},{max(ys)},{max(xs)});out geom;'
    for attempt, host in enumerate(OVERPASS * 2):
        if attempt:
            time.sleep(10)
        try:
            r = requests.post(host, data={"data": q}, headers=HEADERS, timeout=120)
            r.raise_for_status()
            els = r.json()["elements"]
        except (requests.RequestException, ValueError, KeyError) as exc:
            print(f"  overpass {host} failed: {exc}")
            continue
        return sum(
            1 for el in els
            if any(inside(p["lon"], p["lat"], ring) for p in el.get("geometry", []) for ring in rings)
        )
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-buildings", action="store_true")
    args = ap.parse_args()

    previous = {}
    if OUT.exists():
        previous = {f["properties"]["id"]: f["properties"].get("buildings") for f in json.loads(OUT.read_text())["features"]}

    features = []
    for i, (fid, query, name, name_ar, osm_id) in enumerate(AREAS):
        if i:
            time.sleep(1)
        r = requests.get(
            NOMINATIM,
            params={"q": query, "format": "jsonv2", "polygon_geojson": 1, "limit": 1},
            headers=HEADERS,
            timeout=30,
        )
        r.raise_for_status()
        hits = r.json()
        hit = hits[0] if hits else {}
        geom = hit.get("geojson", {})
        if geom.get("type") not in ("Polygon", "MultiPolygon"):
            print(f"WARNING: {query!r} returned a {geom.get('type')} ({hit.get('category')}/{hit.get('type')}), not a polygon")
            if not osm_id:
                print("  skipped")
                continue
            time.sleep(1)
            r = requests.get(LOOKUP, params={"osm_ids": osm_id, "format": "jsonv2", "polygon_geojson": 1}, headers=HEADERS, timeout=30)
            r.raise_for_status()
            hit = (r.json() or [{}])[0]
            geom = hit.get("geojson", {})
            if geom.get("type") not in ("Polygon", "MultiPolygon"):
                print(f"  lookup {osm_id} also returned no polygon, skipped")
                continue
            print(f"  using OSM boundary {osm_id} instead")
        props = {
            "id": fid,
            "name": name,
            "name_ar": name_ar,
            "osm": f"{hit['osm_type']}/{hit['osm_id']}",
            "display_name": hit.get("display_name"),
        }
        if not args.no_buildings:
            n = count_buildings(geom)
            if n is None and previous.get(fid) is not None:
                n = previous[fid]
                print(f"  keeping the previous building count for {name}")
            props["buildings"] = n
            print(f"  {name}: {n} OSM buildings")
        features.append({"type": "Feature", "properties": props, "geometry": geom})
        print(f"OK {name}: {geom['type']} from {props['osm']}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "type": "FeatureCollection",
        "source": "Boundaries © OpenStreetMap contributors (ODbL), via Nominatim",
        "generated": time.strftime("%Y-%m-%d"),
        "features": features,
    }, ensure_ascii=False))
    print(f"wrote {len(features)} areas → {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
