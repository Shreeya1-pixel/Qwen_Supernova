"use client";

import { motion } from "framer-motion";

interface Line {
  values: (number | null)[];
  color?: string;
  dashedFrom?: number;
  width?: number;
}

/** Bare line chart for small multiples. All lines share one y-scale unless `independent`. */
export function Spark({
  lines,
  height = 80,
  bands = [],
  domain,
  independent = false,
  marker,
}: {
  lines: Line[];
  height?: number;
  bands?: { y: number; label?: string }[];
  domain?: [number, number];
  independent?: boolean;
  marker?: number;
}) {
  const W = 400;
  const H = height;
  const all = lines.flatMap((l) => l.values.filter((v): v is number => v !== null));
  if (!all.length) return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" />;

  const scaleFor = (vals: number[]) => {
    const lo = domain?.[0] ?? Math.min(...vals);
    const hi = domain?.[1] ?? Math.max(...vals);
    const span = hi - lo || 1;
    return (v: number) => H - 4 - ((v - lo) / span) * (H - 8);
  };
  const shared = scaleFor(all);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-auto w-full overflow-visible">
      {bands.map((b) => (
        <g key={b.y}>
          <line x1="0" x2={W} y1={shared(b.y)} y2={shared(b.y)} stroke="var(--rule)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          {b.label && (
            <text x={W} y={shared(b.y) - 2} textAnchor="end" className="mono" fontSize="9" fill="var(--muted)">
              {b.label}
            </text>
          )}
        </g>
      ))}
      {marker !== undefined && (
        <line x1={marker} x2={marker} y1="0" y2={H} stroke="var(--ink)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      )}
      {lines.map((l, k) => {
        const y = independent ? scaleFor(l.values.filter((v): v is number => v !== null)) : shared;
        const n = l.values.length;
        const x = (i: number) => (i / Math.max(n - 1, 1)) * W;
        const seg = (from: number, to: number) =>
          l.values
            .slice(from, to)
            .map((v, j) => (v === null ? null : `${x(from + j).toFixed(1)} ${y(v).toFixed(1)}`))
            .filter(Boolean)
            .map((p, j) => `${j ? "L" : "M"}${p}`)
            .join(" ");
        const cut = l.dashedFrom ?? n;
        return (
          <g key={k}>
            <motion.path
              d={seg(0, cut)}
              fill="none"
              stroke={l.color ?? "var(--ink)"}
              strokeWidth={l.width ?? 1.5}
              vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            />
            {cut < n && (
              <path
                d={seg(cut - 1, n)}
                fill="none"
                stroke={l.color ?? "var(--ink)"}
                strokeWidth={l.width ?? 1.5}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
