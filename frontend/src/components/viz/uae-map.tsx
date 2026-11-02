"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useMemo, useState } from "react";
import { API, type SiteSummary } from "@/lib/api";
import { LEVEL_COPY } from "@/lib/format";

export type MapLayer = "outline" | "truecolor" | "lst" | "aod";
export type MapRes = "low" | "high";

const BOUNDS = { lon: [51.4, 57.0], lat: [22.45, 26.35] } as const;
const K = Math.cos((24.4 * Math.PI) / 180);
const SCALE = 200;
const W = (BOUNDS.lon[1] - BOUNDS.lon[0]) * K * SCALE;
const H = (BOUNDS.lat[1] - BOUNDS.lat[0]) * SCALE;
const px = (lon: number) => (lon - BOUNDS.lon[0]) * K * SCALE;
const py = (lat: number) => (BOUNDS.lat[1] - lat) * SCALE;

const SEAS = [
  { en: "Arabian Gulf", ar: "الخليج العربي", lon: 52.6, lat: 25.75, size: 22 },
  { en: "Gulf of Oman", ar: "خليج عُمان", lon: 56.62, lat: 24.75, size: 15, rotate: -62 },
  { en: "Rubʿ al Khali", ar: "الربع الخالي", lon: 53.2, lat: 22.75, size: 15 },
];
const EMIRATE_AR: Record<string, string> = {
  "Abu Dhabi": "أبوظبي",
  Dubai: "دبي",
  Sharjah: "الشارقة",
  Ajman: "عجمان",
  "Umm al-Quwain": "أم القيوين",
  "Ras al-Khaimah": "رأس الخيمة",
  Fujairah: "الفجيرة",
};
const ARCH = "M-9 12 V-2 A9 9 0 0 1 9 -2 V12 Z";

interface Emirate {
  name: string;
  rings: number[][][];
}

