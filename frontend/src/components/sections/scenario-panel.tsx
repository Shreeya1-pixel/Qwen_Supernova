"use client";

import { Circle, Flame, Info, Pentagon, RotateCcw, Waves, Wind } from "lucide-react";
import type { ZoneStats } from "@/lib/population";
import { setScenario, useScenario, type Preset, type ScenarioHazard } from "@/lib/scenario";
import { useNabd } from "@/lib/store";
import { cn } from "@/lib/format";

export type DrawMode = "idle" | "polygon" | "circle";

export interface OtherArea {
  id: string;
  name: string;
  population: number;
  partly: boolean;
}

const glass = "rounded-2xl border border-white/15 bg-[#0d0b09]/88 text-white shadow-2xl backdrop-blur-md";
const btn = "rounded-xl px-3.5 py-2.5 text-[1rem] font-extrabold transition-colors";

export function ScenarioPanel({
  mode,
  draftCount,
  radiusM,
  circleSet,
  activeId,
  zoneName,
  stats,
  buildings,
  others,
  sample,
  presets,
  presetsFallback,
  exposure,
  onDraw,
  onFinish,
  onCancel,
  onRadius,
  onPreset,
  onReset,
}: {
  presets: Preset[];
  presetsFallback: boolean;
  exposure?: React.ReactNode;
  mode: DrawMode;
  draftCount: number;
  radiusM: number;
  circleSet: boolean;
  activeId: string | null;
  zoneName: string | null;
  stats: ZoneStats | null;
  buildings: number | null;
  others: OtherArea[];
  sample: boolean;
  onDraw: (m: "polygon" | "circle") => void;
  onFinish: () => void;
  onCancel: () => void;
  onRadius: (m: number) => void;
  onPreset: (id: string) => void;
  onReset: () => void;
}) {
  const { t, lang } = useNabd();
  const { hazard } = useScenario();
  const fmt = (n: number) => Math.round(n).toLocaleString(lang === "ar" ? "ar-AE" : "en-US");
  const hazards: [ScenarioHazard, typeof Waves][] = [
    ["flood", Waves],
    ["heat", Flame],
    ["dust", Wind],
  ];

  return (
    <aside className={cn(glass, "absolute end-4 top-4 bottom-10 z-10 flex w-[420px] flex-col gap-4 overflow-y-auto p-5")}>
      <h1 className="text-[1.6rem] font-black leading-none">{t("scen.title")}</h1>

      <section className="space-y-2">
        <p className="text-[0.8rem] font-bold uppercase tracking-widest text-white/60">{t("scen.hazard")}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {hazards.map(([h, Icon]) => (
            <button
              key={h}
              role="radio"
              aria-checked={hazard === h}
              onClick={() => setScenario({ hazard: h })}
              className={cn(
                btn,
                "flex items-center justify-center gap-2 capitalize",
                hazard === h ? (h === "flood" ? "bg-[#0a84ff] text-white" : "bg-white text-black") : "bg-white/10 hover:bg-white/20",
              )}
            >
              <Icon className="size-5" /> {t(`scen.h.${h}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[0.8rem] font-bold uppercase tracking-widest text-white/60">{t("scen.draw")}</p>
        <div className="flex gap-2">
          <button className={cn(btn, "flex flex-1 items-center justify-center gap-2", mode === "polygon" ? "bg-[#ffd60a] text-black" : "bg-white/10 hover:bg-white/20")} onClick={() => onDraw("polygon")}>
            <Pentagon className="size-5" /> {t("scen.polygon")}
          </button>
          <button className={cn(btn, "flex flex-1 items-center justify-center gap-2", mode === "circle" ? "bg-[#ffd60a] text-black" : "bg-white/10 hover:bg-white/20")} onClick={() => onDraw("circle")}>
            <Circle className="size-5" /> {t("scen.circle")}
          </button>
        </div>
        {mode === "polygon" && (
          <div className="space-y-2 rounded-xl bg-[#ffd60a]/12 p-3">
            <p className="text-[0.95rem] font-semibold">{t("scen.drawHint")}</p>
            <div className="flex gap-2">
              <button disabled={draftCount < 3} className={cn(btn, "flex-1 bg-[#ffd60a] text-black disabled:opacity-40")} onClick={onFinish}>
                {t("scen.finish")} ({draftCount})
              </button>
              <button className={cn(btn, "bg-white/10")} onClick={onCancel}>
                {t("scen.cancel")}
              </button>
            </div>
          </div>
        )}
        {mode === "circle" && (
          <div className="space-y-2 rounded-xl bg-[#ffd60a]/12 p-3">
            {!circleSet && <p className="text-[0.95rem] font-semibold">{t("scen.circleHint")}</p>}
            <label className="flex items-center gap-3 text-[1rem] font-bold">
              {t("scen.radius")}
              <input type="range" min={200} max={5000} step={100} value={radiusM} onChange={(e) => onRadius(Number(e.target.value))} className="flex-1 accent-[#ffd60a]" />
              <span className="num w-20 text-end">{(radiusM / 1000).toFixed(1)} km</span>
            </label>
            <button className={cn(btn, "w-full bg-white/10")} onClick={onCancel}>
              {t("scen.finish")}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[0.8rem] font-bold uppercase tracking-widest text-white/60">{t("scen.presets")}</p>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <button key={p.id} className={cn(btn, activeId === p.id ? "bg-[#ff3b30] text-white" : "bg-white/10 hover:bg-white/20")} onClick={() => onPreset(p.id)}>
              {lang === "ar" ? p.name_ar : p.name}
            </button>
          ))}
        </div>
        {presetsFallback && <p className="rounded bg-[#ffd60a] px-2 py-1 text-[0.8rem] font-black text-black">{t("scen.fallback")}</p>}
        <button className={cn(btn, "flex w-full items-center justify-center gap-2 border border-white/25 hover:bg-white/10")} onClick={onReset}>
          <RotateCcw className="size-5" /> {t("scen.reset")}
        </button>
      </section>

      {stats ? (
        <section className="space-y-3 rounded-2xl border-2 border-[#ff3b30] bg-[#3c0606]/60 p-4">
          <p className="text-[1.05rem] font-black text-[#ff8a80]">{zoneName}</p>
          <div>
            <p className="flex items-center gap-1.5 text-[1rem] font-bold">
              {t("scen.popIn")}
              <span className="group relative inline-flex" tabIndex={0} aria-label={t("scen.tooltip")}>
                <Info className="size-5 text-white/70" />
                <span className="pointer-events-none absolute start-0 top-7 z-20 hidden w-72 rounded-lg bg-white p-3 text-[0.85rem] font-semibold leading-snug text-black shadow-xl group-hover:block group-focus:block">
                  {t("scen.tooltip")}
                </span>
              </span>
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="num text-[3.4rem] leading-none text-white">{fmt(stats.population)}</span>
              <span className="text-[1rem] font-bold text-white/70">({t("scen.approx")})</span>
            </p>
            {sample && <p className="mt-1 inline-block rounded bg-[#ffd60a] px-2 py-0.5 text-[0.8rem] font-black text-black">SAMPLE DATA</p>}
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 p-2.5">
              <dt className="text-[0.8rem] font-bold uppercase text-white/60">{t("scen.area")}</dt>
              <dd className="num text-[1.6rem]">{stats.areaKm2.toFixed(2)} km²</dd>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <dt className="text-[0.8rem] font-bold uppercase text-white/60">{t("scen.density")}</dt>
              <dd className="num text-[1.6rem]">
                {fmt(stats.density)} <span className="text-[0.8rem] font-bold">{t("scen.perKm")}</span>
              </dd>
            </div>
          </dl>
          {buildings !== null ? (
            <p className="text-[1.1rem] font-extrabold">
              <span className="num text-[1.6rem]">{fmt(buildings)}</span> {t("scen.osmBuildings")}
            </p>
          ) : (
            <p className="text-[0.85rem] font-semibold text-white/70">{t("scen.noBuildings")}</p>
          )}
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/25 p-4 text-[1.05rem] font-semibold text-white/80">{t("scen.empty")}</p>
      )}

      {exposure}

      {others.length > 0 && (
        <section className="space-y-2">
          <p className="text-[0.8rem] font-bold uppercase tracking-widest text-white/60">{t("scen.others")}</p>
          <ul className="space-y-1.5">
            {others.map((o) => (
              <li key={o.id} className={cn("flex items-center gap-3 rounded-xl border-2 px-3 py-2", o.partly ? "border-[#ff9f0a]" : "border-[#4ade80]/70")}>
                <span className="flex-1">
                  <span className="block text-[1rem] font-extrabold">{o.name}</span>
                  <span className={cn("text-[0.8rem] font-bold uppercase", o.partly ? "text-[#ffb340]" : "text-[#86efac]")}>
                    {t(o.partly ? "scen.partly" : "scen.outside")}
                  </span>
                </span>
                <span className="num text-[1.3rem]">{fmt(o.population)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
