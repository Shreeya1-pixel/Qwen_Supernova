target: frontend/src/components/sections/ticker.tsx
context: frontend/src/lib/format.ts
---
Update the existing Ticker component (shown below as current contents). Keep everything it already does, and add:

1. Language: get `lang` from `useNabd()`. When lang === "ar", show `s.name_ar` instead of `s.name`, hide the separate arabic name span, and show `LEVEL_COPY[s.level].ar` instead of `.en.toUpperCase()`.
2. Live market prices: import `api` and type `Markets` from "@/lib/api". In a `useEffect`, call `api.markets()` once and every 15 minutes (setInterval 900000, clear on unmount); store the result in `useState<Markets | null>(null)`; ignore errors with `.catch(() => {})`.
3. If markets are loaded, append one extra item after the site items, built from `markets.quotes`. For each quote render:
   `<span className="flex items-baseline gap-2 px-8">` containing
   - `<span className="eyebrow opacity-60">{q.key === "brent" ? "Brent" : "Diesel"}</span>`
   - `<span className="mono text-sm tabular-nums">{q.price.toFixed(2)}</span>`
   - `<span className="mono text-xs opacity-60">{q.unit}</span>`
   - `<span className={"mono text-xs " + (q.change_pct >= 0 ? "text-sun" : "text-gulf")}>{q.change_pct >= 0 ? "+" : ""}{q.change_pct.toFixed(2)}%</span>`
   and then, if `markets.cooling_aed_per_hour` is not null, one more span: `<span className="mono text-xs opacity-70">cooling shelter ≈ {markets.cooling_aed_per_hour} AED/h</span>` followed by the ✳ separator span.
4. The outer marquee container must have `dir="ltr"` so the scroll works in Arabic.
5. The early `return null` must stay AFTER all hooks (hooks first, then `if (!live.length) return null`).
