"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useNabd } from "@/lib/store";
import { num, cn } from "@/lib/format";
import { LevelPill, levelTone } from "./ui";
import { useMarkets } from "./world";

function Kpi({ label, value, unit, sub, tone, className }: { label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode; tone?: string; className?: string }) {
  return (
    <div className={cn("panel flex flex-col justify-between gap-2", className)}>
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-baseline gap-x-1.5" dir="ltr">
        <span className="num text-[2.2rem]" style={{ color: tone }}>
          {value}
        </span>
        {unit && <span className="text-xs font-bold text-muted">{unit}</span>}
      </div>
      {sub && <div className="text-[0.75rem] font-medium text-muted">{sub}</div>}
    </div>
  );
}

export function Kpis() {
  const { snapshot: s, t } = useNabd();
  const markets = useMarkets();
  if (!s) return <div className="grid h-[118px] grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{Array.from({ length: 7 }, (_, i) => <div key={i} className="panel animate-pulse" />)}</div>;

  const c = s.current;
  const crossing = s.crew.filter((w) => w.eta_hours !== null).length;
  const up = s.index.delta_6h > 0;
  const stateCopy = { converged: t("dash.auto"), diverged: t("dash.human"), hold: t("dash.hold") }[s.council.state];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <Kpi
        label={t("dash.index")}
        value={Math.round(s.index.value)}
        unit="/100"
        tone={levelTone(s.council.label)}
        sub={
          <span className={cn("inline-flex items-center gap-1 font-bold", up ? "text-oxide" : "text-gulf")} dir="ltr">
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(s.index.delta_6h).toFixed(1)} · 6 h · {s.index.band}
          </span>
        }
      />
      <div className="panel flex flex-col justify-between gap-2">
        <span className="label">{t("dash.verdict")}</span>
        <LevelPill level={s.council.label} solid />
        <span className="text-[0.75rem] font-bold">{stateCopy}</span>
      </div>
      <Kpi label={t("dash.wbgt")} value={num(s.wbgt, 1)} unit="°C" tone={(s.wbgt ?? 0) >= 30 ? "var(--oxide)" : undefined} sub={`${t("dash.air")} ${num(c.temperature_2m, 1)}° · ${t("dash.feels")} ${num(c.apparent_temperature, 0)}°`} />
      <Kpi label={t("dash.humidity")} value={num(c.relative_humidity_2m)} unit="%" sub={`wet-bulb ${num(c.wet_bulb_temperature_2m, 1)}°C`} />
      <Kpi label={t("dash.aqi")} value={num(c.us_aqi)} unit="US AQI" tone={(c.us_aqi ?? 0) > 100 ? "var(--oxide)" : undefined} sub={`PM10 ${num(c.pm10)} · PM2.5 ${num(c.pm2_5)}`} />
      <Kpi label={t("dash.crewRisk")} value={crossing} unit={`/ ${s.crew.length}`} tone={crossing ? "var(--oxide)" : "var(--gulf)"} sub={t("dash.in3h")} />
      <Kpi
        label={t("dash.cooling")}
        value={markets?.cooling_aed_per_hour ?? "—"}
        unit="AED/h"
        sub={markets?.quotes.find((q) => q.key === "brent") ? `Brent $${markets.quotes.find((q) => q.key === "brent")!.price.toFixed(2)}` : "Yahoo Finance"}
      />
    </div>
  );
}
