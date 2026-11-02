"use client";

import { Link2, MessageCircle, Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Markets } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { LANG_LABEL, LEVEL_COPY, cn } from "@/lib/format";
import { NAME_AR } from "@/lib/story";
import { SectionHead } from "@/components/ui/section-head";
import { Reveal } from "@/components/ui/reveal";

type AuditRecord = Awaited<ReturnType<typeof api.audit>>["records"][number];

export function Act() {
  const { snapshot: s, lang, t } = useNabd();
  const [markets, setMarkets] = useState<Markets | null>(null);
  const [chain, setChain] = useState<AuditRecord[]>([]);
  const ar = lang === "ar";

  useEffect(() => {
    api.markets().then(setMarkets).catch(() => {});
  }, []);
  useEffect(() => {
    api.audit(5).then((r) => setChain(r.records)).catch(() => {});
  }, [s?.playbook.audit.hash]);

  if (!s) return null;
  const pb = s.playbook;
  const alerts = (pb.alerts as { worker: string; language: string; psi: number; threshold: number; dry_run: boolean }[]) ?? [];
  const brent = markets?.quotes.find((q) => q.key === "brent");

  return (
    <section id="act" className="gutter section bg-paper-2/50">
      <SectionHead folio="09" kicker={t("act.kicker")} arabic="ماذا بعد" title={t("act.title")} aside={t("act.aside")} />

      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink pb-3">
            <span className={cn("mono text-xs font-semibold uppercase tracking-widest", pb.executed ? "text-oxide" : "text-gulf")}>
              {pb.executed ? t("act.auto") : t("act.human")}
            </span>
            <span className={ar ? "arabic text-lg" : "display text-xl italic"} style={{ color: LEVEL_COPY[s.council.label].tone }}>
              {ar ? LEVEL_COPY[s.council.label].ar : LEVEL_COPY[s.council.label].en}
            </span>
          </div>
          <ol className="divide-y divide-[var(--rule)]">
            {pb.actions.map((a, i) => (
              <Reveal key={a.type} delay={i * 0.05}>
                <li className="grid grid-cols-[2.5rem_1fr] gap-3 py-5">
                  <span className="folio text-3xl leading-none">{i + 1}</span>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="display text-2xl">{a.title}</h3>
                      {a.dry_run && <span className="mono rounded-full border border-current px-2 text-[0.6rem] uppercase text-muted">{t("act.dry")}</span>}
                    </div>
                    {a.detail && <p className="mt-1 text-[0.92rem] leading-relaxed text-muted" dir="ltr">{a.detail}</p>}
                    {a.type === "work_rest" && (
                      <div className="mt-3 flex items-center gap-3" dir="ltr">
                        <div className="flex h-3 w-48 border border-ink">
                          <div className="h-full bg-oxide" style={{ width: `${((a.work_minutes_per_hour ?? 0) / 60) * 100}%` }} />
                        </div>
                        <span className="mono text-xs text-muted">
                          {a.work_minutes_per_hour} min work / {60 - (a.work_minutes_per_hour ?? 0)} min rest · {a.rule}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              </Reveal>
            ))}
            {pb.actions.length === 0 && <li className="py-6 text-muted">{pb.mode}</li>}
          </ol>

          {alerts.length > 0 && (
            <div className="mt-6 border-t border-ink pt-4">
              <p className="eyebrow flex items-center gap-2 text-muted">
                <MessageCircle className="size-3.5" /> WhatsApp
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {alerts.map((al) => (
                  <li key={al.worker} className="chip !cursor-default">
                    {ar ? NAME_AR[al.worker] ?? al.worker : al.worker} · {LANG_LABEL[al.language] ?? al.language}
                    <span className="mono ms-2 text-[0.65rem] text-muted" dir="ltr">
                      {al.psi.toFixed(1)}/{al.threshold.toFixed(1)}
                      {al.dry_run ? ` · ${t("act.dry")}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-10 lg:col-span-5">
          <Reveal className="border-2 border-ink p-6">
            <p className="eyebrow text-muted">{t("act.cost")}</p>
            <div className="mt-2 flex items-baseline gap-3" dir="ltr">
              <span className="display text-7xl tabular-nums">{markets?.cooling_aed_per_hour ?? "—"}</span>
              <span className="mono text-sm text-muted">{t("act.perHour")}</span>
            </div>
            <p className="mono mt-3 text-[0.7rem] leading-relaxed text-muted" dir="ltr">
              6 L/h generator · diesel {markets?.aed_per_litre_wholesale ?? "—"} AED/L wholesale
              {brent && ` · Brent $${brent.price.toFixed(2)} (${brent.change_pct >= 0 ? "+" : ""}${brent.change_pct.toFixed(2)}%)`}
              <br />
              {markets?.source ?? ""}
            </p>
          </Reveal>

          <div>
            <p className="eyebrow flex items-center gap-2 text-muted">
              <Link2 className="size-3.5" /> {t("act.audit")}
            </p>
            <ol dir="ltr" className="mono mt-3 space-y-0 text-[0.7rem]">
              {chain.map((r, i) => (
                <li key={r.hash} className="relative border-s border-ink ps-4 pb-4 last:pb-0">
                  <span className={cn("absolute -start-[5px] top-1 size-2.5 rounded-full border border-ink", i === 0 ? "bg-oxide" : "bg-paper")} />
                  <div className="flex flex-wrap gap-x-3 text-ink">
                    <span>{new Date(r.ts * 1000).toTimeString().slice(0, 8)}</span>
                    <span>{r.site}</span>
                    <span style={{ color: LEVEL_COPY[r.level]?.tone }}>{r.level}</span>
                    <span className="text-muted">{r.state}</span>
                  </div>
                  <div className="truncate text-muted">
                    {r.hash.slice(0, 20)}… ← {t("act.prev")} {r.prev_hash ? r.prev_hash.slice(0, 12) + "…" : "genesis"}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {s.playbook.actions.some((a) => a.type === "ticket") && (
            <p className="flex items-center gap-2 text-[0.8rem] text-muted">
              <Ticket className="size-4" /> Jira + WhatsApp run in dry-run until tokens are set.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
