"use client";

import { motion } from "framer-motion";
import { MoonStar } from "lucide-react";
import { useState } from "react";
import { api, type Worker } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { LANG_LABEL, cn } from "@/lib/format";
import type { TKey } from "@/lib/i18n";
import { NAME_AR } from "@/lib/story";
import { SectionHead } from "@/components/ui/section-head";
import { Reveal } from "@/components/ui/reveal";
import { Spark } from "@/components/viz/spark";

const GENERIC = 7;

function StrainScale({ w, lineLabel, genericLabel }: { w: Worker; lineLabel: string; genericLabel: string }) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, v * 10))}%`;
  const line = w.threshold.threshold;
  const rising = w.projected_psi > w.psi + 0.05;
  return (
    <div dir="ltr" className="relative mt-8 h-14" aria-label={`strain ${w.psi.toFixed(1)}, projected ${w.projected_psi.toFixed(1)}, personal line ${line.toFixed(1)}`}>
      <div className="absolute inset-x-0 top-6 h-px bg-ink" />
      {Array.from({ length: 11 }, (_, i) => (
        <div key={i} className="absolute top-[1.2rem] h-2.5 w-px bg-ink/50" style={{ left: pct(i) }}>
          {i % 5 === 0 && <span className="mono absolute left-1 top-3 text-[0.6rem] text-muted">{i}</span>}
        </div>
      ))}
      <div className="absolute inset-y-0 top-6 h-6 border-l border-dashed border-ink/50" style={{ left: pct(GENERIC) }}>
        <span className="mono absolute left-1 top-1 whitespace-nowrap text-[0.6rem] text-muted">
          {genericLabel} {GENERIC}
        </span>
      </div>
      <div className="absolute -top-2 h-9 border-l-2 border-oxide" style={{ left: pct(line) }}>
        <span className="mono absolute -top-0.5 right-1 whitespace-nowrap text-[0.62rem] font-semibold text-oxide">
          {lineLabel} {line.toFixed(1)}
        </span>
      </div>
      {rising && (
        <motion.div
          className="absolute top-[1.42rem] h-[3px] bg-oxide/40"
          style={{ left: pct(w.psi) }}
          initial={{ width: 0 }}
          whileInView={{ width: `${(w.projected_psi - w.psi) * 10}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.4 }}
        />
      )}
      {rising && (
        <div
          className="absolute top-[1.1rem] size-3.5 -translate-x-1/2 rounded-full border-2 border-oxide bg-paper"
          style={{ left: pct(w.projected_psi) }}
          title="in 3 h"
        />
      )}
      <motion.div
        className="absolute top-[1.1rem] size-3.5 -translate-x-1/2 rounded-full bg-ink"
        initial={{ left: "0%" }}
        whileInView={{ left: pct(w.psi) }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function eta(w: Worker, localTime: string, t: (k: TKey) => string) {
  if (w.eta_hours === 0) return { text: t("crew.overNow"), hot: true };
  if (w.eta_hours === null) return { text: t("crew.under"), hot: false };
  const d = new Date(localTime);
  d.setHours(d.getHours() + w.eta_hours);
  return { text: `${t("crew.crossesAt")} ${d.toTimeString().slice(0, 5)} — ${t("crew.in")} ${w.eta_hours} h`, hot: true };
}

function WorkerCard({ w, localTime, onChange }: { w: Worker; localTime: string; onChange: () => void }) {
  const { lang, t } = useNabd();
  const ar = lang === "ar";
  const [sent, setSent] = useState<string | null>(null);
  const e = eta(w, localTime, t);
  const firstProjected = w.hr_series.findIndex((p) => p.projected);
  const reports = w.threshold.belief.alpha + w.threshold.belief.beta - 6;

  const send = async (verdict: "confirmed" | "false_alarm") => {
    await api.feedback(w.id, verdict);
    const [subj, poss] = w.role === "site nurse" ? ["she", "Her"] : ["he", "His"];
    if (ar) setSent(verdict === "confirmed" ? "سُجّل: كان متعباً. الحد يضيق." : "سُجّل: إنذار كاذب. الحد يتسع قليلاً.");
    else setSent(verdict === "confirmed" ? `Logged: ${subj} was unwell. ${poss} line tightens.` : `Logged: false alarm. ${poss} line relaxes a little.`);
    onChange();
  };

  return (
    <article className={cn("flex flex-col bg-paper p-5", e.hot && "bg-[color-mix(in_srgb,var(--oxide)_6%,var(--paper))]")}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="display text-3xl">{ar ? NAME_AR[w.name] ?? w.name : w.name}</h3>
          <p className="text-[0.82rem] text-muted">
            <span dir="ltr">{w.role}</span> · {w.age} · {t("crew.day")} {w.days_in_uae} {t("crew.inUae")}
          </p>
        </div>
        <div className="text-end">
          <span className="block text-lg leading-none">{LANG_LABEL[w.language] ?? w.language}</span>
          {w.fasting && (
            <span className="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-gulf">
              <MoonStar className="size-3" /> {t("crew.fasting")}
            </span>
          )}
        </div>
      </header>

      <StrainScale w={w} lineLabel={t("crew.line")} genericLabel={t("crew.generic")} />

      <p className={cn("display mt-2 text-xl italic", e.hot ? "text-oxide" : "text-gulf")}>{e.text}</p>
      <p dir="ltr" className="mono mt-1 text-start text-[0.68rem] text-muted">
        PSI {w.psi.toFixed(1)} → {w.projected_psi.toFixed(1)} · HR {Math.round(w.hr)} · core {w.core_temp.toFixed(1)}°C
      </p>

      <div className="mt-3">
        <Spark
          height={46}
          lines={[{ values: w.hr_series.map((p) => p.hr), color: "var(--ink)", width: 1.2, dashedFrom: firstProjected > 0 ? firstProjected : undefined }]}
        />
        <p className="text-[0.62rem] text-muted">{t("crew.hr")}</p>
      </div>

      {w.symptoms.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-1.5">
          {w.symptoms.map((sym) => (
            <span key={sym} className="mono rounded-full bg-oxide px-2 py-0.5 text-[0.65rem] text-paper">
              {sym.replace("_", " ")}
            </span>
          ))}
        </p>
      )}

      <ul dir="ltr" className="mt-4 space-y-1 text-start text-[0.78rem] leading-snug text-muted">
        {w.threshold.reasons.map((r) => (
          <li key={r}>— {r}</li>
        ))}
      </ul>
      {reports > 0 && (
        <p className="mt-1 text-[0.78rem] text-muted">
          — {t("crew.learned")} {reports}
        </p>
      )}

      <footer className="mt-auto border-t border-[var(--rule)] pt-4">
        {sent ? (
          <p className="text-[0.78rem] text-gulf">{sent}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.75rem] text-muted">{t("crew.after")}</span>
            <button className="chip !py-1 !text-[0.75rem]" onClick={() => send("confirmed")}>
              {t("crew.unwell")}
            </button>
            <button className="chip !py-1 !text-[0.75rem]" onClick={() => send("false_alarm")}>
              {t("crew.fine")}
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}

export function Crew() {
  const { snapshot: s, refresh, ramadan, t } = useNabd();
  if (!s) return null;
  const crew = [...s.crew].sort((a, b) => (a.eta_hours ?? 99) - (b.eta_hours ?? 99) || b.projected_psi - a.projected_psi);
  const crossing = crew.filter((w) => w.eta_hours !== null).length;

  return (
    <section id="crew" className="gutter section">
      <SectionHead
        folio="06"
        kicker={t("crew.kicker")}
        arabic="الطاقم"
        title={t("crew.title")}
        aside={
          <>
            {t("crew.aside")}
            {ramadan && <strong className="mt-2 block text-gulf">{t("crew.ramadanOn")}</strong>}
          </>
        }
      />

      <Reveal className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-ink pb-4">
        <span className="display text-6xl tabular-nums">{crossing}</span>
        <span className="display text-2xl italic">
          {t("crew.of")} {crew.length} {t("crew.cross")}
        </span>
        <span className="ms-auto text-[0.72rem] text-muted">{t("crew.sim")}</span>
      </Reveal>

      <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2 xl:grid-cols-4">
        {crew.map((w) => (
          <WorkerCard key={w.id} w={w} localTime={s.local_time} onChange={refresh} />
        ))}
      </div>
    </section>
  );
}
