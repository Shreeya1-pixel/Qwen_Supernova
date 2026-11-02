"""One-time prep: WorldPop UAE GeoTIFF → frontend/public/data/pop_dubai.json.

    pip install rasterio numpy
    python scripts/prep_population.py /path/to/are_ppp_2020_UNadj.tif [--step 2] [--min 1]

Writes {"source", "cell_m", "cells": [{lat, lng, pop}, ...]} for the Dubai bounding box.
--step N sums N×N blocks (e.g. 2 → ~200 m cells); --min drops near-empty cells
(unconstrained WorldPop spreads fractions of a person across the desert).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import from_bounds

WEST, SOUTH, EAST, NORTH = 54.9, 24.7, 55.7, 25.4
OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "data" / "pop_dubai.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("tif", type=Path)
    ap.add_argument("--step", type=int, default=1, help="aggregate N×N cells")
    ap.add_argument("--min", type=float, default=1.0, help="drop cells with fewer people than this")
    args = ap.parse_args()

    with rasterio.open(args.tif) as src:
        window = from_bounds(WEST, SOUTH, EAST, NORTH, src.transform).round_offsets().round_lengths()
        data = src.read(1, window=window).astype("float64")
        transform = src.window_transform(window)
        nodata = src.nodata
    if nodata is not None:
        data[data == nodata] = 0
    data[~np.isfinite(data) | (data < 0)] = 0

    s = max(1, args.step)
    if s > 1:
        h, w = (data.shape[0] // s) * s, (data.shape[1] // s) * s
        data = data[:h, :w].reshape(h // s, s, w // s, s).sum(axis=(1, 3))

    res_x, res_y = transform.a * s, transform.e * s
    rows, cols = np.nonzero(data >= max(args.min, 1e-9))
    lngs = transform.c + (cols + 0.5) * res_x
    lats = transform.f + (rows + 0.5) * res_y
    cells = [{"lat": round(float(la), 4), "lng": round(float(lo), 4), "pop": round(float(p), 1)}
             for la, lo, p in zip(lats, lngs, data[rows, cols])]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": f"WorldPop {args.tif.name}", "cell_m": round(abs(res_x) * 111_320 * 0.906),
                               "bbox": [WEST, SOUTH, EAST, NORTH], "cells": cells}, separators=(",", ":")))
    kept = sum(c["pop"] for c in cells)
    print(f"{len(cells)} cells · {kept:,.0f} of {data.sum():,.0f} people kept → {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
