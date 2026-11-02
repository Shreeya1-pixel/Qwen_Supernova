"use client";

import { useNabd } from "@/lib/store";
import { SectionHead } from "@/components/ui/section-head";
import { Reveal } from "@/components/ui/reveal";
import { ExposureFlow } from "@/components/viz/exposure-flow";

export function Reach() {
  const { snapshot: s, t } = useNabd();
  if (!s) return null;
  const top = s.exposure.outcomes.filter((o) => o.risk > 0.05).slice(0, 3);
  const heads = { hazard: t("reach.hazard"), pathway: t("reach.pathway"), cohort: t("reach.cohort"), outcome: t("reach.outcome") };

  return (
    <section id="reach" className="gutter section bg-paper-2/50">
      <SectionHead folio="05" kicker={t("reach.kicker")} arabic="من يتأثر" title={t("reach.title")} aside={t("reach.aside")} />

      <Reveal className="mt-12 overflow-x-auto border-y border-ink py-6">
        <div className="min-w-[760px]">
          <ExposureFlow graph={s.exposure.graph} heads={heads} />
        </div>
      </Reveal>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {top.map((o, i) => (
          <Reveal key={o.id} delay={i * 0.08} className="border-t-2 border-ink pt-4">
            <div className="flex items-baseline justify-between">
              <span className="folio text-3xl">{i + 1}</span>
              <span className="display text-5xl tabular-nums">{Math.round(o.risk * 100)}%</span>
            </div>
            <h3 className="display mt-3 text-2xl">{o.label}</h3>
            <p dir="ltr" className="mt-3 text-start text-[0.9rem] leading-relaxed text-muted">
              {o.path.map((p, k) => (
                <span key={p.id}>
                  {k > 0 && <span className="mx-1.5 text-oxide">→</span>}
                  <span className={k === 0 ? "font-semibold text-ink" : undefined}>{p.label}</span>
                </span>
              ))}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
