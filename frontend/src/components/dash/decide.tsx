"use client";

import { Activity, Database, Link2, Mountain, ShieldCheck, Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AuditRecord } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { LANG_LABEL, cn } from "@/lib/format";
import { Bar, LevelPill, Loading, Panel, levelTone } from "./ui";

const AGENT = {
  environment: { icon: Mountain, key: "read.land", reads: "read.landReads" },
  physiology: { icon: Activity, key: "read.body", reads: "read.bodyReads" },
  integrity: { icon: Database, key: "read.data", reads: "read.dataReads" },
} as const;

export function CouncilPanel({ className, detailed = false }: { className?: string; detailed?: boolean }) {
  const { snapshot: s, t } = useNabd();
  if (!s) return <Panel title={t("dash.council")} className={className}><Loading /></Panel>;
  const c = s.council;
  const banner = { converged: t("read.converged"), diverged: t("read.diverged"), hold: t("read.hold") }[c.state];
  return (
    <Panel title={t("dash.council")} action={<LevelPill level={c.label} solid />} className={className}>
      <ul className="space-y-3">
        {c.agents.map((a) => {
          const meta = AGENT[a.agent as keyof typeof AGENT];
          const Icon = meta?.icon ?? ShieldCheck;
          return (
            <li key={a.agent}>
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${levelTone(a.label)} 16%, transparent)`, color: levelTone(a.label) }}>
                  <Icon className="size-3.5" />
                </span>
                <span className="flex-1 text-[0.85rem] font-bold">{meta ? t(meta.key) : a.agent}</span>
                <LevelPill level={a.label} />
              </div>
              <div className="ms-9 mt-1.5">
                <Bar value={a.confidence} tone={levelTone(a.label)} />
                <span className="label mt-1 block" dir="ltr">
                  {t("read.confidence")} {Math.round(a.confidence * 100)}%
                </span>
                {(detailed ? a.reasons : a.reasons.slice(0, 1)).map((r) => (
                  <p key={r} className="mt-0.5 text-[0.78rem] leading-snug text-muted" dir="ltr">
                    {r}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className={cn("mt-3 rounded-lg px-3 py-2 text-[0.78rem] font-semibold", c.state === "converged" ? "bg-gulf/10 text-gulf" : "bg-oxide/10 text-oxide")}>{banner}</p>
    </Panel>
  );
}

export function PlaybookPanel({ className, detailed = false }: { className?: string; detailed?: boolean }) {
  const { snapshot: s, t } = useNabd();
  if (!s) return <Panel title={t("dash.playbook")} className={className}><Loading /></Panel>;
  const pb = s.playbook;
  const alerts = (pb.alerts as { worker: string; language: string; psi: number; threshold: number; dry_run: boolean }[]) ?? [];
  return (
    <Panel
      title={t("dash.playbook")}
      action={<span className={cn("pill", pb.executed ? "bg-oxide/12 text-oxide" : "bg-gulf/12 text-gulf")}>{pb.executed ? t("act.auto") : t("act.human")}</span>}
      className={className}
    >
      <ol className="space-y-2">
        {pb.actions.map((a, i) => (
          <li key={a.type} className="grid grid-cols-[1.6rem_1fr] gap-2">
            <span className="num grid size-6 place-items-center rounded-full bg-ink text-[0.72rem] text-paper">{i + 1}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.86rem] font-bold">{a.title}</span>
                {a.dry_run && <span className="label rounded-full border border-[var(--line)] px-1.5">{t("act.dry")}</span>}
              </div>
              {a.type === "work_rest" && (
                <div className="mt-1 flex items-center gap-2" dir="ltr">
                  <div className="w-28">
                    <Bar value={a.work_minutes_per_hour ?? 0} max={60} tone="var(--oxide)" />
                  </div>
                  <span className="label normal-case">
                    {a.work_minutes_per_hour}′ work / {60 - (a.work_minutes_per_hour ?? 0)}′ rest
                  </span>
                </div>
              )}
              {(detailed || a.type !== "work_rest") && a.detail && (
                <p className={cn("text-[0.76rem] leading-snug text-muted", !detailed && "line-clamp-2")} dir="ltr">
                  {a.detail}
                </p>
              )}
            </div>
          </li>
        ))}
        {!pb.actions.length && <li className="text-sm text-muted">{pb.mode}</li>}
      </ol>
      {alerts.length > 0 && (
        <div className="mt-3 border-t border-[var(--line)] pt-2">
          <span className="label">WhatsApp</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {alerts.map((al) => (
              <span key={al.worker} className="pill bg-sand">
                {al.worker} · {LANG_LABEL[al.language] ?? al.language}
              </span>
            ))}
          </div>
        </div>
      )}
      {pb.actions.some((a) => a.type === "ticket") && (
        <p className="label mt-2 flex items-center gap-1 normal-case">
          <Ticket className="size-3" /> Jira + WhatsApp are dry runs until tokens are set
        </p>
      )}
    </Panel>
  );
}

export function AuditPanel({ className, limit = 6, refresh }: { className?: string; limit?: number; refresh?: number }) {
  const { snapshot: s, t } = useNabd();
  const [chain, setChain] = useState<AuditRecord[]>([]);
  useEffect(() => {
    api.audit(limit).then((r) => setChain(r.records)).catch(() => {});
  }, [limit, s?.playbook.audit.hash, refresh]);

  return (
    <Panel title={t("dash.audit")} action={<Link2 className="size-4 text-muted" />} className={className}>
      <ol dir="ltr" className="space-y-0">
        {chain.map((r, i) => (
          <li key={r.hash} className="relative border-s-2 border-[var(--line)] pb-3 ps-4 last:pb-0">
            <span className={cn("absolute -start-[6px] top-1 size-2.5 rounded-full border-2 border-ink", i === 0 ? "bg-oxide" : "bg-paper")} />
            <div className="flex flex-wrap items-center gap-x-2 text-[0.8rem]">
              <span className="font-bold tabular-nums">{new Date(r.ts * 1000).toTimeString().slice(0, 8)}</span>
              <span className="font-semibold">{r.site}</span>
              <LevelPill level={r.level} />
              <span className="label">{r.state}</span>
              {r.executed && <span className="label text-oxide">executed</span>}
            </div>
            <div className="mono truncate text-[0.68rem] text-muted">
              {r.hash.slice(0, 18)}… ← {r.prev_hash ? r.prev_hash.slice(0, 10) + "…" : "genesis"}
            </div>
            {r.actions.length > 0 && <div className="truncate text-[0.72rem] text-muted">{r.actions.join(" · ")}</div>}
            {r.jira && (
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.74rem]">
                <Ticket className="size-3 shrink-0 text-gulf" />
                {r.jira.url ? (
                  <a href={r.jira.url} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-gulf underline underline-offset-2">
                    {r.jira.key}
                  </a>
                ) : (
                  <span className="label shrink-0">{r.jira.dry_run ? "Jira dry run" : "Jira failed"}</span>
                )}
                <span className="truncate text-muted">{r.jira.summary}</span>
              </div>
            )}
          </li>
        ))}
        {!chain.length && <Loading rows={3} />}
      </ol>
    </Panel>
  );
}
