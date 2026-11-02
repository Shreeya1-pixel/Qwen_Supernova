"use client";

import { area, booleanIntersects, circle, featureCollection, intersect, pointOnFeature, polygon } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScenarioBanner } from "@/components/sections/scenario-banner";
import { ScenarioExposure, type PersonNow } from "@/components/sections/scenario-exposure";
import { api, type ExposureConditions } from "@/lib/api";
import { STATUS_COLOR, exposureStatus, peopleIn } from "@/lib/exposure";
import { ScenarioLayers } from "@/components/sections/scenario-layers";
import { ScenarioPanel, type DrawMode, type OtherArea } from "@/components/sections/scenario-panel";
import { ScenarioMap, type AreaLabel, type ScenarioOverlay } from "@/components/viz/scenario-map";
import { PEOPLE_PER_DOT, usePopulation, zoneStats } from "@/lib/population";
import { resetScenario, setScenario, usePresets, useScenario, type Zone } from "@/lib/scenario";
import { useNabd } from "@/lib/store";

/** Real boundaries share edges with their neighbours; only a real overlap (≥ 2% of the district) counts. */
function overlaps(district: Zone, zone: Zone) {
  if (!booleanIntersects(district, zone)) return false;
  const shared = intersect(featureCollection([district, zone]));
  return !!shared && area(shared) >= 0.02 * area(district);
}

