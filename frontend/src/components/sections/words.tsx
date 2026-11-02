"use client";

import { motion } from "framer-motion";
import { CornerDownLeft, Eraser } from "lucide-react";
import { useMemo, useState } from "react";
import { api, type IntakeResult } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { LANG_LABEL, cn } from "@/lib/format";
import { NAME_AR } from "@/lib/story";
import { SectionHead } from "@/components/ui/section-head";

const SAMPLES: Record<string, string> = {
  hi: "bhai sar ghoom raha hai, dizzy and vomiting",
  ur: "seene mein dard, saans nahi aa rahi",
  ml: "thala karangunnu, vellam illa",
  tl: "nahihilo ako, walang tubig",
  ta: "thalai vali, thanni illa, very tired",
  ar: "mafi mai w rasi y3awerni",
  bn: "matha ghurche, bomi hocche",
};

const SEVERITY_COPY = {
  none: { label: "Nothing recognised", ar: "لم يُتعرّف على شيء", tone: "var(--muted)" },
  low: { label: "Low", ar: "منخفضة", tone: "var(--sun)" },
  high: { label: "High — stop and cool", ar: "عالية — توقّف وتبرّد", tone: "var(--oxide)" },
  emergency: { label: "Emergency", ar: "طارئة", tone: "var(--oxide)" },
} as const;

