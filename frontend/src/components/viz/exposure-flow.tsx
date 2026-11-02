"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Snapshot } from "@/lib/api";

const LAYERS = ["hazard", "pathway", "cohort", "outcome"] as const;
const HEADS: Record<string, string> = { hazard: "The land", pathway: "How it reaches", cohort: "Who", outcome: "What happens" };
const W = 1100;
const COL_W = 14;

type Graph = Snapshot["exposure"]["graph"];

export function ExposureFlow({ graph, heads = HEADS }: { graph: Graph; heads?: Record<string, string> }) {
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const cols = LAYERS.map((layer) => graph.nodes.filter((n) => n.layer === layer).sort((a, b) => b.risk - a.risk));
    const rows = Math.max(...cols.map((c) => c.length), 1);
    const rowH = 54;
    const H = rows * rowH + 40;
    const colX = (i: number) => 10 + i * ((W - 230) / (LAYERS.length - 1));
    const pos: Record<string, { x: number; y: number; h: number; layer: string; label: string; risk: number }> = {};
    cols.forEach((col, i) => {
      const offset = ((rows - col.length) * rowH) / 2;
      col.forEach((n, j) => {
        const h = 8 + n.risk * 30;
        pos[n.id] = { x: colX(i), y: 40 + offset + j * rowH + rowH / 2, h, layer: n.layer, label: n.label, risk: n.risk };
      });
    });
    return { pos, H, colX };
  }, [graph]);

  const lit = useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    const walk = (dir: "up" | "down") => {
      let grew = true;
      while (grew) {
        grew = false;
        for (const l of graph.links) {
          const [from, to] = dir === "down" ? [l.source, l.target] : [l.target, l.source];
          if (set.has(from) && !set.has(to) && l.flow > 0.01) {
            set.add(to);
            grew = true;
          }
        }
      }
    };
    walk("down");
    const down = new Set(set);
    set.clear();
    set.add(hover);
    walk("up");
    return new Set([...down, ...set]);
  }, [hover, graph.links]);

  const { pos, H, colX } = layout;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Exposure pathways from hazards to health outcomes">
      {LAYERS.map((l, i) => (
        <text key={l} x={colX(i)} y={16} className="eyebrow" fontSize="11" fill="var(--muted)" letterSpacing="0.16em">
          {heads[l].toUpperCase()}
        </text>
      ))}

      {graph.links.map((l, k) => {
        const a = pos[l.source];
        const b = pos[l.target];
        if (!a || !b) return null;
        const on = lit ? lit.has(l.source) && lit.has(l.target) : true;
        const x1 = a.x + COL_W;
        const x2 = b.x;
        const same = a.layer === b.layer;
        const d = same
          ? `M${x1} ${a.y} C ${x1 + 80} ${a.y}, ${x1 + 80} ${b.y}, ${x1} ${b.y}`
          : `M${x1} ${a.y} C ${(x1 + x2) / 2} ${a.y}, ${(x1 + x2) / 2} ${b.y}, ${x2} ${b.y}`;
        return (
          <motion.path
            key={k}
            d={d}
            fill="none"
            stroke={l.flow > 0.5 ? "var(--oxide)" : "var(--ink)"}
            strokeWidth={0.6 + l.flow * 9}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: on ? (l.flow > 0.02 ? 0.25 + l.flow * 0.6 : 0.12) : 0.04 }}
            transition={{ duration: 0.6 }}
          />
        );
      })}

      {Object.entries(pos).map(([id, n]) => {
        const on = lit ? lit.has(id) : true;
        const hot = n.risk >= 0.5;
        return (
          <g
            key={id}
            onMouseEnter={() => setHover(id)}
            onMouseLeave={() => setHover(null)}
            opacity={on ? 1 : 0.25}
            className="cursor-default transition-opacity duration-300"
          >
            <rect x={n.x} y={n.y - n.h / 2} width={COL_W} height={n.h} fill={hot ? "var(--oxide)" : n.risk > 0.15 ? "var(--ink)" : "var(--paper)"} stroke="var(--ink)" />
            <text x={n.x + COL_W + 8} y={n.y - 2} fontSize="14" fill="var(--ink)" fontWeight={hot ? 600 : 400}>
              {n.label}
            </text>
            <text x={n.x + COL_W + 8} y={n.y + 13} className="mono" fontSize="10.5" fill="var(--muted)">
              {Math.round(n.risk * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
