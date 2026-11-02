"""Backtest — how many hours of warning would NABD have given, using only what was known at the time?

For every hour t in a historical window we rebuild NABD's view of the world from:
  • the reference series up to t (Open-Meteo analysis: the first hours of each model run), and
  • forecasts that had already been *issued* by t, from Open-Meteo's Previous Runs API:
        hours t+1 … t+18   ← the run of the previous day   (`*_previous_day1`)
        hours t+19 … t+42  ← the run of two days before    (`*_previous_day2`)
    The 6-hour margin covers model run + publication latency, so nothing leaks from the future.

NABD alarms at t when the Nabd Index — run through that hybrid observed+forecast series —
reaches RESTRICT (≥ 65, the environment check's level 3) anywhere in the next 42 h.
The event is the first hour the *reference* crosses a fixed danger threshold:
    flood  6-hour rain ≥ 25 mm (NABD's flood hazard saturates)
    heat   estimated WBGT ≥ 32 °C (black-flag level for heavy outdoor work)
Lead time = event hour − start of the alarm run that is still active at the event.

Honest limits: the reference is model analysis, not rain gauges or a globe thermometer, and
the lead time comes from public forecasts plus the index's memory — not from the tipping-point
statistics, which are reported separately as context.
"""
from __future__ import annotations

import asyncio
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import median

import httpx

from ..connectors.open_meteo import CACHE_DIR, SiteFrame
from ..sites import get_site
from . import nabd_index
from .hazards import estimate_wbgt

PREVIOUS_RUNS_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
VARS = ["precipitation", "temperature_2m", "wet_bulb_temperature_2m", "shortwave_radiation", "wind_speed_10m"]
DAY1_UNTIL = 18
HORIZON = 42
ALARM_INDEX = 65.0
FLOOD_MM_6H = 25.0
WBGT_BLACK_FLAG = 32.0

SHIFT_ISSUE_H = 5
SHIFT = (6, 18)
BAN = (12.5, 15.0)
STOP_INDEX = 85.0

CASES = {
    "flood-2024": {"site": "hatta", "start": "2024-03-01", "end": "2024-05-31", "event": "flood",
                   "title": "Spring 2024 · Hatta (incl. the 16 April storm)"},
    "heat-aug-2025": {"site": "dubai-south", "start": "2025-08-01", "end": "2025-08-31", "event": "heat",
                      "title": "August 2025 · Dubai South"},
    "heat-sep-2025": {"site": "dubai-south", "start": "2025-09-01", "end": "2025-09-30", "event": "heat",
                      "title": "September 2025 · Dubai South (midday ban ends 15 Sep)"},
}


async def _fetch(site_id: str, start: str, end: str) -> dict:
    path = CACHE_DIR / f"backtest_{site_id}_{start}_{end}.json"
    if path.exists():
        return json.loads(path.read_text())
    site = get_site(site_id)
    hourly = VARS + [f"{v}_previous_day{d}" for v in VARS for d in (1, 2)]
    # Pad the start so the index memory and the first forecasts are warm.
    padded = (date.fromisoformat(start) - timedelta(days=4)).isoformat()
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(PREVIOUS_RUNS_URL, params={
            "latitude": site.lat, "longitude": site.lon, "timezone": "Asia/Dubai",
            "start_date": padded, "end_date": end, "hourly": ",".join(hourly)})
        r.raise_for_status()
    data = r.json()["hourly"]
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))
    return data


def _wbgt(h: dict, suffix: str, i: int) -> float | None:
    t, tw = h[f"temperature_2m{suffix}"][i], h[f"wet_bulb_temperature_2m{suffix}"][i]
    if t is None or tw is None:
        return None
    return estimate_wbgt(t, tw, h[f"shortwave_radiation{suffix}"][i] or 0.0, h[f"wind_speed_10m{suffix}"][i] or 0.0)


def _rain6(series: list, i: int) -> float:
    return sum(v for v in series[max(0, i - 5):i + 1] if v is not None)


