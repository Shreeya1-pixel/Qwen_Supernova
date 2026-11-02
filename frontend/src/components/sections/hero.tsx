"use client";

import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useNabd } from "@/lib/store";
import { headline, bulletinNo } from "@/lib/story";
import { num } from "@/lib/format";
import { PulseLine } from "@/components/viz/pulse-line";
import { SplitReveal } from "@/components/ui/split-reveal";
import { Stamp } from "@/components/ui/stamp";

const EASE = [0.22, 1, 0.36, 1] as const;
const BAND_AR: Record<string, string> = { low: "منخفض", elevated: "مرتفع", high: "عالٍ", severe: "شديد" };
const DRIVER_AR: Record<string, string> = {
  heat: "الإجهاد الحراري",
  dust: "الغبار",
  air: "تلوث الهواء",
  uv: "الأشعة فوق البنفسجية",
  flood: "السيول",
  sea_warming: "احترار البحر",
};

export function Hero() {
  const { snapshot: s, error, lang, t } = useNabd();
  const ar = lang === "ar";

  if (!s)
    return (
      <section id="top" className="gutter flex min-h-[92svh] items-center pt-24">
        <p className="mono text-sm text-muted">{error ? `${t("hero.offline")} (${error})` : t("hero.loading")}</p>
      </section>
    );

  const { title, deck } = headline(s, lang);
  const { vol, no } = bulletinNo(s.local_time);
  const date = new Date(s.local_time);
  const locale = ar ? "ar-AE" : "en-GB";
  const coastal = s.site.kind === "coastal";
  const stats = [
    [t("hero.air"), num(s.current.temperature_2m, 1), "°C"],
    [t("hero.humidity"), num(s.current.relative_humidity_2m), "%"],
    [t("hero.wbgt"), num(s.wbgt, 1), "°C"],
    coastal ? [t("hero.sea"), num(s.current.sea_surface_temperature, 1), "°C"] : [t("hero.dust"), num(s.current.pm10), "µg/m³"],
    [t("hero.aqi"), num(s.current.us_aqi), "US AQI"],
  ];
  const driver = (d?: { hazard: string; label: string }) => (d ? (ar ? DRIVER_AR[d.hazard] ?? d.label : d.label.toLowerCase()) : "");

  return (
    <section id="top" className="gutter relative pb-10 pt-20 md:pt-24">
      <div className="rule-double flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-3">
        <p className="mono text-[0.72rem] uppercase tracking-[0.14em] text-muted">
          Vol. {vol} · No. {no} · {date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ·{" "}
          {s.local_time.slice(11, 16)} GST
        </p>
        <p className="display text-lg italic">{t("hero.tagline")}</p>
        <p className="mono text-[0.72rem] uppercase tracking-[0.14em]">
          {s.replay ? <span className="text-oxide">{t("hero.replay")}</span> : <span className="text-gulf">{t("hero.live")}</span>}
          {s.stale && <span className="ms-2 text-oxide">{t("hero.cached")}</span>}
        </p>
      </div>
      <div className="mt-[3px] border-t border-ink" />

      <div className="mt-8 grid gap-10 md:mt-12 md:grid-cols-12">
        <div className="md:col-span-8">
          <p className="eyebrow flex flex-wrap items-baseline gap-3 text-oxide">
            <span>{ar ? s.site.name_ar : s.site.name}</span>
            {!ar && <span className="arabic text-base normal-case tracking-normal">{s.site.name_ar}</span>}
            <span className="mono text-muted" dir="ltr">
              {s.site.lat.toFixed(2)}°N {s.site.lon.toFixed(2)}°E
            </span>
          </p>
          <h1 key={title} className="display mt-4 text-[clamp(3rem,8.4vw,7.8rem)]">
            <SplitReveal text={title} onLoad stagger={0.06} />
          </h1>
          <motion.p
            key={deck}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
            className="mt-6 max-w-[40rem] text-[clamp(1.05rem,1.5vw,1.3rem)] leading-relaxed"
          >
            {ar ? (
              deck
            ) : (
              <>
                <span className="float-left mr-2 mt-1 font-[family-name:var(--font-display)] text-[3.6em] leading-[0.8] text-oxide">
                  {deck.charAt(0)}
                </span>
                {deck.slice(1)}
              </>
            )}
          </motion.p>
        </div>

        <aside className="flex flex-col justify-between gap-8 border-[var(--rule)] md:col-span-4 md:border-s md:ps-8">
          <div>
            <p className="eyebrow text-muted">{t("hero.index")}</p>
            <div className="mt-2 flex items-end gap-4">
              <span className="display text-[clamp(5.5rem,11vw,9.5rem)] leading-[0.8] tabular-nums">{Math.round(s.index.value)}</span>
              <div className="pb-2">
                <p className="display text-2xl capitalize italic">{ar ? BAND_AR[s.index.band] ?? s.index.band : s.index.band}</p>
                <p className={`mono text-sm ${s.index.delta_6h > 0 ? "text-oxide" : "text-gulf"}`}>
                  {s.index.delta_6h > 0 ? "▲" : "▼"} {Math.abs(s.index.delta_6h).toFixed(1)} {t("hero.in6h")}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {t("hero.mostly")} <strong className="font-semibold text-ink">{driver(s.index.drivers[0]) || "—"}</strong>
              {s.index.drivers[1] && (
                <>
                  {" "}
                  {t("hero.and")} {driver(s.index.drivers[1])}
                </>
              )}
              . {t("hero.decay")}
            </p>
          </div>
          <Stamp level={s.council.label} state={s.council.state} className="self-start" />
        </aside>
      </div>

      <div className="mt-12 md:mt-16">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <p className="eyebrow text-muted">
            {t("hero.pulse")} · {ar ? s.site.name_ar : s.site.name}
          </p>
          <p className="eyebrow hidden text-muted md:block" dir="ltr">
            {s.sources.join(" + ")}
          </p>
        </div>
        <PulseLine values={s.raw.series.wet_bulb_temperature_2m ?? []} times={s.raw.time} />
      </div>

      <dl className="mt-8 grid grid-cols-2 border-t border-ink sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([k, v, u]) => (
          <div key={k} className="border-b border-e border-[var(--rule)] px-1 py-4 pe-4 last:border-e-0">
            <dt className="eyebrow text-muted">{k}</dt>
            <dd className="mt-1 flex items-baseline gap-1" dir="ltr">
              <span className="display text-4xl tabular-nums">{v}</span>
              <span className="mono text-xs text-muted">{u}</span>
            </dd>
          </div>
        ))}
      </dl>

      <a href="#land" className="mt-10 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowDown className="size-4" /> {t("hero.next")}
      </a>
    </section>
  );
}
