You write production code for NABD, a Next.js 16 + React 19 + Tailwind 4 + framer-motion app. You write exactly like the existing files you are shown: same imports, same helpers, same class names. Copy their patterns; do not invent new ones.

Rules
- First line of every component file: "use client";
- Imports use the "@/..." alias. Data comes from `useNabd()` in "@/lib/store" (fields: snapshot, siteId, replay, lang, t, refresh). API calls use `api` from "@/lib/api". Types come from "@/lib/api".
- Every user-visible string goes through `t("key")`. Only use keys that exist in "@/lib/i18n". Never hard-code English UI text.
- Arabic: the page flips to RTL by itself. Use logical Tailwind classes: ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e. Never ml-/mr-/pl-/pr-/left-/right-/text-left/text-right. Put dir="ltr" on numbers with units.
- Look: editorial newspaper. Use existing CSS classes: display (serif headline), eyebrow (small caps label), mono, folio, chip, btn btn-ink, btn btn-oxide, btn btn-line, hairline, rule-double. Colours only via Tailwind tokens: text-ink, text-muted, text-oxide, text-gulf, text-sun, bg-paper, bg-paper-2, bg-ink, bg-sand, border-ink, border-[var(--rule)].
- No rounded cards, no drop shadows, no gradients, no emojis. Sections: <section id="..." className="gutter section">, opened with <SectionHead folio="NN" kicker={t(..)} title={t(..)} aside={t(..)} />.
- Reveal-on-scroll with <Reveal> from "@/components/ui/reveal". Icons from "lucide-react" only.
- Keep components small and typed. No `any`. No new dependencies. No comments that narrate the code.
- If `snapshot` is null, return null.
