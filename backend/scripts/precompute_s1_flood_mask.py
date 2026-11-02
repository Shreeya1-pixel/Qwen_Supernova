#!/usr/bin/env python3
"""Offline Sentinel-1 RTC change-detection flood mask for April 2024 UAE.

Pair logic (same relative orbit + pass direction):
  - Dubai metro south: descending orbit 166 · 2024-04-03 → 2024-04-15
  - Hatta wadi:        ascending  orbit  57 · 2024-04-07 → 2024-04-19

Thresholds (VV dB), matching common S1 flood practice:
  flood = (after - before) < -3 dB  AND  after < -15 dB

Writes:
  nabd/data/s1_flood_mask_apr2024.geojson
  nabd/data/s1_flood_mask_provenance.json

Requires: planetary-computer, rasterio, shapely, scikit-image, numpy, httpx
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import httpx
import numpy as np
import planetary_computer as pc
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from shapely.geometry import MultiPolygon, Polygon, mapping
from shapely.ops import unary_union
from skimage.measure import find_contours, label
from skimage.morphology import binary_dilation, disk, opening, remove_small_objects

ROOT = Path(__file__).resolve().parents[1]
OUT_GEOJSON = ROOT / "nabd" / "data" / "s1_flood_mask_apr2024.geojson"
OUT_PROV = ROOT / "nabd" / "data" / "s1_flood_mask_provenance.json"

PC = "https://planetarycomputer.microsoft.com/api/stac/v1"
CHANGE_DB = -3.0
DARK_DB = -15.0
OUT_RES_M = 60

# zone → (bbox WGS84, before_id, after_id)
ZONES: dict[str, dict] = {
    "dubai-south": {
        "name": "Dubai South / metro flats",
        "bbox": (55.05, 24.85, 55.40, 25.20),
        "before_scene_id": "S1A_IW_GRDH_1SDV_20240403T021553_20240403T021616_053263_0674A7_rtc",
        "after_scene_id": "S1A_IW_GRDH_1SDV_20240415T021552_20240415T021616_053438_067B9A_rtc",
        "relative_orbit": 166,
        "orbit_state": "descending",
    },
    "hatta": {
        "name": "Hatta wadi",
        "bbox": (55.95, 24.70, 56.30, 24.95),
        "before_scene_id": "S1A_IW_GRDH_1SDV_20240407T141702_20240407T141727_053329_067746_rtc",
        "after_scene_id": "S1A_IW_GRDH_1SDV_20240419T141702_20240419T141727_053504_067E38_rtc",
        "relative_orbit": 57,
        "orbit_state": "ascending",
    },
}


def signed_vv(item_id: str) -> tuple[str, dict]:
    r = httpx.get(f"{PC}/collections/sentinel-1-rtc/items/{item_id}", timeout=60)
    r.raise_for_status()
    item = r.json()
    href = pc.sign(item["assets"]["vv"]["href"])
    props = item.get("properties") or {}
    return href, {
        "id": item_id,
        "datetime": props.get("datetime"),
        "orbit_state": props.get("sat:orbit_state"),
        "relative_orbit": props.get("sat:relative_orbit"),
    }


def read_window_db(href: str, west: float, south: float, east: float, north: float):
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        AWS_NO_SIGN_REQUEST="YES",
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff",
    ):
        with rasterio.open(href) as src:
            mid_lat = (south + north) / 2
            dlon = OUT_RES_M / (111_320 * math.cos(math.radians(mid_lat)))
            dlat = OUT_RES_M / 111_320
            width = max(32, int(math.ceil((east - west) / dlon)))
            height = max(32, int(math.ceil((north - south) / dlat)))
            dst_transform = from_bounds(west, south, east, north, width, height)
            dst = np.full((height, width), np.nan, dtype=np.float32)
            reproject(
                source=rasterio.band(src, 1),
                destination=dst,
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=dst_transform,
                dst_crs="EPSG:4326",
                resampling=Resampling.average,
                src_nodata=src.nodata,
                dst_nodata=np.nan,
            )
            sample = dst[np.isfinite(dst)]
            if sample.size == 0:
                raise RuntimeError(f"no valid pixels in window {(west, south, east, north)}")
            if np.nanmedian(sample) > 0:
                db = 10.0 * np.log10(np.maximum(dst, 1e-10))
                db[~np.isfinite(dst)] = np.nan
            else:
                db = dst
            return db, dst_transform


def poly_area_km2(poly: Polygon) -> float:
    _, lat0, _, lat1 = poly.bounds
    lat_c = (lat0 + lat1) / 2
    m_lon = 111.32 * math.cos(math.radians(lat_c))
    m_lat = 111.32
    xy = [(c[0] * m_lon, c[1] * m_lat) for c in poly.exterior.coords]
    area = 0.0
    for j in range(len(xy) - 1):
        x1, y1 = xy[j]
        x2, y2 = xy[j + 1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def mask_to_polygons(mask: np.ndarray, transform, min_pixels: int = 10) -> list[Polygon]:
    # Speckle change masks are fragmented — dilate to reconnect nearby water pixels,
    # drop tiny islands, then light opening to smooth edges for GeoJSON.
    mask = binary_dilation(mask.astype(bool), disk(2))
    mask = remove_small_objects(mask, min_size=min_pixels)
    mask = opening(mask, disk(1))
    if not mask.any():
        return []
    polys: list[Polygon] = []
    labeled = label(mask)
    for lid in range(1, int(labeled.max()) + 1):
        component = labeled == lid
        for contour in find_contours(component.astype(float), 0.5):
            coords = [rasterio.transform.xy(transform, row, col) for row, col in contour]
            if len(coords) < 4:
                continue
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            try:
                p = Polygon(coords)
                if not p.is_valid:
                    p = p.buffer(0)
                if isinstance(p, MultiPolygon):
                    polys.extend([g for g in p.geoms if not g.is_empty and g.area > 1e-6])
                elif isinstance(p, Polygon) and not p.is_empty and p.area > 1e-6:
                    polys.append(p)
            except Exception:
                continue
    if not polys:
        return []
    merged = unary_union(polys)
    if isinstance(merged, Polygon):
        return [merged]
    if isinstance(merged, MultiPolygon):
        return [g for g in merged.geoms if g.area > 1e-6]
    return []


def process_zone(zone: str, cfg: dict) -> tuple[list[dict], dict]:
    before_href, before_meta = signed_vv(cfg["before_scene_id"])
    after_href, after_meta = signed_vv(cfg["after_scene_id"])
    west, south, east, north = cfg["bbox"]
    print(f"\n=== {zone} ===")
    print("before", before_meta["id"], before_meta["datetime"])
    print("after ", after_meta["id"], after_meta["datetime"])
    b_db, transform = read_window_db(before_href, west, south, east, north)
    a_db, transform = read_window_db(after_href, west, south, east, north)
    h = min(b_db.shape[0], a_db.shape[0])
    w = min(b_db.shape[1], a_db.shape[1])
    b_db, a_db = b_db[:h, :w], a_db[:h, :w]
    valid = np.isfinite(b_db) & np.isfinite(a_db)
    flood = (
        valid
        & ((a_db - b_db) < CHANGE_DB)
        & (a_db < DARK_DB)
        & (b_db > (DARK_DB - 2))
    )
    n = int(flood.sum())
    print(
        f"flood_px={n}/{int(valid.sum())} "
        f"before_med={np.nanmedian(b_db):.1f} after_med={np.nanmedian(a_db):.1f}"
    )
    polys = sorted(mask_to_polygons(flood, transform, min_pixels=10), key=lambda p: p.area, reverse=True)[:30]
    print(f"polygons={len(polys)}")
    features = []
    zone_km2 = 0.0
    for poly in polys:
        simp = poly.simplify(0.0012, preserve_topology=True)
        if simp.is_empty:
            continue
        geoms = [simp] if isinstance(simp, Polygon) else list(simp.geoms)
        for g in geoms:
            if g.is_empty or g.area < 1e-6:
                continue
            km2 = poly_area_km2(g)
            zone_km2 += km2
            cx, cy = g.centroid.x, g.centroid.y
            r, c = rasterio.transform.rowcol(transform, cx, cy)
            r = int(np.clip(r, 0, h - 1))
            c = int(np.clip(c, 0, w - 1))
            after_val = float(a_db[r, c]) if np.isfinite(a_db[r, c]) else -16.0
            if after_val < -20:
                depth, conf = "deep", 0.88
            elif after_val < -17:
                depth, conf = "moderate", 0.80
            else:
                depth, conf = "shallow", 0.72
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "zone": zone,
                        "name": cfg["name"],
                        "confidence": conf,
                        "depth_class": depth,
                        "area_km2": round(km2, 3),
                        "method": "s1_rtc_change",
                        "change_db_threshold": CHANGE_DB,
                        "dark_db_threshold": DARK_DB,
                        "before_scene_id": cfg["before_scene_id"],
                        "after_scene_id": cfg["after_scene_id"],
                        "relative_orbit": cfg["relative_orbit"],
                        "orbit_state": cfg["orbit_state"],
                        "before_datetime": before_meta["datetime"],
                        "after_datetime": after_meta["datetime"],
                    },
                    "geometry": mapping(g),
                }
            )
    stats = {
        "pixels": n,
        "polygons": len(features),
        "km2": round(zone_km2, 3),
        "before_scene_id": cfg["before_scene_id"],
        "after_scene_id": cfg["after_scene_id"],
        "before_datetime": before_meta["datetime"],
        "after_datetime": after_meta["datetime"],
    }
    return features, stats


def main() -> None:
    all_features: list[dict] = []
    zone_stats: dict[str, dict] = {}
    scene_ids: list[str] = []
    for zone, cfg in ZONES.items():
        feats, stats = process_zone(zone, cfg)
        all_features.extend(feats)
        zone_stats[zone] = stats
        scene_ids.extend([cfg["before_scene_id"], cfg["after_scene_id"]])

    if not all_features:
        raise SystemExit("No flood polygons detected — check thresholds / scene coverage.")

    fc = {
        "type": "FeatureCollection",
        "properties": {
            "title": "Precomputed Sentinel-1 RTC flood mask — April 2024 UAE",
            "method": "change detection: (after_dB - before_dB) < -3 AND after_dB < -15",
            "source": "Microsoft Planetary Computer sentinel-1-rtc (VV)",
            "thresholds_db": {"change": CHANGE_DB, "dark": DARK_DB},
            "pairs": {
                zone: {
                    "before_scene_id": cfg["before_scene_id"],
                    "after_scene_id": cfg["after_scene_id"],
                    "relative_orbit": cfg["relative_orbit"],
                    "orbit_state": cfg["orbit_state"],
                }
                for zone, cfg in ZONES.items()
            },
            "note": (
                "Offline precompute for NABD Theme 04. Loaded at runtime; "
                "not a live SAR processor."
            ),
        },
        "features": all_features,
    }
    OUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_GEOJSON.write_text(json.dumps(fc))
    prov = {
        "before_scene_ids": sorted({cfg["before_scene_id"] for cfg in ZONES.values()}),
        "after_scene_ids": sorted({cfg["after_scene_id"] for cfg in ZONES.values()}),
        "scene_ids": sorted(set(scene_ids)),
        "change_db_threshold": CHANGE_DB,
        "dark_db_threshold": DARK_DB,
        "feature_count": len(all_features),
        "zones": zone_stats,
        "geojson": str(OUT_GEOJSON.name),
    }
    OUT_PROV.write_text(json.dumps(prov, indent=2))
    print("\nWrote", OUT_GEOJSON, "features=", len(all_features), "bytes=", OUT_GEOJSON.stat().st_size)
    print("Wrote", OUT_PROV)
    print(json.dumps(zone_stats, indent=2))


if __name__ == "__main__":
    main()
