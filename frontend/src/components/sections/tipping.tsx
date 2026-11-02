"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useNabd } from "@/lib/store";
import { cn } from "@/lib/format";
import { NAME_AR, SIGNAL_AR } from "@/lib/story";
import { SectionHead } from "@/components/ui/section-head";
import { Reveal } from "@/components/ui/reveal";
import { Spark } from "@/components/viz/spark";

const STATUS = {
  stable: { key: "tip.resilient", tone: "var(--gulf)" },
  watch: { key: "tip.watch", tone: "var(--sun)" },
  approaching_transition: { key: "tip.losing", tone: "var(--oxide)" },
} as const;

function Valley({ depth, period, label, note }: { depth: number; period: number; label: string; note: string }) {
  const reduced = useReducedMotion();
  const w = 220;
  const curve = `M0 20 C ${w * 0.3} 20, ${w * 0.32} ${20 + depth}, ${w / 2} ${20 + depth} S ${w * 0.7} 20, ${w} 20`;
  const bottom = 20 + depth - 9;
  const radius = 2400 / depth;
  const angle = depth > 40 ? 9 : 14;
  return (
    <figure className="flex-1">
      <svg viewBox={`0 0 ${w} 110`} className="w-full overflow-visible">
        <path d={curve} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        <motion.g
          style={{ transformOrigin: `${w / 2}px ${bottom - radius}px`, transformBox: "view-box" }}
          animate={reduced ? undefined : { rotate: [-angle, angle, -angle] }}
          transition={{ duration: period, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle r="9" cx={w / 2} cy={bottom} fill="var(--oxide)" />
        </motion.g>
      </svg>
      <figcaption className="mt-2">
        <span className="display block text-xl italic">{label}</span>
        <span className="text-[0.8rem] text-muted">{note}</span>
      </figcaption>
    </figure>
  );
}

export function Tipping() {
  const { snapshot: s, lang, t } = useNabd();
  if (!s) return null;
  const ar = lang === "ar";
  const [pre, em, post] = t("tip.pull").split("*");

  return (
    <section id="tipping" className="gutter section">
      <SectionHead folio="04" kicker={t("tip.kicker")} arabic="قبل الانهيار" title={t("tip.title")} aside={t("tip.aside")} />

      <Reveal className="mt-12 grid gap-10 border-y border-ink py-8 md:grid-cols-12">
        <div className="flex gap-8 md:col-span-7">
          <Valley depth={70} period={1.4} label={t("tip.resilient")} note={t("tip.resilientNote")} />
          <Valley depth={22} period={4.2} label={t("tip.losing")} note={t("tip.losingNote")} />
        </div>
        <p className="display text-[clamp(1.4rem,2.4vw,2rem)] leading-snug md:col-span-5">
          {pre}
          <em>{em}</em>
          {post}
        </p>
      </Reveal>

      <div className="mt-12 grid gap-px border border-ink bg-ink sm:grid-cols-2">
        {s.early_warning.map((w, i) => {
          const st = STATUS[w.status];
          return (
            <Reveal key={w.series_key} delay={i * 0.06} className="bg-paper p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="display text-2xl capitalize">{ar ? SIGNAL_AR[w.key] ?? w.key : w.key}</h3>
                <span className={cn("text-xs font-semibold", !ar && "mono uppercase")} style={{ color: st.tone }}>
                  {t(st.key)}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div>
                  <p className="mono text-[0.65rem] text-muted">{t("tip.signal")}</p>
                  <Spark height={44} lines={[{ values: w.residual, width: 1 }]} />
                </div>
                <div>
                  <p className="mono text-[0.65rem] text-muted">
                    <span className="text-oxide">
                      — {t("tip.ar1")} τ {w.tau_ar1.toFixed(2)}
                    </span>
                    <span className="ms-3 text-gulf">
                      — {t("tip.var")} τ {w.tau_variance.toFixed(2)}
                    </span>
                  </p>
                  <Spark
                    height={56}
                    independent
                    lines={[
                      { values: w.ar1, color: "var(--oxide)", width: 1.8 },
                      { values: w.variance, color: "var(--gulf)", width: 1.8 },
                    ]}
                  />
                </div>
              </div>
              <p dir="ltr" className={cn("mt-4 text-start text-[0.88rem] leading-relaxed", w.status !== "stable" && "text-ink")}>
                {w.explanation.charAt(0).toUpperCase() + w.explanation.slice(1)}
              </p>
            </Reveal>
          );
        })}
      </div>

      {s.body_warning.length > 0 && (
        <Reveal className="mt-10">
          <p className="eyebrow text-muted">{t("tip.body")}</p>
          <ul className="mt-3 divide-y divide-[var(--rule)] border-y border-ink">
            {s.body_warning.map((b) => {
              const st = STATUS[b.status as keyof typeof STATUS];
              return (
                <li key={b.worker} className="grid gap-2 py-3 sm:grid-cols-12">
                  <span className="display text-xl sm:col-span-2">{ar ? NAME_AR[b.worker] ?? b.worker : b.worker}</span>
                  <span className="text-xs font-semibold sm:col-span-2" style={{ color: st?.tone }}>
                    {st ? t(st.key) : b.status}
                  </span>
                  <span dir="ltr" className="text-start text-[0.88rem] text-muted sm:col-span-8">
                    HRV {b.explanation}
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>
      )}
    </section>
  );
}
