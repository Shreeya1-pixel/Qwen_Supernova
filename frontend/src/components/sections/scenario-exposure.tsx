"use client";

import { BellRing, MessageCircle, Moon, Smartphone, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type ExposureConditions, type NotifyResult } from "@/lib/api";
import { STATUS_COLOR, exposureStatus, type Person } from "@/lib/exposure";
import { useNabd } from "@/lib/store";
import { cn } from "@/lib/format";
import { WhatsAppPhone, type PhoneThread } from "./whatsapp-phone";

export interface PersonNow extends Person {
  minutes: number;
  status: ReturnType<typeof exposureStatus>;
}

/** Who is in the zone, how long they've been outside, and a WhatsApp alert when they pass the live limit. */
export function ScenarioExposure({
  people,
  cond,
  condError,
}: {
  people: PersonNow[];
  cond: ExposureConditions | null;
  condError: boolean;
}) {
  const { t } = useNabd();
  const [wa, setWa] = useState<{ configured: boolean; test_to: string | null } | null>(null);
  const [results, setResults] = useState<Record<string, NotifyResult | "sending">>({});
  const [sentAt, setSentAt] = useState<Record<string, number>>({});
  const [auto, setAuto] = useState(true);
  const [phone, setPhone] = useState<{ ids: string[]; index: number } | null>(null);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    api.whatsappStatus().then(setWa).catch(() => setWa(null));
  }, []);

  const notify = async (p: PersonNow, show?: string[]) => {
    if (!cond) return;
    notified.current.add(p.id);
    setResults((r) => ({ ...r, [p.id]: "sending" }));
    try {
      const res = await api.notifyExposure({
        name: p.name,
        language: p.language,
        minutes: Math.round(p.minutes),
        limit: cond.sun_limit_min,
        wbgt: cond.wbgt,
        demo: p.demo,
        sun: cond.is_day,
      });
      setResults((r) => ({ ...r, [p.id]: res }));
      setSentAt((m) => ({ ...m, [p.id]: Date.now() }));
      if (show) setPhone((cur) => cur ?? { ids: show, index: 0 });
    } catch (err) {
      setResults((r) => ({ ...r, [p.id]: { message: "", sent: false, dry_run: false, to: null, error: String(err) } }));
    }
  };

  useEffect(() => {
    if (!auto || !cond) return;
    for (const p of people) if (p.status === "over" && !notified.current.has(p.id)) void notify(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, cond, people]);

  const over = people.filter((p) => p.status === "over");
  const threads: PhoneThread[] = (phone?.ids ?? []).flatMap((id) => {
    const p = people.find((x) => x.id === id);
    const res = results[id];
    return p && res && res !== "sending" && !res.error
      ? [{ id, name: p.name, language: p.language, demo: p.demo, result: res, at: sentAt[id] ?? Date.now() }]
      : [];
  });

  return (
    <section className="space-y-3 rounded-2xl border border-white/20 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[1.05rem] font-black">{t("scen.exp.title")}</p>
        <span className="num text-[1.4rem]">{people.length}</span>
      </div>

      {cond ? (
        <div className="rounded-xl bg-white/10 p-2.5 text-[0.9rem] font-semibold">
          <p className="flex items-center gap-1.5">
            {cond.is_day ? <Sun className="size-4 text-[#ffd60a]" /> : <Moon className="size-4 text-white/70" />}
            {cond.temp_c.toFixed(1)} °C · {cond.humidity}% RH · {t("scen.exp.feels")} {cond.feels_c.toFixed(0)} °C · UV {cond.uv.toFixed(0)}
          </p>
          <p className="mt-1">
            WBGT <b className="num">{cond.wbgt}</b> °C →{" "}
            <b>{cond.sun_limit_min > 0 ? t("scen.exp.limit").replace("{n}", String(cond.sun_limit_min)) : t("scen.exp.stop")}</b>
          </p>
          <p className="mt-1 text-[0.72rem] font-bold uppercase text-white/50">
            {cond.source}
            {!cond.is_day && ` · ${t("scen.exp.night")}`}
          </p>
        </div>
      ) : (
        <p className="text-[0.85rem] text-white/60">{condError ? t("scen.exp.noCond") : "…"}</p>
      )}

      <ul className="space-y-1.5">
        {people.map((p) => {
          const res = results[p.id];
          const pct = cond && cond.sun_limit_min > 0 ? Math.min(1, p.minutes / cond.sun_limit_min) : 1;
          return (
            <li key={p.id} className={cn("rounded-xl border px-3 py-2", p.demo ? "border-[#25d366]/60" : "border-white/15")}>
              <div className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: STATUS_COLOR[p.status] }} />
                <span className="flex-1 truncate text-[0.95rem] font-extrabold">
                  {p.name} <span className="text-[0.75rem] font-bold uppercase text-white/50">{p.language}</span>
                </span>
                <span className="num text-[1rem]">
                  {Math.round(p.minutes)}
                  {cond && cond.sun_limit_min > 0 ? `/${cond.sun_limit_min}` : ""} min
                </span>
                <button
                  onClick={() => notify(p, [p.id])}
                  disabled={!cond || res === "sending"}
                  aria-label={`${t("scen.exp.notify")} ${p.name}`}
                  className="rounded-lg bg-[#25d366] p-1.5 text-black disabled:opacity-40"
                >
                  <MessageCircle className="size-4" />
                </button>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: STATUS_COLOR[p.status] }} />
              </div>
              {res && res !== "sending" && (
                <div className="mt-2 rounded-lg bg-black/40 p-2 text-[0.78rem] leading-snug">
                  <p className={cn("font-black uppercase", res.sent ? "text-[#25d366]" : res.error ? "text-[#ff8a80]" : "text-[#ffd60a]")}>
                    {res.sent ? `${t("scen.exp.sent")} ${res.to ?? ""}${res.kind === "template" ? " · template" : ""}` : res.error ? res.error : t("scen.exp.dry")}
                  </p>
                  {res.message && <p className="mt-1 line-clamp-2 whitespace-pre-line text-white/85">{res.message}</p>}
                  {res.message && (
                    <button
                      onClick={() => setPhone({ ids: [p.id], index: 0 })}
                      className="mt-1.5 flex items-center gap-1 font-extrabold text-[#25d366]"
                    >
                      <Smartphone className="size-3.5" /> {t("scen.exp.open")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const ids = over.map((p) => p.id);
            over.forEach((p) => void notify(p, ids));
          }}
          disabled={!cond || !over.length}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#ff3b30] px-3 py-2 text-[0.95rem] font-extrabold disabled:opacity-40"
        >
          <BellRing className="size-4" /> {t("scen.exp.notifyAll").replace("{n}", String(over.length))}
        </button>
        <label className="flex items-center gap-1.5 text-[0.85rem] font-bold">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[#25d366]" />
          {t("scen.exp.auto")}
        </label>
      </div>

      <p className="text-[0.75rem] font-semibold text-white/60">
        {wa?.configured
          ? t("scen.exp.waOn").replace("{to}", wa.test_to ?? "—")
          : t("scen.exp.waOff")}{" "}
        {t("scen.exp.sim")}
      </p>

      {phone &&
        threads.length > 0 &&
        createPortal(
          <WhatsAppPhone
            threads={threads}
            index={Math.min(phone.index, threads.length - 1)}
            onIndex={(index) => setPhone((cur) => (cur ? { ...cur, index } : cur))}
            onClose={() => setPhone(null)}
          />,
          document.body,
        )}
    </section>
  );
}
