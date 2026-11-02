"""Map sources, both live and keyless.

- geoBoundaries API → UAE emirate outlines, simplified (low) or full (high).
  Proxied because GitHub's redirect has no CORS header; cached on disk forever.
- NASA GIBS WMS → the latest satellite pass over the UAE. Some days are empty
  (swath gaps, cloud masks), so we probe back a few days for a real image.
"""
from __future__ import annotations

import json
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlencode

import httpx

CACHE = Path(__file__).resolve().parents[2] / ".cache"
GB_API = "https://www.geoboundaries.org/api/current/gbOpen/ARE/ADM1/"
GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
BBOX = (22.45, 51.4, 26.35, 57.0)  # lat_min, lon_min, lat_max, lon_max (WMS 1.3.0 order for EPSG:4326)
LAYERS = {
    "truecolor": ("VIIRS_NOAA20_CorrectedReflectance_TrueColor", "image/jpeg"),
    "lst": ("MODIS_Aqua_Land_Surface_Temp_Day", "image/png"),
    "aod": ("MODIS_Terra_Aerosol_Optical_Depth_3km", "image/png"),
}
WIDTH = {"low": 1024, "high": 3072}
EMPTY_BYTES = 6000
_imagery: dict[tuple, tuple[float, dict]] = {}


async def boundaries(res: str = "low") -> dict:
    path = CACHE / f"boundaries_{res}.json"
    if path.exists():
        return json.loads(path.read_text())
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        meta = (await client.get(GB_API)).json()
        url = meta["simplifiedGeometryGeoJSON" if res == "low" else "gjDownloadURL"]
        gj = (await client.get(url)).json()
    digits = 3 if res == "low" else 4
    emirates = []
    for f in gj["features"]:
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        rings = [[[round(x, digits), round(y, digits)] for x, y in poly[0]] for poly in polys]
        emirates.append({"name": f["properties"].get("shapeName"), "rings": rings})
    data = {"res": res, "source": "geoBoundaries gbOpen ARE ADM1 (ODbL, OpenStreetMap)",
            "points": sum(len(r) for e in emirates for r in e["rings"]), "emirates": emirates}
    CACHE.mkdir(exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False))
    return data


def _url(layer: str, fmt: str, day: date, width: int) -> str:
    height = round(width * (BBOX[2] - BBOX[0]) / (BBOX[3] - BBOX[1]) / 0.91)
    return GIBS + "?" + urlencode({
        "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "LAYERS": layer, "CRS": "EPSG:4326",
        "BBOX": ",".join(map(str, BBOX)), "WIDTH": width, "HEIGHT": height, "FORMAT": fmt,
        "TRANSPARENT": "true", "TIME": day.isoformat()})


async def imagery(kind: str, res: str = "low", on: str | None = None) -> dict:
    layer, fmt = LAYERS[kind]
    start = date.fromisoformat(on[:10]) if on else date.today() - timedelta(days=1)
    key = (kind, res, start)
    if key in _imagery and time.time() - _imagery[key][0] < 3 * 3600:
        return _imagery[key][1]
    found = None
    async with httpx.AsyncClient(timeout=30) as client:
        for back in range(6):
            day = start - timedelta(days=back)
            probe = await client.get(_url(layer, fmt, day, 256))
            if probe.status_code == 200 and len(probe.content) > EMPTY_BYTES * 256 / 1024:
                found = day
                break
    found = found or start
    data = {"kind": kind, "layer": layer, "date": found.isoformat(), "url": _url(layer, fmt, found, WIDTH[res]),
            "bbox": {"lat": [BBOX[0], BBOX[2]], "lon": [BBOX[1], BBOX[3]]}, "source": "NASA GIBS"}
    _imagery[key] = (time.time(), data)
    return data


# Live heat field: current conditions on a 0.4° grid (10 × 13 points) in one multi-location
# Open-Meteo call. Each point counts against the free quota, hence the 30-minute cache.
GRID_LATS = [round(22.6 + 0.4 * i, 2) for i in range(10)]
GRID_LONS = [round(51.5 + 0.4 * j, 2) for j in range(13)]
HEAT_KEYS = ("temperature_2m", "apparent_temperature", "wet_bulb_temperature_2m", "relative_humidity_2m")
_heat: dict = {"at": 0.0, "data": None}


async def heat_grid() -> dict:
    if _heat["data"] and time.time() - _heat["at"] < 1800:
        return _heat["data"]
    pts = [(la, lo) for la in GRID_LATS for lo in GRID_LONS]
    path = CACHE / "heat_grid.json"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get("https://api.open-meteo.com/v1/forecast", params={
                "latitude": ",".join(str(p[0]) for p in pts),
                "longitude": ",".join(str(p[1]) for p in pts),
                "current": ",".join(HEAT_KEYS),
                "timezone": "Asia/Dubai",
            })
            r.raise_for_status()
        rows = r.json()
        data = {"lats": GRID_LATS, "lons": GRID_LONS, "time": rows[0]["current"]["time"],
                "values": {k: [row["current"].get(k) for row in rows] for k in HEAT_KEYS},
                "source": "Open-Meteo forecast, current conditions", "stale": False}
        CACHE.mkdir(exist_ok=True)
        path.write_text(json.dumps(data))
    except (httpx.HTTPError, KeyError, ValueError, IndexError):
        if _heat["data"]:
            return _heat["data"]
        if not path.exists():
            raise
        data = {**json.loads(path.read_text()), "stale": True}
    _heat.update(at=time.time(), data=data)
    return data
