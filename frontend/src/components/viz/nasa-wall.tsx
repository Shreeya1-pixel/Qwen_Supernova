"use client";

import { useState } from "react";
import type { OrbitNasa, OrbitNasaTile } from "@/lib/api";
import { cn } from "@/lib/format";

export function NasaWall({ nasa }: { nasa: OrbitNasa | null }) {
  const tiles = nasa?.gallery?.length ? nasa.gallery : nasa?.sequence ?? [];
  const [active, setActive] = useState(0);
  const hero = tiles[active] ?? nasa?.hero;

  if (!nasa) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--line)]" />;
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-ink">
        {hero?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.url}
            alt={hero.title}
            className="max-h-[480px] w-full object-cover object-center"
            loading="eager"
          />
        ) : (
          <div className="grid h-64 place-items-center text-paper/60">No NASA tile</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-4 text-paper">
          <p className="label text-paper/70">NASA GIBS · live · {hero?.date}</p>
          <p className="text-lg font-extrabold leading-tight">{hero?.title}</p>
          <p className="text-[0.82rem] text-paper/80">{hero?.vibe}</p>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-oxide px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-paper">
          NASA API connected
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile, i) => (
          <button
            key={`${tile.id}-${tile.date}-${i}`}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "group overflow-hidden rounded-md border text-start transition",
              i === active ? "border-ink ring-2 ring-ink/30" : "border-[var(--line)] hover:border-ink/40",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tile.url} alt={tile.title} className="h-24 w-full object-cover" loading="lazy" />
            <div className="px-2 py-1.5">
              <p className="truncate text-[0.72rem] font-bold leading-tight">{tile.title}</p>
              <p className="label truncate normal-case opacity-70">{tile.date}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="text-[0.78rem] text-muted">{nasa.note}</p>
    </div>
  );
}

export type { OrbitNasaTile };
