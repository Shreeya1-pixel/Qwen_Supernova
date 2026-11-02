"use client";

import { useEffect, useState } from "react";
import { api, type Markets } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { LEVEL_COPY, num } from "@/lib/format";

export function Ticker() {
  const { sites, lang } = useNabd();
  const [markets, setMarkets] = useState<Markets | null>(null);
  const ar = lang === "ar";

  useEffect(() => {
    const load = () => api.markets().then(setMarkets).catch(() => {});
    load();
    const t = setInterval(load, 900_000);
    return () => clearInterval(t);
  }, []);

  const live = sites.filter((s) => !s.error);
  if (!live.length) return null;

  const items = [
    ...live.map((s) => (
      <span key={s.id} className="flex items-baseline gap-3 px-8">
        <span className={ar ? "arabic text-2xl" : "display text-2xl italic"}>{ar ? s.name_ar : s.name}</span>
        {!ar && <span className="arabic text-base opacity-70">{s.name_ar}</span>}
        <span className="mono text-sm tabular-nums">{Math.round(s.index)}</span>
        <span className={ar ? "arabic text-sm" : "mono text-xs"} style={{ color: LEVEL_COPY[s.level].tone }}>
          {ar ? LEVEL_COPY[s.level].ar : LEVEL_COPY[s.level].en.toUpperCase()}
        </span>
        <span className="mono text-xs opacity-70">
          {num(s.temperature, 1)}°C · WBGT {num(s.wbgt, 1)}
          {s.sst !== null && ` · sea ${num(s.sst, 1)}°C`}
        </span>
        {s.warning && <span className="mono text-xs text-sun">↯ {s.warning} slowing</span>}
        <span className="opacity-40">✳</span>
      </span>
    )),
    ...(markets?.quotes ?? []).map((q) => (
      <span key={q.key} className="flex items-baseline gap-2 px-8">
        <span className="eyebrow opacity-60">{q.key === "brent" ? "Brent" : "Diesel"}</span>
        <span className="mono text-sm tabular-nums">{q.price.toFixed(2)}</span>
        <span className="mono text-xs opacity-60">{q.unit}</span>
        <span className={`mono text-xs ${q.change_pct >= 0 ? "text-sun" : "text-gulf"}`}>
          {q.change_pct >= 0 ? "+" : ""}
          {q.change_pct.toFixed(2)}%
        </span>
      </span>
    )),
  ];
  if (markets?.cooling_aed_per_hour != null)
    items.push(
      <span key="cooling" className="flex items-baseline gap-3 px-8">
        <span className="mono text-xs opacity-70">cooling shelter ≈ {markets.cooling_aed_per_hour} AED/h</span>
        <span className="opacity-40">✳</span>
      </span>,
    );

  return (
    <div dir="ltr" className="on-dark overflow-hidden border-y border-ink bg-ink py-4 text-paper" aria-label="All sites and markets">
      <div className="marquee">
        <div className="flex">{items}</div>
        <div className="flex" aria-hidden>
          {items}
        </div>
      </div>
    </div>
  );
}
