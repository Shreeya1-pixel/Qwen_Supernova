"""Verifier Council — no irreversible action without agreement.

Three independent checks — deterministic engines, not LLM agents — assess separately; a Verifier (SafeO's meta-judge pattern)
checks convergence before anything automatic happens:

  converged  (levels within 1)  → act automatically at the higher level
  diverged   (levels 2+ apart)  → human review; suggest, never auto-execute
  untrusted data                → HOLD: dispatch a manual check, never "all clear"
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

LEVELS = ["SAFE", "WATCH", "CAUTION", "RESTRICT", "STOP_WORK"]


@dataclass
class Assessment:
    agent: str
    level: int
    confidence: float
    reasons: list[str]

    @property
    def label(self) -> str:
        return LEVELS[self.level]


def environment_agent(index_value: float, warnings: list[dict], top_hazard: str | None = None,
                      news_pressure: dict | None = None) -> Assessment:
    level = 0 if index_value < 25 else 1 if index_value < 50 else 2 if index_value < 65 else 3 if index_value < 85 else 4
    reasons = [f"Nabd Index {index_value:.0f}"]
    tipping = [w for w in warnings if w["status"] == "approaching_transition"]
    if tipping:
        level = min(4, level + 1)
        reasons.append("tipping-point signal in " + ", ".join(w["key"] for w in tipping))
    confidence = 0.6 + 0.1 * sum(1 for w in warnings if w["status"] != "stable")
    # News may only raise confidence in what the sensors already show, never the level.
    news_pressure = news_pressure or {}
    corroboration = news_pressure.get(top_hazard or "", 0)
    if top_hazard == "heat":
        corroboration = max(corroboration, news_pressure.get("humidity", 0))
    if level >= 1 and corroboration >= 0.4:
        confidence += 0.1
        reasons.append(f"live news corroborates {top_hazard.replace('_', ' ')} (pressure {corroboration:.2f})")
    return Assessment("environment", level, round(min(confidence, 0.95), 2), reasons)


def physiology_agent(workers: list[dict]) -> Assessment:
    """Judges bodies now *and* over the next few forecast hours, so a crew resting
    through the midday ban is not mistaken for a crew that is safe to send back out."""
    def effective(w: dict) -> float:
        return max(w["psi"], w.get("projected_psi", w["psi"]))

    over = [w for w in workers if effective(w) >= w["threshold"]["threshold"]]
    near = [w for w in workers if w not in over and effective(w) >= w["threshold"]["threshold"] - 1.0]
    worst = max((effective(w) - w["threshold"]["threshold"] for w in workers), default=-10)
    if worst >= 2:
        level = 4
    elif over:
        level = 3 if len(over) > 1 or worst >= 1 else 2
    elif near:
        level = 1
    else:
        level = 0
    now_over = [w for w in over if w["psi"] >= w["threshold"]["threshold"]]
    soon = [w for w in over if w not in now_over]
    reasons = [f"{len(now_over)} worker(s) over their personal line now",
               f"{len(soon)} projected to cross within 3 h", f"{len(near)} within 1 point"]
    for w in soon[:3]:
        reasons.append(f"{w['name']} crosses in ~{w['eta_hours']} h (projected PSI {w['projected_psi']})")
    for w in now_over[:3]:
        reasons.append(f"{w['name']} PSI {w['psi']} ≥ line {w['threshold']['threshold']}")
    return Assessment("physiology", level, 0.75, reasons)


def integrity_agent(trust: dict) -> Assessment:
    level = 0 if trust["trusted"] else 2
    return Assessment("integrity", level, trust.get("score", 1.0), trust.get("reasons", []))


def verify(env: Assessment, body: Assessment, integrity: Assessment, trusted: bool) -> dict:
    gap = abs(env.level - body.level)
    top = max(env.level, body.level)
    if not trusted:
        decision = {"state": "hold", "level": max(top, 2), "auto_execute": False,
                    "summary": "Sensor data failed integrity checks — holding at caution and "
                               "dispatching a manual check. NABD never issues an all-clear on untrusted data."}
    elif gap <= 1:
        decision = {"state": "converged", "level": top, "auto_execute": top >= 2,
                    "summary": f"Environment and body agree → {LEVELS[top]}."}
    else:
        decision = {"state": "diverged", "level": top, "auto_execute": False,
                    "summary": f"Environment says {env.label}, bodies say {body.label} — "
                               "sent to a human supervisor before any action."}
    decision["label"] = LEVELS[decision["level"]]
    decision["agents"] = [asdict(a) | {"label": a.label} for a in (env, body, integrity)]
    return decision
