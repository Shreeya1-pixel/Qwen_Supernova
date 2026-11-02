"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { bbox, pointOnFeature } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import { dotsInView, type PopGrid } from "@/lib/population";
import type { Zone } from "@/lib/scenario";

export type ScenarioOverlay = "none" | "lst" | "aod" | "pop";

export interface AreaLabel {
  id: string;
  name: string;
  center: [number, number];
  zone: Zone;
  population: number;
  status: string;
}

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const gibs = (layer: string, day: string, level: number, ext: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${day}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`;
const GIBS = {
  lst: { kind: "lst", layer: "MODIS_Aqua_Land_Surface_Temp_Day", level: 7, ext: "png" },
  aod: { kind: "aod", layer: "MODIS_Terra_Aerosol_Optical_Depth_3km", level: 6, ext: "png" },
} as const;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const BOUNDARY_ATTR = "Boundary source: OpenStreetMap contributors";

function yesterday() {
  return new Date(Date.now() - 864e5).toISOString().slice(0, 10);
}

export function ScenarioMap({
  overlay,
  grid,
  zone,
  zoneLabel,
  others,
  draft,
  drawing,
  fitTo,
  onPick,
  onFinish,
  onDots,
  people,
}: {
  overlay: ScenarioOverlay;
  grid: PopGrid | null;
  zone: Zone | null;
  zoneLabel: string | null;
  others: AreaLabel[];
  draft: [number, number][];
  drawing: boolean;
  fitTo: Zone | null;
  onPick: (lngLat: [number, number]) => void;
  onFinish: () => void;
  onDots: (perDot: number) => void;
  people: { id: string; lng: number; lat: number; color: string }[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const handlers = useRef({ onPick, onFinish, onDots, drawing });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    handlers.current = { onPick, onFinish, onDots, drawing };
  }, [onPick, onFinish, onDots, drawing]);

  useEffect(() => {
    let dead = false;
    import("maplibre-gl").then(async ({ default: ml }) => {
      if (dead || !box.current) return;
      const dates: Record<string, string> = {};
      // Latest clear NASA pass dates come from the existing backend; fall back to yesterday if it is down.
      await Promise.all(
        Object.values(GIBS).map((g) =>
          fetch(`${API}/geo/imagery/${g.kind}`, { signal: AbortSignal.timeout(1500) })
            .then((r) => r.json())
            .then((d: { date: string }) => (dates[g.kind] = d.date))
            .catch(() => (dates[g.kind] = yesterday())),
        ),
      );
      if (dead || !box.current) return;
      const src = (key: keyof typeof GIBS) => ({
        type: "raster" as const,
        tiles: [gibs(GIBS[key].layer, dates[GIBS[key].kind], GIBS[key].level, GIBS[key].ext)],
        tileSize: 256,
        maxzoom: GIBS[key].level,
        attribution: "NASA GIBS",
      });
      const m = new ml.Map({
        container: box.current,
        style: {
          version: 8,
          sources: {
            esri: { type: "raster", tiles: [ESRI], tileSize: 256, maxzoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
            labels: { type: "raster", tiles: [ESRI_LABELS], tileSize: 256, maxzoom: 19 },
            lst: src("lst"),
            aod: src("aod"),
            dots: { type: "geojson", data: EMPTY, attribution: "Population: WorldPop 2020" },
            others: { type: "geojson", data: EMPTY, attribution: BOUNDARY_ATTR },
            zone: { type: "geojson", data: EMPTY },
            people: { type: "geojson", data: EMPTY },
            draft: { type: "geojson", data: EMPTY },
          },
          layers: [
            { id: "esri", type: "raster", source: "esri" },
            { id: "lst", type: "raster", source: "lst", layout: { visibility: "none" }, paint: { "raster-opacity": 0.6 } },
            { id: "aod", type: "raster", source: "aod", layout: { visibility: "none" }, paint: { "raster-opacity": 0.6 } },
            { id: "labels", type: "raster", source: "labels" },
            { id: "others-fill", type: "fill", source: "others", paint: { "fill-color": "#22c55e", "fill-opacity": 0.14 } },
            { id: "others-line", type: "line", source: "others", paint: { "line-color": "#4ade80", "line-width": 2.5 } },
            { id: "zone-fill", type: "fill", source: "zone", paint: { "fill-color": "#ef4444", "fill-opacity": 0.26 } },
            { id: "zone-line", type: "line", source: "zone", paint: { "line-color": "#ff3b30", "line-width": 4 } },
            {
              id: "dots",
              type: "circle",
              source: "dots",
              layout: { visibility: "none" },
              paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 1.4, 17, 2],
                "circle-color": "#00e5ff",
                "circle-opacity": 0.8,
                "circle-stroke-color": "#003040",
                "circle-stroke-width": 0.4,
              },
            },
            {
              id: "people",
              type: "circle",
              source: "people",
              paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 8],
                "circle-color": ["get", "color"],
                "circle-stroke-color": "#fff",
                "circle-stroke-width": 2.5,
              },
            },
            { id: "draft-line", type: "line", source: "draft", paint: { "line-color": "#ffd60a", "line-width": 3, "line-dasharray": [2, 1] } },
            { id: "draft-pts", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 6, "circle-color": "#ffd60a", "circle-stroke-color": "#000", "circle-stroke-width": 2 } },
          ],
        },
        center: [55.4, 25.15],
        zoom: 11.2,
        maxZoom: 18,
        attributionControl: { compact: false },
      });
      m.addControl(new ml.NavigationControl(), "bottom-left");
      m.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
      m.on("click", (e) => handlers.current.drawing && handlers.current.onPick([e.lngLat.lng, e.lngLat.lat]));
      m.on("dblclick", (e) => {
        if (!handlers.current.drawing) return;
        e.preventDefault();
        handlers.current.onFinish();
      });
      m.on("load", () => setReady(true));
      map.current = m;
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const id of ["lst", "aod"] as const) m.setLayoutProperty(id, "visibility", overlay === id ? "visible" : "none");
    m.setLayoutProperty("dots", "visibility", overlay === "pop" ? "visible" : "none");
  }, [ready, overlay]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !grid || overlay !== "pop") return;
    const draw = () => {
      const b = m.getBounds();
      const { points, perDot } = dotsInView(grid, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      (m.getSource("dots") as GeoJSONSource).setData({
        type: "Feature",
        properties: {},
        geometry: { type: "MultiPoint", coordinates: points },
      });
      handlers.current.onDots(perDot);
    };
    draw();
    m.on("moveend", draw);
    return () => {
      m.off("moveend", draw);
    };
  }, [ready, grid, overlay]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("people") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: people.map((p) => ({ type: "Feature", properties: { color: p.color }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })),
    });
  }, [ready, people]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("zone") as GeoJSONSource).setData(zone ? { type: "FeatureCollection", features: [zone] } : EMPTY);
    (m.getSource("others") as GeoJSONSource).setData({ type: "FeatureCollection", features: others.map((o) => o.zone) });
    const pts = draft.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: p } }));
    const line = draft.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: draft } }] : [];
    (m.getSource("draft") as GeoJSONSource).setData({ type: "FeatureCollection", features: [...line, ...pts] });
    m.doubleClickZoom[drawing ? "disable" : "enable"]();
    m.getCanvas().style.cursor = drawing ? "crosshair" : "";
  }, [ready, zone, others, draft, drawing]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    let alive = true;
    import("maplibre-gl").then(({ default: ml }) => {
      if (!alive) return;
      markers.current.forEach((mk) => mk.remove());
      const make = (html: string, at: [number, number]) => {
        const el = document.createElement("div");
        el.className = "scen-label";
        el.innerHTML = html;
        return new ml.Marker({ element: el, anchor: "bottom", offset: [0, -6] }).setLngLat(at).addTo(m);
      };
      markers.current = others.map((o) =>
        make(`<b>${o.name}</b><span>${Math.round(o.population).toLocaleString()} people</span><em>${o.status}</em>`, o.center),
      );
      if (zone && zoneLabel) {
        const el = make(`<b>${zoneLabel}</b>`, pointOnFeature(zone).geometry.coordinates as [number, number]);
        el.getElement().classList.add("scen-danger");
        markers.current.push(el);
      }
    });
    return () => {
      alive = false;
    };
  }, [ready, others, zone, zoneLabel]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !fitTo) return;
    const [w, s, e, n] = bbox(fitTo);
    m.fitBounds([[w, s], [e, n]], { padding: { top: 120, bottom: 120, left: 80, right: 460 }, maxZoom: 15.5, duration: 1200 });
  }, [ready, fitTo]);

  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
