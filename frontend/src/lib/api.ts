// Defaults to /api (relative) so it works when frontend + backend share one domain (Docker on Render).
// For local dev: set NEXT_PUBLIC_NABD_API=http://127.0.0.1:8040/api in frontend/.env.local
export const API = (process.env.NEXT_PUBLIC_NABD_API ?? "/api").replace(/\/+$/, "");

export type Level = "SAFE" | "WATCH" | "CAUTION" | "RESTRICT" | "STOP_WORK";

export interface SiteSummary {
  id: string;
  name: string;
  name_ar: string;
  kind: string;
  lat: number;
  lon: number;
  story: string;
  index: number;
  band: string;
  delta_6h: number;
  level: Level;
  temperature: number | null;
  wbgt: number | null;
  aqi: number | null;
  sst: number | null;
  top_driver: string | null;
  warning: string | null;
  stale: boolean;
  as_of: string;
  error?: string;
}

export interface Driver {
  hazard: string;
  label: string;
  share: number;
  memory: number;
}

export interface EarlyWarning {
  key: string;
  series_key: string;
  status: "stable" | "watch" | "approaching_transition";
  tau_ar1: number;
  tau_variance: number;
  psi: number;
  rising_hours: number;
  explanation: string;
  ar1: number[];
  variance: number[];
  residual: number[];
}

export interface PathStep {
  id: string;
  label: string;
  layer: string;
}

export interface Exposed {
  id: string;
  label: string;
  risk: number;
  path: PathStep[];
}

export interface GraphNode {
  id: string;
  layer: "hazard" | "pathway" | "cohort" | "outcome";
  label: string;
  risk: number;
}

export interface Worker {
  id: string;
  name: string;
  role: string;
  language: string;
  days_in_uae: number;
  age: number;
  fasting: boolean;
  symptoms: string[];
  psi: number;
  hr: number;
  core_temp: number;
  hrv_rmssd: number;
  symptom_boost: number;
  projected_psi: number;
  eta_hours: number | null;
  threshold: { threshold: number; base: number; reasons: string[]; belief: { alpha: number; beta: number } };
  hr_series: { time: string; hr: number; psi: number; hrv: number; projected: boolean }[];
}

export interface Agent {
  agent: string;
  level: number;
  label: Level;
  confidence: number;
  reasons: string[];
}

export interface Action {
  type: string;
  title: string;
  detail?: string;
  rule?: string;
  wbgt?: number;
  work_minutes_per_hour?: number;
  dry_run?: boolean;
}

export interface Snapshot {
  site: { id: string; name: string; name_ar: string; kind: string; lat: number; lon: number; story: string; cohorts: string[] };
  as_of: string;
  local_time: string;
  replay: string | null;
  stale: boolean;
  sources: string[];
  current: Record<string, number | null>;
  wbgt: number | null;
  hazards: Record<string, number>;
  fusion: { reference: Record<string, number | null>; ground: Record<string, number>; applied: string[] };
  index: { value: number; delta_6h: number; band: string; drivers: Driver[]; memory: Record<string, number>; series: { time: string; value: number }[] };
  early_warning: EarlyWarning[];
  body_warning: { worker: string; status: string; explanation: string }[];
  exposure: {
    cohorts: Exposed[];
    outcomes: Exposed[];
    graph: { nodes: GraphNode[]; links: { source: string; target: string; flow: number }[]; layers: string[]; calm?: boolean };
    calm?: boolean;
  };
  crew: Worker[];
  trust: { trusted: boolean; score: number; reasons: string[] };
  council: { state: "converged" | "diverged" | "hold"; level: number; label: Level; auto_execute: boolean; summary: string; agents: Agent[] };
  playbook: { executed: boolean; mode: string; actions: Action[]; alerts: unknown[]; audit: { hash: string; prev_hash: string } };
  raw: { time: string[]; series: Record<string, (number | null)[]> };
  news: { pressure: Record<string, number>; articles: Article[] } | null;
}

export interface JiraTicket {
  sent: boolean;
  dry_run: boolean;
  summary: string;
  key?: string | null;
  url?: string | null;
  error?: string | null;
  audit_hash?: string;
}

export interface AuditRecord {
  ts: number;
  site: string;
  level: Level;
  state: string;
  executed: boolean;
  actions: string[];
  hash: string;
  prev_hash: string;
  jira?: Omit<JiraTicket, "sent" | "audit_hash">;
}

export interface JiraTicket {
  sent: boolean;
  dry_run: boolean;
  summary: string;
  key?: string | null;
  url?: string | null;
  error?: string | null;
  audit_hash?: string;
}