function Highlighted({ result }: { result: IntakeResult }) {
  const text = result.text;
  const marks = Object.values(result.matches)
    .flat()
    .map((m) => ({ ...m, at: text.toLowerCase().indexOf(m.phrase.toLowerCase()) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.at < cursor) continue;
    out.push(text.slice(cursor, m.at));
    out.push(
      <span key={m.at} className="relative whitespace-nowrap">
        <span className="underline decoration-oxide decoration-2 underline-offset-[0.18em]">{text.slice(m.at, m.at + m.phrase.length)}</span>
        <sup className="mono ms-0.5 text-[0.32em] font-semibold uppercase not-italic text-oxide">{m.language}</sup>
      </span>,
    );
    cursor = m.at + m.phrase.length;
  }
  out.push(text.slice(cursor));
  return <>{out}</>;
}

export function Words() {
  const { snapshot: s, refresh, lang, t } = useNabd();
  const ar = lang === "ar";
  const crew = useMemo(() => s?.crew ?? [], [s]);
  const [picked, setPicked] = useState<string>("");
  const [draft, setDraft] = useState<{ worker: string; text: string } | null>(null);
  const [answer, setAnswer] = useState<{ worker: string; result: IntakeResult } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!s) return null;
  const worker = crew.find((w) => w.id === picked) ?? crew[0];
  const workerId = worker?.id ?? "";
  const text = draft?.worker === workerId ? draft.text : (SAMPLES[worker?.language ?? ""] ?? "");
  const result = answer?.worker === workerId ? answer.result : null;
  const setText = (value: string) => setDraft({ worker: workerId, text: value });
  const setWorkerId = (id: string) => {
    setPicked(id);
    setDraft(null);
  };

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
    if (!workerId) return;
    await api.clearSymptoms(workerId);
    setAnswer(null);
    refresh();
  };

  return (
    <section id="words" className="gutter section on-dark bg-ink text-paper">
      <SectionHead
        folio="07"
        kicker={t("words.kicker")}
        arabic="بكلماتهم"
        title={t("words.title")}
        aside={<span className="text-paper/70">{t("words.aside")}</span>}
      />

      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow text-paper/60">{t("words.who")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {crew.map((w) => (
              <button
                key={w.id}
                className={cn("chip", w.id === workerId && "!border-paper !bg-paper !text-ink")}
                aria-pressed={w.id === workerId}
                onClick={() => {
                  setWorkerId(w.id);
                }}
              >
                {ar ? NAME_AR[w.name] ?? w.name : w.name} <span className="ms-1 opacity-60">{LANG_LABEL[w.language]}</span>
              </button>
            ))}
          </div>

          <label className="eyebrow mt-8 block text-paper/60" htmlFor="intake">
            {t("words.message")}
          </label>
          <div className="mt-3 border border-paper/30 focus-within:border-paper">
            <textarea
              id="intake"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              dir="auto"
              className="block w-full resize-none bg-transparent p-4 text-lg text-paper placeholder:text-paper/40 focus:outline-none"
              placeholder={t("words.placeholder")}
            />
            <div className="flex items-center justify-between border-t border-paper/20 px-3 py-2">
              <span className="text-[0.68rem] text-paper/50">{t("words.hint")}</span>
              <div className="flex gap-2">
                {worker && worker.symptoms.length > 0 && (
                  <button className="btn btn-line !px-3 !py-2 !text-xs" onClick={clear}>
                    <Eraser className="size-3.5" /> {t("words.clear")}
                  </button>
                )}
                <button className="btn !bg-paper !px-4 !py-2 !text-xs !text-ink" onClick={submit} disabled={busy}>
                  {t("words.send")} <CornerDownLeft className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
          <p className="mt-6 text-[0.8rem] leading-relaxed text-paper/60">
            {t("words.try")}{" "}
            <em dir="ltr">&ldquo;ana dayekh w 3atshan&rdquo;</em>, <em dir="ltr">&ldquo;behosh ho gaya&rdquo;</em>,{" "}
            <em dir="ltr">&ldquo;stopped sweating, chakkar&rdquo;</em>
          </p>
        </div>

        <div className="lg:col-span-7">
          {result ? (
            <motion.div key={result.text + result.reply} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <p className="eyebrow text-paper/60">{t("words.heard")}</p>
              <p dir="auto" className="display mt-3 text-[clamp(2rem,4.4vw,3.6rem)] italic leading-[1.05]">
                &ldquo;<Highlighted result={result} />&rdquo;
              </p>

              <dl className="mt-8 grid grid-cols-3 border-y border-paper/25">
                <div className="border-e border-paper/25 py-4 pe-3">
                  <dt className="eyebrow text-paper/50">{t("words.languages")}</dt>
                  <dd className="mt-1 text-lg">
                    {result.languages.map((l) => LANG_LABEL[l] ?? l).join(" + ") || "—"}
                    {result.code_switched && <span className="block text-[0.7rem] text-sun">{t("words.switched")}</span>}
                  </dd>
                </div>
                <div className="border-e border-paper/25 px-3 py-4">
                  <dt className="eyebrow text-paper/50">{t("words.symptoms")}</dt>
                  <dd dir="ltr" className="mt-1 text-start text-lg capitalize">
                    {result.symptoms.map((x) => x.replace("_", " ")).join(", ") || "—"}
                  </dd>
                </div>
                <div className="py-4 ps-3">
                  <dt className="eyebrow text-paper/50">{t("words.severity")}</dt>
                  <dd className="mt-1 text-lg" style={{ color: SEVERITY_COPY[result.severity].tone }}>
                    {ar ? SEVERITY_COPY[result.severity].ar : SEVERITY_COPY[result.severity].label}
                  </dd>
                </div>
              </dl>

              {result.reply && (
                <div className="mt-8">
                  <p className="eyebrow text-paper/60">
                    {t("words.replied")} {LANG_LABEL[result.language] ?? result.language_name}
                  </p>
                  <p
                    dir={["ar", "ur"].includes(result.language) ? "rtl" : "ltr"}
                    className={cn(
                      "mt-3 max-w-[38rem] border-s-2 border-oxide ps-5 text-start text-[clamp(1.25rem,2.2vw,1.7rem)] leading-relaxed",
                      ["ar", "ur"].includes(result.language) && "arabic",
                    )}
                  >
                    {result.reply}
                  </p>
                </div>
              )}
              {worker && result.symptoms.length > 0 && (
                <p dir="ltr" className="mono mt-6 text-start text-[0.72rem] text-sun">
                  → {worker.name}: +{worker.symptom_boost.toFixed(1)} PSI · council re-voted (§03, §06)
                </p>
              )}
            </motion.div>
          ) : (
            <div className="flex h-full min-h-[18rem] items-center justify-center border border-dashed border-paper/25 p-8 text-center">
              <p className="display max-w-sm text-2xl italic text-paper/50">{t("words.empty")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
