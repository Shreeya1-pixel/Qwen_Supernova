"""Nabd Index — a decaying memory of environmental stress per site (0..100).

Grown out of the GeoTrade Global Tension Index (exponentially decaying event
memory with attributed drivers), reshaped for bodies and ecosystems:

  1. Each hazard keeps a "fast attack, slow release" memory:
         m_h(t) = min(100, max(100·hazard_h(t), m_h(t−1)·e^(−λ_h)) + 2·hazard_h(t))
     Exposure hits at once; recovery is gradual; sustained exposure accumulates.
     Each hazard fades at its own physical pace (λ_h from a half-life):
         heat 6 h (bodies cool overnight), UV 3 h, air 12 h, dust 24 h,
         flood 48 h (standing water), sea warming 72 h (blooms build slowly).

  2. Hazards combine as a noisy-OR weighted by severity s_h:
         index = 100 · (1 − Π_h (1 − s_h · m_h/100))
     so one extreme hazard is enough to make the index severe, and several
     moderate ones add up without exceeding 100.

  3. Each hazard's share of −log(1 − index/100) is reported as a driver.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from ..connectors.open_meteo import SiteFrame
from .hazards import HAZARD_LABELS, HAZARDS, hour_hazards

HALF_LIFE_H = {"heat": 6, "uv": 3, "air": 12, "dust": 24, "flood": 48, "sea_warming": 72}
LAMBDA = {h: math.log(2) / hl for h, hl in HALF_LIFE_H.items()}
# How directly each hazard harms people (sea warming acts through blooms and water, so it is indirect).
SEVERITY = {"heat": 0.95, "flood": 0.9, "dust": 0.6, "air": 0.55, "sea_warming": 0.4, "uv": 0.25}
LOOKBACK_H = 72


@dataclass
class IndexResult:
    value: float
    delta_6h: float
    band: str
    drivers: list[dict]
    memory: dict[str, float] = field(default_factory=dict)
    series: list[dict] = field(default_factory=list)


def band(value: float) -> str:
    if value >= 75:
        return "severe"
    if value >= 50:
        return "high"
    if value >= 25:
        return "elevated"
    return "calm"


def combine(memory: dict[str, float]) -> tuple[float, dict[str, float]]:
    survive, logs = 1.0, {}
    for h, m in memory.items():
        p = min(0.999, SEVERITY[h] * m / 100.0)
        survive *= 1.0 - p
        logs[h] = -math.log(1.0 - p)
    return 100.0 * (1.0 - survive), logs


def compute(frame: SiteFrame, lookback: int = LOOKBACK_H) -> IndexResult:
    start = max(0, frame.now_index - lookback + 1)
    memory = {h: 0.0 for h in HAZARDS}
    series, logs = [], {}
    for i in range(start, frame.now_index + 1):
        hz = hour_hazards(frame, i)
        for h in HAZARDS:
            x = hz.values[h]
            memory[h] = min(100.0, max(100.0 * x, memory[h] * math.exp(-LAMBDA[h])) + 2.0 * x)
        value, logs = combine(memory)
        series.append({"time": hz.time, "value": round(value, 2)})

    value = series[-1]["value"] if series else 0.0
    past = series[-7]["value"] if len(series) >= 7 else (series[0]["value"] if series else 0.0)
    total_log = sum(logs.values()) or 1.0
    drivers = sorted(
        ({"hazard": h, "label": HAZARD_LABELS[h], "share": round(logs[h] / total_log, 3),
          "memory": round(memory[h], 1)} for h in HAZARDS if logs.get(h, 0) > 0.005),
        key=lambda d: d["share"], reverse=True,
    )
    return IndexResult(value=value, delta_6h=round(value - past, 2), band=band(value), drivers=drivers,
                       memory={h: round(m, 1) for h, m in memory.items()}, series=series)
