"""Mirage Guard — is this sensor reading real?

A heat-warning system is a safety target: a faked "all clear" keeps people
working in lethal conditions. Every field reading passes these checks:

  signature   HMAC-SHA256 with a per-device key derived from the site master key
  freshness   timestamp within the allowed clock skew
  replay      each nonce accepted once
  range       values physically possible
  rate        outdoor air cannot change faster than physics allows
  reference   ground sensor must roughly agree with the satellite/model reference
  flatline    a live sensor is never perfectly constant
  swarm       identical readings from many device IDs = cloned sensors
              (SafeO's Sybil detector, retargeted from users to devices)

Checks are deterministic string/number rules — no model can be talked out of them.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any

MASTER_KEY = os.environ.get("NABD_MASTER_KEY", "nabd-dev-master-key-change-me").encode()

MAX_SKEW_S = 300
RANGES = {"temperature": (-10.0, 60.0), "humidity": (0.0, 100.0), "pm10": (0.0, 6000.0)}
MAX_RATE_PER_MIN = {"temperature": 0.6, "humidity": 4.0, "pm10": 150.0}
REFERENCE_TOLERANCE = {"temperature": 6.0, "humidity": 30.0}
FLATLINE_RUN = 6
SWARM_WINDOW_S = 120
SWARM_DEVICES = 3


def device_key(device_id: str) -> bytes:
    return hmac.new(MASTER_KEY, device_id.encode(), hashlib.sha256).digest()


def canonical(packet: dict[str, Any]) -> bytes:
    body = {k: packet[k] for k in ("device_id", "site_id", "ts", "nonce", "metrics")}
    return json.dumps(body, sort_keys=True, separators=(",", ":")).encode()


def sign(packet: dict[str, Any], key: bytes | None = None) -> dict[str, Any]:
    key = key or device_key(packet["device_id"])
    return {**packet, "sig": hmac.new(key, canonical(packet), hashlib.sha256).hexdigest()}


@dataclass
class Check:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class Verdict:
    accepted: bool
    checks: list[Check]

    @property
    def failed(self) -> list[str]:
        return [c.name for c in self.checks if not c.passed]


@dataclass
class Guard:
    """Stateful verifier for one site's telemetry stream."""
    seen_nonces: set[str] = field(default_factory=set)
    last: dict[str, dict] = field(default_factory=dict)
    history: dict[str, deque] = field(default_factory=lambda: defaultdict(lambda: deque(maxlen=FLATLINE_RUN)))
    recent: deque = field(default_factory=lambda: deque(maxlen=2000))
    verdicts: deque = field(default_factory=lambda: deque(maxlen=200))

    def verify(self, packet: dict[str, Any], reference: dict[str, float] | None = None,
               now: float | None = None) -> Verdict:
        now = time.time() if now is None else now
        checks: list[Check] = []
        metrics = packet.get("metrics") or {}
        device = packet.get("device_id", "")

        expected = hmac.new(device_key(device), canonical(packet), hashlib.sha256).hexdigest() \
            if all(k in packet for k in ("device_id", "site_id", "ts", "nonce", "metrics")) else ""
        checks.append(Check("signature", bool(expected) and hmac.compare_digest(expected, packet.get("sig", "")),
                            "HMAC-SHA256 per-device key"))

        skew = abs(now - float(packet.get("ts", 0)))
        checks.append(Check("freshness", skew <= MAX_SKEW_S, f"clock skew {skew:.0f}s"))

        nonce = str(packet.get("nonce", ""))
        checks.append(Check("replay", bool(nonce) and nonce not in self.seen_nonces, "nonce reuse"))

        bad_range = [k for k, (lo, hi) in RANGES.items() if k in metrics and not lo <= metrics[k] <= hi]
        checks.append(Check("range", not bad_range, ", ".join(bad_range) or "all values physical"))

        prev = self.last.get(device)
        too_fast = []
        if prev:
            # Floor at one minute: sub-minute sensor jitter is noise, not physics.
            minutes = max((float(packet["ts"]) - prev["ts"]) / 60.0, 1.0)
            for k, limit in MAX_RATE_PER_MIN.items():
                if k in metrics and k in prev["metrics"]:
                    rate = abs(metrics[k] - prev["metrics"][k]) / minutes
                    if rate > limit:
                        too_fast.append(f"{k} {rate:.1f}/min > {limit}")
        checks.append(Check("rate", not too_fast, "; ".join(too_fast) or "within physical rate"))

        disagree = []
        if reference:
            for k, tol in REFERENCE_TOLERANCE.items():
                if k in metrics and reference.get(k) is not None and abs(metrics[k] - reference[k]) > tol:
                    disagree.append(f"{k} {metrics[k]:.1f} vs reference {reference[k]:.1f}")
            if "pm10" in metrics and (reference.get("pm10") or 0) > 150 and metrics["pm10"] < reference["pm10"] * 0.3:
                disagree.append(f"pm10 {metrics['pm10']:.0f} clean while reference shows dust {reference['pm10']:.0f}")
        checks.append(Check("reference", not disagree, "; ".join(disagree) or "agrees with satellite/model"))

        hist = self.history[device]
        fingerprint_values = tuple(round(float(metrics[k]), 2) for k in sorted(metrics))
        flat = len(hist) >= FLATLINE_RUN - 1 and all(h == fingerprint_values for h in hist)
        checks.append(Check("flatline", not flat, f"{FLATLINE_RUN} identical readings" if flat else "live variation"))

        fp = hashlib.sha256(repr(fingerprint_values).encode()).hexdigest()[:16]
        ts = float(packet.get("ts", now))
        devices = {d for (t, f, d) in self.recent if f == fp and ts - t <= SWARM_WINDOW_S}
        devices.add(device)
        checks.append(Check("swarm", len(devices) < SWARM_DEVICES,
                            f"{len(devices)} devices sent identical readings" if len(devices) >= SWARM_DEVICES
                            else "unique fingerprint"))

        verdict = Verdict(accepted=all(c.passed for c in checks), checks=checks)
        if checks[0].passed:
            self.seen_nonces.add(nonce)
            self.recent.append((ts, fp, device))
            hist.append(fingerprint_values)
            if verdict.accepted:
                self.last[device] = {"ts": ts, "metrics": dict(metrics)}
        self.verdicts.append(verdict)
        return verdict

    def ground(self, max_age_s: float = 900, now: float | None = None) -> dict[str, float]:
        """Mean of the latest accepted reading per device (fresh devices only)."""
        now = time.time() if now is None else now
        fresh = [r["metrics"] for r in self.last.values() if now - r["ts"] <= max_age_s]
        keys = {k for m in fresh for k in m}
        return {k: sum(m[k] for m in fresh if k in m) / sum(1 for m in fresh if k in m) for k in keys}

    def trust(self) -> dict:
        if not self.verdicts:
            return {"trusted": True, "score": 1.0, "reasons": ["no field sensors connected — using satellite/model data"]}
        recent = list(self.verdicts)[-50:]
        accepted = sum(v.accepted for v in recent)
        score = accepted / len(recent)
        last10 = recent[-10:]
        critical = [n for v in last10 for n in v.failed if n in ("signature", "swarm", "reference", "replay")]
        trusted = score >= 0.8 and not critical
        reasons = [f"{accepted}/{len(recent)} recent readings accepted"]
        if critical:
            reasons.append("recent failures: " + ", ".join(sorted(set(critical))))
        return {"trusted": trusted, "score": round(score, 2), "reasons": reasons}


_guards: dict[str, Guard] = {}


def guard_for(site_id: str) -> Guard:
    return _guards.setdefault(site_id, Guard())
