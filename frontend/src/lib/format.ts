import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Level } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const num = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(digits);

export const LEVEL_COPY: Record<Level, { en: string; ar: string; tone: string }> = {
  SAFE: { en: "Safe", ar: "آمن", tone: "var(--gulf)" },
  WATCH: { en: "Watch", ar: "مراقبة", tone: "var(--sun)" },
  CAUTION: { en: "Caution", ar: "حذر", tone: "var(--sun)" },
  RESTRICT: { en: "Restrict", ar: "تقييد", tone: "var(--oxide)" },
  STOP_WORK: { en: "Stop work", ar: "أوقف العمل", tone: "var(--oxide)" },
};

export const LANG_LABEL: Record<string, string> = {
  hi: "हिन्दी",
  ur: "اردو",
  ml: "മലയാളം",
  tl: "Tagalog",
  ta: "தமிழ்",
  ar: "العربية",
  bn: "বাংলা",
  en: "English",
};

export function clock(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function hour(iso: string) {
  return iso.slice(11, 16);
}
