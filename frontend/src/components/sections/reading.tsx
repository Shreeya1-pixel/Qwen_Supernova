"use client";

import { motion } from "framer-motion";
import { Feather } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { LEVEL_COPY, cn } from "@/lib/format";
import { SectionHead } from "@/components/ui/section-head";
import { Reveal } from "@/components/ui/reveal";
import { Spark } from "@/components/viz/spark";

const AGENT_KEYS = {
  environment: { title: "read.land", reads: "read.landReads", ar: "البيئة" },
  physiology: { title: "read.body", reads: "read.bodyReads", ar: "الجسد" },
  integrity: { title: "read.data", reads: "read.dataReads", ar: "النزاهة" },
} as const;

export function Reading() {
  const { snapshot: s, lang, t } = useNabd();
  const ar = lang === "ar";
  const [briefing, setBriefing] = useState<{ key: string; text: string; source: string } | null>(null);
  const [writing, setWriting] = useState(false);

  if (!s) return null;
  const key = `${s.site.id}|${s.replay}`;
  const brief = briefing?.key === key ? briefing : null;

  const write = async () => {
    setWriting(true);
    try {
      setBriefing({ key, ...(await api.briefing(s.site.id, s.replay)) });
    } catch (e) {
      setBriefing({ key, text: (e as Error).message, source: "error" });
    } finally {
      setWriting(false);
    }
  };

  const verdict = t(s.council.state === "converged" ? "read.converged" : s.council.state === "diverged" ? "read.diverged" : "read.hold");

  return (
    <section id="reading" className="gutter section bg-paper-2/50">
      <SectionHead
        folio="03"
        kicker={`${t("read.kicker")} · ${ar ? s.site.name_ar : s.site.name}`}
        arabic="القراءة"
        title={t("read.title")}
        aside={t("read.aside")}
      />

      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow text-muted">{t("read.drivers")}</p>
          <ul className="mt-4 space-y-4">
            {s.index.drivers.map((d, i) => (
              <li key={d.hazard}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="display text-xl">{d.label}</span>
                  <span className="mono text-sm tabular-nums">{Math.round(d.share * 100)}%</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full border border-ink">
                  <motion.div
                    className="h-full"
                    style={{ background: i === 0 ? "var(--oxide)" : "var(--ink)" }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${d.share * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <p className="mono mt-1 text-[0.7rem] text-muted">
                  {t("read.memory")} {d.memory.toFixed(0)} / 100
                </p>
              </li>
            ))}
            {!s.index.drivers.length && <li className="text-muted">—</li>}
          </ul>

          <div className="mt-10">
            <p className="eyebrow text-muted">{t("read.series")}</p>
            <div className="mt-3 border-b border-ink">
              <Spark
                height={120}
                domain={[0, 100]}
                bands={[
                  { y: 25, label: "elevated" },
                  { y: 50, label: "high" },
                  { y: 75, label: "severe" },
                ]}
                lines={[{ values: s.index.series.map((p) => p.value), color: "var(--oxide)", width: 2 }]}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <p className="eyebrow text-muted">{t("read.council")}</p>
          <div className="mt-4 grid gap-px border border-ink bg-ink sm:grid-cols-3">
            {s.council.agents.map((a, i) => {
              const keys = AGENT_KEYS[a.agent as keyof typeof AGENT_KEYS];
              return (
                <Reveal key={a.agent} delay={i * 0.08} className="flex flex-col bg-paper p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="display text-2xl italic">{keys ? t(keys.title) : a.agent}</span>
                    {!ar && keys && <span className="arabic text-sm text-muted">{keys.ar}</span>}
                  </div>
                  <p className="mt-1 text-[0.78rem] leading-snug text-muted">{keys ? t(keys.reads) : ""}</p>
                  <p
                    className={cn("mt-5 text-sm font-semibold", !ar && "mono uppercase")}
                    style={{ color: LEVEL_COPY[a.label].tone }}
                  >
                    {ar ? LEVEL_COPY[a.label].ar : LEVEL_COPY[a.label].en}
                  </p>
                  <div className="mt-2 flex gap-1" aria-label={`level ${a.level} of 4`}>
                    {[0, 1, 2, 3, 4].map((k) => (
                      <span key={k} className={cn("h-1.5 flex-1", k <= a.level ? "bg-ink" : "bg-ink/10")} />
                    ))}
                  </div>
                  <ul dir="ltr" className="mt-4 space-y-1.5 text-start text-[0.82rem] leading-snug">
                    {a.reasons.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span className="text-oxide">—</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                  <p className="mono mt-auto pt-4 text-[0.68rem] text-muted">
                    {t("read.confidence")} {Math.round(a.confidence * 100)}%
                  </p>
                </Reveal>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="mono text-xs uppercase tracking-widest text-oxide">{s.council.state}</span>
            <span className="display text-xl">{verdict}</span>
          </div>

          <div className="mt-10 border-t border-ink pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="eyebrow text-muted">{t("read.briefing")}</p>
              <button className="btn btn-ink" onClick={write} disabled={writing}>
                <Feather className="size-4" />
                {writing ? t("read.writing") : brief ? t("read.rewrite") : t("read.write")}
              </button>
            </div>
            {brief && (
              <motion.blockquote
                key={brief.text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 border-s-2 border-oxide ps-5"
              >
                <p dir="auto" className="display whitespace-pre-line text-[1.35rem] leading-snug">
                  {brief.text}
                </p>
                <footer className="mono mt-3 text-[0.7rem] text-muted">
                  {brief.source.startsWith("gemini")
                    ? `Written by ${brief.source.replace("gemini:", "")} from the numbers above — not a decision, a summary of one`
                    : `source: ${brief.source} — set GEMINI_API_KEY for a written briefing`}
                </footer>
              </motion.blockquote>
            )}
          </div>

          {s.news && s.news.articles.length > 0 && (
            <div className="mt-10 border-t border-ink pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow text-muted">{t("read.news")}</p>
                <p className="text-[0.75rem] text-muted">{t("read.newsNote")}</p>
              </div>
              <ul className="mt-4 divide-y divide-[var(--rule)]">
                {s.news.articles.map((a) => (
                  <li key={a.link} className="py-3">
                    <a href={a.link} target="_blank" rel="noreferrer" className="group grid grid-cols-[1fr_auto] gap-4">
                      <span
                        dir={a.lang === "ar" ? "rtl" : "ltr"}
                        className={cn("leading-snug group-hover:text-oxide", a.lang === "ar" ? "arabic text-lg" : "display text-lg")}
                      >
                        {a.title}
                      </span>
                      <span className="mono whitespace-nowrap text-[0.65rem] text-muted" dir="ltr">
                        {a.source} · {Math.round(a.age_hours)}h · {a.hazards.join(", ")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
