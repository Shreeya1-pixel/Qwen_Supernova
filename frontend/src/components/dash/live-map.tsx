"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, ImageSource, Map as MlMap, Marker } from "maplibre-gl";
import { Box, Layers, Maximize2, Tag } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API, type SiteSummary } from "@/lib/api";
import { useNabd } from "@/lib/store";
import { LEVEL_COPY, cn } from "@/lib/format";

const num = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "–" : v.toFixed(d));

type Base = "hd" | "pass";
type Overlay = "feels" | "wetbulb" | "lst" | "aod" | "none";

interface HeatGrid {
  lats: number[];
  lons: number[];
  time: string;
  values: Record<string, (number | null)[]>;
  source: string;
}

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const gibs = (layer: string, day: string, level: number, ext: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${day}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`;

const RAMPS: Record<"feels" | "wetbulb", { key: string; label: string; lo: number; hi: number; stops: [number, string][] }> = {
  feels: {
    key: "apparent_temperature",
    label: "Feels-like °C",
    lo: 24,
    hi: 48,
    stops: [
      [24, "#2b83ba"],
      [30, "#abdda4"],
      [34, "#ffffbf"],
      [38, "#fdae61"],
      [42, "#d7191c"],
      [48, "#5e0b33"],
    ],
  },
  wetbulb: {
    key: "wet_bulb_temperature_2m",
    label: "Wet-bulb °C",
    lo: 14,
    hi: 32,
    stops: [
      [14, "#2b83ba"],
      [20, "#abdda4"],
      [24, "#ffffbf"],
      [27, "#fdae61"],
      [30, "#d7191c"],
      [32, "#5e0b33"],
    ],
  },
};

const LAYER_COPY: Record<Overlay, { label: string; note: string }> = {
  feels: { label: "Feels-like", note: "Open-Meteo · live grid" },
  wetbulb: { label: "Wet-bulb", note: "Open-Meteo · live grid" },
  lst: { label: "Land heat", note: "NASA MODIS · land surface temp" },
  aod: { label: "Dust & haze", note: "NASA MODIS · aerosol depth" },
  none: { label: "Off", note: "" },
};

function hexRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rampColor(stops: [number, string][], v: number) {
  if (v <= stops[0][0]) return hexRgb(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      const x = hexRgb(ca);
      const y = hexRgb(cb);
      return x.map((c, k) => Math.round(c + (y[k] - c) * t));
    }
  }
  return hexRgb(stops[stops.length - 1][1]);
}

/** Bilinear sample of the grid at (lat, lon); null outside. */
function sample(g: HeatGrid, key: string, lat: number, lon: number) {
  const { lats, lons } = g;
  const vals = g.values[key];
  const fy = ((lat - lats[0]) / (lats[lats.length - 1] - lats[0])) * (lats.length - 1);
  const fx = ((lon - lons[0]) / (lons[lons.length - 1] - lons[0])) * (lons.length - 1);
  if (fy < 0 || fx < 0 || fy > lats.length - 1 || fx > lons.length - 1) return null;
  const y0 = Math.floor(fy);
  const x0 = Math.floor(fx);
  const y1 = Math.min(y0 + 1, lats.length - 1);
  const x1 = Math.min(x0 + 1, lons.length - 1);
  const at = (y: number, x: number) => vals[y * lons.length + x];
  const q = [at(y0, x0), at(y0, x1), at(y1, x0), at(y1, x1)];
  if (q.some((v) => v === null)) return q.find((v) => v !== null) ?? null;
  const [a, b, c, d] = q as number[];
  const tx = fx - x0;
  const ty = fy - y0;
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function heatBounds(g: HeatGrid) {
  return { w: g.lons[0], e: g.lons[g.lons.length - 1], s: g.lats[0], n: g.lats[g.lats.length - 1] };
}

/** Paint the grid as a smooth field, clipped to UAE land. */
function paintHeat(g: HeatGrid, mode: "feels" | "wetbulb", land: number[][][]) {
  const ramp = RAMPS[mode];
  const b = heatBounds(g);
  const W = 900;
  const H = Math.round((W * (b.n - b.s)) / ((b.e - b.w) * Math.cos((24.4 * Math.PI) / 180)));
  const raw = document.createElement("canvas");
  raw.width = W;
  raw.height = H;
  const rc = raw.getContext("2d")!;
  const img = rc.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = b.n - ((b.n - b.s) * y) / (H - 1);
    for (let x = 0; x < W; x++) {
      const lon = b.w + ((b.e - b.w) * x) / (W - 1);
      const v = sample(g, ramp.key, lat, lon);
      const i = (y * W + x) * 4;
      if (v === null) continue;
      const [r, gg, bb] = rampColor(ramp.stops, v);
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = bb;
      img.data[i + 3] = 255;
    }
  }
  rc.putImageData(img, 0, 0);

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const oc = out.getContext("2d")!;
  if (land.length) {
    oc.beginPath();
    for (const ring of land) {
      ring.forEach(([lon, lat], i) => {
        const px = ((lon - b.w) / (b.e - b.w)) * W;
        const py = ((b.n - lat) / (b.n - b.s)) * H;
        if (i) oc.lineTo(px, py);
        else oc.moveTo(px, py);
      });
      oc.closePath();
    }
    oc.clip();
  }
  oc.filter = "blur(3px)";
  oc.drawImage(raw, 0, 0);
  return out.toDataURL("image/png");
}

function markerEl(s: SiteSummary, active: boolean, label: string) {
  const tone = LEVEL_COPY[s.level]?.tone ?? "#999";
  const el = document.createElement("button");
  el.type = "button";
  el.className = "nabd-marker";
  el.dataset.active = String(active);
  el.style.setProperty("--tone", tone);
  el.innerHTML = `<span class="nabd-ring"></span><span class="nabd-arch">${Math.round(s.index)}</span><span class="nabd-name">${label}</span>`;
  return el;
}

export function LiveMap({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { sites, siteId, setSiteId, snapshot: s, lang, t } = useNabd();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState<Base>("hd");
  const [overlay, setOverlay] = useState<Overlay>("feels");
  const [opacity, setOpacity] = useState(0.62);
  const [tilt, setTilt] = useState(false);
  const [labels, setLabels] = useState(true);
  const [grid, setGrid] = useState<HeatGrid | null>(null);
  const [land, setLand] = useState<number[][][]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [hover, setHover] = useState<{ x: number; y: number; v: number; lat: number; lon: number } | null>(null);
  const live = useMemo(() => sites.filter((x) => !x.error), [sites]);

  useEffect(() => {
    fetch(`${API}/geo/heat`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setGrid)
      .catch(() => {});
    fetch(`${API}/geo/boundaries?res=high`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { emirates: { rings: number[][][] }[] }) => setLand(d.emirates.flatMap((e) => e.rings)))
      .catch(() => {});
    for (const kind of ["lst", "aod", "truecolor"]) {
      fetch(`${API}/geo/imagery/${kind}`)
        .then((r) => r.json())
        .then((d: { date: string }) => setDates((p) => ({ ...p, [kind]: d.date })))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    let dead = false;
    import("maplibre-gl").then(({ default: ml }) => {
      if (dead || !box.current) return;
      const m = new ml.Map({
        container: box.current,
        style: {
          version: 8,
          sources: {
            hd: { type: "raster", tiles: [ESRI], tileSize: 256, maxzoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
            labels: { type: "raster", tiles: [LABELS], tileSize: 256, maxzoom: 19, attribution: "Labels © Esri" },
          },
          layers: [
            { id: "hd", type: "raster", source: "hd", paint: { "raster-saturation": -0.15, "raster-contrast": 0.08 } },
            { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.9 } },
          ],
        },
        center: [54.4, 24.35],
        zoom: compact ? 5.9 : 6.7,
        minZoom: 4,
        maxZoom: 16,
        attributionControl: { compact: true },
      });
      m.addControl(new ml.NavigationControl({ visualizePitch: true }), "bottom-right");
      if (!compact) m.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-right");
      m.on("load", () => {
        const blank = document.createElement("canvas").toDataURL();
        m.addSource("heat", { type: "image", url: blank, coordinates: [[51, 27], [57, 27], [57, 22], [51, 22]] });
        m.addLayer({ id: "heat", type: "raster", source: "heat", paint: { "raster-opacity": 0, "raster-fade-duration": 300 } }, "labels");
        m.addSource("emirates", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "emirates-glow", type: "line", source: "emirates", paint: { "line-color": "#000", "line-width": 3, "line-opacity": 0.25, "line-blur": 2 } }, "labels");
        m.addLayer({ id: "emirates", type: "line", source: "emirates", paint: { "line-color": "#fff", "line-width": 1, "line-opacity": 0.75 } }, "labels");
        setReady(true);
      });
      map.current = m;
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const add = (id: string, tiles: string, maxzoom: number, before: string) => {
      if (m.getSource(id)) return;
      m.addSource(id, { type: "raster", tiles: [tiles], tileSize: 256, maxzoom, attribution: "NASA GIBS" });
      m.addLayer({ id, type: "raster", source: id, layout: { visibility: "none" } }, before);
    };
    if (dates.truecolor) add("pass", gibs("VIIRS_NOAA20_CorrectedReflectance_TrueColor", dates.truecolor, 9, "jpg"), 9, "heat");
    if (dates.lst) add("lst", gibs("MODIS_Aqua_Land_Surface_Temp_Day", dates.lst, 7, "png"), 7, "heat");
    if (dates.aod) add("aod", gibs("MODIS_Terra_Aerosol_Optical_Depth_3km", dates.aod, 6, "png"), 6, "heat");
  }, [ready, dates]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !land.length) return;
    (m.getSource("emirates") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: land.map((ring) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } })),
    });
  }, [ready, land]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !grid || (overlay !== "feels" && overlay !== "wetbulb")) return;
    const b = heatBounds(grid);
    (m.getSource("heat") as ImageSource).updateImage({
      url: paintHeat(grid, overlay, land),
      coordinates: [
        [b.w, b.n],
        [b.e, b.n],
        [b.e, b.s],
        [b.w, b.s],
      ],
    });
  }, [ready, grid, overlay, land]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const vis = (id: string, on: boolean) => m.getLayer(id) && m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    vis("hd", base === "hd");
    vis("pass", base === "pass");
    vis("labels", labels);
    vis("lst", overlay === "lst");
    vis("aod", overlay === "aod");
    m.setPaintProperty("heat", "raster-opacity", overlay === "feels" || overlay === "wetbulb" ? opacity : 0);
    for (const id of ["lst", "aod"]) if (m.getLayer(id)) m.setPaintProperty(id, "raster-opacity", opacity);
  }, [ready, base, overlay, opacity, labels, dates]);

  useEffect(() => {
    map.current?.easeTo({ pitch: tilt ? 55 : 0, bearing: tilt ? -12 : 0, duration: 900 });
  }, [tilt]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    let alive = true;
    import("maplibre-gl").then(({ default: ml }) => {
      if (!alive) return;
      markers.current.forEach((mk) => mk.remove());
      markers.current = live.map((site) => {
        const el = markerEl(site, site.id === siteId, lang === "ar" ? site.name_ar : site.name);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSiteId(site.id);
        });
        const mk = new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([site.lon, site.lat]).addTo(m);
        el.setAttribute("aria-label", `${site.name} ${Math.round(site.index)}`);
        return mk;
      });
    });
    return () => {
      alive = false;
    };
  }, [ready, live, siteId, lang, setSiteId]);

  useEffect(() => {
    const site = live.find((x) => x.id === siteId);
    if (ready && site && !compact) map.current?.flyTo({ center: [site.lon, site.lat - 0.05], zoom: Math.max(map.current.getZoom(), 8.4), duration: 1400, essential: true });
  }, [siteId, ready, compact, live]);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const m = map.current;
      if (!m || !grid || (overlay !== "feels" && overlay !== "wetbulb")) return setHover(null);
      const rect = box.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ll = m.unproject([x, y]);
      const v = sample(grid, RAMPS[overlay].key, ll.lat, ll.lng);
      setHover(v === null ? null : { x, y, v, lat: ll.lat, lon: ll.lng });
    },
    [grid, overlay],
  );

  const ramp = overlay === "feels" || overlay === "wetbulb" ? RAMPS[overlay] : null;
  const glass = "rounded-2xl border border-white/10 bg-[#14110e]/72 text-[#f4ede2] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md";
  const segBtn = (on: boolean) => cn("rounded-full px-2.5 py-1 text-[0.72rem] font-bold transition-colors", on ? "bg-[#f4ede2] text-[#14110e]" : "text-[#f4ede2]/75 hover:text-[#f4ede2]");
  const crossing = s?.crew.filter((w) => w.eta_hours !== null).length ?? 0;
  const site = live.find((x) => x.id === siteId);

  return (
    <div className={cn("relative overflow-hidden bg-[#0e0c0a]", className)} dir="ltr">
      <div className="absolute inset-0">
        <div ref={box} className="h-full w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </div>

      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg bg-[#14110e]/85 px-2 py-1 text-[0.72rem] font-bold text-[#f4ede2]" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          {hover.v.toFixed(1)}°C <span className="font-medium opacity-60">{overlay === "feels" ? "feels-like" : "wet-bulb"}</span>
        </div>
      )}

      <div className={cn(glass, "absolute start-3 top-3 z-10 space-y-2 p-3", compact && "p-2")}>
        {!compact && (
          <div className="flex items-center gap-2">
            <Layers className="size-4 opacity-70" />
            <span className="text-[0.8rem] font-extrabold uppercase tracking-wide">{t("dash.map")}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1 rounded-full bg-white/8 p-0.5">
          {(["feels", "wetbulb", "lst", "aod", "none"] as Overlay[]).map((o) => (
            <button key={o} className={segBtn(overlay === o)} onClick={() => setOverlay(o)}>
              {LAYER_COPY[o].label}
            </button>
          ))}
        </div>
        {!compact && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-full bg-white/8 p-0.5">
                <button className={segBtn(base === "hd")} onClick={() => setBase("hd")}>
                  HD satellite
                </button>
                <button className={segBtn(base === "pass")} onClick={() => setBase("pass")}>
                  Today&apos;s pass
                </button>
              </div>
              <button className={cn("flex items-center gap-1 bg-white/8", segBtn(tilt))} onClick={() => setTilt(!tilt)} title="3D tilt">
                <Box className="size-3.5" /> 3D
              </button>
              <button className={cn("flex items-center gap-1 bg-white/8", segBtn(labels))} onClick={() => setLabels(!labels)} title="Place names">
                <Tag className="size-3.5" />
              </button>
            </div>
            <label className="flex items-center gap-2 text-[0.68rem] font-semibold opacity-80">
              Opacity
              <input type="range" min={0.15} max={0.95} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-28 accent-[#d9a441]" />
            </label>
          </>
        )}
      </div>

      {compact && (
        <Link href="/map" className={cn(glass, "absolute end-3 top-3 z-10 flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-bold")}>
          <Maximize2 className="size-3.5" /> Full map
        </Link>
      )}

      {overlay !== "none" && (
        <div className={cn(glass, "absolute bottom-3 start-3 z-10 w-64 p-3", compact && "w-52 p-2")}>
          {ramp ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-[0.75rem] font-extrabold">{ramp.label}</span>
                <span className="text-[0.62rem] opacity-60">{grid ? grid.time.slice(11) + " GST" : "…"}</span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${ramp.stops.map(([v, c]) => `${c} ${((v - ramp.lo) / (ramp.hi - ramp.lo)) * 100}%`).join(",")})` }} />
              <div className="mt-1 flex justify-between text-[0.62rem] font-semibold opacity-70">
                {ramp.stops.map(([v]) => (
                  <span key={v}>{v}</span>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="text-[0.75rem] font-extrabold">{LAYER_COPY[overlay].label}</span>
              <div className="mt-1.5 h-2.5 rounded-full" style={{ background: "linear-gradient(90deg,#3b4cc0,#8fb8e0,#f7f2c8,#f4a261,#b40426)" }} />
              <div className="mt-1 flex justify-between text-[0.62rem] font-semibold opacity-70">
                <span>{overlay === "lst" ? "cooler" : "clear"}</span>
                <span>{overlay === "lst" ? "hotter" : "dusty"}</span>
              </div>
            </>
          )}
          <p className="mt-1.5 text-[0.62rem] opacity-60">
            {LAYER_COPY[overlay].note}
            {overlay === "lst" && dates.lst ? ` · ${dates.lst}` : ""}
            {overlay === "aod" && dates.aod ? ` · ${dates.aod}` : ""}
          </p>
        </div>
      )}

      {!compact && site && s && (
        <aside className={cn(glass, "absolute end-3 top-3 z-10 w-[300px] p-4")} dir={lang === "ar" ? "rtl" : "ltr"}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest opacity-60">{site.kind}</p>
          <h2 className="text-2xl font-extrabold leading-tight">{lang === "ar" ? site.name_ar : site.name}</h2>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <span className="num text-[3.2rem] leading-none" style={{ color: LEVEL_COPY[site.level].tone }}>
                {Math.round(s.index.value)}
              </span>
              <span className="ms-1 text-xs font-bold opacity-60">/100</span>
            </div>
            <span className="pill" style={{ background: LEVEL_COPY[s.council.label].tone, color: "#fff" }}>
              {lang === "ar" ? LEVEL_COPY[s.council.label].ar : LEVEL_COPY[s.council.label].en.toUpperCase()}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["WBGT", num(s.wbgt, 1) + "°"],
              [t("dash.feels"), num(s.current.apparent_temperature, 0) + "°"],
              ["AQI", num(s.current.us_aqi)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/8 py-1.5">
                <dd className="num text-lg">{v}</dd>
                <dt className="text-[0.6rem] font-semibold uppercase opacity-60">{k}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-3 space-y-1.5">
            {s.index.drivers.slice(0, 3).map((d) => (
              <div key={d.hazard}>
                <div className="flex justify-between text-[0.72rem] font-semibold">
                  <span>{d.label}</span>
                  <span>{Math.round(d.share * 100)}%</span>
                </div>
                <div className="h-1 rounded-full bg-white/10">
                  <div className="h-1 rounded-full bg-[#d9a441]" style={{ width: `${d.share * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className={cn("mt-3 rounded-lg px-2.5 py-1.5 text-[0.75rem] font-bold", crossing ? "bg-[#b4471f]/30 text-[#ffb59a]" : "bg-[#1f6f6b]/30 text-[#9fe0d9]")}>
            {crossing} / {s.crew.length} {t("dash.crewRisk").toLowerCase()} · {t("dash.in3h")}
          </p>
          <ul className="mt-3 space-y-1">
            {live.map((x) => (
              <li key={x.id}>
                <button onClick={() => setSiteId(x.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1 text-[0.78rem] font-bold", x.id === siteId ? "bg-white/15" : "hover:bg-white/8")}>
                  <span className="size-2 rounded-full" style={{ background: LEVEL_COPY[x.level].tone }} />
                  <span className="flex-1 text-start">{lang === "ar" ? x.name_ar : x.name}</span>
                  <span className="num">{Math.round(x.index)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