def _index_path(h: dict, t: int) -> tuple[list[float], int]:
    """Index from t−72 to t+42: observed up to t, then only forecasts already issued by t."""
    lo = max(0, t - nabd_index.LOOKBACK_H)
    hi = min(len(h["time"]), t + HORIZON + 1)
    series: dict[str, list] = {v: [] for v in VARS}
    for i in range(lo, hi):
        suffix = "" if i <= t else "_previous_day1" if i - t <= DAY1_UNTIL else "_previous_day2"
        for v in VARS:
            series[v].append(h[f"{v}{suffix}"][i])
    frame = SiteFrame(site_id="backtest", fetched_at=0, stale=False, time=h["time"][lo:hi],
                      now_index=hi - lo - 1, series=series)
    return [p["value"] for p in nabd_index.compute(frame, lookback=hi - lo).series], t - lo


def _outlook(h: dict, t: int) -> tuple[float, float]:
    """(nowcast index at t, max forecast index over t+1…t+42)."""
    values, k = _index_path(h, t)
    return values[k], max(values[k + 1:], default=values[k])


def _forecast_index(h: dict, t: int) -> list[float]:
    values, k = _index_path(h, t)
    return values[k + 1:]


def _alarm_start(alarm: list[bool], e: int) -> int | None:
    if not alarm[e]:
        return None
    s = e
    while s > 0 and alarm[s - 1]:
        s -= 1
    return s


def _in_ban(stamp: str) -> bool:
    d = datetime.fromisoformat(stamp)
    hour = d.hour + d.minute / 60
    return (6, 15) <= (d.month, d.day) <= (9, 15) and BAN[0] <= hour < BAN[1]


def _heat_days(case: dict, h: dict, first: int) -> dict:
    """Per working day: did NABD, at 05:00, flag the 06–18 shift? Did the shift cross black flag?"""
    times = h["time"]
    ref = [_wbgt(h, "", i) for i in range(len(times))]
    days, table = [], {"hit": 0, "miss": 0, "false_alarm": 0, "quiet": 0}
    stop_table = dict(table)
    flag_hours = outside_ban = 0
    for t in range(first, len(times)):
        if not times[t].endswith(f"T{SHIFT_ISSUE_H:02d}:00"):
            continue
        lo, hi = t + SHIFT[0] - SHIFT_ISSUE_H, t + SHIFT[1] - SHIFT_ISSUE_H
        if hi >= len(times):
            break
        lo_series = _forecast_index(h, t)[SHIFT[0] - SHIFT_ISSUE_H - 1:SHIFT[1] - SHIFT_ISSUE_H]
        peak_fc = max(lo_series)
        shift_hours = [i for i in range(lo, hi + 1) if ref[i] is not None and ref[i] >= WBGT_BLACK_FLAG]
        flag_hours += len(shift_hours)
        outside_ban += sum(1 for i in shift_hours if not _in_ban(times[i]))
        event = bool(shift_hours)
        for tab, cut in ((table, ALARM_INDEX), (stop_table, STOP_INDEX)):
            alarm = peak_fc >= cut
            tab["hit" if alarm and event else "miss" if event else "false_alarm" if alarm else "quiet"] += 1
        days.append({"day": times[t][:10], "forecast_peak_index": round(peak_fc, 1),
                     "observed_peak_wbgt": round(max(r for r in ref[lo:hi + 1] if r is not None), 1),
                     "event": event, "first_flag_hour": times[shift_hours[0]][11:] if event else None,
                     "lead_h": shift_hours[0] - t if event else None})

    def scores(tab: dict) -> dict:
        pod = tab["hit"] / (tab["hit"] + tab["miss"]) if tab["hit"] + tab["miss"] else None
        far = tab["false_alarm"] / (tab["hit"] + tab["false_alarm"]) if tab["hit"] + tab["false_alarm"] else None
        return tab | {"pod": round(pod, 2) if pod is not None else None, "far": round(far, 2) if far is not None else None}

    leads = [d["lead_h"] for d in days if d["event"]]
    return {
        "mode": "daily",
        "rule": {"event": f"estimated WBGT ≥ {WBGT_BLACK_FLAG:g} °C during the 06–18 shift",
                 "alarm": f"at 05:00, forecast Nabd Index ≥ {ALARM_INDEX:g} (restrict) / ≥ {STOP_INDEX:g} (stop) during the shift"},
        "summary": {"days": len(days), "event_days": len(leads),
                    "median_lead_h": median(leads) if leads else None,
                    "restrict": scores(table), "stop": scores(stop_table),
                    "black_flag_hours": flag_hours, "outside_midday_ban": outside_ban},
        "days": days,
        "chart": [{"time": d["day"], "ref": d["observed_peak_wbgt"], "index_ahead": d["forecast_peak_index"],
                   "alarm": d["forecast_peak_index"] >= ALARM_INDEX} for d in days],
    }


