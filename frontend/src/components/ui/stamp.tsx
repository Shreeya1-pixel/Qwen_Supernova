"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Level } from "@/lib/api";
import { LEVEL_COPY, cn } from "@/lib/format";

/** The council's verdict, inked like a rubber stamp on a site permit. */
export function Stamp({ level, state, className }: { level: Level; state: string; className?: string }) {
  const reduced = useReducedMotion();
  const copy = LEVEL_COPY[level];
  const note = state === "converged" ? "checks agree" : state === "diverged" ? "checks disagree · human decides" : "held · data untrusted";
  return (
    <motion.div
      key={`${level}-${state}`}
      initial={reduced ? false : { scale: 1.6, opacity: 0, rotate: -14 }}
      animate={{ scale: 1, opacity: 1, rotate: -6 }}
      transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.2 }}
      className={cn("inline-block select-none p-1", className)}
      style={{ color: copy.tone }}
    >
      <div className="border-[3px] border-current px-5 py-3 text-center outline outline-1 outline-offset-[3px] outline-current">
        <div className="display text-[clamp(1.7rem,3.2vw,2.6rem)] uppercase leading-none tracking-wide">{copy.en}</div>
        <div className="arabic mt-1 text-xl leading-none">{copy.ar}</div>
        <div className="eyebrow mt-2 !text-[0.6rem]">{note}</div>
      </div>
    </motion.div>
  );
}
