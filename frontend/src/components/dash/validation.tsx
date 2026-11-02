"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { Panel } from "./ui";

interface Case {
  id: string;
  title: string;
  mode: "events" | "daily";
  summary: Record<string, number | null | Record<string, number | null>>;
}

export function ValidationPanel({ className }: { className?: string }) {
  const [cases, setCases] = useState<Case[] | null>(null);
  useEffect(() => {
    fetch(`${API}/validation`)
      .then((r) => r.json())
      .then((d: { cases: Case[] }) => setCases(d.cases))
      .catch(() => setCases([]));
  }, []);
  const flood = cases?.find((c) => c.id === "flood-2024");
  const heat = cases?.filter((c) => c.mode === "daily") ?? [];

  return (
    <Panel title="Validation · backtest with forecasts issued at the time" className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/validation-flood.png" alt="Hatta April 2024: NABD alarm 39 hours before the flood threshold" className="w-full rounded-lg" />
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {flood && (
          <div className="rounded-xl border border-[var(--line)] p-3">
            <p className="label">Hatta floods · spring 2024</p>
            <p className="num text-3xl">{String(flood.summary.warned)}/{String(flood.summary.events)}</p>
            <p className="text-[0.8rem]">
              events flagged, up to {String(flood.summary.max_lead_h)} h ahead · obs. only {String(flood.summary.nowcast_median_lead_h)} h ·{" "}
              {String(flood.summary.false_alarm_runs)}/{String(flood.summary.alarm_runs)} alarm periods false
            </p>
          </div>
        )}
        {heat.map((c) => {
          const r = c.summary.restrict as Record<string, number>;
          return (
            <div key={c.id} className="rounded-xl border border-[var(--line)] p-3">
              <p className="label">{c.title}</p>
              <p className="num text-3xl">
                {r.hit}/{String(c.summary.event_days)}
              </p>
              <p className="text-[0.8rem]">
                black-flag days flagged by 05:00 · median {String(c.summary.median_lead_h)} h · false-alarm ratio {r.far} ·{" "}
                {String(c.summary.outside_midday_ban)}/{String(c.summary.black_flag_hours)} hours outside the midday ban
              </p>
            </div>
          );
        })}
      </div>
      <p className="label mt-2 normal-case">Lead time comes from public forecasts plus the index&apos;s memory. Reference = model analysis. See docs/METHODS.md.</p>
    </Panel>
  );
}
