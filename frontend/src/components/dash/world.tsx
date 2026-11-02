"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Markets } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { cn } from "@/lib/format";
import { Spark } from "@/components/viz/spark";
import { Bar, Loading, Panel, riskTone } from "./ui";

let marketsCache: { at: number; data: Markets } | null = null;

export function useMarkets() {
  const [data, setData] = useState<Markets | null>(marketsCache?.data ?? null);
  useEffect(() => {
    if (marketsCache && Date.now() - marketsCache.at < 15 * 60_000) return;
    api
      .markets()
      .then((d) => {
        marketsCache = { at: Date.now(), data: d };
        setData(d);
      })
      .catch(() => {});
  }, []);
  return data;
}

const HAZARD_LABEL: Record<string, string> = { heat: "Heat", humidity: "Humidity", dust: "Dust", flood: "Flood", sea_warming: "Sea warming" };

export function NewsPanel({ limit = 6, className }: { limit?: number; className?: string }) {
  const { snapshot: s, t } = useNabd();
  const news = s?.news;
  return (
    <Panel title={t("dash.news")} action={<span className="label">Google News · EN + AR</span>} className={className}>
      {!news ? (
        <Loading />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-5 gap-2">
            {Object.entries(news.pressure).map(([k, v]) => (
              <div key={k}>
                <span className="label block truncate">{HAZARD_LABEL[k] ?? k}</span>
                <Bar value={v} tone={riskTone(v)} />
              </div>
            ))}
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {news.articles.slice(0, limit).map((a) => (
              <li key={a.link} className="py-2">
                <a href={a.link} target="_blank" rel="noreferrer" className="group flex items-start gap-2">
                  <span dir={a.lang === "ar" ? "rtl" : "ltr"} className={cn("flex-1 text-[0.85rem] font-semibold leading-snug group-hover:underline", a.lang === "ar" && "arabic")}>
                    {a.title}
                  </span>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" />
                </a>
                <span className="label" dir="ltr">
                  {a.source} · {Math.round(a.age_hours)} h · {a.hazards.join(", ")}
                </span>
              </li>
            ))}
            {!news.articles.length && <li className="py-3 text-sm text-muted">No UAE weather stories in the last few days.</li>}
          </ul>
        </>
      )}
    </Panel>
  );
}

export function MarketsPanel({ className }: { className?: string }) {
  const m = useMarkets();
  const { t } = useNabd();
  return (
    <Panel title={t("dash.cooling")} action={<span className="label">Yahoo Finance</span>} className={className}>
      {!m ? (
        <Loading rows={2} />
      ) : (
        <div className="space-y-3" dir="ltr">
          <div className="flex items-baseline gap-2">
            <span className="num text-4xl">{m.cooling_aed_per_hour ?? "—"}</span>
            <span className="text-sm font-bold text-muted">AED / hour</span>
          </div>
          <p className="text-[0.75rem] text-muted">6 L/h generator · diesel {m.aed_per_litre_wholesale ?? "—"} AED/L wholesale</p>
          {m.quotes.map((q) => (
            <div key={q.key} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[0.8rem] font-bold">{q.key === "brent" ? "Brent crude" : "Diesel (heating oil)"}</span>
                  <span className={cn("text-[0.72rem] font-bold", q.change_pct >= 0 ? "text-oxide" : "text-gulf")}>
                    {q.change_pct >= 0 ? "+" : ""}
                    {q.change_pct.toFixed(2)}%
                  </span>
                </div>
                <Spark height={28} lines={[{ values: q.series, color: "var(--ink)", width: 1.4 }]} />
              </div>
              <span className="num text-xl">
                {q.price.toFixed(2)}
                <span className="ms-1 text-[0.65rem] font-bold text-muted">{q.unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
