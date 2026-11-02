import { area, bbox, booleanPointInPolygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { useEffect, useState } from "react";

export interface PopCell {
  lat: number;
  lng: number;
  pop: number;
}

export interface PopGrid {
  cells: PopCell[];
  source: string;
  cellM: number;
  sample: boolean;
}

// Tiny stand-in so the demo still runs without the WorldPop file. Values are illustrative only.
function sampleGrid(): PopGrid {
  const cells: PopCell[] = [];
  const blobs = [
    { lat: 25.121, lng: 55.382, peak: 420 },
    { lat: 25.12, lng: 55.418, peak: 260 },
    { lat: 25.164, lng: 55.41, peak: 520 },
    { lat: 25.22, lng: 55.42, peak: 300 },
  ];
  for (let lat = 25.08; lat <= 25.25; lat += 0.004) {
    for (let lng = 55.34; lng <= 55.46; lng += 0.004) {
      const pop = blobs.reduce((s, b) => s + b.peak * Math.exp(-(((lat - b.lat) / 0.012) ** 2 + ((lng - b.lng) / 0.014) ** 2)), 0);
      if (pop > 5) cells.push({ lat: +lat.toFixed(4), lng: +lng.toFixed(4), pop: Math.round(pop) });
    }
  }
  return { cells, source: "SAMPLE DATA", cellM: 400, sample: true };
}

let cached: PopGrid | null = null;
let pending: Promise<PopGrid> | null = null;

export function loadPopulation(): Promise<PopGrid> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch("/data/pop_dubai.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { cells: PopCell[]; source: string; cell_m: number }) => ({ cells: d.cells, source: d.source, cellM: d.cell_m, sample: false }))
    .catch(() => sampleGrid())
    .then((g) => (cached = g));
  return pending;
}

export function usePopulation() {
  const [grid, setGrid] = useState<PopGrid | null>(cached);
  useEffect(() => {
    if (!cached) loadPopulation().then(setGrid);
  }, []);
  return grid;
}

export interface ZoneStats {
  population: number;
  areaKm2: number;
  density: number;
  cells: number;
}

export const PEOPLE_PER_DOT = 50;
export const MIN_CELL_POP = 5;
export const MAX_DOTS = 20000;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DotLayer {
  points: [number, number][];
  /** People per drawn dot; above PEOPLE_PER_DOT when the viewport cap thins the dots. */
  perDot: number;
}

/**
 * Dot-density points for the viewport: round(pop / 50) dots per cell (cells below MIN_CELL_POP get none),
 * scattered uniformly inside the cell. Each cell seeds its own RNG from its coordinates, so dots never move
 * between renders. Over MAX_DOTS, every dot is kept with the same probability and perDot grows to match.
 */
export function dotsInView(grid: PopGrid, [w, s, e, n]: [number, number, number, number]): DotLayer {
  const halfLat = grid.cellM / 2 / 111320;
  const inView: PopCell[] = [];
  let total = 0;
  for (const c of grid.cells) {
    if (c.pop < MIN_CELL_POP || c.lng < w || c.lng > e || c.lat < s || c.lat > n) continue;
    const k = Math.round(c.pop / PEOPLE_PER_DOT);
    if (!k) continue;
    inView.push(c);
    total += k;
  }
  const keep = total > MAX_DOTS ? MAX_DOTS / total : 1;
  const points: [number, number][] = [];
  for (const c of inView) {
    const rand = mulberry32(Math.round(c.lat * 1e5) * 73856093 ^ Math.round(c.lng * 1e5) * 19349663);
    const halfLng = halfLat / Math.cos((c.lat * Math.PI) / 180);
    const k = Math.round(c.pop / PEOPLE_PER_DOT);
    for (let i = 0; i < k; i++) {
      const dx = (rand() * 2 - 1) * halfLng;
      const dy = (rand() * 2 - 1) * halfLat;
      if (rand() < keep) points.push([c.lng + dx, c.lat + dy]);
    }
  }
  return { points, perDot: Math.round(PEOPLE_PER_DOT / keep) };
}

/** Sum of grid cells whose centre lies inside the zone (bbox pre-filter keeps it fast). */
export function zoneStats(grid: PopGrid, zone: Feature<Polygon | MultiPolygon>): ZoneStats {
  const [w, s, e, n] = bbox(zone);
  let population = 0;
  let cells = 0;
  for (const c of grid.cells) {
    if (c.lng < w || c.lng > e || c.lat < s || c.lat > n) continue;
    if (booleanPointInPolygon([c.lng, c.lat], zone)) {
      population += c.pop;
      cells++;
    }
  }
  const areaKm2 = area(zone) / 1e6;
  return { population, areaKm2, density: areaKm2 > 0 ? population / areaKm2 : 0, cells };
}
