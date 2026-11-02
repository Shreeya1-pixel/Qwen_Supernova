"use client";

import { useState } from "react";
import { useNabd } from "@/lib/store";
import { LEVEL_COPY, cn, hour, num } from "@/lib/format";
import { Spark } from "@/components/viz/spark";
import { ExposureFlow } from "@/components/viz/exposure-flow";
import { ScenarioPathway } from "@/components/sections/scenario-pathway";
import { UaeMap, type MapLayer, type MapRes } from "@/components/viz/uae-map";
import { Bar, LevelPill, Loading, Panel, riskTone } from "./ui";

const LAYERS: { id: MapLayer; key: "land.outline" | "land.truecolor" | "land.lst" | "land.aod" }[] = [
  { id: "truecolor", key: "land.truecolor" },
  { id: "lst", key: "land.lst" },
  { id: "aod", key: "land.aod" },
  { id: "outline", key: "land.outline" },
];

export function MapPanel({ className, initialRes = "low" }: { className?: string; initialRes?: MapRes }) {
  const { sites, siteId, setSiteId, replay, lang, t } = useNabd();
  const [layer, setLayer] = useState<MapLayer>("truecolor");
  const [res, setRes] = useState<MapRes>(initialRes);
  const [meta, setMeta] = useState<{ points?: number; imageryDate?: string }>({});
  const live = sites.filter((s) => !s.error);

  return (
    <Panel
      className={className}
      title={t("dash.map")}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg">
            {LAYERS.map((l) => (
              <button key={l.id} aria-pressed={layer === l.id} onClick={() => setLayer(l.id)}>
                {t(l.key)}
              </button>
            ))}
          </div>
          <div className="seg">
            {(["low", "high"] as const).map((r) => (
              <button key={r} aria-pressed={res === r} onClick={() => setRes(r)}>
                {t(r === "low" ? "land.low" : "land.high")}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="relative flex-1 overflow-hidden rounded-[10px] border border-[var(--line)] bg-paper-2/50">
        {live.length ? (
          <UaeMap
            sites={live}
            active={siteId}
            onSelect={setSiteId}
            layer={layer}
            res={res}
            replay={replay}
            lang={lang}
            onMeta={(m) => setMeta((p) => ({ points: m.points || p.points, imageryDate: m.imageryDate ?? p.imageryDate }))}
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center">
            <Loading />
          </div>
        )}
        {(layer === "lst" || layer === "aod") && (
          <div className="absolute bottom-3 start-3 rounded-md bg-paper/90 px-3 py-2">
            <div className="h-2 w-36 rounded-full" style={{ background: "linear-gradient(90deg,#3b4cc0,#8fb8e0,#f7f2c8,#f4a261,#b40426)" }} />
            <div className="label mt-1 flex justify-between" dir="ltr">
              <span>{layer === "lst" ? "cooler" : "clear"}</span>
              <span>{layer === "lst" ? "hotter" : "dusty"}</span>
            </div>
          </div>
        )}
      </div>
      <p className="label mt-2 flex flex-wrap justify-between gap-2" dir="ltr">
        <span>geoBoundaries · NASA GIBS</span>
        <span>
          {meta.points ? `${meta.points.toLocaleString()} pts` : ""}
          {layer !== "outline" && meta.imageryDate ? ` · pass ${meta.imageryDate}` : ""}
        </span>
      </p>
    </Panel>
  );
}

export function SitesTable({ className }: { className?: string }) {
  const { sites, siteId, setSiteId, lang, t } = useNabd();
  const ar = lang === "ar";
  return (
    <Panel title={t("land.site")} className={className}>
      <table className="w-full text-start text-[0.85rem]">
        <thead>
          <tr className="label border-b border-[var(--line)]">
            <th className="pb-2 text-start font-medium">{t("land.site")}</th>
            <th className="pb-2 text-end font-medium">{t("land.index")}</th>
            <th className="pb-2 text-end font-medium">WBGT</th>
            <th className="pb-2 text-end font-medium">AQI</th>
            <th className="pb-2 ps-3 text-start font-medium">{t("land.verdict")}</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr
              key={s.id}
              onClick={() => setSiteId(s.id)}
              className={cn("cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-sand/50", s.id === siteId && "bg-sand/70")}
            >
              <td className="py-2.5">
                <div className="font-bold">{ar ? s.name_ar : s.name}</div>
                <div className="label normal-case">{s.kind}</div>
              </td>
              <td className="num py-2.5 text-end text-xl">{s.error ? "—" : Math.round(s.index)}</td>
              <td className="py-2.5 text-end font-semibold tabular-nums">{num(s.wbgt, 1)}</td>
              <td className="py-2.5 text-end font-semibold tabular-nums">{num(s.aqi)}</td>
              <td className="py-2.5 ps-3">{!s.error && <LevelPill level={s.level} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function TrendPanel({ className, height = 150 }: { className?: string; height?: number }) {
  const { snapshot: s, t } = useNabd();
  const series = s?.index.series ?? [];
  const wb = s?.raw.series.wet_bulb_temperature_2m ?? [];
  return (
    <Panel
      className={className}
      title={t("dash.trend")}
      action={
        <span className="flex items-center gap-3 text-[0.72rem] font-bold">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-oxide" /> {t("dash.index")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-ink" /> wet-bulb °C
          </span>
        </span>
      }
    >
      {!s ? (
        <Loading />
      ) : (
        <>
          <Spark
            height={height}
            independent
            lines={[
              { values: series.map((p) => p.value), color: "var(--oxide)", width: 2.2 },
              { values: wb, color: "var(--ink)", width: 1.3 },
            ]}
          />
          <div className="label mt-1 flex justify-between" dir="ltr">
            <span>{series[0] ? hour(series[0].time) : ""}</span>
            <span>
              wet-bulb {num(Math.min(...wb.filter((v): v is number => v !== null)), 1)}–{num(Math.max(...wb.filter((v): v is number => v !== null)), 1)}°C
            </span>
            <span>{series.at(-1) ? hour(series.at(-1)!.time) : ""}</span>
          </div>
        </>
      )}
    </Panel>
  );
}

const HAZARD_NAME: Record<string, string> = { heat: "Heat", dust: "Dust", air: "Air", sea_warming: "Sea", uv: "UV", flood: "Flood" };

export function DriversPanel({ className }: { className?: string }) {
  const { snapshot: s, t } = useNabd();
  return (
    <Panel title={t("dash.drivers")} className={className}>
      {!s ? (
        <Loading />
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <ul className="space-y-2.5">
            {s.index.drivers.map((d) => (
              <li key={d.hazard}>
                <div className="mb-1 flex items-baseline justify-between text-[0.82rem]">
                  <span className="font-bold">{d.label}</span>
                  <span className="num text-base">{Math.round(d.share * 100)}%</span>
                </div>
                <Bar value={d.share} tone={riskTone(d.share)} />
              </li>
            ))}
            {!s.index.drivers.length && <li className="text-sm text-muted">No hazard is contributing right now.</li>}
          </ul>
          <div>
            <p className="label mb-2">Hazards now · intensity</p>
            <ul className="grid grid-cols-3 gap-2">
              {Object.entries(s.hazards).map(([k, v]) => (
                <li key={k} className="flex flex-col items-center rounded-xl border border-[var(--line)] py-2">
                  <svg viewBox="0 0 36 36" className="size-10 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="4" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke={riskTone(v)} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${v * 94.2} 94.2`} />
                  </svg>
                  <span className="num mt-1 text-sm">{Math.round(v * 100)}</span>
                  <span className="text-[0.64rem] font-bold text-muted">{HAZARD_NAME[k] ?? k}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  );
}

const STATUS = {
  stable: { en: "Stable", tone: "var(--gulf)" },
  watch: { en: "Watch", tone: "var(--sun)" },
  approaching_transition: { en: "Losing resilience", tone: "var(--oxide)" },
} as const;

export function SignalsPanel({ className, detailed = false }: { className?: string; detailed?: boolean }) {
  const { snapshot: s, t } = useNabd();
  return (
    <Panel title={t("dash.signals")} action={<span className="label">AR(1) · variance · Kendall τ</span>} className={className}>
      {!s ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {s.early_warning.map((e) => (
            <li key={e.key} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.85rem] font-bold capitalize">{e.key}</span>
                <span className="pill" style={{ color: STATUS[e.status].tone, background: `color-mix(in srgb, ${STATUS[e.status].tone} 14%, transparent)` }}>
                  {STATUS[e.status].en}
                </span>
              </div>
              <div className={cn("mt-1 grid gap-3", detailed ? "grid-cols-3" : "grid-cols-2")}>
                <div>
                  <span className="label">memory τ {e.tau_ar1.toFixed(2)}</span>
                  <Spark height={detailed ? 44 : 26} lines={[{ values: e.ar1, color: "var(--ink)", width: 1.3 }]} />
                </div>
                <div>
                  <span className="label">variance τ {e.tau_variance.toFixed(2)}</span>
                  <Spark height={detailed ? 44 : 26} lines={[{ values: e.variance, color: "var(--oxide)", width: 1.3 }]} />
                </div>
                {detailed && (
                  <div>
                    <span className="label">signal</span>
                    <Spark height={44} lines={[{ values: e.residual, color: "var(--muted)", width: 1 }]} />
                  </div>
                )}
              </div>
              {detailed && <p className="mt-1 text-[0.78rem] text-muted">{e.explanation}</p>}
            </li>
          ))}
          {detailed &&
            s.body_warning.map((b) => (
              <li key={b.worker} className="flex items-center justify-between gap-3 py-2 text-[0.8rem]">
                <span className="font-bold">{b.worker}</span>
                <span className="flex-1 truncate text-muted">{b.explanation}</span>
                <span className="label">{b.status}</span>
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
}

export function ExposedPanel({ className, graph = false }: { className?: string; graph?: boolean }) {
  const { snapshot: s, t } = useNabd();
  return (
    <Panel title={t("dash.exposed")} className={className}>
      {!s ? (
        <Loading />
      ) : graph ? (
        <ExposureFlow graph={s.exposure.graph} heads={{ hazard: t("reach.hazard"), pathway: t("reach.pathway"), cohort: t("reach.cohort"), outcome: t("reach.outcome") }} />
      ) : (
        <ul className="space-y-2.5">
          {s.exposure.cohorts.slice(0, 5).map((c) => (
            <li key={c.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.82rem]">
                <span className="truncate font-bold">{c.label}</span>
                <span className="num text-base">{Math.round(c.risk * 100)}</span>
              </div>
              <Bar value={c.risk} tone={riskTone(c.risk)} />
              <span className="label mt-0.5 block truncate normal-case" dir="ltr">
                {c.path.map((p) => p.label).join(" → ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ScenarioPathway />
    </Panel>
  );
}

export function LevelLegend() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(LEVEL_COPY) as (keyof typeof LEVEL_COPY)[]).map((l) => (
        <LevelPill key={l} level={l} />
      ))}
    </div>
  );
}
