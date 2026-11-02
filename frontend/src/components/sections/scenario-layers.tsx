"use client";

import type { ScenarioOverlay } from "@/components/viz/scenario-map";
import { useNabd } from "@/lib/store";
import { cn } from "@/lib/format";

const chip = (on: boolean) =>
  cn("rounded-full px-3 py-1.5 text-[0.9rem] font-extrabold transition-colors", on ? "bg-white text-black" : "text-white/80 hover:text-white");

const OVERLAYS: ScenarioOverlay[] = ["none", "lst", "aod", "pop"];

/** One overlay at a time, plus the legend for zone colours and dots. */
export function ScenarioLayers({
  overlay,
  onOverlay,
  perDot,
  cellM,
}: {
  overlay: ScenarioOverlay;
  onOverlay: (o: ScenarioOverlay) => void;
  perDot: number;
  cellM: number;
}) {
  const { t } = useNabd();
  return (
    <div className="absolute start-4 top-24 z-10 w-[340px] space-y-3 rounded-2xl border border-white/15 bg-[#0d0b09]/88 p-3 text-white backdrop-blur-md">
      <div className="space-y-1.5">
        <span className="text-[0.75rem] font-bold uppercase text-white/60">{t("scen.overlay")}</span>
        <div className="flex flex-wrap items-center gap-1 rounded-full bg-white/10 p-1" role="radiogroup">
          {OVERLAYS.map((o) => (
            <button key={o} role="radio" aria-checked={overlay === o} className={chip(overlay === o)} onClick={() => onOverlay(o)}>
              {t(`scen.${o}`)}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-1.5 text-[0.85rem] font-semibold">
        <li className="flex items-center gap-2">
          <span className="size-4 shrink-0 rounded-sm border-2 border-[#ff3b30] bg-[#ef4444]/40" /> {t("scen.legZone")}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-4 shrink-0 rounded-sm border-2 border-[#4ade80] bg-[#22c55e]/25" /> {t("scen.legOther")}
        </li>
        {overlay === "pop" && (
          <li className="flex items-start gap-2">
            <span className="mt-1 flex w-4 shrink-0 flex-wrap gap-0.5">
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className="size-1 rounded-full bg-[#00e5ff]" />
              ))}
            </span>
            <span>
              {t("scen.legDot").replace("{n}", String(perDot)).replace("{m}", String(Math.round(cellM / 10) * 10))}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
