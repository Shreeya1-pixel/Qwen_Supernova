"use client";

import { useNabd } from "@/lib/store";
import { SplitReveal } from "./split-reveal";

/** Almanac-style section opener: folio number, kicker, headline, and a margin note. */
export function SectionHead({
  folio,
  kicker,
  title,
  aside,
  arabic,
}: {
  folio: string;
  kicker: string;
  title: string;
  aside?: React.ReactNode;
  arabic?: string;
}) {
  const { lang } = useNabd();
  return (
    <header className="rule-double grid gap-6 pt-5 md:grid-cols-12">
      <div className="flex items-baseline gap-3 md:col-span-3 md:flex-col md:gap-1">
        <span className="folio text-5xl leading-none md:text-6xl">§{folio}</span>
        <span className="eyebrow text-muted">{kicker}</span>
        {arabic && lang === "en" && <span className="arabic text-xl text-muted">{arabic}</span>}
      </div>
      <h2 key={title} className="display text-[clamp(2.4rem,6.2vw,5.4rem)] md:col-span-6">
        <SplitReveal text={title} />
      </h2>
      {aside && <div className="text-[0.95rem] leading-relaxed text-muted md:col-span-3 md:pt-3">{aside}</div>}
    </header>
  );
}
