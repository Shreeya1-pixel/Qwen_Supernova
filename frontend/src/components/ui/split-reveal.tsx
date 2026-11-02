"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useIntroDone } from "@/lib/intro";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Words rise out of a mask one after another. `*wrapped*` words are set in italics. */
export function SplitReveal({
  text,
  delay = 0,
  stagger = 0.045,
  onLoad = false,
}: {
  text: string;
  delay?: number;
  stagger?: number;
  onLoad?: boolean;
}) {
  const reduced = useReducedMotion();
  const introDone = useIntroDone();
  const words = text
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .flatMap((part) => {
      const italic = part.startsWith("*") && part.endsWith("*");
      const clean = italic ? part.slice(1, -1) : part;
      return clean
        .split(/(\s+)/)
        .filter((w) => w.length > 0)
        .map((w) => ({ w, italic }));
    });

  let index = 0;
  return (
    <>
      <span className="sr-only">{text.replace(/\*/g, "")}</span>
      <span aria-hidden>
        {words.map(({ w, italic }, i) => {
          if (/^\s+$/.test(w)) return <span key={i}> </span>;
          const order = index++;
          const shown = { y: "0%", rotate: 0 };
          const motionProps = reduced
            ? {}
            : onLoad
              ? { initial: { y: "115%", rotate: 4 }, animate: introDone ? shown : undefined }
              : { initial: { y: "115%", rotate: 4 }, whileInView: shown, viewport: { once: true, margin: "-8% 0px" } };
          return (
            <span key={i} className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
              <motion.span
                className="inline-block origin-bottom-left"
                transition={{ duration: 1, delay: delay + order * stagger, ease: EASE }}
                {...motionProps}
              >
                {italic ? <em>{w}</em> : w}
              </motion.span>
            </span>
          );
        })}
      </span>
    </>
  );
}
