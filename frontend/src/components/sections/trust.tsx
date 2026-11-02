"use client";

import { motion } from "framer-motion";
import { Bug, ShieldCheck, Skull, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type RedTeamReport } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { cn } from "@/lib/format";
import { SectionHead } from "@/components/ui/section-head";
import { Reveal } from "@/components/ui/reveal";

type Line = { at: string; text: string; tone?: "ok" | "bad" | "warn" | "dim" };

const stamp = () => new Date().toTimeString().slice(0, 8);

export function Trust() {
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

  if (!s) return null;
  const push = (lines: Line[]) =>
    setLogs((l) => ({ site: siteId, lines: [...(l.site === siteId ? l.lines : []), ...lines].slice(-80) }));
  const setReport = (r: RedTeamReport) => setResult({ site: siteId, report: r });

  const redTeam = async () => {
    setBusy(true);
    push([{ at: stamp(), text: `$ mirage --site ${s.site.id} --adaptive`, tone: "dim" }]);
    try {
      const r = await api.redTeam(s.site.id);
      setReport(r);
      for (const res of r.results) {
        const tone = res.outcome === "caught" ? "ok" : res.outcome === "neutralised" ? "warn" : "bad";
        const last = res.attempts[res.attempts.length - 1];
        push([
          { at: stamp(), text: `» ${res.strategy} — ${res.description}`, tone: "dim" },
          ...res.attempts.slice(0, 3).map((a) => ({
            at: stamp(),
            text: `   try ${a.step} · scale ${a.params.scale.toFixed(2)} · ${a.caught_by.length ? "caught by " + a.caught_by.join(", ") : "passed checks"}`,
            tone: a.caught_by.length ? ("ok" as const) : ("warn" as const),
          })),
          ...(res.attempts.length > 3 ? [{ at: stamp(), text: `   … ${res.attempts.length - 3} more, down to scale ${last.params.scale.toFixed(2)}`, tone: "dim" as const }] : []),
          { at: stamp(), text: `   ${res.outcome.toUpperCase()}${res.note ? " — " + res.note : ""}`, tone },
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
    push([{ at: stamp(), text: `$ probes send --site ${s.site.id}${attack ? ` --attack ${attack}` : ""}`, tone: "dim" }]);
    try {
      const r = await api.simulateSensors(s.site.id, attack);
      push(
        r.readings.map((p) => ({
          at: stamp(),
          text: `   ${p.device}  ${p.metrics.temperature.toFixed(1)}°C  ${p.metrics.humidity}%  pm10 ${p.metrics.pm10}  ${p.accepted ? "ACCEPTED" : "REJECTED · " + p.failed.join(", ")}`,
          tone: p.accepted ? "ok" : "bad",
        })),
      );
      push([{ at: stamp(), text: `= trust ${Math.round(r.trust.score * 100)}% · ${r.trust.trusted ? "trusted" : "HOLD — council will not issue an all-clear"}`, tone: r.trust.trusted ? "ok" : "bad" }]);
      refresh();
    } catch (e) {
      push([{ at: stamp(), text: (e as Error).message, tone: "bad" }]);
    } finally {
      setBusy(false);
    }
  };

  const tone = { ok: "text-[#8fd3c7]", bad: "text-[#ff8a65]", warn: "text-sun", dim: "text-paper/45" };
  const counts = report
    ? [
        [report.caught, t("trust.caught"), "text-gulf"],
        [report.neutralised, t("trust.neutralised"), "text-sun"],
        [report.evaded, t("trust.evaded"), "text-oxide"],
      ]
    : null;

  return (
    <section id="trust" className="gutter section">
      <SectionHead folio="08" kicker={t("trust.kicker")} arabic="هل يمكن خداعه؟" title={t("trust.title")} aside={t("trust.aside")} />

      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-4">
          <div className="flex flex-col gap-2">
            <button className="btn btn-oxide justify-start" onClick={redTeam} disabled={busy}>
              <Skull className="size-4" /> {t("trust.redteam")}
            </button>
            <button className="btn btn-line justify-start" onClick={() => probes()} disabled={busy}>
              <ShieldCheck className="size-4" /> {t("trust.honest")}
            </button>
            <button className="btn btn-line justify-start" onClick={() => probes("spoof")} disabled={busy}>
              <Bug className="size-4" /> {t("trust.spoof")}
            </button>
            <button className="btn btn-line justify-start" onClick={() => probes("unsigned")} disabled={busy}>
              <Unplug className="size-4" /> {t("trust.unsigned")}
            </button>
          </div>

          <div className="border-t border-ink pt-4">
            <p className="eyebrow text-muted">{t("trust.score")}</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className={cn("display text-6xl tabular-nums", s.trust.trusted ? "text-ink" : "text-oxide")}>{Math.round(s.trust.score * 100)}</span>
              <span className="mono text-xs uppercase text-muted">{s.council.state}</span>
            </div>
            <ul className="mt-2 space-y-1 text-[0.82rem] text-muted">
              {s.trust.reasons.map((r) => (
                <li key={r}>— {r}</li>
              ))}
            </ul>
          </div>

          {counts && (
            <Reveal className="grid grid-cols-3 border-y border-ink">
              {counts.map(([n, label, c]) => (
                <div key={label as string} className="border-e border-[var(--rule)] py-3 text-center last:border-e-0">
                  <div className={cn("display text-5xl tabular-nums", c as string)}>{n}</div>
                  <div className="eyebrow mt-1 text-muted">{label}</div>
                </div>
              ))}
            </Reveal>
          )}
          {report && report.neutralised > 0 && <p className="text-[0.82rem] leading-relaxed text-muted">{t("trust.neutralNote")}</p>}
        </div>

        <div className="lg:col-span-8">
          <div dir="ltr" className="on-dark border border-ink bg-ink text-paper">
            <div className="flex items-center justify-between border-b border-paper/15 px-4 py-2">
              <span className="mono text-[0.7rem] text-paper/50">mirage · {s.site.id}</span>
              <span className="mono text-[0.7rem] text-paper/50">HMAC-SHA256 · freshness · replay · range · rate · reference · flatline · swarm</span>
            </div>
            <div ref={box} className="no-scrollbar mono h-[26rem] overflow-y-auto p-4 text-[0.78rem] leading-relaxed">
              {log.length === 0 && <p className="max-w-lg text-paper/50">{t("trust.idle")}</p>}
              {log.map((l, i) => (
                <motion.p key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className={cn("whitespace-pre-wrap", tone[l.tone ?? "dim"])}>
                  <span className="me-3 text-paper/30">{l.at}</span>
                  {l.text}
                </motion.p>
              ))}
              {busy && <span className="blink">▍</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
