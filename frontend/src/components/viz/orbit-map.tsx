"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

const ROAD_COLOR: Record<string, string> = {
  impassable: "#b42318",
  partial: "#e67e22",
  clear: "#2f6f4e",
};

const BLD_COLOR: Record<string, string> = {
  critical: "#b42318",
  impacted: "#e67e22",
  safe: "#2f6f4e",
};

export function OrbitMap({
  flood,
  buildings,
  roads,
}: {
  flood: FeatureCollection;
  buildings: FeatureCollection;
  roads: FeatureCollection;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    import("maplibre-gl").then(({ default: ml }) => {
      if (dead || !box.current || map.current) return;
      const m = new ml.Map({
        container: box.current,
        style: {
          version: 8,
          sources: {
            esri: { type: "raster", tiles: [ESRI], tileSize: 256, attribution: "Esri" },
            labels: { type: "raster", tiles: [LABELS], tileSize: 256 },
            flood: { type: "geojson", data: EMPTY },
            buildings: { type: "geojson", data: EMPTY },
            roads: { type: "geojson", data: EMPTY },
          },
          layers: [
            { id: "esri", type: "raster", source: "esri" },
            { id: "labels", type: "raster", source: "labels" },
            {
              id: "flood-fill",
              type: "fill",
              source: "flood",
              paint: { "fill-color": "#1d6fd8", "fill-opacity": 0.45 },
            },
            {
              id: "flood-line",
              type: "line",
              source: "flood",
              paint: { "line-color": "#0b3d91", "line-width": 2 },
            },
            {
              id: "roads",
              type: "line",
              source: "roads",
              paint: {
                "line-width": 4,
                "line-color": [
                  "match",
                  ["get", "status"],
                  "impassable", ROAD_COLOR.impassable,
                  "partial", ROAD_COLOR.partial,
                  ROAD_COLOR.clear,
                ],
              },
            },
            {
              id: "buildings",
              type: "circle",
              source: "buildings",
              paint: {
                "circle-radius": 7,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#f7f1e8",
                "circle-color": [
                  "match",
                  ["get", "severity"],
                  "critical", BLD_COLOR.critical,
                  "impacted", BLD_COLOR.impacted,
                  BLD_COLOR.safe,
                ],
              },
            },
          ],
        },
        center: [55.7, 24.85],
        zoom: 8.2,
        attributionControl: false,
      });
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        map.current = m;
        setReady(true);
      });
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("flood") as GeoJSONSource).setData(flood);
    (map.current.getSource("buildings") as GeoJSONSource).setData(buildings);
    (map.current.getSource("roads") as GeoJSONSource).setData(roads);
    const coords = flood.features.flatMap((f) => {
      const g = f.geometry;
      if (g.type === "Polygon") return g.coordinates[0] as [number, number][];
      return [];
    });
    if (coords.length > 2) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.current.fitBounds(
        [
          [Math.min(...lngs) - 0.05, Math.min(...lats) - 0.05],
          [Math.max(...lngs) + 0.05, Math.max(...lats) + 0.05],
        ],
        { padding: 48, duration: 600 },
      );
    }
  }, [ready, flood, buildings, roads]);

  return <div ref={box} className="h-full min-h-[360px] w-full rounded-lg" />;
}