export interface AuditRecord {
  ts: number;
  site: string;
  level: Level;
  state: string;
  executed: boolean;
  actions: string[];
  hash: string;
  prev_hash: string;
  jira?: Omit<JiraTicket, "sent" | "audit_hash">;
}

export interface Article {
  title: string;
  source: string;
  link: string;
  lang: "en" | "ar";
  age_hours: number;
  hazards: string[];
}

export interface Markets {
  quotes: { key: string; symbol: string; unit: string; price: number; change_pct: number; series: number[] }[];
  aed_per_litre_wholesale?: number;
  cooling_aed_per_hour: number | null;
  stale: boolean;
  source: string;
}

export interface Scenario {
  id: string;
  site_id: string;
  at: string;
  title: string;
  why: string;
}

export interface IntakeResult {
  text: string;
  symptoms: string[];
  severity: "none" | "low" | "high" | "emergency";
  language: string;
  language_name: string;
  code_switched: boolean;
  languages: string[];
  reply: string;
  matches: Record<string, { phrase: string; language: string }[]>;
}

export interface RedTeamReport {
  caught: number;
  neutralised: number;
  evaded: number;
  total: number;
  protected_rate: number;
  reference: Record<string, number>;
  results: {
    strategy: string;
    description: string;
    outcome: "caught" | "neutralised" | "evaded";
    note: string;
    attempts: { step: number; params: { scale: number }; caught_by: string[] }[];
  }[];
}

export interface ExposureConditions {
  time: string;
  temp_c: number;
  humidity: number;
  feels_c: number;
  uv: number;
  wind_kmh: number;
  is_day: boolean;
  wbgt: number;
  rule: string;
  sun_limit_min: number;
  source: string;
}

export interface NotifyResult {
  message: string;
  sent: boolean;
  dry_run: boolean;
  to: string | null;
  kind?: "text" | "template";
  note?: string;
  error?: string;
}

export interface OrbitKpis {
  flood_km2: number;
  buildings_impacted: number;
  buildings_critical: number;
  roads_km_affected: number;
  zones_active: number;
  overture_scanned?: number;
  overture_flooded?: number;
  hospitals_flooded?: number;
  schools_flooded?: number;
}

export interface OrbitBriefing {
  event: {
    id: string;
    title: string;
    theme: string;
    hackathon: string;
    peak_local: string;
    peak_rain_mm: number;
    peak_rain_place: string;
    summary: string;
    sources: string[];
  };
  latency: {
    orbit_flood_mask_h: number;
    orbit_damage_triage_h: number;
    traditional_optical_h: number;
    traditional_field_survey_h: number;
  };
  advantage_hours: number;
  one_liner: string;
  latency_note?: string;
  deliverables: string[];
  peak_kpis: OrbitKpis;
  triage_kpis: OrbitKpis;
  overture?: {
    scanned: number;
    source: string;
    flooded_at_triage: number;
    hospitals_flooded: number;
    schools_flooded: number;
  };
  phases: { id: string; label: string; hours_after_onset: number; kpis: OrbitKpis }[];
}

export interface OrbitPhase {
  id: string;
  label: string;
  hours_after_onset: number;
  local_time: string;
  status: string;
  note: string;
  kpis: OrbitKpis;
  flood: { type: "FeatureCollection"; features: unknown[] };
  buildings: {
    id: string;
    name: string;
    zone: string;
    use: string;
    flooded: boolean;
    depth_class: string;
    severity: string;
    damage_score: number;
  }[];
  roads: {
    id: string;
    name: string;
    zone: string;
    class: string;
    status: string;
    length_km: number;
  }[];
  geojson_buildings: { type: "FeatureCollection"; features: unknown[] };
  geojson_roads: { type: "FeatureCollection"; features: unknown[] };
}

export interface OrbitPhaseDetail {
  event: OrbitBriefing["event"];
  latency: OrbitBriefing["latency"];
  advantage_hours: number;
  phase: OrbitPhase;
  phase_ids: string[];
}

