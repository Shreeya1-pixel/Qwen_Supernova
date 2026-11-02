"use client";

import { useNabd } from "@/lib/store";
import { SplitReveal } from "@/components/ui/split-reveal";

const SOURCES = [
  ["Open-Meteo", "forecast, air quality, marine, historical"],
  ["NASA GIBS", "VIIRS true colour, MODIS land heat, aerosol"],
  ["NASA EONET", "regional natural events"],
  ["geoBoundaries", "emirate outlines, low + high detail"],
  ["Google News RSS", "UAE weather, English + Arabic"],
  ["Yahoo Finance", "Brent, diesel futures"],
  ["Gemini", "optional briefing only"],
];

const METHOD = [
  "Nabd Index — per-hazard memory, noisy-OR",
  "Critical slowing down — AR(1), variance, Kendall τ",
  "Exposure graph — damped propagation, best path",
  "Moran PSI + 3 h projection",
  "Bayesian personal thresholds — Beta(α, β)",
  "Verifier council — converge / diverge / hold",
  "HMAC-signed telemetry + adaptive red team",
  "8-language code-switched intake, on device",
];

export function Footer() {
  const { t } = useNabd();
  return (
    <footer className="on-dark gutter bg-ink pb-10 pt-24 text-paper">
      <h2 className="display text-[clamp(3rem,9vw,8.5rem)]">
        <SplitReveal text={t("foot.title")} />
      </h2>

      <div className="mt-16 grid gap-10 border-t border-paper/25 pt-8 md:grid-cols-3">
        <div>
          <p className="eyebrow text-paper/50">{t("foot.sources")}</p>
          <ul className="mt-4 space-y-2 text-[0.88rem]">
            {SOURCES.map(([name, what]) => (
              <li key={name} dir="ltr" className="flex justify-between gap-4 border-b border-paper/10 pb-2">
                <span>{name}</span>
                <span className="text-end text-paper/50">{what}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow text-paper/50">{t("foot.method")}</p>
          <ul dir="ltr" className="mono mt-4 space-y-2 text-[0.75rem] text-paper/80">
            {METHOD.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow text-paper/50">{t("foot.honest")}</p>
          <ul className="mt-4 space-y-3 text-[0.88rem] leading-relaxed text-paper/80">
            {(["foot.honest1", "foot.honest2", "foot.honest3", "foot.honest4"] as const).map((k) => (
              <li key={k}>— {t(k)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-20 flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-baseline gap-4">
          <span className="display text-[clamp(4rem,14vw,12rem)] leading-none">Nabd</span>
          <span className="arabic text-[clamp(3rem,10vw,9rem)] leading-none text-oxide">نبض</span>
        </div>
        <p className="mono text-[0.7rem] text-paper/40">Emergency in the UAE: 998 ambulance · 999 police</p>
      </div>
    </footer>
  );
}
