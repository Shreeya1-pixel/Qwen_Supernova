# NABD Orbit نبض

## Supernova × SpacePoint Hackathon

Right now, a satellite is crossing the UAE. It sees clouds over the Hajar, ships in Hormuz, cities spreading into the sand. **Most of it goes unused.**

You get **real satellite data** and one week to build something that matters — then the top 8 teams pitch live to the judges.

**We built NABD Orbit** so that pass is not wasted when the next flood hits.

---

**THEME 04 / 04 — First Responders from Orbit · Disaster response**  
BITS Pilani Dubai · 26 Oct – 5 Nov · Hybrid · Teams of 3–5 · **Data prototype**  
*(No space background needed.)*

> Official goals:
> 1. **Map floods within hours, not days.**
> 2. **Assess damage to roads and buildings.**
> 3. **Learn from the April 2024 UAE floods.**
>
> **Data:** Sentinel-1 radar · Sentinel-2 · Copernicus DEM

**Demo:** http://127.0.0.1:3848/orbit · **Repo:** [Shreeya1-pixel/Qwen_Supernova](https://github.com/Shreeya1-pixel/Qwen_Supernova)

---

## Yes — we use NASA satellites (and Copernicus)

| Source | What we use it for |
|---|---|
| **NASA GIBS** (live WMS) | Flood water product, false-colour SWIR, night lights, aerosols, vapour, SST for **Apr 2024** → `GET /api/orbit/nasa` · shown as the satellite wall on `/orbit` |
| **Sentinel-1 radar** (Theme 04) | Live STAC catalogue over the flood AOI → `GET /api/orbit/scenes` |
| **Sentinel-2** (Theme 04) | Live STAC optical scenes (same endpoint) |
| **Copernicus DEM** (Theme 04) | Live GLO-30 DEM tiles over the AOI (same endpoint) |

Theme 04 names Copernicus sensors for flood/DEM. **NASA GIBS** is the optical/thermal context layer we actually render against. Both are live, keyless APIs.

---

## Theme 04 → what runs today

| Official goal | What is real vs labelled |
|---|---|
| **Map floods within hours, not days** | **Prototype** Sentinel-1-style water extents on Hatta + Dubai South (calibrated to reported Apr 2024 corridors). **Not** a full before/after SAR change-detection job yet. Live STAC proves real S1/S2/DEM coverage for that week. |
| **Assess damage to roads and buildings** | **Overture Maps**: **3,000+** real hospitals, schools, clinics (and related critical places) scanned against the flood mask per phase → `GET /api/orbit/facilities`. Compact demo road sample remains for map lines. |
| **Learn from April 2024** | Full case: NCM **254.8 mm**, archive rainfall, Hatta early-warning backtest **39 h** (weather engines), NASA GIBS on event day. |

### Latency numbers (read this before pitching)

**T+4 h / T+6 h / ~42 h gained are design targets**, not measured wall-clock of a processor in this repo. They describe a *radar-first* responder pipeline vs typical ~48 h optical clear. If a judge asks “what ran in 4 hours?” the honest answer is: **STAC + NASA GIBS + Overture triage run now; a timed SAR processor is the next build step** (the gap vs Kestrel’s GEE change detection).

### What we do *not* claim

- Flood-mask **IoU / accuracy** vs ground truth (weather early-warning metrics are separate).  
- Wearables / BLE mesh as Theme 04 scoring (labelled simulations / browser stand-in).  
- WhatsApp as a Theme 04 pillar.

---

## Damage triage — Overture (real places)

Pulled from **Overture Maps places** release `2026-10-21.0` (public S3 GeoParquet) for the Dubai–Sharjah–Hatta corridor, filtered to hospitals, schools, clinics, pharmacies and related critical amenities.

| Metric | Approx. |
|---|---|
| Critical places scanned | **3,000+** (from a ~4.5k raw AOI extract) |
| Triage | Point-in-flood-mask → severity critical / impacted |
| API | `GET /api/orbit/facilities?phase_id=t6` |

Refresh extract (optional, needs DuckDB + network):

```bash
cd backend && source .venv/bin/activate
pip install duckdb
python -m nabd.connectors.overture_places
```

---

## Judge demo (~4 minutes)

1. **http://127.0.0.1:3848/orbit** — open with the **NASA satellite wall** (flood / false-colour / night lights).  
2. Copernicus STAC: S1 / S2 / DEM catalogue.  
3. Scrub April 2024 phases → flood + roads.  
4. **Overture panel:** scanned / flooded hospitals & schools.  
5. Honest close: prototype water mask; design-target latency; live NASA GIBS + STAC + Overture.

---

## APIs

| Endpoint | Role |
|---|---|
| `GET /api/orbit` | Briefing, goals, KPIs, latency note |
| `GET /api/orbit/phases/{id}` | Flood GeoJSON + triage |
| `GET /api/orbit/scenes` | Live Sentinel-1 · Sentinel-2 · Copernicus DEM |
| `GET /api/orbit/nasa` | **NASA GIBS** layers for 16 Apr 2024 |
| `GET /api/orbit/facilities` | **Overture** hospitals/schools/clinics vs mask |
| `GET /api/orbit/rainfall` | Archive precip near Hatta |
| `GET /api/orbit/osm` | OSM corridor (best-effort / cached fallback) |

---

## Run locally

```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn nabd.main:app --host 127.0.0.1 --port 8040

cd frontend && npm install && npm run dev
```

Open **http://127.0.0.1:3848/orbit**

---

## Gaps we still own (vs strongest Theme 04 peers)

| Gap | Status |
|---|---|
| Full Sentinel-1 before/after processing (e.g. GEE) | **Not in-repo** — next milestone |
| Measured T+4 wall-clock | **Design target only** — labelled in API + UI |
| Flood-mask accuracy metric | **Not claimed** |
| Public hosted demo URL | Localhost for now — deploy is the cheapest next win |
| Breadth (heat / languages / mesh) | Secondary; pitch **orbit + Overture** only |

---

<sub>NASA GIBS · Copernicus Sentinel-1/2 + DEM via Element84 STAC · Overture Maps places 2026-10-21.0 · Open-Meteo · © OpenStreetMap.</sub>