const ringPath = (ring: number[][]) => ring.map(([lon, lat], i) => `${i ? "L" : "M"}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join(" ") + " Z";

function centroid(rings: number[][][]) {
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a));
  const [sx, sy] = ring.reduce(([x, y], [lon, lat]) => [x + lon, y + lat], [0, 0]);
  return [sx / ring.length, sy / ring.length];
}

export function UaeMap({
  sites,
  active,
  onSelect,
  layer,
  res,
  replay,
  lang,
  onMeta,
}: {
  sites: SiteSummary[];
  active: string;
  onSelect: (id: string) => void;
  layer: MapLayer;
  res: MapRes;
  replay: string | null;
  lang: "en" | "ar";
  onMeta?: (m: { points: number; imageryDate?: string }) => void;
}) {
  const [emirates, setEmirates] = useState<Emirate[]>([]);
  const [fetched, setFetched] = useState<{ layer: MapLayer; url: string; date: string } | null>(null);
  const image = fetched && fetched.layer === layer ? fetched : null;
  const hatch = useId();
  const clip = useId();

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let fallback = false;
    let done = false;
    const load = (tries: number) =>
      fetch(`${API}/geo/boundaries?res=${res}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { emirates: Emirate[]; points: number }) => {
          done = true;
          if (!live) return;
          setEmirates(d.emirates);
          onMeta?.({ points: d.points });
        })
        .catch(() => {
          if (!live) return;
          if (!fallback) {
            fallback = true;
            fetch("/uae.json")
              .then((r) => r.json())
              .then((d: { rings: number[][][] }) => live && !done && setEmirates([{ name: "UAE", rings: d.rings }]));
          }
          if (tries > 0) timer = setTimeout(() => load(tries - 1), 4000);
        });
    load(5);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  useEffect(() => {
    if (layer === "outline") return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const on = replay ? `&on=${replay}` : "";
    const load = (tries: number) =>
      fetch(`${API}/geo/imagery/${layer}?res=${res}${on}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { url: string; date: string }) => live && (setFetched({ ...d, layer }), onMeta?.({ points: 0, imageryDate: d.date })))
        .catch(() => live && tries > 0 && (timer = setTimeout(() => load(tries - 1), 4000)));
    load(5);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, res, replay]);

  const land = useMemo(() => emirates.map((e) => e.rings.map(ringPath).join(" ")).join(" "), [emirates]);
  const labels = useMemo(() => emirates.filter((e) => e.name !== "UAE").map((e) => ({ name: e.name, at: centroid(e.rings) })), [emirates]);
  const bar = 50 / 111.32 * SCALE;
  const imageOnLand = layer === "lst" || layer === "aod";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Map of the UAE with monitored sites">
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink)" strokeWidth="0.6" opacity="0.16" />
        </pattern>
        <clipPath id={clip}>
          <path d={land} />
        </clipPath>
      </defs>

      {image && (
        <image
          key={image.url}
          href={image.url}
          x="0"
          y="0"
          width={W}
          height={H}
          preserveAspectRatio="none"
          clipPath={imageOnLand ? `url(#${clip})` : undefined}
          style={{ filter: layer === "truecolor" ? "sepia(0.35) saturate(0.8) contrast(1.05)" : "saturate(0.9)", mixBlendMode: "multiply" }}
          opacity={layer === "truecolor" ? 0.9 : 0.85}
        />
      )}

      {[52, 53, 54, 55, 56].map((lon) => (
        <g key={lon}>
          <line x1={px(lon)} x2={px(lon)} y1={0} y2={H} stroke="var(--rule)" strokeDasharray="1 5" />
          <text x={px(lon) + 3} y={H - 6} className="mono" fontSize="9" fill="var(--muted)">
            {lon}°E
          </text>
        </g>
      ))}
      {[23, 24, 25, 26].map((lat) => (
        <g key={lat}>
          <line x1={0} x2={W} y1={py(lat)} y2={py(lat)} stroke="var(--rule)" strokeDasharray="1 5" />
          <text x={4} y={py(lat) - 3} className="mono" fontSize="9" fill="var(--muted)">
            {lat}°N
          </text>
        </g>
      ))}

      {layer !== "truecolor" &&
        SEAS.map((s) => (
          <text
            key={s.en}
            x={px(s.lon)}
            y={py(s.lat)}
            transform={s.rotate ? `rotate(${s.rotate} ${px(s.lon)} ${py(s.lat)})` : undefined}
            textAnchor="middle"
            className={lang === "ar" ? "arabic" : "display"}
            fontStyle={lang === "ar" ? "normal" : "italic"}
            fontSize={s.size}
            letterSpacing={lang === "ar" ? 0 : "0.18em"}
            fill="var(--muted)"
            opacity="0.75"
          >
            {lang === "ar" ? s.ar : s.en}
          </text>
        ))}

      {emirates.map((e) => (
        <motion.path
          key={`${res}-${e.name}`}
          d={e.rings.map(ringPath).join(" ")}
          fill={layer === "outline" ? `url(#${hatch})` : "none"}
          stroke="var(--ink)"
          strokeWidth={res === "high" ? 0.7 : 1}
          strokeLinejoin="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
      ))}

      {labels.map((l) => (
        <text
          key={l.name}
          x={px(l.at[0])}
          y={py(l.at[1])}
          textAnchor="middle"
          fontSize={l.name === "Abu Dhabi" ? 13 : 8.5}
          className={lang === "ar" ? "arabic" : "mono"}
          letterSpacing={lang === "ar" ? 0 : "0.12em"}
          fill="var(--ink)"
          opacity={layer === "truecolor" ? 0.85 : 0.5}
          style={{ paintOrder: "stroke", stroke: "var(--paper)", strokeWidth: layer === "truecolor" ? 2.5 : 0 }}
        >
          {lang === "ar" ? EMIRATE_AR[l.name] ?? l.name : l.name.toUpperCase()}
        </text>
      ))}

      {sites.map((s) => {
        const on = s.id === active;
        const tone = LEVEL_COPY[s.level]?.tone ?? "var(--ink)";
        return (
          <g
            key={s.id}
            transform={`translate(${px(s.lon)} ${py(s.lat)})`}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(s.id)}
            role="button"
            tabIndex={0}
            aria-label={`${s.name}, index ${Math.round(s.index)}`}
            className="cursor-pointer outline-none"
          >
            {on && <circle r="24" fill="none" stroke="var(--oxide)" strokeWidth="1.2" strokeDasharray="2 3" className="beat" style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
            <g transform={`scale(${on ? 1.35 : 1})`}>
              <path d={ARCH} fill={tone} stroke="var(--ink)" strokeWidth="1" />
              <path d="M-4 12 V3 A4 4 0 0 1 4 3 V12" fill="var(--paper)" opacity="0.85" />
            </g>
            <text
              y={on ? -22 : -16}
              textAnchor="middle"
              className="display"
              fontSize={on ? 22 : 17}
              fill="var(--ink)"
              style={{ paintOrder: "stroke", stroke: "var(--paper)", strokeWidth: 3 }}
            >
              {Math.round(s.index)}
            </text>
            <text
              y={on ? 32 : 26}
              textAnchor="middle"
              fontSize="11"
              fill="var(--ink)"
              fontWeight={on ? 600 : 400}
              className={lang === "ar" ? "arabic" : undefined}
              style={{ paintOrder: "stroke", stroke: "var(--paper)", strokeWidth: 3 }}
            >
              {lang === "ar" ? s.name_ar : s.name}
            </text>
          </g>
        );
      })}

      <g transform={`translate(${W - bar - 24} ${H - 26})`}>
        <rect width={bar / 2} height="4" fill="var(--ink)" />
        <rect x={bar / 2} width={bar / 2} height="4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="0.8" />
        <text y="-5" className="mono" fontSize="9" fill="var(--ink)">
          0
        </text>
        <text x={bar} y="-5" textAnchor="end" className="mono" fontSize="9" fill="var(--ink)">
          50 km
        </text>
      </g>
      <g transform={`translate(${W - 34} 40)`}>
        <path d="M0 -18 L5 0 L0 -4 L-5 0 Z" fill="var(--ink)" />
        <text y="14" textAnchor="middle" className="display" fontSize="13" fill="var(--ink)">
          N
        </text>
      </g>
    </svg>
  );
}
