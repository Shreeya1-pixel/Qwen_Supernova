"use client";

import { AnimatePresence, motion } from "framer-motion";
import { History, MoonStar, Radio, SunMedium } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNabd } from "@/lib/store";
import { clock, cn } from "@/lib/format";

const NAV = [
  ["#land", "nav.land"],
  ["#reading", "nav.reading"],
  ["#tipping", "nav.tipping"],
  ["#reach", "nav.reach"],
  ["#crew", "nav.crew"],
  ["#words", "nav.words"],
  ["#trust", "nav.trust"],
  ["#act", "nav.act"],
  ["#offgrid", "nav.off"],
] as const;

export function Header() {
  const { replay, setReplay, scenarios, ramadan, setRamadan, glare, setGlare, snapshot, loading, lang, setLang, t } = useNabd();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !menu.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500",
        scrolled ? "border-b border-[var(--rule)] bg-paper/90 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="gutter flex h-14 items-center gap-4">
        <a href="#top" className="flex items-baseline gap-2" aria-label="NABD home">
          <span className="display text-2xl">Nabd</span>
          <span className="arabic text-lg text-oxide">نبض</span>
        </a>

        <nav className="ms-6 hidden items-center gap-5 xl:flex" aria-label="Sections">
          {NAV.map(([href, key], i) => (
            <a key={href} href={href} className="group text-[0.82rem] text-muted transition-colors hover:text-ink">
              <span className="folio me-1 text-[0.8rem]">{i + 2}</span>
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <div className="flex items-center rounded-full border border-[var(--rule)] p-0.5 text-[0.8rem]" role="group" aria-label="Language">
            <button className={cn("tab rounded-full px-2.5 py-1.5", lang === "en" && "bg-ink text-paper")} onClick={() => setLang("en")} aria-pressed={lang === "en"}>
              EN
            </button>
            <button className={cn("tab arabic rounded-full px-2.5 py-1 text-[0.95rem]", lang === "ar" && "bg-ink text-paper")} onClick={() => setLang("ar")} aria-pressed={lang === "ar"}>
              ع
            </button>
          </div>
          <div ref={menu} className="relative">
            <div className="flex items-center rounded-full border border-[var(--rule)] p-0.5 text-[0.8rem]">
              <button
                className={cn("tab flex items-center gap-1.5 rounded-full px-3 py-1.5", !replay && "bg-ink text-paper")}
                onClick={() => setReplay(null)}
                aria-pressed={!replay}
              >
                <Radio className="size-3.5" /> {t("hdr.live")}
              </button>
              <button
                className={cn("tab flex items-center gap-1.5 rounded-full px-3 py-1.5", replay && "bg-oxide text-paper")}
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-haspopup="menu"
              >
                <History className="size-3.5" /> {replay ? clock(replay) : t("hdr.replay")}
              </button>
            </div>
            <AnimatePresence>
              {open && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="absolute end-0 top-12 w-[min(92vw,24rem)] border border-ink bg-paper p-2 shadow-[6px_6px_0_var(--ink)]"
                >
                  <p className="eyebrow px-3 pb-2 pt-1 text-muted">{t("hdr.replayHint")}</p>
                  {scenarios.map((s) => (
                    <button
                      key={s.id}
                      role="menuitem"
                      onClick={() => {
                        setReplay(s.at, s.site_id);
                        setOpen(false);
                        document.querySelector("#top")?.scrollIntoView();
                      }}
                      className={cn(
                        "block w-full border-t border-[var(--rule)] px-3 py-3 text-start transition-colors hover:bg-sand",
                        replay === s.at && "bg-sand",
                      )}
                    >
                      <span className="mono text-[0.7rem] text-oxide">{clock(s.at)}</span>
                      <span className="display mt-1 block text-xl">{s.title}</span>
                      <span className="mt-1 block text-[0.8rem] leading-snug text-muted">{s.why}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            className={cn("chip hidden items-center gap-1.5 sm:inline-flex", ramadan && "!border-gulf !bg-gulf !text-paper")}
            onClick={() => setRamadan(!ramadan)}
            aria-pressed={ramadan}
            title="Simulate Ramadan fasting for the crew"
          >
            <MoonStar className="size-3.5" /> {t("hdr.ramadan")}
          </button>
          <button
            className="chip inline-flex items-center gap-1.5"
            onClick={() => setGlare(!glare)}
            aria-pressed={glare}
            title="Maximum contrast for reading in direct sun"
          >
            <SunMedium className="size-3.5" /> <span className="hidden sm:inline">{t("hdr.glare")}</span>
          </button>
          <span
            className={cn("ms-1 size-2 rounded-full", loading ? "bg-sun" : snapshot?.stale ? "bg-oxide" : "bg-gulf", !loading && "beat")}
            title={loading ? "reading…" : snapshot?.stale ? "showing cached data" : "fresh"}
          />
        </div>
      </div>
    </header>
  );
}
