# NABD Orbit · Supernova × Spacepoint

**Hackathon:** Supernova × Spacepoint · 26 Oct – 5 Nov · BITS Pilani Dubai · Hybrid  
**Team size:** 3–5 · **Build:** data prototype  
**Theme chosen:** **01? No — Theme 04: First Responders from Orbit (Disaster response)**

---

## One-line pitch

**NABD Orbit maps flood water from space in ~4 hours, scores which roads and buildings are cut by ~6 hours, and uses the April 2024 UAE floods as the worked example — so first responders act in hours, not days.**

---

## Theme 04 checklist

| Brief requirement | What we ship |
|---|---|
| Map floods within hours, not days | Timeline phases T+0 → T+24 with a prototype Sentinel-1 style water mask ready by **T+4 h** |
| Assess damage to roads and buildings | Each phase scores buildings (safe / impacted / critical) and roads (clear / partial / impassable) |
| Learn from the April 2024 UAE floods | Full replay around Hatta + Dubai South; NCM peak **254.8 mm**; archive rainfall series |
| Space / EO data story | Meteosat/NCM totals, Open-Meteo archive precip, NASA GIBS context, SAR-style change extents, GPM-class framing |

---

## Demo path (judges · ~4 minutes)

1. Open the app → sidebar **Orbit response** (`/orbit`).
2. Show the four latency KPIs: flood mask **T+4**, damage triage **T+6**, optical clear **T+48**, **~42 h gained**.
3. Scrub the storm timeline: T+0 watch → T+4 mask → T+6 triage → T+12 peak → T+24 standing water.
4. On the map: blue water, red impassable roads / critical buildings, green clear assets.
5. Rainfall panel: Hatta archive series + note that event-max was at Khatm Al Shakla (NCM).
6. Close on honesty: prototype SAR extents + triage assets, not a silent fake “live Sentinel pipeline”.

Also available from the original NABD product: replay `flood-2024` on Hatta (early-warning 39 h before threshold) and Scenario mode for population in a drawn zone.

---

## Run locally

```bash
# Backend :8040
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn nabd.main:app --host 127.0.0.1 --port 8040

# Frontend :3848 (or whatever package.json uses)
cd ../frontend && npm install && npm run dev
```

**Orbit API**

| Endpoint | Purpose |
|---|---|
| `GET /api/orbit` | Theme briefing + KPIs + phase summaries |
| `GET /api/orbit/phases` | All phases with GeoJSON |
| `GET /api/orbit/phases/{t0\|t4\|t6\|t12\|t24}` | One phase + map layers |
| `GET /api/orbit/rainfall` | April 2024 precip near Hatta |

---

## Honest limits (say this if asked)

- Flood polygons are **prototype SAR-style extents** calibrated to reported April 2024 inundation corridors — not an automated ASF/GEE Sentinel-1 job in this repo.
- Building/road layers are **triage demo assets** aligned to those corridors so responders can rehearse dispatch.
- Rainfall prefers **Open-Meteo archive**; if offline, a labelled schematic fallback is used.
- The wider NABD stack (heat, multilingual alerts, off-grid relay) remains available and is the productisation path after the flood mask.

---

## Why Theme 04 (not 01 / 02 / 03)

NABD already owned the April 2024 flood narrative, early warning, and scenario population tools. Theme 04 is the shortest path from that work to a space-data **first-responder** prototype. Theme 01 (cloud seeding / aquifers / fog) and Theme 03 (dark ships / oil spills) would be net-new domains.
