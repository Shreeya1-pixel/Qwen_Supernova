"use client";

import type { Level } from "@/lib/api";
import { LEVEL_COPY, cn } from "@/lib/format";
import { useNabd } from "@/lib/store";

export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      {(title || action) && (
        <header className="panel-title">
          <span>{title}</span>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function LevelPill({ level, solid = false }: { level: Level; solid?: boolean }) {
  const { lang } = useNabd();
  const c = LEVEL_COPY[level];
  return (
    <span
      className="pill"
      style={solid ? { background: c.tone, color: "var(--paper)" } : { color: c.tone, background: `color-mix(in srgb, ${c.tone} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: solid ? "var(--paper)" : c.tone }} />
      {lang === "ar" ? c.ar : c.en.toUpperCase()}
    </span>
  );
}

export function Bar({ value, max = 1, tone = "var(--ink)", marker }: { value: number; max?: number; tone?: string; marker?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="relative" dir="ltr">
      <div className="bar">
        <span style={{ width: `${pct}%`, background: tone }} />
      </div>
      {marker !== undefined && (
        <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-oxide" style={{ left: `${Math.min(100, (marker / max) * 100)}%` }} />
      )}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-[var(--line)]" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export const levelTone = (l: Level) => LEVEL_COPY[l]?.tone ?? "var(--muted)";
export const riskTone = (r: number) => (r >= 0.66 ? "var(--oxide)" : r >= 0.33 ? "var(--sun)" : "var(--gulf)");
