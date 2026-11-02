"use client";

import { useState } from "react";
import { useNabd } from "@/lib/store";
import { LEVEL_COPY, cn, num } from "@/lib/format";
import { SectionHead } from "@/components/ui/section-head";
import { UaeMap, type MapLayer, type MapRes } from "@/components/viz/uae-map";
import { Reveal } from "@/components/ui/reveal";

const LAYERS: { id: MapLayer; key: "land.outline" | "land.truecolor" | "land.lst" | "land.aod" }[] = [
  { id: "outline", key: "land.outline" },
  { id: "truecolor", key: "land.truecolor" },
  { id: "lst", key: "land.lst" },
  { id: "aod", key: "land.aod" },
];

export function Land() {
  const { sites, siteId, setSiteId, replay, lang, t } = useNabd();
  const [layer, setLayer] = useState<MapLayer>("truecolor");
  const [res, setRes] = useState<MapRes>("low");
  const [meta, setMeta] = useState<{ points?: number; imageryDate?: string }>({});
  const live = sites.filter((s) => !s.error);
  const ar = lang === "ar";
  const current = live.find((s) => s.id === siteId);

  return (
    <section id="land" className="gutter section">
      <SectionHead folio="02" kicker={t("land.kicker")} arabic="الأرض" title={t("land.title")} aside={t("land.aside")} />

      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("land.layer")}>
              {LAYERS.map((l) => (
                <button key={l.id} className="chip !py-1 !text-[0.78rem]" aria-pressed={layer === l.id} onClick={() => setLayer(l.id)}>
                  {t(l.key)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[0.78rem]">
              <span className="eyebrow text-muted">{t("land.res")}</span>
              <div className="flex rounded-full border border-[var(--rule)] p-0.5">
                {(["low", "high"] as const).map((r) => (
                  <button key={r} className={cn("tab rounded-full px-3 py-1", res === r && "bg-ink text-paper")} onClick={() => setRes(r)} aria-pressed={res === r}>
                    {t(r === "low" ? "land.low" : "land.high")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="relative border border-ink bg-paper-2/60 p-2 sm:p-3">
            {live.length ? (
              <UaeMap
                sites={live}
                active={siteId}
                onSelect={setSiteId}
                layer={layer}
                res={res}
                replay={replay}
                lang={lang}
                onMeta={(m) => setMeta((p) => ({ points: m.points || p.points, imageryDate: m.imageryDate ?? p.imageryDate }))}
              />
            ) : (
              <div className="mono flex aspect-[4/3] items-center justify-center text-sm text-muted">{t("hero.loading")}</div>
            )}
            {(layer === "lst" || layer === "aod") && (
              <div className="absolute bottom-4 start-4 bg-paper/90 px-3 py-2">
                <div className="h-2 w-40" style={{ background: "linear-gradient(90deg,#3b4cc0,#8fb8e0,#f7f2c8,#f4a261,#b40426)" }} />
                <div className="mono mt-1 flex justify-between text-[0.6rem] text-muted" dir="ltr">
                  <span>{layer === "lst" ? "cooler" : "clear"}</span>
                  <span>{layer === "lst" ? "hotter" : "dusty"}</span>
                </div>
              </div>
            )}
          </div>
          <p className="mono mt-2 flex flex-wrap justify-between gap-2 text-[0.68rem] text-muted">
            <span>{t("land.credit")}</span>
            <span dir="ltr">
              {meta.points ? `${meta.points.toLocaleString()} pts` : ""}
              {layer !== "outline" && meta.imageryDate ? ` · pass ${meta.imageryDate}` : ""}
            </span>
          </p>
        </Reveal>

        <div className="lg:col-span-5">
          <table className="w-full border-collapse text-start">
            <thead>
              <tr className="eyebrow border-b border-ink text-muted">
                <th className="py-2 text-start font-medium">{t("land.site")}</th>
                <th className="py-2 text-end font-medium">{t("land.index")}</th>
                <th className="py-2 ps-4 text-start font-medium">{t("land.verdict")}</th>
              </tr>
            </thead>
            <tbody>
              {live.map((s, i) => {
                const on = s.id === siteId;
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSiteId(s.id)}
                    className={cn("cursor-pointer border-b border-[var(--rule)] align-top transition-colors hover:bg-sand/60", on && "bg-sand")}
                  >
                    <td className="py-4 pe-2">
                      <div className="flex items-baseline gap-2">
                        <span className="folio text-sm">{i + 1}</span>
                        <span className="display text-2xl">{ar ? s.name_ar : s.name}</span>
                        {!ar && <span className="arabic text-sm text-muted">{s.name_ar}</span>}
                      </div>
                      <p className="mt-1 ps-5 text-[0.8rem] leading-snug text-muted">
                        <span dir="ltr">
                          {num(s.temperature, 1)}°C · WBGT {num(s.wbgt, 1)}
                        </span>
                        {s.warning && (
                          <span className="text-oxide">
                            {" "}
                            · {s.warning} {t("land.losing")}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="py-4 text-end">
                      <span className="display text-3xl tabular-nums">{Math.round(s.index)}</span>
                      <span className={cn("mono block text-[0.7rem]", s.delta_6h > 0 ? "text-oxide" : "text-gulf")} dir="ltr">
                        {s.delta_6h > 0 ? "+" : ""}
                        {s.delta_6h.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 ps-4">
                      <span className={cn("text-[0.78rem] font-semibold", !ar && "mono uppercase")} style={{ color: LEVEL_COPY[s.level].tone }}>
                        {ar ? LEVEL_COPY[s.level].ar : LEVEL_COPY[s.level].en}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {current && (
            <Reveal className="mt-8 border-s-2 border-oxide ps-5">
              <p className="eyebrow text-muted">{t("land.why")}</p>
              <p className="display mt-2 text-2xl italic leading-snug" dir="ltr">
                {current.story}
              </p>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
