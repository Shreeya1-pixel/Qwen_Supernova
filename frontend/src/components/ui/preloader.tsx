"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { intro } from "@/lib/intro";

const EASE = [0.76, 0, 0.24, 1] as const;
const SEEN_KEY = "nabd:intro";
const DURATION = 2100;
const TRACE = "M0 40 H70 L78 34 L84 40 H110 L118 6 L128 72 L136 40 H170 L180 30 L192 40 H260";

export function Preloader() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const skip =
      sessionStorage.getItem(SEEN_KEY) === "1" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(
      () => {
        sessionStorage.setItem(SEEN_KEY, "1");
        setVisible(false);
        intro.finish();
      },
      skip ? 0 : DURATION,
    );
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-paper text-ink"
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 0.9, ease: EASE }}
          aria-hidden
        >
          <div className="w-[min(78vw,26rem)]">
            <svg viewBox="0 0 260 80" className="w-full overflow-visible">
              <motion.path
                d={TRACE}
                fill="none"
                stroke="var(--oxide)"
                strokeWidth={2}
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: [0.65, 0, 0.35, 1] }}
              />
            </svg>
            <div className="mt-6 flex items-baseline justify-between border-t border-ink pt-3">
              <motion.span
                className="display text-5xl"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
              >
                Nabd
              </motion.span>
              <motion.span
                className="arabic text-4xl text-oxide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.9 }}
              >
                نبض
              </motion.span>
            </div>
            <p className="eyebrow mt-3 text-muted">Reading the land before the body</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
