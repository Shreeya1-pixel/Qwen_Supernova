"use client";

import { ExternalLink, Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type JiraTicket } from "@/lib/api";
import { cn } from "@/lib/format";
import { Panel } from "./ui";

type Status = Awaited<ReturnType<typeof api.jiraStatus>>;

export function JiraPanel({ className, onFiled }: { className?: string; onFiled?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<JiraTicket[]>([]);

  useEffect(() => {
    api.jiraStatus().then(setStatus).catch(() => {});
  }, []);

  async function file() {
    setBusy(true);
    try {
      const r = await api.jiraDemo();
      setTickets(r.tickets);
      onFiled?.();
    } finally {
      setBusy(false);
    }
  }

  const live = status?.configured && status.ok;
  const badge = live ? `Connected · ${status?.project}` : status?.configured ? `Token rejected (${status.error})` : "Dry run";

  return (
    <Panel
      title="Jira incidents"
      action={<span className={cn("pill", live ? "bg-gulf/12 text-gulf" : "bg-oxide/12 text-oxide")}>{badge}</span>}
      className={className}
    >
      <p className="text-[0.8rem] leading-snug text-muted">
        Every escalated decision opens a ticket for the safety officer. The ticket key is written into the same hash-chained record, so
        the paper trail and the work queue point at each other.
      </p>
      <button
        type="button"
        onClick={file}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[0.8rem] font-bold text-paper disabled:opacity-50"
      >
        <Ticket className="size-3.5" />
        {busy ? "Filing…" : "File stop-work tickets (15 Jul 13:00)"}
      </button>
      {tickets.length > 0 && (
        <ul className="mt-3 space-y-1.5" dir="ltr">
          {tickets.map((tk) => (
            <li key={tk.summary} className="flex min-w-0 items-center gap-2 text-[0.78rem]">
              {tk.url ? (
                <a href={tk.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-bold text-gulf underline underline-offset-2">
                  {tk.key} <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="label shrink-0">{tk.dry_run ? "dry run" : "failed"}</span>
              )}
              <span className="truncate" title={tk.error ?? tk.summary}>
                {tk.summary}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