async def run(case_id: str) -> dict:
    case = CASES[case_id]
    h = await _fetch(case["site"], case["start"], case["end"])
    times = h["time"]
    first = times.index(f"{case['start']}T00:00")
    head = {"id": case_id, "title": case["title"], "site": case["site"], "event_kind": case["event"],
            "source": "Open-Meteo Previous Runs API (archived forecasts) · reference = model analysis",
            "generated": datetime.now().isoformat(timespec="minutes")}
    if case["event"] == "heat":
        return head | _heat_days(case, h, first)

    ref = [_rain6(h["precipitation"], i) for i in range(len(times))]
    threshold = FLOOD_MM_6H

    now_idx, ahead = [0.0] * len(times), [0.0] * len(times)
    for t in range(first, len(times)):
        now_idx[t], ahead[t] = _outlook(h, t)
    alarm = [t >= first and max(now_idx[t], ahead[t]) >= ALARM_INDEX for t in range(len(times))]
    nowcast_alarm = [t >= first and now_idx[t] >= ALARM_INDEX for t in range(len(times))]

    # Event onsets: first hour above threshold after ≥ 12 h below it.
    events, below = [], 12
    for t in range(first, len(times)):
        if ref[t] >= threshold:
            if below >= 12:
                events.append(t)
            below = 0
        else:
            below += 1

    rows = []
    for e in events:
        s, sn = _alarm_start(alarm, e), _alarm_start(nowcast_alarm, e)
        rows.append({"event": times[e], "peak": round(max(ref[e:e + 12]), 1),
                     "alarm_from": times[s] if s is not None else None,
                     "lead_h": e - s if s is not None else None,
                     "nowcast_lead_h": e - sn if sn is not None else None})

    # Alarm runs that never met an event within 12 h of ending count as false alarms.
    runs, t = [], first
    while t < len(times):
        if alarm[t]:
            s = t
            while t < len(times) and alarm[t]:
                t += 1
            runs.append((s, t - 1))
        t += 1
    false_runs = [r for r in runs if not any(r[0] <= e <= r[1] + 12 for e in events)]

    leads = [r["lead_h"] for r in rows if r["lead_h"] is not None]
    biggest = max(events, key=lambda e: max(ref[e:e + 12]), default=first)
    window = range(max(first, biggest - 96), min(len(times), biggest + 24))
    return head | {
        "mode": "events",
        "rule": {"event": f"6-h rain ≥ {FLOOD_MM_6H:g} mm",
                 "alarm": f"Nabd Index ≥ {ALARM_INDEX:g} now or within {HORIZON} h (forecasts issued ≥ 6 h earlier)"},
        "events": rows,
        "summary": {
            "hours": len(times) - first, "events": len(events), "warned": len(leads),
            "median_lead_h": median(leads) if leads else None,
            "max_lead_h": max(leads) if leads else None,
            "nowcast_median_lead_h": median([r["nowcast_lead_h"] or 0 for r in rows] or [0]),
            "alarm_runs": len(runs), "false_alarm_runs": len(false_runs),
            "false_alarm_ratio": round(len(false_runs) / len(runs), 2) if runs else 0.0,
        },
        "chart": [{"time": times[i], "ref": round(ref[i], 2), "index_now": now_idx[i], "index_ahead": ahead[i],
                   "alarm": alarm[i]} for i in window],
    }


async def run_all() -> list[dict]:
    return list(await asyncio.gather(*(run(c) for c in CASES)))


RESULTS = Path(__file__).resolve().parents[3] / "docs" / "validation.json"


def load_results() -> list[dict] | None:
    return json.loads(RESULTS.read_text()) if RESULTS.exists() else None
