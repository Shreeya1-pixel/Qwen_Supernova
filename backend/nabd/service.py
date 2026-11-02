"""Builds one site snapshot by running every engine over the live frame."""
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from zoneinfo import ZoneInfo

from .automation import playbooks
from .connectors import news
from .connectors.open_meteo import SiteFrame, site_frame
from .engine import council, early_warning, exposure_graph, nabd_index
from .engine.calendar_uae import is_ramadan
from .engine.hazards import current_hazards, dust_from_pm10, heat_from_wbgt
from .engine.physiology import crew, current_state
from .engine.thresholds import personal_threshold
from .security.integrity import guard_for
from .sites import Site, get_site

DUBAI = ZoneInfo("Asia/Dubai")

WARNING_SERIES = {
    "wet_bulb_temperature_2m": "wet-bulb temperature",
    "pm10": "dust (PM10)",
    "us_aqi": "air quality index",
    "sea_surface_temperature": "sea-surface temperature",
}


HISTORY_H = 21 * 24
_ew_cache: dict[tuple, list[dict]] = {}


def early_warnings(frame: SiteFrame) -> list[dict]:
    """Tipping-point statistics per series, cached per fetched frame (the surrogate test is not free)."""
    key = (frame.site_id, frame.fetched_at, frame.now_index)
    if key in _ew_cache:
        return _ew_cache[key]
    end = frame.now_index + 1
    out = []
    for series_key, label in WARNING_SERIES.items():
        raw = (frame.series.get(series_key) or [])[max(0, end - HISTORY_H):end]
        if sum(v is not None for v in raw) >= 7 * 24:
            out.append(asdict(early_warning.analyse(label, raw)) | {"series_key": series_key})
    if len(_ew_cache) > 64:
        _ew_cache.clear()
    _ew_cache[key] = out
    return out


def now_dubai() -> datetime:
    return datetime.now(DUBAI).replace(tzinfo=None)


def reference_values(frame: SiteFrame) -> dict:
    return {"temperature": frame.current("temperature_2m"),
            "humidity": frame.current("relative_humidity_2m"),
            "pm10": frame.current("pm10")}


def fused_hazards(frame: SiteFrame, site: Site) -> tuple[dict, float | None, dict]:
    """Current hazards, with trusted ground sensors allowed to raise — never lower — them."""
    hz = current_hazards(frame)
    values, wbgt = dict(hz.values), hz.wbgt
    ref = reference_values(frame)
    ground = guard_for(site.id).ground()
    fusion = {"reference": ref, "ground": ground, "applied": []}
    if ground.get("temperature") and ref["temperature"] and ground["temperature"] > ref["temperature"] and wbgt:
        wbgt += 0.3 * (ground["temperature"] - ref["temperature"])
        values["heat"] = heat_from_wbgt(wbgt)
        fusion["applied"].append("temperature")
    if ground.get("pm10") and ref["pm10"] is not None and ground["pm10"] > ref["pm10"]:
        values["dust"] = dust_from_pm10(ground["pm10"])
        fusion["applied"].append("pm10")
    return values, wbgt, fusion


def crew_states(frame: SiteFrame, site: Site, now: datetime, ramadan_demo: bool) -> list[dict]:
    fasting_season = ramadan_demo or is_ramadan(now.date())
    rows = []
    for w in crew(site.id):
        w.fasting = fasting_season and w.language in {"ur", "ar", "bn", "ml"} and w.role != "site nurse"
        state = current_state(frame, w)
        threshold = personal_threshold(w, now)
        line = threshold["threshold"]
        projected = max((r["psi"] for r in state["forecast"]), default=state["psi"])
        eta = 0 if state["psi"] >= line else next(
            (k for k, r in enumerate(state["forecast"], start=1) if r["psi"] >= line), None)
        rows.append({
            "id": w.id, "name": w.name, "role": w.role, "language": w.language,
            "days_in_uae": w.days_in_uae, "age": w.age, "fasting": w.fasting, "symptoms": list(w.symptoms),
            "psi": state["psi"], "hr": state["hr"], "core_temp": state["core_temp"],
            "hrv_rmssd": state["hrv_rmssd"], "symptom_boost": state["symptom_boost"],
            "threshold": threshold, "projected_psi": projected, "eta_hours": eta,
            "hr_series": [{"time": r["time"], "hr": r["hr"], "psi": r["psi"], "hrv": r["hrv_rmssd"],
                           "projected": r["projected"]}
                          for r in state["series"][-48:] + state["forecast"]],
            "_hrv_full": [r["hrv_rmssd"] for r in state["series"]],
        })
    return rows


