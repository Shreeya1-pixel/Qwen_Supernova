"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHead } from "@/components/dash/page-head";
import { Loading, Panel } from "@/components/dash/ui";
import { OrbitMap } from "@/components/viz/orbit-map";
import {
  api,
  type OrbitBriefing,
  type OrbitPhaseDetail,
  type OrbitRainfall,
} from "@/lib/api";
import { cn } from "@/lib/format";
import { useNabd } from "@/lib/store";

export default function OrbitScreen() {
  const { t } = useNabd();
  const [brief, setBrief] = useState<OrbitBriefing | null>(null);
  const [phaseId, setPhaseId] = useState("t6");
  const [detail, setDetail] = useState<OrbitPhaseDetail | null>(null);
  const [rain, setRain] = useState<OrbitRainfall | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.orbit(), api.orbitRainfall()])
      .then(([b, r]) => {
        if (!alive) return;
        setBrief(b);
        setRain(r);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .orbitPhase(phaseId)
      .then((d) => alive && setDetail(d))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [phaseId]);

  const phase = detail?.phase;
  const spark = useMemo(() => {
    if (!rain?.hourly?.length) return [];
    // downsample a bit for the sparkline
    return rain.hourly.filter((_, i) => i % 2 === 0);
  }, [rain]);
  const maxMm = Math.max(1, ...(spark.map((h) => h.mm || 0)));

  return (
    <>
      <PageHead title="side.orbit" sub={t("orbit.sub")}>
        <span className="rounded-full bg-ink px-3 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-paper">
          {t("orbit.badge")}
        </span>
      </PageHead>

      {err && (
        <p className="mb-3 rounded-lg border border-oxide/30 bg-oxide/10 px-3 py-2 text-[0.85rem] text-oxide">
          {t("orbit.err")} {err}
        </p>
      )}

      <div className="mb-3 grid gap-3 md:grid-cols-4">
        <Kpi label={t("orbit.kpi.mask")} value={`T+${brief?.latency.orbit_flood_mask_h ?? "–"} h`} hint={t("orbit.kpi.maskHint")} />
        <Kpi label={t("orbit.kpi.triage")} value={`T+${brief?.latency.orbit_damage_triage_h ?? "–"} h`} hint={t("orbit.kpi.triageHint")} />
        <Kpi label={t("orbit.kpi.optical")} value={`T+${brief?.latency.traditional_optical_h ?? "–"} h`} hint={t("orbit.kpi.opticalHint")} />
        <Kpi
          label={t("orbit.kpi.lead")}
          value={brief ? `${brief.advantage_hours} h` : "–"}
          hint={t("orbit.kpi.leadHint")}
          accent
        />
      </div>

      <Panel title={t("orbit.event")} className="mb-3" action={<span className="label">{brief?.event.peak_local?.replace("T", " ") ?? ""}</span>}>
        {!brief ? (
          <Loading rows={3} />
        ) : (
          <div className="space-y-2 text-[0.88rem]">
            <p className="font-bold">{brief.event.title}</p>
            <p className="text-muted">{brief.event.summary}</p>
            <p className="text-[0.82rem]">
              <span className="font-bold">{brief.event.peak_rain_mm} mm</span>
              <span className="text-muted"> · {brief.event.peak_rain_place}</span>
            </p>
            <p className="rounded-md bg-sand/60 px-3 py-2 text-[0.82rem]">{brief.one_liner}</p>
          </div>
        )}
      </Panel>

      <div className="grid gap-3 xl:grid-cols-12">
        <Panel
          title={t("orbit.timeline")}
          className="xl:col-span-3"
          action={<span className="label">{t("orbit.scrub")}</span>}
        >
          <ul className="space-y-1.5">
            {(brief?.phases ?? []).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPhaseId(p.id)}
                  className={cn(
                    "w-full rounded-lg px-2.5 py-2 text-start transition-colors",
                    phaseId === p.id ? "bg-ink text-paper" : "hover:bg-sand/70",
                  )}
                >
                  <div className="text-[0.8rem] font-bold">{p.label}</div>
                  <div className={cn("num text-[0.72rem]", phaseId === p.id ? "text-paper/70" : "text-muted")}>
                    {p.kpis.flood_km2} km² · {p.kpis.buildings_impacted} bld · {p.kpis.roads_km_affected} km rd
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t("orbit.map")} className="xl:col-span-6" action={<span className="label">{phase?.label ?? "…"}</span>}>
          <div className="h-[420px] overflow-hidden rounded-md">
            {phase ? (
              <OrbitMap
                flood={phase.flood as never}
                buildings={phase.geojson_buildings as never}
                roads={phase.geojson_roads as never}
              />
            ) : (
              <div className="grid h-full place-items-center text-muted">
                <Loading rows={4} />
              </div>
            )}
          </div>
          <p className="label mt-2 normal-case">{t("orbit.mapNote")}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[0.72rem] font-semibold">
            <Legend swatch="#1d6fd8" label={t("orbit.leg.flood")} />
            <Legend swatch="#b42318" label={t("orbit.leg.critical")} />
            <Legend swatch="#e67e22" label={t("orbit.leg.partial")} />
            <Legend swatch="#2f6f4e" label={t("orbit.leg.clear")} />
          </div>
        </Panel>

        <div className="flex flex-col gap-3 xl:col-span-3">
          <Panel title={t("orbit.damage")}>
            {!phase ? (
              <Loading />
            ) : (
              <div className="space-y-3 text-[0.85rem]">
                <Stat row={t("orbit.stat.flood")} val={`${phase.kpis.flood_km2} km²`} />
                <Stat row={t("orbit.stat.bld")} val={`${phase.kpis.buildings_impacted}`} />
                <Stat row={t("orbit.stat.crit")} val={`${phase.kpis.buildings_critical}`} />
                <Stat row={t("orbit.stat.roads")} val={`${phase.kpis.roads_km_affected} km`} />
                <p className="text-[0.8rem] text-muted">{phase.note}</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-[0.78rem]">
                  {phase.buildings
                    .filter((b) => b.flooded)
                    .map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-1">
                        <span>{b.name}</span>
                        <span className={cn("font-bold uppercase", b.severity === "critical" ? "text-oxide" : "text-sun")}>
                          {b.severity}
                        </span>
                      </li>
                    ))}
                  {!phase.buildings.some((b) => b.flooded) && (
                    <li className="text-muted">{t("orbit.noDamage")}</li>
                  )}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title={t("orbit.rain")} action={<span className="label">{rain?.source?.split("(")[0] ?? ""}</span>}>
            {!rain ? (
              <Loading />
            ) : (
              <div>
                <div className="mb-2 flex items-end justify-between">
                  <div>
                    <div className="num text-2xl font-extrabold">{rain.total_mm}</div>
                    <div className="label">mm · Hatta cell</div>
                  </div>
                  <div className="text-end text-[0.75rem] text-muted">
                    peak {rain.peak_mm} mm
                    <br />
                    {rain.peak_at?.replace("T", " ")}
                  </div>
                </div>
                <div className="flex h-16 items-end gap-px" dir="ltr">
                  {spark.length ? spark.map((h) => (
                    <span
                      key={h.t}
                      title={`${h.t}: ${h.mm} mm`}
                      className="flex-1 rounded-t-sm bg-gulf/80"
                      style={{ height: `${Math.max(4, ((h.mm || 0) / maxMm) * 100)}%` }}
                    />
                  )) : (
                    <span className="text-muted">{t("orbit.noRain")}</span>
                  )}
                </div>
                <p className="label mt-2 normal-case">{rain.note}</p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel title={t("orbit.deliver")} className="mt-3">
        <ul className="grid gap-2 text-[0.85rem] md:grid-cols-2">
          {(brief?.deliverables ?? [t("orbit.loading")]).map((d) => (
            <li key={d} className="rounded-lg bg-sand/50 px-3 py-2">
              {d}
            </li>
          ))}
        </ul>
        <p className="label mt-3 normal-case">{t("orbit.honest")}</p>
      </Panel>
    </>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={cn("panel p-3", accent && "bg-ink text-paper")}>
      <p className={cn("label", accent && "text-paper/60")}>{label}</p>
      <p className="num text-2xl font-extrabold">{value}</p>
      <p className={cn("text-[0.72rem]", accent ? "text-paper/70" : "text-muted")}>{hint}</p>
    </div>
  );
}

function Stat({ row, val }: { row: string; val: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted">{row}</span>
      <span className="num font-bold">{val}</span>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: swatch }} />
      {label}
    </span>
  );
}
