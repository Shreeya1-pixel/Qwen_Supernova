"""NABD API.

    uvicorn nabd.main:app --reload --port 8040
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import service
from .automation.playbooks import AUDIT_LOG, _audit
from .connectors import eonet, gemini, geo, jira, markets, nasa_gibs, news, overpass_osm, overture_places, stac_eo, whatsapp
from .connectors.open_meteo import site_frame
from .engine import backtest, exposure, orbit_response, thresholds
from .engine.physiology import find_worker
from .intake import codeswitch
from .security import mirage
from .security.integrity import guard_for, sign
from .sites import SCENARIOS, SITES, get_site

app = FastAPI(title="NABD API", version="0.1.0",
              description="Early warning that links environmental stress to human health in extreme environments.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("NABD_CORS", "http://localhost:3000,http://127.0.0.1:3000,"
                                 "http://localhost:3848,http://127.0.0.1:3848").split(","),
    allow_methods=["*"], allow_headers=["*"],
)


def _site_or_404(site_id: str):
    try:
        return get_site(site_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/api/health")
async def health():
    return {"ok": True, "sites": list(SITES), "gemini": bool(os.environ.get("GEMINI_API_KEY"))}


@app.get("/api/scenarios")
async def scenarios():
    return {"scenarios": [s.__dict__ for s in SCENARIOS.values()]}


@app.get("/api/sites")
async def sites(replay: str | None = None):
    async def one(site_id: str):
        try:
            snap = await service.snapshot(site_id, replay=replay)
        except Exception as exc:  # one failing site must not blank the map
            return {"id": site_id, "error": str(exc)}
        return {**snap["site"], "index": snap["index"]["value"], "band": snap["index"]["band"],
                "delta_6h": snap["index"]["delta_6h"], "level": snap["council"]["label"],
                "temperature": snap["current"]["temperature_2m"], "wbgt": snap["wbgt"],
                "aqi": snap["current"]["us_aqi"], "sst": snap["current"]["sea_surface_temperature"],
                "top_driver": (snap["index"]["drivers"] or [{"label": None}])[0]["label"],
                "warning": next((w["key"] for w in snap["early_warning"] if w["status"] != "stable"), None),
                "stale": snap["stale"], "as_of": snap["as_of"]}
    replay = _valid_replay(replay)
    return {"sites": await asyncio.gather(*(one(s) for s in SITES))}


@app.get("/api/sites/{site_id}")
async def site_snapshot(site_id: str, ramadan: bool = Query(False, description="demo: simulate Ramadan fasting"),
                        refresh: bool = False,
                        replay: str | None = Query(None, description="historical local time, e.g. 2025-07-15T13:00")):
    _site_or_404(site_id)
    return await service.snapshot(site_id, ramadan_demo=ramadan, force=refresh, replay=_valid_replay(replay))


@app.get("/api/sites/{site_id}/briefing")
async def site_briefing(site_id: str, replay: str | None = None):
    _site_or_404(site_id)
    return await gemini.briefing(await service.snapshot(site_id, replay=_valid_replay(replay)))


def _valid_replay(replay: str | None) -> str | None:
    if not replay:
        return None
    try:
        at = datetime.fromisoformat(replay)
    except ValueError as exc:
        raise HTTPException(422, "replay must be ISO local time, e.g. 2025-07-15T13:00") from exc
    if at.year < 2022 or at > datetime.now():
        raise HTTPException(422, "replay must be between 2022 and now")
    return at.strftime("%Y-%m-%dT%H:00")


class IntakeIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    worker_id: str | None = None


@app.post("/api/intake")
async def intake(body: IntakeIn):
    parsed = codeswitch.parse(body.text)
    worker = find_worker(body.worker_id) if body.worker_id else None
    if body.worker_id and not worker:
        raise HTTPException(404, f"unknown worker {body.worker_id}")
    if worker:
        worker.symptoms = parsed["symptoms"]
        parsed["worker_id"] = worker.id
    return parsed


@app.post("/api/intake/clear/{worker_id}")
async def clear_symptoms(worker_id: str):
    worker = find_worker(worker_id)
    if not worker:
        raise HTTPException(404, "unknown worker")
    worker.symptoms = []
    return {"ok": True}


class FeedbackIn(BaseModel):
    worker_id: str
    verdict: str


@app.post("/api/feedback")
async def feedback(body: FeedbackIn):
    if not find_worker(body.worker_id):
        raise HTTPException(404, "unknown worker")
    try:
        b = thresholds.record_feedback(body.worker_id, body.verdict)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"alpha": b.alpha, "beta": b.beta}


@app.post("/api/telemetry")
async def telemetry(packet: dict):
    site = _site_or_404(packet.get("site_id", ""))
    frame = await site_frame(site)
    verdict = guard_for(site.id).verify(packet, service.reference_values(frame))
    return {"accepted": verdict.accepted, "failed": verdict.failed,
            "checks": [c.__dict__ for c in verdict.checks]}


@app.post("/api/sites/{site_id}/sensors/simulate")
async def simulate_sensors(site_id: str, attack: str | None = None):
    """Demo helper: push one round of signed readings from 5 field probes (optionally one spoofed)."""
    site = _site_or_404(site_id)
    ref = service.reference_values(await site_frame(site))
    guard = guard_for(site.id)
    now = time.time()
    out = []
    for i in range(1, 6):
        device = f"probe-{i}"
        prev = guard.last.get(device, {}).get("metrics")
        temp = (prev or {}).get("temperature", (ref["temperature"] or 35) + (i - 3) * 0.3)
        metrics = {"temperature": round(temp + (0.05 * ((i + int(now)) % 5 - 2)), 2),
                   "humidity": round(min(99.0, (ref["humidity"] or 40) + i * 0.2), 1),
                   "pm10": round((ref["pm10"] or 80) * (0.95 + 0.02 * i), 1)}
        if attack == "spoof" and i == 1:
            metrics["temperature"] = round((ref["temperature"] or 35) - 12, 2)
        pkt = {"device_id": device, "site_id": site.id, "ts": now, "nonce": uuid.uuid4().hex, "metrics": metrics}
        pkt = sign(pkt) if attack != "unsigned" or i != 1 else {**pkt, "sig": "0" * 64}
        v = guard.verify(pkt, ref, now=now)
        out.append({"device": device, "metrics": metrics, "accepted": v.accepted, "failed": v.failed})
    return {"readings": out, "trust": guard.trust()}


@app.post("/api/redteam/{site_id}")
async def red_team(site_id: str, seed: int = 7):
    site = _site_or_404(site_id)
    ref = service.reference_values(await site_frame(site))
    return mirage.run_red_team(site.id, ref, seed=seed)


@app.get("/api/events")
async def events():
    return {"events": await eonet.regional_events()}


@app.get("/api/geo/boundaries")
async def geo_boundaries(res: str = Query("low", pattern="^(low|high)$")):
    try:
        return await geo.boundaries(res)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise HTTPException(503, f"boundaries unavailable: {exc}") from exc


@app.get("/api/geo/imagery/{kind}")
async def geo_imagery(kind: str, res: str = Query("low", pattern="^(low|high)$"), on: str | None = None):
    if kind not in geo.LAYERS:
        raise HTTPException(404, f"layers: {', '.join(geo.LAYERS)}")
    return await geo.imagery(kind, res, on)


@app.get("/api/validation")
async def validation():
    """Lead-time backtests (generated by `python -m scripts.validate`; computed on demand if missing)."""
    saved = backtest.load_results()
    if saved:
        return {"cases": saved}
    try:
        return {"cases": await backtest.run_all()}
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise HTTPException(503, f"backtest unavailable: {exc}") from exc


# ---------------------------------------------------------------------------
# Theme 04 · First Responders from Orbit (Supernova × Spacepoint)
# ---------------------------------------------------------------------------

@app.get("/api/orbit")
async def orbit_briefing():
    """Hackathon briefing: flood-in-hours, damage triage, April 2024 case."""
    return orbit_response.briefing()


@app.get("/api/orbit/phases")
async def orbit_phases():
    return {"phases": orbit_response.phases(), "event": orbit_response.EVENT, "latency": orbit_response.LATENCY}


@app.get("/api/orbit/phases/{phase_id}")
async def orbit_phase(phase_id: str):
    try:
        return orbit_response.overview(phase_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/api/orbit/rainfall")
async def orbit_rainfall(lat: float = Query(24.80, ge=22, le=27), lon: float = Query(56.12, ge=51, le=57)):
    """Event-window precipitation near Hatta (Open-Meteo archive when reachable)."""
    return await orbit_response.rainfall_series(lat, lon)


@app.get("/api/orbit/scenes")
async def orbit_scenes():
    """Live Sentinel-1 / Sentinel-2 STAC hits over the April 2024 UAE flood AOI."""
    return await stac_eo.flood_event_scenes()


@app.get("/api/orbit/osm")
async def orbit_osm():
    """Live OSM buildings & roads in the flood corridor (Overpass)."""
    return await overpass_osm.assets("both")


@app.get("/api/orbit/nasa")
async def orbit_nasa():
    """NASA GIBS context layers for 16 April 2024 (true-colour / LST / AOD)."""
    return nasa_gibs.april_2024_context()


@app.get("/api/orbit/facilities")
async def orbit_facilities(phase_id: str = Query("t6")):
    """Overture Maps hospitals/schools/clinics triaged against the flood mask."""
    try:
        phase = orbit_response.phase_by_id(phase_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    fac = phase.get("facilities") or {}
    meta = overture_places.load()
    return {
        "phase_id": phase_id,
        "source": fac.get("source") or meta["source"],
        "scanned": fac.get("scanned", meta["count"]),
        "flooded": fac.get("flooded", 0),
        "hospitals_flooded": fac.get("hospitals_flooded", 0),
        "schools_flooded": fac.get("schools_flooded", 0),
        "clinics_flooded": fac.get("clinics_flooded", 0),
        "critical_flooded": fac.get("critical_flooded", 0),
        "facilities": fac.get("facilities") or [],
        "geojson": fac.get("geojson"),
        "note": fac.get("note") or meta["note"],
    }


@app.get("/api/geo/heat")
async def geo_heat():
    try:
        return await geo.heat_grid()
    except (httpx.HTTPError, KeyError, ValueError, IndexError) as exc:
        raise HTTPException(503, f"heat grid unavailable: {exc}") from exc


@app.get("/api/exposure/conditions")
async def exposure_conditions(lat: float = Query(..., ge=22, le=27), lng: float = Query(..., ge=51, le=57)):
    """Live conditions at a point and how many minutes per hour heavy work in the sun is safe."""
    try:
        return await exposure.conditions(lat, lng)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise HTTPException(503, f"conditions unavailable: {exc}") from exc


@app.get("/api/exposure/whatsapp")
async def whatsapp_status():
    to = whatsapp.test_recipient()
    return {"configured": whatsapp.configured(), "test_to": whatsapp.mask(to) if to else None}


class NotifyIn(BaseModel):
    name: str = Field(..., max_length=60)
    language: str = Field("en", max_length=5)
    minutes: int = Field(..., ge=0, le=1440)
    limit: int = Field(..., ge=0, le=60)
    wbgt: float
    phone: str | None = Field(None, max_length=20)
    demo: bool = False
    sun: bool = True


@app.post("/api/exposure/notify")
async def exposure_notify(body: NotifyIn):
    """Send a "too long in the sun" alert. Simulated people are dry runs; `demo` goes to WHATSAPP_TEST_TO."""
    message = exposure.sun_alert(body.language, body.minutes, body.limit, body.wbgt, body.sun)
    to = whatsapp.test_recipient() if body.demo else body.phone
    if to:
        result = await whatsapp.send_text(to, message)
    else:
        result = {"sent": False, "dry_run": True, "to": None}
    _audit({"ts": time.time(), "site": "scenario zone", "level": "RESTRICT",
            "state": "sent" if result["sent"] else "dry run", "executed": result["sent"],
            "actions": [f"sun_exposure_alert:{body.name}"], "minutes": body.minutes, "limit": body.limit,
            "wbgt": body.wbgt})
    return {"message": message, **result}


@app.get("/api/news")
async def news_feed():
    return await news.signal()


@app.get("/api/markets")
async def market_quotes():
    return await markets.quotes()


class TicketIn(BaseModel):
    site: str = Field(..., max_length=60)
    level: str = Field("RESTRICT", max_length=12)
    summary: str = Field(..., max_length=200)
    detail: list[str] = Field(default_factory=list, max_length=12)
    labels: list[str] = Field(default_factory=lambda: ["nabd"], max_length=6)


DEMO_SITE, DEMO_REPLAY = "dubai-south", "2025-07-15T13:00"
LANG_NAME = {"en": "English", "ar": "Arabic", "hi": "Hindi", "ur": "Urdu", "ml": "Malayalam", "ta": "Tamil",
             "tl": "Tagalog", "bn": "Bengali"}


def _stop_tickets(snap: dict) -> list[TicketIn]:
    """One ticket per worker the council stopped, plus the crew-wide stop, worded as audit entries."""
    site, when = snap["site"]["name"], datetime.fromisoformat(snap["as_of"])
    stamp, wbgt, idx = f"{when:%d %b %Y, %H:%M}", snap["wbgt"], snap["index"]["value"]
    level, council = snap["council"]["label"], snap["council"]["summary"]
    rule = next((a["rule"] for a in snap["playbook"]["actions"] if a["type"] == "work_rest"), "Stop heavy outdoor work")
    water = next((a["detail"].split(",")[0] for a in snap["playbook"]["actions"] if a["type"] == "hydration"), None)
    supervisor = next((w["name"] for w in snap["crew"] if w.get("role") == "supervisor"), "site supervisor")
    stopped = [w for w in snap["crew"] if w["projected_psi"] >= w["threshold"]["threshold"]]
    tickets = []
    for w in stopped:
        limit = w["threshold"]
        why = "; ".join(limit["reasons"]) or "standard limit"
        tickets.append(TicketIn(
            site=site, level=level,
            summary=f"{w['name']} ({w['role']}) stopped work at {site}: heat strain will pass his personal limit",
            detail=[f"Decision: {w['name']} stopped from heavy outdoor work at {stamp}, {site}.",
                    f"Reason: heat strain projected to reach {w['projected_psi']:.1f} in the next {w['eta_hours']} h, "
                    f"over his personal limit of {limit['threshold']:.1f} ({why}).",
                    f"Now: heat strain {w['psi']:.1f}, heart rate {w['hr']:.0f} bpm, core temperature {w['core_temp']:.1f} °C.",
                    f"Conditions: WBGT {wbgt:.1f} °C (black flag is 32 °C), NABD Index {idx:.0f}.",
                    f"Council: {council}",
                    f"Actions: moved to shade, drinking {(water or '650 ml per hour').replace(' per worker', '')}, WhatsApp check-in in "
                    f"{LANG_NAME.get(w['language'], w['language'])}, {supervisor} notified, re-check in 30 min."],
            labels=["nabd", "heat", "stop-work", "worker"]))
    tickets.append(TicketIn(
        site=site, level=level,
        summary=f"Crew stop at {site}: heavy outdoor work halted at {when:%H:%M}",
        detail=[f"Decision: {level.replace('_', ' ')} for the whole {site} crew at {stamp}.",
                f"Reason: WBGT {wbgt:.1f} °C, above the 32 °C black flag; NABD Index {idx:.0f}.",
                f"Workers stopped individually: {', '.join(w['name'] for w in stopped) or 'none'}.",
                f"Rule applied: {rule}. Midday ban 12:30–15:00 also in force (MoHRE).",
                f"Council: {council}"],
        labels=["nabd", "heat", "stop-work", "crew"]))
    return tickets


async def _ticket(t: TicketIn) -> dict:
    lines = [*t.detail, "Filed automatically by NABD. The same decision is in the hash-chained audit trail."]
    result = await jira.create_issue(t.summary, lines, t.labels)
    record = _audit({"ts": time.time(), "site": t.site, "level": t.level,
                     "state": "ticket filed" if result["sent"] else "ticket dry run" if result["dry_run"] else "ticket failed",
                     "executed": result["sent"], "actions": ["jira_ticket"],
                     "jira": {k: result.get(k) for k in ("key", "url", "summary", "dry_run", "error")}})
    return {**result, "audit_hash": record["hash"]}


@app.get("/api/jira/status")
async def jira_status():
    return await jira.status()


@app.post("/api/jira/ticket")
async def jira_ticket(body: TicketIn):
    return await _ticket(body)


@app.post("/api/jira/demo")
async def jira_demo():
    """Replay the 15 Jul 2025 13:00 peak at Dubai South and file a ticket for every worker the council stopped."""
    snap = await service.snapshot(DEMO_SITE, replay=_valid_replay(DEMO_REPLAY))
    return {"tickets": [await _ticket(t) for t in _stop_tickets(snap)]}


@app.get("/api/audit")
async def audit(limit: int = 20):
    if not AUDIT_LOG.exists():
        return {"records": []}
    lines = AUDIT_LOG.read_text().strip().splitlines()[-limit:]
    return {"records": [json.loads(line) for line in reversed(lines)]}
