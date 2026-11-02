"use client";

import { CornerDownLeft, Eraser, MoonStar } from "lucide-react";
import { useMemo, useState } from "react";
import { api, type IntakeResult, type Worker } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { LANG_LABEL, cn } from "@/lib/format";
import { NAME_AR } from "@/lib/story";
import { Spark } from "@/components/viz/spark";
import { Loading, Panel } from "./ui";

const sortCrew = (crew: Worker[]) => [...crew].sort((a, b) => (a.eta_hours ?? 99) - (b.eta_hours ?? 99) || b.projected_psi - a.projected_psi);

function etaText(w: Worker, localTime: string, now: string) {
  if (w.eta_hours === 0) return now;
  if (w.eta_hours === null) return "—";
  const d = new Date(localTime);
  d.setHours(d.getHours() + w.eta_hours);
  return d.toTimeString().slice(0, 5);
}

function StrainBar({ w }: { w: Worker }) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, v * 10))}%`;
  const over = w.psi >= w.threshold.threshold;
  return (
    <div className="relative h-4" dir="ltr" title={`PSI ${w.psi.toFixed(1)} → ${w.projected_psi.toFixed(1)} · line ${w.threshold.threshold.toFixed(1)}`}>
      <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-[var(--line)]" />
      <div className="absolute top-1.5 h-1 rounded-full" style={{ width: pct(w.psi), background: over ? "var(--oxide)" : "var(--ink)" }} />
      {w.projected_psi > w.psi && <div className="absolute top-1.5 h-1 rounded-e-full bg-oxide/35" style={{ left: pct(w.psi), width: `${(w.projected_psi - w.psi) * 10}%` }} />}
      <div className="absolute top-0 h-4 w-0.5 rounded bg-oxide" style={{ left: pct(w.threshold.threshold) }} />
    </div>
  );
}

export function CrewTable({ className, limit }: { className?: string; limit?: number }) {
  const { snapshot: s, lang, t } = useNabd();
  const ar = lang === "ar";
  if (!s) return <Panel title={t("dash.crew")} className={className}><Loading rows={5} /></Panel>;
  const crew = sortCrew(s.crew).slice(0, limit);
  return (
    <Panel title={t("dash.crew")} action={<span className="label">Moran PSI · personal line</span>} className={className}>
      <table className="w-full text-[0.82rem]">
        <thead>
          <tr className="label border-b border-[var(--line)]">
            <th className="pb-2 text-start font-medium">{t("dash.crew")}</th>
            <th className="w-[38%] pb-2 text-start font-medium">{t("dash.strain")}</th>
            <th className="pb-2 text-end font-medium">PSI</th>
            <th className="pb-2 text-end font-medium">{t("dash.line")}</th>
            <th className="pb-2 text-end font-medium">{t("dash.eta")}</th>
          </tr>
        </thead>
        <tbody>
          {crew.map((w) => {
            const hot = w.eta_hours !== null;
            return (
              <tr key={w.id} className="border-b border-[var(--line)] last:border-0">
                <td className="py-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    {ar ? NAME_AR[w.name] ?? w.name : w.name}
                    {w.fasting && <MoonStar className="size-3 text-gulf" />}
                    {w.symptoms.length > 0 && <span className="size-1.5 rounded-full bg-oxide" title={w.symptoms.join(", ")} />}
                  </div>
                  <div className="label normal-case">
                    {w.role} · {LANG_LABEL[w.language] ?? w.language}
                  </div>
                </td>
                <td className="py-2 pe-3">
                  <StrainBar w={w} />
                </td>
                <td className="py-2 text-end font-bold tabular-nums" dir="ltr">
                  {w.psi.toFixed(1)}
                  <span className="text-muted">→{w.projected_psi.toFixed(1)}</span>
                </td>
                <td className="py-2 text-end font-semibold tabular-nums text-oxide">{w.threshold.threshold.toFixed(1)}</td>
                <td className={cn("py-2 text-end font-bold", hot ? "text-oxide" : "text-gulf")}>{etaText(w, s.local_time, t("dash.now"))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function WorkerCard({ w, localTime }: { w: Worker; localTime: string }) {
  const { refresh, lang, t } = useNabd();
  const ar = lang === "ar";
  const [sent, setSent] = useState<string | null>(null);
  const hot = w.eta_hours !== null;
  const firstProjected = w.hr_series.findIndex((p) => p.projected);

  const send = async (verdict: "confirmed" | "false_alarm") => {
    await api.feedback(w.id, verdict);
    setSent(verdict === "confirmed" ? "Logged: unwell — line tightens" : "Logged: false alarm — line relaxes");
    refresh();
  };

  return (
    <article className={cn("panel flex flex-col gap-2", hot && "!border-oxide/50")}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold leading-tight">{ar ? NAME_AR[w.name] ?? w.name : w.name}</h3>
          <p className="label normal-case">
            {w.role} · {w.age} · day {w.days_in_uae}
          </p>
        </div>
        <div className="text-end">
          <span className="text-[0.85rem] font-bold">{LANG_LABEL[w.language] ?? w.language}</span>
          {w.fasting && (
            <span className="flex items-center justify-end gap-1 text-[0.7rem] font-semibold text-gulf">
              <MoonStar className="size-3" /> {t("crew.fasting")}
            </span>
          )}
        </div>
      </header>
      <div className="flex items-baseline justify-between" dir="ltr">
        <span className={cn("num text-3xl", hot ? "text-oxide" : "")}>{w.psi.toFixed(1)}</span>
        <span className="text-[0.75rem] font-bold text-muted">
          → {w.projected_psi.toFixed(1)} in 3 h · line <span className="text-oxide">{w.threshold.threshold.toFixed(1)}</span>
        </span>
      </div>
      <StrainBar w={w} />
      <p className={cn("text-[0.8rem] font-bold", hot ? "text-oxide" : "text-gulf")}>
        {w.eta_hours === 0 ? t("crew.overNow") : w.eta_hours === null ? t("crew.under") : `${t("crew.crossesAt")} ${etaText(w, localTime, "")}`}
      </p>
      <Spark height={40} lines={[{ values: w.hr_series.map((p) => p.hr), color: "var(--ink)", width: 1.2, dashedFrom: firstProjected > 0 ? firstProjected : undefined }]} />
      <span className="label" dir="ltr">
        HR {Math.round(w.hr)} · core {w.core_temp.toFixed(1)}°C · HRV {Math.round(w.hrv_rmssd)} ms
      </span>
      {w.symptoms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {w.symptoms.map((x) => (
            <span key={x} className="pill bg-oxide text-paper">
              {x.replace("_", " ")}
            </span>
          ))}
        </div>
      )}
      <ul className="space-y-0.5 text-[0.74rem] leading-snug text-muted" dir="ltr">
        {w.threshold.reasons.map((r) => (
          <li key={r}>· {r}</li>
        ))}
      </ul>
      <footer className="mt-auto border-t border-[var(--line)] pt-2">
        {sent ? (
          <p className="text-[0.75rem] font-semibold text-gulf">{sent}</p>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="label me-auto">{t("crew.after")}</span>
            <button className="pill border border-[var(--line)] hover:border-ink" onClick={() => send("confirmed")}>
              {t("crew.unwell")}
            </button>
            <button className="pill border border-[var(--line)] hover:border-ink" onClick={() => send("false_alarm")}>
              {t("crew.fine")}
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}

export function CrewGrid() {
  const { snapshot: s } = useNabd();
  if (!s) return <Loading rows={6} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {sortCrew(s.crew).map((w) => (
        <WorkerCard key={w.id} w={w} localTime={s.local_time} />
      ))}
    </div>
  );
}

const SAMPLES: Record<string, string> = {
  hi: "bhai sar ghoom raha hai, dizzy and vomiting",
  ur: "seene mein dard, saans nahi aa rahi",
  ml: "thala karangunnu, vellam illa",
  tl: "nahihilo ako, walang tubig",
  ta: "thalai vali, thanni illa, very tired",
  ar: "mafi mai w rasi y3awerni",
  bn: "matha ghurche, bomi hocche",
};

const SEVERITY = {
  none: { label: "Nothing recognised", tone: "var(--muted)" },
  low: { label: "Low", tone: "var(--sun)" },
  high: { label: "High — stop and cool", tone: "var(--oxide)" },
  emergency: { label: "Emergency", tone: "var(--oxide)" },
} as const;

export function IntakePanel({ className, large = false }: { className?: string; large?: boolean }) {
  const { snapshot: s, refresh, lang, t } = useNabd();
  const ar = lang === "ar";
  const crew = useMemo(() => s?.crew ?? [], [s]);
  const [picked, setPicked] = useState("");
  const [draft, setDraft] = useState<{ worker: string; text: string } | null>(null);
  const [answer, setAnswer] = useState<{ worker: string; result: IntakeResult } | null>(null);
  const [busy, setBusy] = useState(false);

  const worker = crew.find((w) => w.id === picked) ?? crew[0];
  const workerId = worker?.id ?? "";
  const text = draft?.worker === workerId ? draft.text : (SAMPLES[worker?.language ?? ""] ?? "");
  const result = answer?.worker === workerId ? answer.result : null;

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setAnswer({ worker: workerId, result: await api.intake(text, workerId || undefined) });
      refresh();
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    await api.clearSymptoms(workerId);
    setAnswer(null);
    refresh();
  };

  return (
    <Panel title={t("dash.intake")} action={<span className="label">8 languages · on-device</span>} className={className}>
      <div className="flex flex-wrap gap-1.5">
        {crew.map((w) => (
          <button
            key={w.id}
            onClick={() => {
              setPicked(w.id);
              setDraft(null);
            }}
            className={cn("pill border", w.id === workerId ? "border-ink bg-ink text-paper" : "border-[var(--line)] hover:border-ink")}
          >
            {ar ? NAME_AR[w.name] ?? w.name : w.name}
            <span className="opacity-60">{LANG_LABEL[w.language]}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 rounded-lg border border-[var(--line)] bg-paper focus-within:border-ink">
        <textarea
          value={text}
          onChange={(e) => setDraft({ worker: workerId, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={large ? 3 : 2}
          dir="auto"
          placeholder={t("words.placeholder")}
          className="block w-full resize-none bg-transparent px-3 py-2 text-[0.95rem] font-semibold focus:outline-none"
        />
        <div className="flex items-center justify-between border-t border-[var(--line)] px-2 py-1.5">
          <span className="label normal-case">{t("words.hint")}</span>
          <div className="flex gap-1.5">
            {worker && worker.symptoms.length > 0 && (
              <button onClick={clear} className="pill border border-[var(--line)]">
                <Eraser className="size-3" /> {t("words.clear")}
              </button>
            )}
            <button onClick={submit} disabled={busy} className="pill bg-ink text-paper">
              {t("words.send")} <CornerDownLeft className="size-3" />
            </button>
          </div>
        </div>
      </div>
      {result ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="label">{t("words.languages")}</span>
              <p className="text-[0.85rem] font-bold">
                {result.languages.map((l) => LANG_LABEL[l] ?? l).join(" + ") || "—"}
                {result.code_switched && <span className="block text-[0.7rem] font-semibold text-sun">{t("words.switched")}</span>}
              </p>
            </div>
            <div>
              <span className="label">{t("words.symptoms")}</span>
              <p className="text-[0.85rem] font-bold capitalize" dir="ltr">
                {result.symptoms.map((x) => x.replace("_", " ")).join(", ") || "—"}
              </p>
            </div>
            <div>
              <span className="label">{t("words.severity")}</span>
              <p className="text-[0.85rem] font-bold" style={{ color: SEVERITY[result.severity].tone }}>
                {SEVERITY[result.severity].label}
              </p>
            </div>
          </div>
          {result.reply && (
            <div className="rounded-lg border-s-4 border-oxide bg-paper px-3 py-2">
              <span className="label">
                {t("words.replied")} {LANG_LABEL[result.language] ?? result.language_name}
              </span>
              <p dir={["ar", "ur"].includes(result.language) ? "rtl" : "ltr"} className={cn("text-[1rem] font-semibold", ["ar", "ur"].includes(result.language) && "arabic")}>
                {result.reply}
              </p>
            </div>
          )}
          {worker && result.symptoms.length > 0 && (
            <p className="label normal-case text-oxide" dir="ltr">
              → {worker.name}: +{worker.symptom_boost.toFixed(1)} PSI · council re-voted
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[0.8rem] text-muted">{t("words.empty")}</p>
      )}
    </Panel>
  );
}
