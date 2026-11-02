# NABD Orbit نبض

**Supernova × SpacePoint · Theme 04 — First Responders from Orbit**

NABD maps April 2024 UAE floods from orbit in hours: Sentinel-1 flood mask, NASA GIBS context, and Overture triage of roads and critical places.  
Live stack is Sentinel-1 / Sentinel-2 / Copernicus DEM (STAC) + NASA GIBS + Overture — FastAPI + Next.js on one Render image.  
Honest limits: unvalidated offline S1 mask; **T+4 / T+6** are design targets only.

**Live demo:** [https://qwen-supernova-2.onrender.com/orbit](https://qwen-supernova-2.onrender.com/orbit)  
<sub>Free-tier Render may cold-start ~30–60s. If Overview looks empty on first hit, wait and refresh — `/api/health` and `/orbit` are the judge path.</sub>

<p align="center"><img src="docs/img/overview.jpg" width="720" alt="NABD operations overview"></p>

---

## Why this is Theme 04 (technically)

| Theme ask | What NABD ships |
|---|---|
| **Map floods in hours** | Precomputed **Sentinel-1 RTC** before/after change mask (VV **−3 dB** change · **−15 dB** dark). Scene IDs stored + pytest-checked. Live **STAC** lists the S1/S2/DEM catalogue. |
| **Damage to roads & buildings** | Flood GeoJSON scored against roads/buildings + **3,000+** real Overture hospitals/schools/clinics. |
| **Learn from April 2024** | Event briefing, archive rainfall, NASA GIBS week gallery, Hatta early-warning backtest (**39 h** lead on archived forecasts). |
| **Theme data** | Sentinel-1 · Sentinel-2 · Copernicus DEM (Element84 STAC) + NASA GIBS WMS (keyless). |

**Stack:** FastAPI + Next.js · one Docker image on Render · pytest suite on the critical engines.

**Honest limits (judges will ask):** weaknesses are an **unvalidated** flood mask (offline-precomputed from real S1 RTC pairs — not a live timed SAR processor, not field-checked) and **T+4 / T+6** vs ~**T+48** optical figures that are only **design targets**, not wall-clock of this repo.

---

## Judge path (2 minutes on the live site)

1. **[https://qwen-supernova-2.onrender.com/orbit](https://qwen-supernova-2.onrender.com/orbit)** — NASA wall · S1 flood timeline · Overture triage  
2. Click phases **T+0 → T+6 → T+12** — mask + KPIs expand  
3. **[/alerts](https://qwen-supernova-2.onrender.com/alerts)** — 21-byte off-grid frame  
4. **[/messages](https://qwen-supernova-2.onrender.com/messages)** — multilingual / codeswitch intake  
5. Smoke APIs:

```bash
curl -s https://qwen-supernova-2.onrender.com/api/health
curl -s https://qwen-supernova-2.onrender.com/api/orbit/nasa | head -c 180
curl -s https://qwen-supernova-2.onrender.com/api/orbit/scenes | head -c 180
curl -s "https://qwen-supernova-2.onrender.com/api/orbit/facilities?phase_id=t6" | head -c 180
```

---

## Architecture (what actually runs)

```
Browser (Next.js)
    │  /api/*
    ▼
FastAPI (nabd)
    ├── /api/orbit/*     Theme 04 — GIBS, STAC, S1 mask GeoJSON, Overture triage
    ├── /api/sites/*     Live Open-Meteo fusion → hazards → exposure graph → council
    ├── intake / alerts  Codeswitch + 21-byte signed BLE-sized frames
    └── audit            Hash-chained decision log
```

| Layer | Implementation |
|---|---|
| **EO catalogue** | Element84 Earth Search STAC — Sentinel-1 GRD, Sentinel-2, Copernicus GLO-30 DEM |
| **NASA context** | GIBS WMS GetMap (reflectance gallery for 14–17 Apr 2024) |
| **Flood mask** | Offline S1 RTC VV change detection → `backend/nabd/data/s1_flood_mask_apr2024.geojson` + provenance JSON |
| **Critical places** | Overture Maps places extract (hospitals / schools / clinics) |
| **Weather** | Open-Meteo forecast + air + marine; disk/memory cache; synthetic fallback on HTTP 429 |
| **Trust** | Signed packets, Mirage red-team, council never auto-clears untrusted data |

<p align="center"><img src="docs/img/architecture_slide.png" width="640" alt="Architecture"></p>

---

## The problem

**April 2024:** record UAE rain (**254.8 mm** in &lt;24 h). Warnings existed; responders still needed **where the water was** and **which assets were cut** — in hours, not after optical clear (~2 days).

<p align="center"><img src="docs/img/validation-flood.png" width="640" alt="Hatta April 2024 flood early-warning backtest"></p>
<sub>Hatta backtest: archived forecasts only — **39 h** lead before the flood threshold (observations alone ≈ 3 h). Engine is tested for **no look-ahead**.</sub>

---

## From orbit — evidence on the page

| NASA / EO | Prototype (live Render) |
|:---:|:---:|
| <img src="docs/img/nasa-false721.jpg" width="360" alt="MODIS false colour"> | <img src="docs/img/readme/proto-orbit-live.jpg" width="360" alt="Orbit response with NASA GIBS wall"> |
| False-colour GIBS (live WMS) | `/orbit` — NASA wall + KPIs (Engines online) |

Also: live STAC scenes → `GET /api/orbit/scenes`. Mask provenance → scene IDs in GeoJSON properties + `pytest` (`test_flood_mask_comes_from_stored_scene_ids`).

---

## Technical strengths beyond Theme 04

These are the same product judges can open from the sidebar — not slideware.

| Pillar | What’s real |
|---|---|
| **Multilingual** | 8 languages for alerts · EN/AR UI + RTL · on-device codeswitch intake (no LLM required to parse) |
| **Offline last mile** | 21-byte signed alert frame (BLE-advert sized) · verify · dedupe · per-phone language |
| **Safety engines** | Deterministic council (land × body × integrity) · exposure graph · personal strain · audit hash chain |
| **Resilience** | Weather cache + synthetic fallback so Render free-tier 429s don’t blank Overview |

<p align="center"><img src="docs/img/messages.jpg" width="420" alt="Messages"> <img src="docs/img/alerts.jpg" width="420" alt="Alerts"></p>

---

## Local run (~5 minutes)

**Needs:** Python 3.11+, Node 20+.

```bash
git clone https://github.com/Shreeya1-pixel/Qwen_Supernova.git
cd Qwen_Supernova

# Terminal 1 — API
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn nabd.main:app --host 127.0.0.1 --port 8040

# Terminal 2 — UI
cd frontend && npm install && npm run dev
```

| URL | Role |
|---|---|
| http://127.0.0.1:3848/orbit | Theme 04 primary page |
| http://127.0.0.1:8040/api/health | API health |
| http://127.0.0.1:3848/alerts | Off-grid relay |
| http://127.0.0.1:3848/messages | Multilingual intake |

```bash
cd backend && source .venv/bin/activate && pytest -q
```

---

## Tests (technically checkable)

**20 passed** in CI-local suite, including:

| Area | Coverage |
|---|---|
| **Orbit / Theme 04** | Phases expand · triage KPIs · briefing · **flood mask ↔ stored S1 scene IDs** |
| **Early warning** | Critical slowing-down · stable ≠ tipping · daily cycle rejected |
| **Backtest** | **No look-ahead** into the future |
| **Exposure** | Heat → new arrivals · sea warming → water path · WBGT sanity |
| **Trust** | Accepts honest packets · rejects forgery / replay / clone swarm |
| **Council** | Never auto-clears untrusted data · divergence → human |
| **Multilingual** | Codeswitch intake · bilingual sun alert states the limit |

---

## Theme 04 APIs

| Endpoint | Role |
|---|---|
| `GET /api/orbit` | Briefing + KPIs |
| `GET /api/orbit/nasa` | NASA GIBS gallery |
| `GET /api/orbit/scenes` | Sentinel-1 · Sentinel-2 · Copernicus DEM |
| `GET /api/orbit/facilities?phase_id=t6` | Overture places vs flood mask |
| `GET /api/orbit/phases/{t0\|t4\|t6\|t12\|t24}` | Flood + damage GeoJSON |
| `GET /api/orbit/rainfall` | April 2024 precip near Hatta |

---

## Deploy

**Live:** [https://qwen-supernova-2.onrender.com](https://qwen-supernova-2.onrender.com)

Default blueprint = **one Docker service** ([`render.yaml`](render.yaml) + [`Dockerfile`](Dockerfile)). Guide: [DEPLOY_RENDER.md](DEPLOY_RENDER.md). Split services (optional): [`deploy/render.split.yaml`](deploy/render.split.yaml).

---

## Repo layout

```
backend/     FastAPI (nabd/) · tests · S1 mask data · precompute script
frontend/    Next.js UI
docs/        Architecture, methods, imagery
deploy/      Extra Render blueprints
Dockerfile   Production image (UI static export + API)
render.yaml  Default Render blueprint (Docker)
```

---

<sub>NASA GIBS · Copernicus / Element84 STAC · Overture Maps · Open-Meteo · © OpenStreetMap. Supernova × SpacePoint · BITS Pilani Dubai.</sub>
