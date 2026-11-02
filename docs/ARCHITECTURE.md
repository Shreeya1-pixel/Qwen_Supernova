# NABD — tech stack and data flow

## One-line answer

A **Next.js** dashboard talks to a **FastAPI** backend. The backend pulls free public data, runs deterministic engines (no LLM in any decision), and pushes alerts out over WhatsApp, a phone-to-phone mesh, and a hash-chained audit log.

## Architecture

```mermaid
flowchart LR
  subgraph SRC["Free public data · no keys"]
    OM["Open-Meteo<br/>weather · air · marine<br/>previous runs"]
    NASA["NASA GIBS + EONET<br/>satellite layers · events"]
    OSM["OpenStreetMap<br/>boundaries · buildings"]
    WP["WorldPop<br/>population grid"]
    NEWS["Google News RSS · Yahoo oil prices"]
  end

  subgraph DEV["People & devices"]
    WEAR["Wearables<br/>WHOOP · Apple Watch (planned)<br/>simulated today"]
    PROBE["Field sensors<br/>HMAC-signed"]
    PHONE["Worker phones<br/>opt-in location"]
  end

  subgraph BE["Backend · Python FastAPI :8040"]
    CONN["connectors/<br/>open_meteo · geo · news · whatsapp"]
    subgraph ENG["engine/ · deterministic"]
      IDX["Nabd Index<br/>hazard memory"]
      CSD["Tipping-point stats<br/>AR1 · variance · surrogates"]
      GRAPH["Exposure graph<br/>hazard → pathway → people"]
      PHYS["Personal line<br/>PSI · Bayesian thresholds"]
      EXPO["Exposure watch<br/>WBGT → sun limit"]
      BT["Backtest<br/>no look-ahead"]
    end
    SEC["security/<br/>signed sensors · Mirage red team"]
    COUNCIL["Council<br/>3 independent checks"]
    PLAY["automation/<br/>UAE playbooks · audit chain"]
    GEM["Gemini (optional)<br/>briefing text only"]
  end

  subgraph FE["Frontend · Next.js 16 · React 19 · Tailwind 4 :3848"]
    DASH["Dashboard<br/>Overview · Signals · Crew · Alerts · Audit"]
    MAP["Live map<br/>MapLibre · Esri · NASA"]
    SCEN["Scenario mode<br/>Turf.js zones · dot density · exposure watch"]
    RELAY["Off-grid relay<br/>21-byte signed BLE frame"]
    I18N["EN / AR · RTL"]
  end

  OUT["WhatsApp Cloud API<br/>alerts in 8 languages (demo)"]

  SRC --> CONN
  WEAR --> PHYS
  PROBE --> SEC
  PHONE --> EXPO
  CONN --> IDX & CSD & GRAPH & EXPO & BT
  SEC --> COUNCIL
  IDX & CSD & PHYS --> COUNCIL
  GRAPH --> COUNCIL
  COUNCIL --> PLAY
  PLAY --> GEM
  BE <-->|REST JSON| FE
  EXPO --> OUT
  PLAY --> OUT
  RELAY -.->|phone to phone, no network| PHONE
```

## Backend endpoints (FastAPI)

```mermaid
flowchart TB
  API["FastAPI :8040 /api"]
  API --> S["Sites<br/>GET /sites · /sites/{id} · /sites/{id}/briefing · /scenarios"]
  API --> V["Validation<br/>GET /validation"]
  API --> G["Geo<br/>GET /geo/heat · /geo/boundaries · /geo/imagery/{kind}"]
  API --> E["Exposure<br/>GET /exposure/conditions · /exposure/whatsapp<br/>POST /exposure/notify"]
  API --> H["Human input<br/>POST /intake · /intake/clear/{id} · /feedback"]
  API --> T["Trust<br/>POST /telemetry · /sites/{id}/sensors/simulate · /redteam/{id}"]
  API --> X["Context<br/>GET /news · /markets · /events"]
  API --> A["Audit<br/>GET /audit"]
```

## One request, end to end

```mermaid
sequenceDiagram
  participant UI as Next.js dashboard
  participant API as FastAPI
  participant OM as Open-Meteo
  participant ENG as Engines
  participant WA as WhatsApp
  UI->>API: GET /api/sites/dubai-south
  API->>OM: hourly weather + air (cached 10 min)
  OM-->>API: 21 days + 2-day forecast
  API->>ENG: index · tipping stats · exposure graph · personal lines
  ENG-->>API: three independent checks
  API->>API: council: converge → playbook, diverge → human
  API-->>UI: snapshot (index, drivers, crew, actions, audit hash)
  UI->>API: POST /api/exposure/notify (person past sun limit)
  API->>WA: message in worker's language
  WA-->>API: sent / dry run
  API-->>UI: result + audit record
```

## If someone asks

- **Why FastAPI?** It's async, so it fetches several data sources in parallel, and it generates typed APIs from Pydantic. The engines are plain Python and easy to test: 16 offline tests.
- **Why no LLM in decisions?** Safety calls must be deterministic and auditable. Gemini only writes the optional supervisor briefing.
- **Wearables?** The engine takes heart rate and core/skin temperature. Today those are simulated from each site's real WBGT. The plan is **WHOOP** (WHOOP developer API: heart rate, HRV, skin temperature, strain) and **Apple Watch** (HealthKit via a small iOS companion app). The engine doesn't change; only the input stream is swapped.
- **Offline?** Boundaries and population are saved files, the backend keeps a disk cache, and alerts can hop phone to phone with no network.
- **Cost to run?** Every data source is free and keyless. WhatsApp Cloud API charges per conversation beyond the free tier.
