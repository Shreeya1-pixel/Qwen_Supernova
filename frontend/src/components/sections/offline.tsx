"use client";

import { RotateCcw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNabd } from "@/lib/store";
import { PHONES } from "@/lib/alerts";
import { FRAME_BYTES, OBSERVER, decode, radio } from "@/lib/mesh";
import { SectionHead } from "@/components/ui/section-head";
import { Reveal } from "@/components/ui/reveal";

interface Pulse {
  id: number;
  from: number;
  kind: "alert" | "ack" | "hello" | "forged";
}

const ROOM_KEY = "nabd:mesh-room";
const roomStore = {
  get() {
    let r = sessionStorage.getItem(ROOM_KEY);
    if (!r) sessionStorage.setItem(ROOM_KEY, (r = Math.random().toString(36).slice(2, 8)));
    return r;
  },
  subscribe: () => () => {},
};

const TONE = { alert: "var(--oxide)", ack: "var(--gulf)", hello: "var(--muted)", forged: "#b40426" } as const;

export function Offline() {
  const { siteId, snapshot, t } = useNabd();
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [air, setAir] = useState({ frames: 0, bytes: 0 });
  const [epoch, setEpoch] = useState(0);
  const [preset] = useState(() => ({ site: siteId, level: snapshot?.council.label ?? "RESTRICT" }));
  const room = useSyncExternalStore(roomStore.subscribe, roomStore.get, () => null);
  const src = (slot: number) => `/relay?slot=${slot}&room=${room}&site=${preset.site}&level=${preset.level}`;
  const radar = useRef<ReturnType<typeof radio> | null>(null);
  const seq = useRef(0);

  const pulse = useCallback((from: number, kind: Pulse["kind"]) => {
    const id = ++seq.current;
    setPulses((p) => [...p, { id, from, kind }]);
    setAir((a) => ({ frames: a.frames + 1, bytes: a.bytes + FRAME_BYTES }));
    setTimeout(() => setPulses((p) => p.filter((x) => x.id !== id)), 1100);
  }, []);

  useEffect(() => {
    if (!room) return;
    const r = radio(
      OBSERVER,
      async (frame, from) => {
        const p = await decode(frame);
        pulse(from, p ? p.kind : "forged");
      },
      room,
    );
    radar.current = r;
    return () => r.close();
  }, [pulse, room]);

  const forge = () => {
    const f = new Uint8Array(FRAME_BYTES);
    crypto.getRandomValues(f);
    f[0] = 0x11;
    f[5] = 3;
    f[6] = 0;
    f[7] = 6;
    radar.current?.send(f, 2);
    pulse(2, "forged");
  };

  const reset = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("nabd:mesh:"))
      .forEach((k) => localStorage.removeItem(k));
    setAir({ frames: 0, bytes: 0 });
    setEpoch((e) => e + 1);
  };

  const col = (slot: number) => ((slot + 0.5) / PHONES.length) * 100;

  return (
    <section id="offgrid" className="gutter section">
      <SectionHead folio="10" kicker={t("off.kicker")} arabic="بلا شبكة" title={t("off.title")} aside={t("off.aside")} />

      <Reveal className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink pb-3">
          <p className="mono text-[0.75rem]" dir="ltr">
            <span className="text-ink">{air.frames}</span> {t("off.frames")} · <span className="text-ink">{air.bytes}</span> {t("off.air")} ·{" "}
            <span className="text-oxide">0</span> {t("off.internet")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="chip !text-[0.78rem]" onClick={forge}>
              <ShieldAlert className="size-3.5" /> {t("off.forge")}
            </button>
            <button className="chip !text-[0.78rem]" onClick={reset}>
              <RotateCcw className="size-3.5" /> {t("off.reset")}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto" dir="ltr">
          <div className="min-w-[1100px]">
            <svg viewBox="0 0 1000 70" className="block h-[70px] w-full" preserveAspectRatio="none" aria-hidden>
              <line x1={col(0) * 10} x2={col(PHONES.length - 1) * 10} y1="45" y2="45" stroke="var(--rule)" strokeDasharray="2 6" />
              {pulses.map((p) => (
                <circle
                  key={p.id}
                  cx={col(p.from) * 10}
                  cy="45"
                  r="6"
                  fill="none"
                  stroke={TONE[p.kind]}
                  strokeWidth="2"
                  className="mesh-ping"
                  style={{ ["--reach" as string]: `${(1000 / PHONES.length) * 1.1}px` }}
                />
              ))}
              {PHONES.map((p) => (
                <g key={p.slot}>
                  <circle cx={col(p.slot) * 10} cy="45" r="5" fill={p.slot === 0 ? "var(--ink)" : "var(--paper)"} stroke="var(--ink)" />
                  <text x={col(p.slot) * 10} y="20" textAnchor="middle" className="mono" fontSize="11" fill="var(--muted)">
                    {p.name}
                  </text>
                </g>
              ))}
            </svg>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${PHONES.length}, minmax(0, 1fr))` }}>
              {PHONES.map((p) => (
                <div key={`${epoch}-${p.slot}`} className="overflow-hidden rounded-[28px] border-[6px] border-ink bg-ink shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)]">
                  {room ? (
                    <iframe title={`${p.name} phone`} src={src(p.slot)} loading="lazy" className="block h-[600px] w-full rounded-[22px] bg-paper" />
                  ) : (
                    <div className="h-[600px] rounded-[22px] bg-paper" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {(["off.how1", "off.how2", "off.how3"] as const).map((k, i) => (
            <div key={k} className="border-t border-ink pt-3">
              <span className="folio text-2xl">{i + 1}</span>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-muted">{t(k)}</p>
            </div>
          ))}
        </div>
        <p className="mono mt-8 max-w-3xl text-[0.7rem] leading-relaxed text-muted">{t("off.honest")}</p>
      </Reveal>
    </section>
  );
}
