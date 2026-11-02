"""Personal alert thresholds — every worker has their own line.

Starts from PSI 7 ("high strain", Moran 1998) and moves it for known risk
factors. On top sits a Beta(α, β) belief learned from supervisor feedback
(SafeO's Bayesian threshold engine, retargeted): confirmed alerts (α) pull the
line down, false alarms (β) push it up — bounded so feedback can never switch
protection off.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .calendar_uae import fasting_hours
from .physiology import Worker, acclimatisation_penalty

BASE_PSI = 7.0
MIN_PSI, MAX_PSI = 4.0, 8.0
PRIOR_ALPHA, PRIOR_BETA = 4.0, 2.0  # biased toward alerting


@dataclass
class Belief:
    alpha: float = PRIOR_ALPHA
    beta: float = PRIOR_BETA


_beliefs: dict[str, Belief] = {}


def belief(worker_id: str) -> Belief:
    return _beliefs.setdefault(worker_id, Belief())


def record_feedback(worker_id: str, verdict: str) -> Belief:
    b = belief(worker_id)
    if verdict == "confirmed":
        b.alpha += 1
    elif verdict == "false_alarm":
        b.beta += 1
    else:
        raise ValueError("verdict must be 'confirmed' or 'false_alarm'")
    return b


def personal_threshold(w: Worker, now: datetime) -> dict:
    reasons = []
    threshold = BASE_PSI

    acc = acclimatisation_penalty(w.days_in_uae)
    if acc > 0:
        shift = round(acc * 2.5, 2)
        threshold -= shift
        reasons.append(f"day {w.days_in_uae} in UAE — not acclimatised (−{shift})")
    if w.fasting and fasting_hours(now):
        threshold -= 0.8
        reasons.append("fasting during daylight (−0.8)")
    if w.age >= 50:
        threshold -= 0.5
        reasons.append(f"age {w.age} (−0.5)")

    b = belief(w.id)
    prior_mean = PRIOR_ALPHA / (PRIOR_ALPHA + PRIOR_BETA)
    learned = (prior_mean - b.alpha / (b.alpha + b.beta)) * 3.0
    if abs(learned) >= 0.05:
        threshold += learned
        reasons.append(f"learned from {int(b.alpha + b.beta - PRIOR_ALPHA - PRIOR_BETA)} supervisor verdicts "
                       f"({'+' if learned > 0 else '−'}{abs(learned):.2f})")

    threshold = max(MIN_PSI, min(MAX_PSI, threshold))
    return {"threshold": round(threshold, 2), "base": BASE_PSI, "reasons": reasons,
            "belief": {"alpha": b.alpha, "beta": b.beta}}
