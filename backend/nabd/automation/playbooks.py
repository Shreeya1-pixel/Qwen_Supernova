"""Automated playbooks — what happens after the council decides.

Every action is generated from rules a safety officer can read, and every run
writes an audit record. Integrations (WhatsApp, Jira) are dry-run unless the
matching environment variables are set, so the demo never spams anyone.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime
from pathlib import Path

from ..engine.calendar_uae import is_ramadan, midday_ban_active, midday_ban_season
from ..engine.council import LEVELS

AUDIT_LOG = Path(__file__).resolve().parents[2] / ".cache" / "audit.jsonl"

# Work/rest per hour by WBGT for heavy work (after ACGIH TLV guidance, acclimatised).
WORK_REST = [
    (28.0, "Normal work · water every 20 min", 60),
    (29.5, "45 min work / 15 min rest in shade", 45),
    (31.0, "30 min work / 30 min rest in shade", 30),
    (32.5, "15 min work / 45 min rest in shade", 15),
    (99.0, "Stop heavy outdoor work", 0),
]


def work_rest(wbgt: float, acclimatised: bool = True) -> dict:
    effective = wbgt + (0.0 if acclimatised else 1.5)
    for limit, label, minutes in WORK_REST:
        if effective < limit:
            return {"wbgt": round(wbgt, 1), "effective_wbgt": round(effective, 1),
                    "rule": label, "work_minutes_per_hour": minutes}
    return {"wbgt": round(wbgt, 1), "rule": WORK_REST[-1][1], "work_minutes_per_hour": 0}


def hydration_ml_per_hour(wbgt: float, workload: float) -> int:
    base = 250 + max(0.0, wbgt - 24) * 60 * workload
    return int(min(1000, round(base / 50) * 50))


def _audit(record: dict) -> dict:
    AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
    prev = ""
    if AUDIT_LOG.exists():
        lines = AUDIT_LOG.read_text().strip().splitlines()
        prev = json.loads(lines[-1])["hash"] if lines else ""
    record = {**record, "prev_hash": prev}
    record["hash"] = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
    with AUDIT_LOG.open("a") as fh:
        fh.write(json.dumps(record) + "\n")
    return record


def plan(site: dict, decision: dict, wbgt: float | None, workers: list[dict], now: datetime) -> dict:
    level = decision["level"]
    wbgt = wbgt if wbgt is not None else 26.0
    actions: list[dict] = []

    ban_now = midday_ban_active(now)
    if wbgt >= 30.0 and not midday_ban_season(now.date()):
        actions.append({"type": "beyond_calendar",
                        "title": "Heat rule outside the ban season",
                        "detail": f"WBGT {wbgt:.1f}°C on {now:%d %b} — outside the 15 Jun–15 Sep midday ban, "
                                  "NABD applies the same protection because the body, not the calendar, decides."})
    if ban_now:
        actions.append({"type": "midday_ban", "title": "Midday ban in force",
                        "detail": "12:30–15:00 outdoor work stop (MoHRE). Logged for compliance."})

    if level >= 2:
        acclimatised = all(w["days_in_uae"] >= 14 for w in workers)
        actions.append({"type": "work_rest", "title": "Work–rest cycle", **work_rest(wbgt, acclimatised)})
        actions.append({"type": "hydration", "title": "Hydration plan",
                        "detail": f"{hydration_ml_per_hour(wbgt, 0.7)} ml per hour per worker, cool water, "
                                  "electrolytes after 2 h."})
    if level >= 3:
        actions.append({"type": "reschedule", "title": "Shift heavy tasks",
                        "detail": "Move concrete pours, lifting and roofing to before 10:00 or after 17:00."})
    if is_ramadan(now.date()) and any(w.get("fasting") for w in workers):
        actions.append({"type": "ramadan", "title": "Ramadan schedule",
                        "detail": "Fasting crew: light duties until Maghrib, heavy work after iftar."})

    alerts = []
    for w in workers:
        over = w["psi"] >= w["threshold"]["threshold"]
        if over or w.get("symptoms"):
            alerts.append({"worker": w["name"], "language": w["language"], "psi": w["psi"],
                           "threshold": w["threshold"]["threshold"],
                           "channel": "whatsapp", "dry_run": not os.environ.get("WHATSAPP_TOKEN")})
    if alerts:
        actions.append({"type": "escalation", "title": "Escalation chain",
                        "detail": "1) worker check-in in own language → 2) supervisor in 3 min if no reply → "
                                  "3) site medic + nearest clinic location in 6 min."})
    if level >= 3:
        actions.append({"type": "ticket", "title": "Jira incident",
                        "detail": f"[{LEVELS[level]}] {site['name']} — {decision['summary']}",
                        "dry_run": not os.environ.get("JIRA_API_TOKEN")})

    executed = decision.get("auto_execute", False)
    record = _audit({"ts": time.time(), "site": site["id"], "level": LEVELS[level], "state": decision["state"],
                     "executed": executed, "actions": [a["type"] for a in actions], "alerts": len(alerts)})
    return {"executed": executed,
            "mode": "automatic" if executed else "awaiting human approval" if level >= 2 else "monitoring",
            "actions": actions, "alerts": alerts, "audit": {"hash": record["hash"], "prev_hash": record["prev_hash"]}}
