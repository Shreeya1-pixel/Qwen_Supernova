"use client";

import { ArrowLeft, BadgeCheck, CheckCheck, ChevronLeft, ChevronRight, MoreVertical, Phone, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { NotifyResult } from "@/lib/api";
import { useNabd } from "@/lib/store";

export interface PhoneThread {
  id: string;
  name: string;
  language: string;
  demo?: boolean;
  result: NotifyResult;
  at: number;
}

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/** A worker's phone showing the alert as it lands in WhatsApp. Demo preview unless the backend really sent it. */
export function WhatsAppPhone({
  threads,
  index,
  onIndex,
  onClose,
}: {
  threads: PhoneThread[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useNabd();
  const thread = threads[index];
  const [revealed, setRevealed] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(thread.id), 900);
    return () => clearTimeout(timer);
  }, [thread.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < threads.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, threads.length, onIndex, onClose]);

  const { result } = thread;
  const owner = thread.demo ? thread.name : t("scen.exp.phone").replace("{name}", thread.name);
  const shown = revealed === thread.id;
  const parts = result.message.split(/\n\s*\n/).filter(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={owner}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onIndex(index - 1)}
          disabled={index === 0}
          aria-label="Previous"
          className="rounded-full bg-white/15 p-2 text-white disabled:invisible"
        >
          <ChevronLeft className="size-6" />
        </button>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-white">
            <span className="text-[1rem] font-extrabold">{owner}</span>
            <span
              className={
                result.sent
                  ? "rounded-full bg-[#25d366] px-2.5 py-0.5 text-[0.72rem] font-black uppercase text-black"
                  : "rounded-full bg-[#ffd60a] px-2.5 py-0.5 text-[0.72rem] font-black uppercase text-black"
              }
            >
              {result.sent ? t("scen.exp.sentBadge") : t("scen.exp.demoBadge")}
            </span>
            {threads.length > 1 && (
              <span className="num text-[0.85rem] text-white/60">
                {index + 1}/{threads.length}
              </span>
            )}
          </div>

          <div className="h-[640px] w-[320px] rounded-[46px] bg-[#111] p-[10px] shadow-2xl ring-1 ring-white/20">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-[#efeae2]">
              <div className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
              <div className="flex items-center justify-between bg-[#008069] px-6 pb-1 pt-2.5 text-[0.75rem] font-bold text-white">
                <span className="num">{clock(thread.at)}</span>
                <span>5G ▮▮▮</span>
              </div>

              <div className="flex items-center gap-2 bg-[#008069] px-3 pb-2.5 pt-1 text-white">
                <ArrowLeft className="size-5" />
                <span className="flex size-9 items-center justify-center rounded-full bg-[#25d366] text-[0.85rem] font-black text-[#073b2a]">
                  نبض
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="flex items-center gap-1 truncate text-[0.95rem] font-bold">
                    {t("scen.exp.business")} <BadgeCheck className="size-4 fill-[#25d366] text-[#008069]" />
                  </p>
                  <p className="text-[0.7rem] text-white/80">{shown ? t("scen.exp.verified") : t("scen.exp.typing")}</p>
                </div>
                <Video className="size-5" />
                <Phone className="size-4" />
                <MoreVertical className="size-5" />
              </div>

              <div
                className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
                  backgroundSize: "18px 18px, 26px 26px",
                  backgroundPosition: "0 0, 9px 13px",
                }}
              >
                <p className="mx-auto w-fit rounded-md bg-white/90 px-2 py-0.5 text-[0.68rem] font-semibold text-[#54656f] shadow-sm">
                  {t("scen.exp.today")}
                </p>
                <p className="mx-auto w-fit max-w-[90%] rounded-md bg-[#ffeecd] px-2 py-1 text-center text-[0.66rem] text-[#54656f] shadow-sm">
                  {t("scen.exp.official")}
                </p>

                {shown ? (
                  <div className="relative max-w-[85%] rounded-lg rounded-tl-none bg-white px-2.5 pb-1 pt-1.5 text-[0.86rem] leading-snug text-[#111b21] shadow-sm">
                    <p className="mb-0.5 text-[0.72rem] font-bold text-[#008069]">⚠️ {t("scen.exp.business")}</p>
                    {parts.map((part, i) => (
                      <p key={i} dir="auto" className={i ? "mt-1.5 border-t border-black/10 pt-1.5 text-[#54656f]" : ""}>
                        {part}
                      </p>
                    ))}
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[0.65rem] text-[#667781]">
                      <span className="num">{clock(thread.at)}</span>
                      <CheckCheck className={result.sent ? "size-3.5 text-[#53bdeb]" : "size-3.5"} />
                    </p>
                  </div>
                ) : (
                  <div className="flex w-fit gap-1 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="size-2 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 bg-[#f0f2f5] px-2 py-2">
                <div className="flex-1 rounded-full bg-white px-4 py-2 text-[0.8rem] text-[#8696a0]">{t("scen.exp.reply")}</div>
                <span className="flex size-9 items-center justify-center rounded-full bg-[#008069] text-white">🎤</span>
              </div>
            </div>
          </div>

          <p className="max-w-[320px] text-center text-[0.75rem] font-semibold text-white/70">
            {result.sent ? `${t("scen.exp.sent")} ${result.to ?? ""}` : t("scen.exp.demoNote")}
          </p>
        </div>

        <button
          onClick={() => onIndex(index + 1)}
          disabled={index >= threads.length - 1}
          aria-label="Next"
          className="rounded-full bg-white/15 p-2 text-white disabled:invisible"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 rounded-full bg-white/15 p-2 text-white">
        <X className="size-5" />
      </button>
    </div>
  );
}
