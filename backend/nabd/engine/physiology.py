"""Crew physiology: wearable stream → Physiological Strain Index.

Physiological Strain Index (Moran et al., 1998), 0..10:
    PSI = 5·(Tc − Tc₀)/(39.5 − Tc₀) + 5·(HR − HR₀)/(180 − HR₀)

In the demo the wearable stream is SIMULATED, driven by the site's *real*
hourly WBGT from Open-Meteo plus each worker's profile (acclimatisation,
fasting, fitness). Swap `simulate_worker_series` for an Android Health Connect
or BLE wearable reader and everything downstream is unchanged.
"""
from __future__ import annotations

import hashlib
import math
import random
from dataclasses import dataclass, field
from datetime import datetime

from ..connectors.open_meteo import SiteFrame
from .calendar_uae import fasting_hours, midday_ban_active
from .hazards import hour_hazards

TC0 = 37.0


@dataclass
class Worker:
    id: str
    name: str
    language: str
    role: str
    days_in_uae: int
    age: int
    hr_rest: int
    fasting: bool = False
    symptoms: list[str] = field(default_factory=list)


CREW_TEMPLATE = [
    ("ravi", "Ravi", "hi", "steel fixer", 3, 24, 68),
    ("ahmed", "Ahmed", "ur", "mason", 410, 38, 72),
    ("joseph", "Joseph", "ml", "scaffolder", 1200, 45, 70),
    ("maria", "Maria", "tl", "site nurse", 900, 33, 66),
    ("senthil", "Senthil", "ta", "rigger", 9, 29, 74),
    ("khalid", "Khalid", "ar", "supervisor", 9000, 51, 76),
    ("rahim", "Rahim", "bn", "delivery rider", 60, 27, 71),
]

_crews: dict[str, list[Worker]] = {}


def crew(site_id: str) -> list[Worker]:
    if site_id not in _crews:
        _crews[site_id] = [Worker(id=f"{site_id}:{wid}", name=name, language=lang, role=role,
                                  days_in_uae=days, age=age, hr_rest=hr)
                           for wid, name, lang, role, days, age, hr in CREW_TEMPLATE]
    return _crews[site_id]


def find_worker(worker_id: str) -> Worker | None:
    site_id = worker_id.split(":", 1)[0]
    return next((w for w in crew(site_id) if w.id == worker_id), None)


def _rng(*parts: str) -> random.Random:
    seed = int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:12], 16)
    return random.Random(seed)


def acclimatisation_penalty(days: int) -> float:
    """Heat acclimatisation takes ~7–14 days; unacclimatised bodies strain more."""
    return max(0.0, (14 - days) / 14) * 0.6


def workload(dt: datetime, role: str) -> float:
    if midday_ban_active(dt):
        return 0.1
    if role == "supervisor":
        return 0.35 if 7 <= dt.hour < 18 else 0.05
    if role == "delivery rider":
        return 0.55 if 10 <= dt.hour < 23 else 0.05
    return 0.7 if 7 <= dt.hour < 17 else 0.08


def strain_index(hr: float, tc: float, hr0: float) -> float:
    value = 5 * (tc - TC0) / (39.5 - TC0) + 5 * (hr - hr0) / (180 - hr0)
    return max(0.0, min(10.0, value))


def simulate_worker_series(frame: SiteFrame, w: Worker, hours: int = 72, ahead: int = 0) -> list[dict]:
    """Hour-by-hour simulation with state: stored body heat, cardiovascular drift, fluid debt.

    `ahead` continues the same simulation into the forecast hours (rows flagged projected)."""
    rows = []
    hydration_debt = heat_storage = drift = 0.0
    start = max(0, frame.now_index - hours + 1)
    end = min(len(frame.time), frame.now_index + 1 + ahead)
    for i in range(start, end):
        hz = hour_hazards(frame, i)
        dt = datetime.fromisoformat(hz.time)
        wbgt = hz.wbgt if hz.wbgt is not None else 26.0
        load = workload(dt, w.role)
        heat_excess = max(0.0, wbgt - 24.0)
        penalty = 1.0 + acclimatisation_penalty(w.days_in_uae) + (0.003 * max(0, w.age - 35))

        if w.fasting and fasting_hours(dt):
            hydration_debt += 0.08 * load * (1 + heat_excess / 6)
        else:
            hydration_debt = max(0.0, hydration_debt - 0.25)
        if load >= 0.3:
            heat_storage = min(2.5, max(0.0, heat_storage + 0.06 * heat_excess * load * penalty - 0.1))
            drift = min(25.0, drift + (2.5 * load if heat_excess > 3 else 0.0))
        else:
            heat_storage *= 0.55 if wbgt < 30 else 0.75
            drift *= 0.5

        noise = _rng(w.id, hz.time)
        hr = (w.hr_rest + 48 * load + 2.4 * heat_excess * load * penalty + drift
              + 6 * hydration_debt + noise.gauss(0, 2.5))
        tc = (TC0 + 0.011 * (hr - w.hr_rest) + heat_storage
              + 0.15 * hydration_debt + noise.gauss(0, 0.05))
        rmssd = 55 * math.exp(-0.022 * (hr - w.hr_rest)) + noise.gauss(0, 2)
        rows.append({
            "time": hz.time, "projected": i > frame.now_index, "wbgt": round(wbgt, 2), "workload": load,
            "hr": round(hr, 1), "core_temp": round(tc, 2), "hrv_rmssd": round(max(rmssd, 5), 1),
            "psi": round(strain_index(hr, tc, w.hr_rest), 2),
        })
    return rows


SYMPTOM_PSI_BOOST = {"dizziness": 1.5, "confusion": 3.0, "nausea": 1.0, "headache": 0.8,
                     "cramps": 0.8, "no_water": 1.0, "chest_pain": 2.5, "breathless": 1.5,
                     "fainting": 3.5, "no_sweat": 3.0}


PROJECTION_H = 3


def current_state(frame: SiteFrame, w: Worker) -> dict:
    rows = simulate_worker_series(frame, w, hours=72, ahead=PROJECTION_H)
    series = [r for r in rows if not r["projected"]]
    forecast = [r for r in rows if r["projected"]]
    boost = sum(SYMPTOM_PSI_BOOST.get(s, 0.5) for s in w.symptoms)
    for r in forecast:
        r["psi"] = round(min(10.0, r["psi"] + boost), 2)
    last = series[-1]
    return {**last, "psi": round(min(10.0, last["psi"] + boost), 2), "symptom_boost": boost,
            "series": series, "forecast": forecast}
