"use client";

import { useNabd } from "@/lib/store";
import type { TKey } from "@/lib/i18n";

export function PageHead({ title, sub, children }: { title: TKey; sub?: string; children?: React.ReactNode }) {
  const { snapshot, lang, t } = useNabd();
  const site = snapshot ? (lang === "ar" ? snapshot.site.name_ar : snapshot.site.name) : "";
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="label">
          {site}
          {snapshot?.replay ? ` · replay ${snapshot.replay.replace("T", " ")}` : ""}
        </p>
        <h1 className="text-[clamp(1.6rem,2.6vw,2.3rem)] font-extrabold leading-tight tracking-tight">{t(title)}</h1>
        {sub && <p className="max-w-2xl text-[0.88rem] text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
