"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo } from "react";

const W = 1200;
const H = 300;
const PAD = { l: 8, r: 120, t: 34, b: 34 };
const BEAT_W = 96;

interface Props {
  values: (number | null)[];
  times: string[];
  unit?: string;
  label?: string;
}

/** The land's record drawn as a trace that turns into a heartbeat at "now". */
export function PulseLine({ values, times, unit = "°C", label = "wet-bulb" }: Props) {
  const reduced = useReducedMotion();
  const hatch = useId();

  const g = useMemo(() => {
    const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
    if (pts.length < 2) return null;
    const lo = Math.min(...pts.map((p) => p.v));
    const hi = Math.max(...pts.map((p) => p.v));
    const span = Math.max(hi - lo, 1);
    const plotW = W - PAD.l - PAD.r - BEAT_W;
    const x = (i: number) => PAD.l + (i / (values.length - 1)) * plotW;
    const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);

    const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
    const last = pts[pts.length - 1];
    const lx = x(last.i);
    const ly = y(last.v);
    const amp = (H - PAD.t - PAD.b) * 0.55;
    const beat = [
      `L${lx + 14} ${ly}`,
      `Q${lx + 20} ${ly - 10} ${lx + 26} ${ly}`,
      `L${lx + 34} ${ly}`,
      `L${lx + 38} ${ly + 8}`,
      `L${lx + 46} ${Math.max(6, ly - amp)}`,
      `L${lx + 54} ${Math.min(H - 6, ly + amp * 0.45)}`,
      `L${lx + 59} ${ly}`,
      `L${lx + 68} ${ly}`,
      `Q${lx + 77} ${ly - 16} ${lx + 86} ${ly}`,
      `L${lx + BEAT_W} ${ly}`,
    ].join(" ");
    const area = `${line} L${lx} ${H - PAD.b} L${x(pts[0].i)} ${H - PAD.b} Z`;

    const peak = pts.reduce((a, b) => (b.v > a.v ? b : a));
    const days = times
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.endsWith("T00:00"))
      .map(({ t, i }) => ({ x: x(i), label: new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }) }));

    return { line, beat, area, lx, ly, end: lx + BEAT_W, peak: { x: x(peak.i), y: y(peak.v), v: peak.v, t: times[peak.i] }, lo, hi, days, now: last.v };
  }, [values, times]);

  if (!g) return <div className="h-[clamp(9rem,22vw,18rem)]" />;
  const key = `${values.length}-${g.now}-${times[times.length - 1]}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${label} over the last 72 hours, now ${g.now.toFixed(1)}${unit}`}>
      <defs>
        <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink)" strokeWidth="0.8" opacity="0.22" />
        </pattern>
      </defs>

      {g.days.map((d) => (
        <g key={d.x}>
          <line x1={d.x} x2={d.x} y1={PAD.t - 8} y2={H - PAD.b} stroke="var(--rule)" strokeDasharray="2 4" />
          <text x={d.x + 6} y={H - 12} className="mono" fontSize="12" fill="var(--muted)">
            {d.label}
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={g.end} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--ink)" strokeWidth="1" />

      <motion.path
        key={`a-${key}`}
        d={g.area}
        fill={`url(#${hatch})`}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.8 }}
      />
      <motion.path
        key={`l-${key}`}
        d={`${g.line} ${g.beat}`}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.2, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.path
        key={`b-${key}`}
        d={`M${g.lx} ${g.ly} ${g.beat}`}
        fill="none"
        stroke="var(--oxide)"
        strokeWidth="2.4"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 2.1, ease: "easeOut" }}
      />

      <g>
        <line x1={g.peak.x} x2={g.peak.x} y1={g.peak.y - 6} y2={8} stroke="var(--ink)" strokeWidth="0.8" />
        <circle cx={g.peak.x} cy={g.peak.y} r="3" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.2" />
        <text
          x={g.peak.x > W * 0.6 ? g.peak.x - 6 : g.peak.x + 6}
          y={14}
          textAnchor={g.peak.x > W * 0.6 ? "end" : "start"}
          className="mono"
          fontSize="12"
          fill="var(--ink)"
        >
          peak {g.peak.v.toFixed(1)}
          {unit} · {g.peak.t.slice(11, 16)}
        </text>
      </g>

      <g transform={`translate(${g.end + 10} ${g.ly})`}>
        <circle r="5" fill="var(--oxide)" className="beat" />
        <text x="14" y="-6" className="display" fontSize="34" fill="var(--ink)">
          {g.now.toFixed(1)}
          <tspan fontSize="16">{unit}</tspan>
        </text>
        <text x="14" y="14" className="mono" fontSize="11" fill="var(--muted)">
          {label} · now
        </text>
      </g>
    </svg>
  );
}