async def snapshot(site_id: str, ramadan_demo: bool = False, force: bool = False,
                   replay: str | None = None) -> dict:
    site = get_site(site_id)
    frame = await site_frame(site, force=force, replay=replay)
    now = datetime.fromisoformat(frame.time[frame.now_index]) if replay else now_dubai()

    index = nabd_index.compute(frame)
    warnings = early_warnings(frame)

    hazards, wbgt, fusion = fused_hazards(frame, site)
    prop = exposure_graph.propagate(hazards, site.cohorts)

    workers = crew_states(frame, site, now, ramadan_demo)
    body_warnings = []
    for w in workers:
        if w["psi"] >= w["threshold"]["threshold"] - 1.5:
            ew = early_warning.analyse(f"{w['name']} HRV", [-v for v in w["_hrv_full"]], window=24)
            body_warnings.append({"worker": w["name"], "status": ew.status, "explanation": ew.explanation,
                                  "experimental": True})
    for w in workers:
        w.pop("_hrv_full")

    trust = guard_for(site.id).trust()
    news_signal = None if replay else await news.signal()
    top_hazard = index.drivers[0]["hazard"] if index.drivers else None
    env = council.environment_agent(index.value, warnings, top_hazard,
                                    news_signal["pressure"] if news_signal else None)
    body = council.physiology_agent(workers)
    integ = council.integrity_agent(trust)
    decision = council.verify(env, body, integ, trust["trusted"])

    site_dict = {"id": site.id, "name": site.name, "name_ar": site.name_ar, "kind": site.kind,
                 "lat": site.lat, "lon": site.lon, "story": site.story, "cohorts": list(site.cohorts)}
    playbook = playbooks.plan(site_dict, decision, wbgt, workers, now)

    current = {k: frame.current(k) for k in (
        "temperature_2m", "relative_humidity_2m", "apparent_temperature", "wet_bulb_temperature_2m",
        "wind_speed_10m", "uv_index", "pm10", "pm2_5", "dust", "us_aqi", "sea_surface_temperature",
        "precipitation", "soil_moisture_0_to_1cm")}
    start = max(0, frame.now_index - 71)
    raw = {k: frame.series.get(k, [])[start:frame.now_index + 1] for k in WARNING_SERIES}

    return {
        "site": site_dict,
        "as_of": frame.time[frame.now_index] if frame.time else None,
        "local_time": now.isoformat(timespec="minutes"),
        "replay": replay,
        "stale": frame.stale,
        "sources": frame.sources,
        "current": current,
        "wbgt": round(wbgt, 2) if wbgt is not None else None,
        "hazards": {k: round(v, 3) for k, v in hazards.items()},
        "fusion": fusion,
        "index": asdict(index),
        "early_warning": warnings,
        "body_warning": body_warnings,
        "exposure": {
            "cohorts": exposure_graph.explain(prop, "cohort"),
            "outcomes": exposure_graph.explain(prop, "outcome"),
            "graph": exposure_graph.graph_payload(prop),
        },
        "crew": workers,
        "trust": trust,
        "council": decision,
        "news": {"pressure": news_signal["pressure"], "articles": news_signal["articles"][:6]} if news_signal else None,
        "playbook": playbook,
        "raw": {"time": frame.time[start:frame.now_index + 1], "series": raw},
    }
