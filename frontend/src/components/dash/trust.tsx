"use client";

import { Bug, ShieldCheck, Skull, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type RedTeamReport } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { cn } from "@/lib/format";
import { Loading, Panel } from "./ui";

type Line = { at: string; text: string; tone?: "ok" | "bad" | "warn" | "dim" };
const stamp = () => new Date().toTimeString().slice(0, 8);
const TONE = { ok: "text-[#8fd3c7]", bad: "text-[#ff8a65]", warn: "text-sun", dim: "text-paper/45" };

export function TrustPanel({ className, consoleHeight = 220 }: { className?: string; consoleHeight?: number }) {
  const { snapshot: s, refresh, t } = useNabd();
  const [logs, setLogs] = useState<{ site: string; lines: Line[] }>({ site: "", lines: [] });
  const [result, setResult] = useState<{ site: string; report: RedTeamReport } | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const siteId = s?.site.id ?? "";
  const log = logs.site === siteId ? logs.lines : [];
  const report = result?.site === siteId ? result.report : null;

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [log.length]);

  if (!s) return <Panel title={t("dash.trust")} className={className}><Loading /></Panel>;

  const push = (lines: Line[]) => setLogs((l) => ({ site: siteId, lines: [...(l.site === siteId ? l.lines : []), ...lines].slice(-80) }));

  const redTeam = async () => {
    setBusy(true);
    push([{ at: stamp(), text: `$ mirage --site ${siteId} --adaptive`, tone: "dim" }]);
    try {
      const r = await api.redTeam(siteId);
      setResult({ site: siteId, report: r });
      for (const res of r.results) {
        const tone = res.outcome === "caught" ? "ok" : res.outcome === "neutralised" ? "warn" : "bad";
        push([
          { at: stamp(), text: `» ${res.strategy} — ${res.attempts.length} tries`, tone: "dim" },
          { at: stamp(), text: `   ${res.outcome.toUpperCase()}${res.attempts.at(-1)?.caught_by.length ? " by " + res.attempts.at(-1)!.caught_by.join(", ") : ""}`, tone },
        ]);
      }
      push([{ at: stamp(), text: `= ${r.caught} caught · ${r.neutralised} neutralised · ${r.evaded} evaded`, tone: r.evaded ? "bad" : "ok" }]);
    } catch (e) {
      push([{ at: stamp(), text: (e as Error).message, tone: "bad" }]);
    } finally {
      setBusy(false);
    }
  };

  const probes = async (attack?: "spoof" | "unsigned") => {
    setBusy(true);
    push([{ at: stamp(), text: `$ probes send --site ${siteId}${attack ? ` --attack ${attack}` : ""}`, tone: "dim" }]);
    try {
      const r = await api.simulateSensors(siteId, attack);
      push(
        r.readings.map((p) => ({
          at: stamp(),
          text: `   ${p.device}  ${p.metrics.temperature.toFixed(1)}°C  ${p.accepted ? "ACCEPTED" : "REJECTED · " + p.failed.join(", ")}`,
          tone: p.accepted ? "ok" : "bad",
        })),
      );
      push([{ at: stamp(), text: `= trust ${Math.round(r.trust.score * 100)}% · ${r.trust.trusted ? "trusted" : "HOLD"}`, tone: r.trust.trusted ? "ok" : "bad" }]);
      refresh();
    } catch (e) {
      push([{ at: stamp(), text: (e as Error).message, tone: "bad" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={t("dash.trust")}
      action={
        <span className={cn("num text-2xl", s.trust.trusted ? "text-gulf" : "text-oxide")} dir="ltr">
          {Math.round(s.trust.score * 100)}%
        </span>
      }
      className={className}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={redTeam} disabled={busy} className="pill justify-center bg-oxide py-1.5 text-paper">
          <Skull className="size-3.5" /> {t("trust.redteam")}
        </button>
        <button onClick={() => probes()} disabled={busy} className="pill justify-center border border-[var(--line)] py-1.5 hover:border-ink">
          <ShieldCheck className="size-3.5" /> {t("trust.honest")}
        </button>
        <button onClick={() => probes("spoof")} disabled={busy} className="pill justify-center border border-[var(--line)] py-1.5 hover:border-ink">
          <Bug className="size-3.5" /> {t("trust.spoof")}
        </button>
        <button onClick={() => probes("unsigned")} disabled={busy} className="pill justify-center border border-[var(--line)] py-1.5 hover:border-ink">
          <Unplug className="size-3.5" /> {t("trust.unsigned")}
        </button>
      </div>
      {report && (
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          {(
            [
              [report.caught, t("trust.caught"), "text-gulf"],
              [report.neutralised, t("trust.neutralised"), "text-sun"],
              [report.evaded, t("trust.evaded"), "text-oxide"],
            ] as const
          ).map(([n, label, c]) => (
            <div key={label} className="rounded-lg bg-paper py-1.5">
              <div className={cn("num text-2xl", c)}>{n}</div>
              <div className="label">{label}</div>
            </div>
          ))}
        </div>
      )}
      <div ref={box} dir="ltr" className="no-scrollbar mono mt-2 overflow-y-auto rounded-lg bg-ink p-3 text-[0.7rem] leading-relaxed text-paper" style={{ height: consoleHeight }}>
        {log.length === 0 && <p className="text-paper/50">{s.trust.reasons.join(" · ") || t("trust.idle")}</p>}
        {log.map((l, i) => (
          <p key={i} className={cn("whitespace-pre-wrap", TONE[l.tone ?? "dim"])}>
            <span className="me-2 text-paper/30">{l.at}</span>
            {l.text}
          </p>
        ))}
        {busy && <span className="blink">▍</span>}
      </div>
    </Panel>
  );
}
