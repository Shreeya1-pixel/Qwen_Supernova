"""Mirage red team — we attack our own sensor network.

Adapted from M8's adaptive MAP → BREAK → FALSIFY loop:
  MAP      warm up a guard with honest sensor traffic
  BREAK    run an attack; if it is caught, mutate it (smaller, slower, subtler)
           and try again, up to MAX_ATTEMPTS
  FALSIFY  any attack that slips through is re-run with fresh seeds to confirm
           it is a real gap, not luck

The attacker's goal is always the same: make a hot, dusty site look safe so
nobody stops work. Results are reported honestly, including what gets through
and how NABD's safe-side fusion neutralises it.
"""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field

from .integrity import Guard, device_key, sign

MAX_ATTEMPTS = 6
FALSIFY_RUNS = 3
HONEST_DEVICES = [f"probe-{i}" for i in range(1, 6)]


@dataclass
class Attempt:
    step: int
    params: dict
    caught_by: list[str]


@dataclass
class AttackResult:
    strategy: str
    description: str
    outcome: str  # caught | neutralised | evaded
    attempts: list[Attempt] = field(default_factory=list)
    note: str = ""


def _packet(device: str, site: str, ts: float, temp: float, hum: float, pm10: float) -> dict:
    return {"device_id": device, "site_id": site, "ts": ts, "nonce": uuid.uuid4().hex,
            "metrics": {"temperature": round(temp, 2), "humidity": round(hum, 1), "pm10": round(pm10, 1)}}


def _warm_guard(site: str, ref: dict, rng: random.Random, t0: float, minutes: int = 20) -> tuple[Guard, list[dict]]:
    guard = Guard()
    captured = []
    state = {d: (ref["temperature"] + rng.uniform(-1, 1), ref["humidity"] + rng.uniform(-3, 3),
                 ref["pm10"] * rng.uniform(0.9, 1.1)) for d in HONEST_DEVICES}
    for m in range(minutes):
        for d in HONEST_DEVICES:
            t, h, p = state[d]
            t = t + rng.gauss(0, 0.08)
            h = min(99.5, max(1.0, h + rng.gauss(0, 0.5)))
            p = max(0.0, p + rng.gauss(0, 4))
            state[d] = (t, h, p)
            pkt = sign(_packet(d, site, t0 + m * 60, t, h, p))
            guard.verify(pkt, ref, now=t0 + m * 60)
            captured.append(pkt)
    return guard, captured


def _run(strategy: str, site: str, ref: dict, seed: int, scale: float) -> list[str]:
    """Run one attack instance; return the list of checks that caught it (empty = slipped through)."""
    rng = random.Random(seed)
    t0 = 1_700_000_000.0
    guard, captured = _warm_guard(site, ref, rng, t0)
    t = t0 + 20 * 60
    caught: set[str] = set()
    victim = HONEST_DEVICES[0]
    last_t = guard.last[victim]["metrics"]["temperature"]

    def send(pkt: dict, when: float) -> None:
        v = guard.verify(pkt, ref, now=when)
        caught.update(v.failed)

    if strategy == "forged_signature":
        pkt = _packet(victim, site, t, ref["temperature"] - 10 * scale, ref["humidity"], ref["pm10"] * 0.2)
        send(sign(pkt, key=b"attacker-guess"), t)
    elif strategy == "replay":
        old = captured[int(len(captured) * (1 - scale)) % len(captured)]
        send(dict(old), t)
    elif strategy == "abrupt_spoof":
        send(sign(_packet(victim, site, t, last_t - 8 * scale, ref["humidity"], ref["pm10"])), t)
    elif strategy == "slow_drift":
        temp = last_t
        for m in range(1, 41):
            temp -= 0.5 * scale
            send(sign(_packet(victim, site, t + m * 60, temp, ref["humidity"] + rng.gauss(0, 0.4),
                              ref["pm10"] + rng.gauss(0, 3))), t + m * 60)
    elif strategy == "clone_swarm":
        values = (ref["temperature"] - 7 * scale, ref["humidity"], ref["pm10"] * 0.4)
        for d in HONEST_DEVICES:
            send(sign(_packet(d, site, t, *values)), t)
    elif strategy == "flatline":
        for m in range(1, 9):
            send(sign(_packet(victim, site, t + m * 60, last_t - 0.4 * scale, ref["humidity"], ref["pm10"])),
                 t + m * 60)
    elif strategy == "reference_hugging":
        temp = last_t
        target = ref["temperature"] - 5.5 * scale
        for m in range(1, 31):
            temp = max(target, temp - 0.4)
            send(sign(_packet(victim, site, t + m * 60, temp + rng.gauss(0, 0.05),
                              ref["humidity"] + rng.gauss(0, 0.4), ref["pm10"] + rng.gauss(0, 3))), t + m * 60)
    return sorted(caught)


STRATEGIES = {
    "forged_signature": "Inject 'cool, clean air' readings without the device key",
    "replay": "Re-send an old genuine packet captured from the network",
    "abrupt_spoof": "Stolen device key: drop the temperature in one step",
    "slow_drift": "Stolen device key: cool the reading slowly to dodge rate checks",
    "clone_swarm": "Insider with 5 device keys: all report the same safe value",
    "flatline": "Freeze a sensor on a safe value",
    "reference_hugging": "Stolen key: stay just inside satellite tolerance",
}

# Attacks whose only effect is to report *lower* heat/dust than reality.
LOWERING_ATTACKS = {"abrupt_spoof", "slow_drift", "flatline", "reference_hugging"}

# Mutation schedule: each failed attempt makes the attack subtler.
SCALES = [1.0, 0.75, 0.55, 0.4, 0.3, 0.2]


def run_red_team(site: str, reference: dict, seed: int = 7) -> dict:
    ref = {"temperature": reference.get("temperature") or 40.0,
           "humidity": min(95.0, reference.get("humidity") or 40.0),
           "pm10": reference.get("pm10") or 120.0}
    results: list[AttackResult] = []
    for name, description in STRATEGIES.items():
        res = AttackResult(strategy=name, description=description, outcome="caught")
        for step, scale in enumerate(SCALES[:MAX_ATTEMPTS], start=1):
            caught = _run(name, site, ref, seed + step, scale)
            res.attempts.append(Attempt(step=step, params={"scale": scale}, caught_by=caught))
            if not caught:
                confirmed = all(not _run(name, site, ref, seed + 100 + k, scale) for k in range(FALSIFY_RUNS))
                if confirmed:
                    if name in LOWERING_ATTACKS:
                        res.outcome = "neutralised"
                        res.note = ("Slipped past detection, but only by staying within the satellite "
                                    "tolerance — and NABD scores heat and dust on max(ground, reference), "
                                    "so a lowered reading cannot lower the alert.")
                    else:
                        res.outcome = "evaded"
                        res.note = "Confirmed gap — needs a new check."
                break
        results.append(res)

    caught = sum(r.outcome == "caught" for r in results)
    neutralised = sum(r.outcome == "neutralised" for r in results)
    return {
        "site_id": site,
        "reference": ref,
        "caught": caught,
        "neutralised": neutralised,
        "evaded": len(results) - caught - neutralised,
        "total": len(results),
        "protected_rate": round((caught + neutralised) / len(results), 3),
        "results": [{
            "strategy": r.strategy, "description": r.description, "outcome": r.outcome, "note": r.note,
            "attempts": [{"step": a.step, "params": a.params, "caught_by": a.caught_by} for a in r.attempts],
        } for r in results],
    }


__all__ = ["run_red_team", "STRATEGIES", "device_key"]
