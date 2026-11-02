# NABD — API and project layout

Backend: FastAPI on `http://127.0.0.1:8040`. Every endpoint is keyless unless noted.

| Endpoint | Returns |
|---|---|
| `GET /api/health` | Status |
| `GET /api/sites` | All five sites with index and verdict |
| `GET /api/sites/{id}` | Full snapshot: index, hazards, early warnings, exposure, crew, council, playbook, news. `?replay=2024-04-16T12:00` runs an archived hour |
| `GET /api/sites/{id}/briefing` | Supervisor briefing (needs `GEMINI_API_KEY`) |
| `GET /api/scenarios` | Archived replay days |
| `GET /api/validation` | Lead-time backtests |
| `GET /api/geo/heat` | Live feels-like / wet-bulb grid over the UAE (Open-Meteo, 30-min cache) |
| `GET /api/exposure/conditions?lat=&lng=` | Live temp, humidity, UV, WBGT at a point, and the safe minutes in the sun before a shade break |
| `GET /api/exposure/whatsapp` | Whether WhatsApp is connected, and the masked demo number |
| `POST /api/exposure/notify` | "Too long in the sun" alert in the person's language (WhatsApp Cloud API, or a dry run) |
| `GET /api/geo/boundaries?res=low\|high` | Emirate borders (geoBoundaries) |
| `GET /api/geo/imagery/{truecolor\|lst\|aod}` | Latest clear NASA GIBS pass |
| `POST /api/intake` | Multilingual symptom intake |
| `POST /api/intake/clear/{worker_id}` | Clear a worker's reported symptoms |
| `POST /api/feedback` | Supervisor feedback that updates personal lines |
| `POST /api/telemetry` | Signed sensor readings |
| `POST /api/sites/{id}/sensors/simulate` | Simulated field probes |
| `POST /api/redteam/{id}` | Run the Mirage red team |
| `GET /api/news` · `/api/markets` · `/api/events` | Live news, oil prices, NASA EONET |
| `GET /api/audit` | Hash-chained decision log |

## Frontend routes (Next.js, `:3848`)

| Route | Screen |
|---|---|
| `/` | Overview dashboard |
| `/map` | Full-screen live map |
| `/signals` | Tipping-point signals |
| `/crew` | Personal lines |
| `/alerts` | Playbook and off-grid relay |
| `/messages` | Multilingual intake |
| `/scenario` | Scenario mode (flood zone, population, buildings) |
| `/sensors` | Sensor trust and red team |
| `/audit` | Audit log |
| `/story` | Pitch story |
| `/relay?slot=0..4` | A single off-grid phone |

## Layout

```
NABD/
├── backend/
│   ├── nabd/connectors/   open_meteo · geo · news · markets · eonet · gemini
│   ├── nabd/engine/       nabd_index · early_warning · backtest · exposure_graph · physiology · thresholds · council
│   ├── nabd/intake/       codeswitch (8-language intake)
│   ├── nabd/security/     integrity (signed sensors) · mirage (red team)
│   ├── nabd/automation/   playbooks (UAE rules, WhatsApp, Jira, audit chain)
│   ├── scripts/validate.py
│   └── tests/
├── frontend/src/
│   ├── app/(bulletin)/(app)/   dashboard screens incl. scenario/
│   ├── app/(bulletin)/story/   pitch story · app/relay/ off-grid phone
│   ├── components/dash/        dashboard panels · live-map
│   ├── components/viz/         maps and charts · scenario-map
│   ├── components/sections/    story sections · scenario panel, layers, banner
│   └── lib/                    api · store · i18n (EN/AR) · mesh · alerts · population · scenario
├── scripts/prep_population.py  WorldPop GeoTIFF → frontend/public/data/pop_dubai.json
└── docs/                       METHODS · API · ARCHITECTURE · SPEAKER_NOTES · NABD_pitch.pdf · img · validation.json
```
