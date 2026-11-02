/**
 * Offline alert relay. An alert is a 21-byte signed frame — small enough for a single
 * Bluetooth LE advertisement (31 bytes) or a LoRa packet. Every phone that hears a frame
 * verifies it, shows it, and re-broadcasts it once with ttl-1, so an alert walks across a
 * site from phone to phone with no tower and no internet.
 *
 * In the browser the radio is a BroadcastChannel between windows, with range simulated by
 * position: a phone only hears its neighbours.
 */

export const SITES = ["al-quaa", "das-island", "fujairah-coast", "dubai-south", "hatta"] as const;
export const LEVELS = ["SAFE", "WATCH", "CAUTION", "RESTRICT", "STOP_WORK"] as const;
export const ACTIONS = ["stop", "water", "shade", "buddy", "flood", "dust", "clear"] as const;
export type Action = (typeof ACTIONS)[number];
export type Kind = "alert" | "ack" | "hello";

export const FRAME_BYTES = 21;
export const RANGE = 1;
export const TTL = 6;
export const OBSERVER = -1;

const CHANNEL = "nabd-mesh";
const CREW_SECRET = "nabd/dubai-south/crew-7";
const KIND_CODE: Record<Kind, number> = { alert: 1, ack: 2, hello: 3 };
const CODE_KIND = ["", "alert", "ack", "hello"] as const;

export interface Packet {
  kind: Kind;
  id: number;
  ttl: number;
  hops: number;
  site: number;
  level: number;
  /** Action code for alerts; the acknowledging phone's slot for acks. */
  action: number;
  /** Unix minutes. */
  issued: number;
  origin: number;
}

let keyPromise: Promise<CryptoKey> | null = null;
const key = () =>
  (keyPromise ??= crypto.subtle.importKey("raw", new TextEncoder().encode(CREW_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));

/** ttl/hops change at every relay, so byte 4 is zeroed before signing. */
function signedPart(b: Uint8Array) {
  const c = b.slice(0, 13);
  c[4] = 0;
  return c;
}

async function mac(b: Uint8Array) {
  return new Uint8Array(await crypto.subtle.sign("HMAC", await key(), signedPart(b))).subarray(0, 8);
}

export async function encode(p: Packet) {
  const b = new Uint8Array(FRAME_BYTES);
  b[0] = 0x10 | KIND_CODE[p.kind];
  b[1] = (p.id >> 16) & 255;
  b[2] = (p.id >> 8) & 255;
  b[3] = p.id & 255;
  b[4] = (p.ttl << 4) | (p.hops & 15);
  b[5] = p.site;
  b[6] = p.level;
  b[7] = p.action;
  new DataView(b.buffer).setUint32(8, p.issued);
  b[12] = p.origin & 255;
  b.set(await mac(b), 13);
  return b;
}

export async function decode(b: Uint8Array): Promise<Packet | null> {
  if (b.length !== FRAME_BYTES || b[0] >> 4 !== 1) return null;
  const expect = await mac(b);
  let diff = 0;
  for (let i = 0; i < 8; i++) diff |= expect[i] ^ b[13 + i];
  const kind = CODE_KIND[b[0] & 15];
  if (diff || !kind) return null;
  return {
    kind,
    id: (b[1] << 16) | (b[2] << 8) | b[3],
    ttl: b[4] >> 4,
    hops: b[4] & 15,
    site: b[5],
    level: b[6],
    action: b[7],
    issued: new DataView(b.buffer, b.byteOffset).getUint32(8),
    origin: b[12],
  };
}

export function relayed(b: Uint8Array) {
  const c = b.slice();
  c[4] = (Math.max(0, (b[4] >> 4) - 1) << 4) | Math.min(15, (b[4] & 15) + 1);
  return c;
}

export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" ");
export const fromHex = (s: string) => Uint8Array.from(s.split(" ").map((x) => parseInt(x, 16)));
export const dedupeKey = (p: Packet) => (p.kind === "ack" ? `k${p.id}.${p.origin}` : `a${p.id}`);
export const nowMinutes = () => Math.floor(Date.now() / 60000);

export interface Wire {
  from: number;
  frame: number[];
}

export function radio(slot: number, onFrame: (frame: Uint8Array, from: number) => void, room = "open") {
  const ch = new BroadcastChannel(`${CHANNEL}:${room}`);
  let open = true;
  ch.onmessage = (e: MessageEvent<Wire>) => {
    const { from, frame } = e.data;
    if (from === slot) return;
    if (slot === OBSERVER || Math.abs(from - slot) <= RANGE) onFrame(Uint8Array.from(frame), from);
  };
  return {
    send: (frame: Uint8Array, from = slot) => open && ch.postMessage({ from, frame: Array.from(frame) } satisfies Wire),
    close: () => {
      open = false;
      ch.close();
    },
  };
}
