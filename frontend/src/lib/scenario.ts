import { pointOnFeature, polygon } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { useEffect, useState, useSyncExternalStore } from "react";

export type ScenarioHazard = "flood" | "heat" | "dust";
export type Zone = Feature<Polygon | MultiPolygon>;

export interface Preset {
  id: string;
  name: string;
  name_ar: string;
  center: [number, number];
  zone: Zone;
  /** OSM buildings inside the boundary, counted at prep time (scripts/fetch_boundaries.py). */
  buildings: number | null;
}

export interface Presets {
  list: Preset[];
  /** true when public/data/areas.json is missing and the hand-drawn outlines are used. */
  fallback: boolean;
}

// Hand-drawn outlines, used only when public/data/areas.json is missing.
const ring = (pts: [number, number][]) => polygon([[...pts, pts[0]]]);
const FALLBACK: Preset[] = [
  {
    id: "academic-city",
    name: "Academic City",
    name_ar: "المدينة الأكاديمية",
    center: [55.418, 25.121],
    zone: ring([[55.405, 25.132], [55.425, 25.137], [55.437, 25.122], [55.428, 25.106], [55.409, 25.104], [55.401, 25.118]]),
    buildings: null,
  },
  {
    id: "silicon-oasis",
    name: "Silicon Oasis",
    name_ar: "واحة دبي للسيليكون",
    center: [55.382, 25.12],
    zone: ring([[55.366, 25.128], [55.383, 25.138], [55.399, 25.127], [55.396, 25.108], [55.377, 25.102], [55.364, 25.112]]),
    buildings: null,
  },
  {
    id: "international-city",
    name: "International City",
    name_ar: "المدينة العالمية",
    center: [55.41, 25.163],
    zone: ring([[55.396, 25.172], [55.418, 25.176], [55.426, 25.161], [55.413, 25.15], [55.395, 25.156]]),
    buildings: null,
  },
  {
    id: "mirdif",
    name: "Mirdif",
    name_ar: "مردف",
    center: [55.42, 25.22],
    zone: ring([[55.404, 25.232], [55.432, 25.235], [55.441, 25.216], [55.421, 25.205], [55.402, 25.213]]),
    buildings: null,
  },
];

interface AreaProps {
  id: string;
  name: string;
  name_ar?: string;
  buildings?: number | null;
}

let presetsCache: Presets | null = null;
let presetsPending: Promise<Presets> | null = null;

export function loadPresets(): Promise<Presets> {
  if (presetsCache) return Promise.resolve(presetsCache);
  presetsPending ??= fetch("/data/areas.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((fc: FeatureCollection<Polygon | MultiPolygon, AreaProps>) => {
      const list = fc.features
        .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
        .map((f): Preset => ({
          id: f.properties.id,
          name: f.properties.name,
          name_ar: f.properties.name_ar ?? f.properties.name,
          center: pointOnFeature(f).geometry.coordinates as [number, number],
          zone: f,
          buildings: f.properties.buildings ?? null,
        }));
      if (!list.length) throw new Error("no polygons");
      return { list, fallback: false };
    })
    .catch((err) => {
      console.warn(`[scenario] areas.json unavailable (${err}); using hand-drawn preset outlines. Run scripts/fetch_boundaries.py.`);
      return { list: FALLBACK, fallback: true };
    })
    .then((p) => (presetsCache = p));
  return presetsPending;
}

export function usePresets() {
  const [presets, setPresets] = useState<Presets | null>(presetsCache);
  useEffect(() => {
    if (!presetsCache) loadPresets().then(setPresets);
  }, []);
  return presets;
}

export interface ScenarioState {
  hazard: ScenarioHazard;
  zone: Zone | null;
  zoneId: string | null; // preset id, or "custom"
  zoneName: string | null;
  population: number | null;
  sample: boolean;
}

let state: ScenarioState = { hazard: "flood", zone: null, zoneId: null, zoneName: null, population: null, sample: false };
const listeners = new Set<() => void>();

export function setScenario(patch: Partial<ScenarioState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function resetScenario() {
  setScenario({ zone: null, zoneId: null, zoneName: null, population: null });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useScenario() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