export default function ScenarioScreen() {
  const { t, lang } = useNabd();
  const grid = usePopulation();
  const presets = usePresets();
  const list = useMemo(() => presets?.list ?? [], [presets]);
  const sc = useScenario();
  const [overlay, setOverlay] = useState<ScenarioOverlay>("none");
  const [perDot, setPerDot] = useState(PEOPLE_PER_DOT);
  const [mode, setMode] = useState<DrawMode>("idle");
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [centre, setCentre] = useState<[number, number] | null>(null);
  const [radiusM, setRadiusM] = useState(1500);
  const [fitTo, setFitTo] = useState<Zone | null>(null);

  const name = useCallback((id: string) => {
    const p = list.find((x) => x.id === id);
    return p ? (lang === "ar" ? p.name_ar : p.name) : t("scen.custom");
  }, [list, lang, t]);

  const applyZone = useCallback((zone: Zone, id: string, fit = true) => {
    setScenario({ zone, zoneId: id, zoneName: name(id) });
    if (fit) setFitTo(zone);
  }, [name]);

  const stats = useMemo(() => (grid && sc.zone ? zoneStats(grid, sc.zone) : null), [grid, sc.zone]);

  const [cond, setCond] = useState<{ zone: Zone; data: ExposureConditions | null; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!sc.zone || mode !== "idle") return;
    const zone = sc.zone;
    const [lng, lat] = pointOnFeature(zone).geometry.coordinates;
    let alive = true;
    api
      .exposureConditions(lat, lng)
      .then((data) => alive && setCond({ zone, data, at: Date.now() }))
      .catch(() => alive && setCond({ zone, data: null, at: Date.now() }));
    return () => {
      alive = false;
    };
  }, [sc.zone, mode]);
  const zoneCond = cond && cond.zone === sc.zone ? cond : null;
  const people: PersonNow[] = useMemo(() => {
    if (!sc.zone || mode !== "idle" || !zoneCond?.data) return [];
    const limit = zoneCond.data.sun_limit_min;
    const elapsed = Math.max(0, now - zoneCond.at) / 60000;
    return peopleIn(sc.zone, sc.zoneId === "custom" ? JSON.stringify(sc.zone.geometry).slice(0, 80) : sc.zoneId ?? "zone").map((p) => {
      const minutes = p.outdoorsMin + elapsed;
      return { ...p, minutes, status: exposureStatus(minutes, limit) };
    });
  }, [sc.zone, sc.zoneId, mode, zoneCond, now]);
  const buildings = list.find((p) => p.id === sc.zoneId)?.buildings ?? null;

  useEffect(() => {
    setScenario({ population: stats?.population ?? null, sample: grid?.sample ?? false });
  }, [stats, grid]);

  useEffect(() => {
    if (sc.zoneId) setScenario({ zoneName: name(sc.zoneId) });
  }, [lang, name, sc.zoneId]);

  const others: (OtherArea & AreaLabel)[] = useMemo(() => {
    if (!grid) return [];
    return list.filter((p) => p.id !== sc.zoneId).map((p) => {
      const partly = !!sc.zone && overlaps(p.zone, sc.zone);
      return {
        id: p.id,
        name: lang === "ar" ? p.name_ar : p.name,
        center: p.center,
        zone: p.zone,
        population: zoneStats(grid, p.zone).population,
        partly,
        status: t(partly ? "scen.partly" : "scen.outside"),
      };
    });
  }, [grid, list, sc.zone, sc.zoneId, lang, t]);

  const onPick = useCallback((p: [number, number]) => {
    if (mode === "polygon") setDraft((d) => [...d, p]);
    if (mode === "circle") {
      setCentre(p);
      applyZone(circle(p, radiusM / 1000, { steps: 72 }) as Feature<Polygon>, "custom", false);
    }
  }, [mode, radiusM, applyZone]);

  const finish = useCallback(() => {
    // A double-click also fires two clicks; drop the duplicate vertex it leaves behind.
    const pts = draft.filter((p, i) => i === 0 || Math.hypot(p[0] - draft[i - 1][0], p[1] - draft[i - 1][1]) > 1e-6);
    if (pts.length >= 3) applyZone(polygon([[...pts, pts[0]]]), "custom", false);
    setDraft([]);
    setMode("idle");
  }, [draft, applyZone]);

  const onRadius = (m: number) => {
    setRadiusM(m);
    if (centre) applyZone(circle(centre, m / 1000, { steps: 72 }) as Feature<Polygon>, "custom", false);
  };

  const reset = () => {
    resetScenario();
    setMode("idle");
    setDraft([]);
    setCentre(null);
  };

  return (
    <div className="relative -mx-4 -my-4 h-[calc(100dvh-3.4rem)] overflow-hidden bg-black lg:-mx-6 lg:-my-5">
      <ScenarioMap
        overlay={overlay}
        grid={grid}
        zone={sc.zone}
        zoneLabel={sc.zone && stats ? `${sc.zoneName} · ~${Math.round(stats.population).toLocaleString()}` : null}
        others={others}
        draft={draft}
        drawing={mode !== "idle"}
        fitTo={fitTo}
        onPick={onPick}
        onFinish={finish}
        onDots={setPerDot}
        people={people.map((p) => ({ id: p.id, lng: p.lng, lat: p.lat, color: STATUS_COLOR[p.status] }))}
      />
      <ScenarioLayers overlay={overlay} onOverlay={setOverlay} perDot={perDot} cellM={grid?.cellM ?? 100} />
      <ScenarioBanner sample={!!grid?.sample} />
      <ScenarioPanel
        mode={mode}
        draftCount={draft.length}
        radiusM={radiusM}
        circleSet={!!centre}
        activeId={sc.zoneId}
        zoneName={sc.zoneName}
        stats={stats}
        buildings={buildings}
        others={others}
        sample={!!grid?.sample}
        presets={list}
        presetsFallback={!!presets?.fallback}
        exposure={
          sc.zone && mode === "idle" ? (
            <ScenarioExposure people={people} cond={zoneCond?.data ?? null} condError={!!zoneCond && !zoneCond.data} />
          ) : null
        }
        onDraw={(m) => {
          setMode(m);
          setDraft([]);
          setCentre(null);
        }}
        onFinish={finish}
        onCancel={() => {
          setMode("idle");
          setDraft([]);
        }}
        onRadius={onRadius}
        onPreset={(id) => {
          const p = list.find((x) => x.id === id)!;
          setMode("idle");
          setDraft([]);
          applyZone(p.zone, p.id);
        }}
        onReset={reset}
      />
    </div>
  );
}
