"use client";

import { History, MoonStar, Radio, SunMedium } from "lucide-react";
import { useNabd } from "@/lib/store";
import { LEVEL_COPY, clock, cn } from "@/lib/format";

export function TopBar() {
  const { sites, siteId, setSiteId, replay, setReplay, scenarios, ramadan, setRamadan, glare, setGlare, lang, setLang, snapshot, loading, t } = useNabd();
  const ar = lang === "ar";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-paper/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 lg:px-6">
        <div className="flex items-baseline gap-2 lg:hidden">
          <span className="num text-[1.6rem]">NABD</span>
          <span className="arabic text-lg text-oxide">نبض</span>
        </div>

        <nav className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto" aria-label="Sites">
          {sites.map((s) => {
            const on = s.id === siteId;
            const tone = LEVEL_COPY[s.level]?.tone ?? "var(--muted)";
            return (
              <button
                key={s.id}
                onClick={() => setSiteId(s.id)}
                aria-pressed={on}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[0.8rem] font-bold transition-colors",
                  on ? "border-ink bg-ink text-paper" : "border-[var(--line)] bg-[var(--panel)] hover:border-ink",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: tone }} />
                {ar ? s.name_ar : s.name}
                <span className={cn("num text-[0.8rem]", on ? "text-paper" : "text-muted")}>{s.error ? "—" : Math.round(s.index)}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="label hidden 2xl:inline" dir="ltr">
            {loading ? "…" : `${t("dash.updated")} ${clock(snapshot?.as_of)}`}
          </span>
          <div className="seg">
            <button aria-pressed={!replay} onClick={() => setReplay(null)} className="flex items-center gap-1.5">
              <Radio className="size-3.5" /> {t("hdr.live")}
            </button>
            <select
              aria-label={t("hdr.replay")}
              className={cn("w-[5.5rem] truncate rounded-full bg-transparent px-2 text-[0.75rem] font-bold outline-none", replay && "w-44 bg-ink text-paper")}
              value={scenarios.find((s) => s.at === replay)?.id ?? ""}
              onChange={(e) => {
                const sc = scenarios.find((s) => s.id === e.target.value);
                if (sc) setReplay(sc.at, sc.site_id);
              }}
            >
              <option value="" disabled>
                {t("hdr.replay")}
              </option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <History className="me-2 ms-0.5 size-3.5 self-center text-muted" />
          </div>
          <div className="seg">
            <button aria-pressed={ramadan} onClick={() => setRamadan(!ramadan)} className="flex items-center gap-1.5">
              <MoonStar className="size-3.5" /> {t("hdr.ramadan")}
            </button>
            <button aria-pressed={glare} onClick={() => setGlare(!glare)} className="flex items-center gap-1.5">
              <SunMedium className="size-3.5" /> {t("hdr.glare")}
            </button>
          </div>
          <div className="seg">
            <button aria-pressed={!ar} onClick={() => setLang("en")}>
              EN
            </button>
            <button aria-pressed={ar} onClick={() => setLang("ar")} className="arabic">
              ع
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
