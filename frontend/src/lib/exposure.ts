import { bbox, booleanPointInPolygon } from "@turf/turf";
import type { Zone } from "./scenario";

export type ExposureStatus = "ok" | "soon" | "over";

export interface Person {
  id: string;
  name: string;
  language: string;
  role: string;
  lng: number;
  lat: number;
  /** Minutes already spent outdoors when the zone was opened. */
  outdoorsMin: number;
  /** The presenter's own phone: notifications go to WHATSAPP_TEST_TO. */
  demo: boolean;
}

// Simulated opt-in phones; a deployment gets positions from the worker app, with consent.
const ROSTER: [string, string, string][] = [
  ["Your phone (demo)", "en", "presenter"],
  ["Ravi", "hi", "steel fixer"],
  ["Ahmed", "ur", "mason"],
  ["Joseph", "ml", "scaffolder"],
  ["Maria", "tl", "landscaper"],
  ["Senthil", "ta", "rigger"],
  ["Rahim", "bn", "delivery rider"],
  ["Khalid", "ar", "supervisor"],
];
const OUTDOORS_MIN = [34, 52, 18, 41, 27, 63, 9, 22];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same zone → same people in the same places. */
export function peopleIn(zone: Zone, zoneKey: string): Person[] {
  const [w, s, e, n] = bbox(zone);
  const rand = rng([...zoneKey].reduce((h, c) => Math.imul(h, 31) + c.charCodeAt(0), 7));
  const out: Person[] = [];
  for (let tries = 0; out.length < ROSTER.length && tries < 2000; tries++) {
    const lng = w + rand() * (e - w);
    const lat = s + rand() * (n - s);
    if (!booleanPointInPolygon([lng, lat], zone)) continue;
    const i = out.length;
    const [name, language, role] = ROSTER[i];
    out.push({ id: `${zoneKey}:${i}`, name, language, role, lng, lat, outdoorsMin: OUTDOORS_MIN[i], demo: i === 0 });
  }
  return out;
}

export function exposureStatus(minutes: number, limit: number): ExposureStatus {
  if (limit <= 0 || minutes >= limit) return "over";
  return minutes >= limit * 0.75 ? "soon" : "ok";
}

export const STATUS_COLOR: Record<ExposureStatus, string> = { ok: "#34c759", soon: "#ff9f0a", over: "#ff3b30" };
