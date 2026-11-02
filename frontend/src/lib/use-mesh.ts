"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIONS, TTL, decode, dedupeKey, encode, fromHex, hex, nowMinutes, radio, relayed, type Action, type Packet } from "./mesh";

export interface Heard {
  packet: Packet;
  hops: number;
  at: number;
  mine: boolean;
}
export interface LogLine {
  at: number;
  text: string;
  tone?: "ok" | "bad";
}

const STORE_FOR_MIN = 60;
const storeKey = (room: string, slot: number) => `nabd:mesh:${room}:${slot}`;
/** One phone on the mesh: hears neighbours, verifies, shows, relays once, and stores frames to hand on later. */
export function useMeshNode(slot: number, room = "open") {
  const [heard, setHeard] = useState<Heard[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [inRange, setInRange] = useState(true);
  const stored = useRef(new Map<string, Uint8Array>());
  const tx = useRef<ReturnType<typeof radio> | null>(null);

  const note = useCallback((text: string, tone?: LogLine["tone"]) => setLog((l) => [{ at: Date.now(), text, tone }, ...l].slice(0, 8)), []);

  const keep = useCallback(
    (p: Packet, frame: Uint8Array, mine: boolean) => {
      stored.current.set(dedupeKey(p), frame);
      const fresh = [...stored.current.values()].filter((f) => new DataView(f.buffer).getUint32(8) > nowMinutes() - STORE_FOR_MIN);
      localStorage.setItem(storeKey(room, slot), JSON.stringify(fresh.map(hex)));
      setHeard((h) => [{ packet: p, hops: p.hops, at: Date.now(), mine }, ...h]);
    },
    [room, slot],
  );

  const onFrame = useCallback(
    async (frame: Uint8Array, from: number) => {
      const p = await decode(frame);
      if (!p) return note(`rejected a frame from phone ${from}: bad signature`, "bad");
      if (p.kind === "hello") {
        const backlog = [...stored.current.values()];
        if (backlog.length) note(`phone ${from} is back — handing over ${backlog.length} stored`);
        backlog.forEach((f, i) => setTimeout(() => tx.current?.send(relayed(f)), 120 * (i + 1)));
        return;
      }
      if (stored.current.has(dedupeKey(p))) return;
      keep(p, frame, false);
      note(`${p.kind} ${p.id.toString(16)} from phone ${from} · ${p.hops} hop${p.hops === 1 ? "" : "s"}`, "ok");
      if (p.ttl > 0) {
        const next = relayed(frame);
        setTimeout(() => {
          tx.current?.send(next);
          note(`relayed ${p.kind} ${p.id.toString(16)} · ttl ${p.ttl - 1}`);
        }, 250 + Math.random() * 450);
      }
    },
    [keep, note],
  );

  useEffect(() => {
    const saved: string[] = JSON.parse(localStorage.getItem(storeKey(room, slot)) ?? "[]");
    let live = true;
    Promise.all(saved.map(async (s) => ({ f: fromHex(s), p: await decode(fromHex(s)) }))).then((rows) => {
      if (!live) return;
      const restored: Heard[] = [];
      for (const { f, p } of rows) {
        if (!p) continue;
        stored.current.set(dedupeKey(p), f);
        restored.unshift({ packet: p, hops: p.hops, at: p.issued * 60000, mine: p.origin === slot });
      }
      setHeard(restored);
    });
    return () => {
      live = false;
    };
  }, [room, slot]);

  useEffect(() => {
    if (!inRange) return;
    const r = radio(slot, onFrame, room);
    tx.current = r;
    encode({ kind: "hello", id: 0, ttl: 0, hops: 0, site: 0, level: 0, action: 0, issued: nowMinutes(), origin: slot }).then((f) => {
      r.send(f);
      [...stored.current.values()].forEach((s, i) => setTimeout(() => tx.current === r && r.send(relayed(s)), 150 * (i + 1)));
    });
    return () => {
      r.close();
      tx.current = null;
    };
  }, [slot, inRange, onFrame, room]);

  const originate = useCallback(
    async (p: Omit<Packet, "ttl" | "hops" | "issued" | "origin">) => {
      const packet: Packet = { ...p, ttl: TTL, hops: 0, issued: nowMinutes(), origin: slot };
      const frame = await encode(packet);
      keep(packet, frame, true);
      tx.current?.send(frame);
      note(`sent ${p.kind} ${p.id.toString(16)} · ${frame.length} bytes`, "ok");
      return frame;
    },
    [keep, note, slot],
  );

  const alert = useCallback(
    (site: number, level: number, action: Action) =>
      originate({ kind: "alert", id: Math.floor(Math.random() * 0xffffff), site, level, action: ACTIONS.indexOf(action) }),
    [originate],
  );
  const ack = useCallback((a: Packet) => originate({ kind: "ack", id: a.id, site: a.site, level: a.level, action: slot }), [originate, slot]);
  const reset = useCallback(() => {
    stored.current.clear();
    localStorage.removeItem(storeKey(room, slot));
    setHeard([]);
    setLog([]);
  }, [room, slot]);

  return { heard, log, inRange, setInRange, alert, ack, reset };
}
