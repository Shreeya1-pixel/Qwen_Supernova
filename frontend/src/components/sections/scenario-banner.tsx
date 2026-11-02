"use client";

import { TriangleAlert } from "lucide-react";
import { useScenario } from "@/lib/scenario";
import { useNabd } from "@/lib/store";
import { cn } from "@/lib/format";

/** Top banner while a zone is active, plus the always-visible honesty tags. */
export function ScenarioBanner({ sample }: { sample: boolean }) {
  const { t } = useNabd();
  const sc = useScenario();
  return (
    <>
      {sc.zone && (
        <div className="pointer-events-none absolute start-4 end-[456px] top-4 z-10 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#ff3b30] px-5 py-3 text-white shadow-2xl">
            <TriangleAlert className="size-7" />
            <span className="text-[1.3rem] font-black tracking-wide">
              {t("scen.banner")}: {t(`scen.h.${sc.hazard}`)}{" "}
              {t("scen.exercise")}
            </span>
          </div>
        </div>
      )}
      <div className="absolute bottom-10 start-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 rtl:translate-x-1/2">
        {sample && (
          <span className="rounded-lg bg-[#ffd60a] px-3 py-2 text-[0.95rem] font-black text-black">
            {t("scen.sample")}
          </span>
        )}
        <span
          className={cn(
            "rounded-lg border-2 border-white bg-black/80 px-3 py-2 text-[1rem] font-black uppercase tracking-wide text-white",
          )}
        >
          {t("scen.sim")}
        </span>
      </div>
    </>
  );
}