export interface OrbitRainfall {
  source: string;
  stale: boolean;
  lat: number;
  lon: number;
  total_mm: number;
  peak_mm: number;
  peak_at: string;
  hourly: { t: string; mm: number }[];
  note: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const q = (params: Record<string, string | boolean | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};

export const api = {
  sites: (replay?: string | null) => request<{ sites: SiteSummary[] }>(`/sites${q({ replay })}`),
  site: (id: string, opts: { replay?: string | null; ramadan?: boolean } = {}) =>
    request<Snapshot>(`/sites/${id}${q({ replay: opts.replay, ramadan: opts.ramadan })}`),
  scenarios: () => request<{ scenarios: Scenario[] }>("/scenarios"),
  briefing: (id: string, replay?: string | null) => request<{ text: string; source: string }>(`/sites/${id}/briefing${q({ replay })}`),
  intake: (text: string, worker_id?: string) =>
    request<IntakeResult>("/intake", { method: "POST", body: JSON.stringify({ text, worker_id }) }),
  clearSymptoms: (worker_id: string) => request(`/intake/clear/${encodeURIComponent(worker_id)}`, { method: "POST" }),
  feedback: (worker_id: string, verdict: "confirmed" | "false_alarm") =>
    request("/feedback", { method: "POST", body: JSON.stringify({ worker_id, verdict }) }),
  news: () => request<{ pressure: Record<string, number>; articles: Article[]; source: string }>("/news"),
  markets: () => request<Markets>("/markets"),
  audit: (limit = 5) =>
    request<{ records: AuditRecord[] }>(`/audit?limit=${limit}`),
  jiraStatus: () => request<{ configured: boolean; ok: boolean; project: string | null; site?: string; error?: string | null }>("/jira/status"),
  jiraDemo: () => request<{ tickets: JiraTicket[] }>("/jira/demo", { method: "POST" }),
  exposureConditions: (lat: number, lng: number) => request<ExposureConditions>(`/exposure/conditions?lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}`),
  whatsappStatus: () => request<{ configured: boolean; test_to: string | null }>("/exposure/whatsapp"),
  notifyExposure: (body: { name: string; language: string; minutes: number; limit: number; wbgt: number; demo?: boolean; sun?: boolean }) =>
    request<NotifyResult>("/exposure/notify", { method: "POST", body: JSON.stringify(body) }),
  redTeam: (id: string) => request<RedTeamReport>(`/redteam/${id}`, { method: "POST" }),
  simulateSensors: (id: string, attack?: string) =>
    request<{ readings: { device: string; accepted: boolean; failed: string[]; metrics: Record<string, number> }[]; trust: Snapshot["trust"] }>(
      `/sites/${id}/sensors/simulate${q({ attack })}`,
      { method: "POST" },
    ),
  orbit: () => request<OrbitBriefing>("/orbit"),
  orbitPhase: (id: string) => request<OrbitPhaseDetail>(`/orbit/phases/${encodeURIComponent(id)}`),
  orbitRainfall: (lat = 24.8, lon = 56.12) =>
    request<OrbitRainfall>(`/orbit/rainfall?lat=${lat}&lon=${lon}`),
  orbitScenes: () => request<OrbitScenes>("/orbit/scenes"),
  orbitOsm: () => request<OrbitOsm>("/orbit/osm"),
  orbitNasa: () => request<OrbitNasa>("/orbit/nasa"),
  orbitFacilities: (phase = "t6") => request<OrbitFacilities>(`/orbit/facilities?phase_id=${encodeURIComponent(phase)}`),
};

export interface OrbitNasaTile {
  id: string;
  title: string;
  vibe: string;
  layer: string;
  date: string;
  url: string;
  format?: string;
  sparse?: boolean;
}

export interface OrbitNasa {
  ok: boolean;
  connected?: boolean;
  source: string;
  endpoint?: string;
  date: string;
  note: string;
  theme_split: { nasa: string[]; copernicus_theme04: string[] };
  gallery?: OrbitNasaTile[];
  sequence?: OrbitNasaTile[];
  hero?: OrbitNasaTile;
  layers: Record<string, OrbitNasaTile | { layer: string; date: string; url: string }>;
}

export interface OrbitFacilities {
  phase_id: string;
  source: string;
  scanned: number;
  flooded: number;
  hospitals_flooded: number;
  schools_flooded: number;
  clinics_flooded: number;
  critical_flooded: number;
  note: string;
}

export interface OrbitScene {
  id?: string;
  collection?: string;
  datetime?: string;
  platform?: string;
  sar_instrument_mode?: string;
  eo_cloud_cover?: number;
  thumbnail?: string;
}

export interface OrbitScenes {
  event: string;
  why: string;
  theme?: string;
  theme_data: string[];
  sentinel1: { ok: boolean; count: number; scenes: OrbitScene[]; source: string; note: string; stale?: boolean };
  sentinel2: { ok: boolean; count: number; scenes: OrbitScene[]; source: string; note: string; stale?: boolean };
  copernicus_dem?: { ok: boolean; count: number; scenes: OrbitScene[]; source: string; note: string; stale?: boolean };
}

export interface OrbitOsm {
  ok: boolean;
  source: string;
  buildings_count?: number;
  roads_count?: number;
  note: string;
  stale?: boolean;
}
