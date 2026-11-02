"use client";

import { Bluetooth, BluetoothOff, ExternalLink, RotateCcw } from "lucide-react";
import { useNabd } from "@/lib/store";
import { ACTION_LABEL, PHONES } from "@/lib/alerts";
import { ACTIONS, FRAME_BYTES, LEVELS, SITES, type Action } from "@/lib/mesh";
import { useMeshNode } from "@/lib/use-mesh";
import { cn } from "@/lib/format";
import { LevelPill, Panel } from "./ui";

export const OPS_ROOM = "ops";
const phoneUrl = (slot: number) => `/relay?slot=${slot}&room=${OPS_ROOM}`;

export function RelayPanel({ className }: { className?: string }) {
  const { snapshot: s, siteId, t } = useNabd();
  const node = useMeshNode(0, OPS_ROOM);
  const level = Math.max(0, LEVELS.indexOf(s?.council.label ?? "WATCH"));
  const site = Math.max(0, SITES.indexOf(siteId as (typeof SITES)[number]));
  const sent = node.heard.find((h) => h.packet.kind === "alert" && h.mine);
  const acks = sent ? node.heard.filter((h) => h.packet.kind === "ack" && h.packet.id === sent.packet.id) : [];

  return (
    <Panel
      title={t("dash.relay")}
      action={
        <span className="flex items-center gap-1.5">
          <button onClick={() => node.setInRange(!node.inRange)} title="radio" className={cn("grid size-6 place-items-center rounded-full", node.inRange ? "bg-gulf/15 text-gulf" : "bg-oxide/15 text-oxide")}>
            {node.inRange ? <Bluetooth className="size-3.5" /> : <BluetoothOff className="size-3.5" />}
          </button>
          <button onClick={node.reset} title="reset" className="grid size-6 place-items-center rounded-full text-muted hover:text-ink">
            <RotateCcw className="size-3.5" />
          </button>
        </span>
      }
      className={className}
    >
      <p className="text-[0.76rem] leading-snug text-muted">
        {FRAME_BYTES}-byte signed frame · hops phone to phone over Bluetooth LE · no internet
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {ACTIONS.map((a: Action) => (
          <button
            key={a}
            onClick={() => node.alert(site, level, a)}
            className={cn("pill justify-center border py-1.5", a === "stop" ? "border-oxide bg-oxide text-paper" : "border-[var(--line)] hover:border-ink")}
          >
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>
      {sent && (
        <div className="mt-3 border-t border-[var(--line)] pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.8rem] font-bold">{ACTION_LABEL[ACTIONS[sent.packet.action] ?? "stop"]}</span>
            <LevelPill level={LEVELS[sent.packet.level] ?? "WATCH"} />
          </div>
          <ul className="mt-1.5 space-y-1">
            {PHONES.filter((p) => p.slot !== 0).map((p) => {
              const a = acks.find((k) => k.packet.origin === p.slot);
              return (
                <li key={p.slot} className="flex items-center justify-between text-[0.8rem]">
                  <a href={phoneUrl(p.slot)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold hover:underline">
                    {p.name} <ExternalLink className="size-3 text-muted" />
                  </a>
                  <span className={cn("text-[0.72rem] font-bold", a ? "text-gulf" : "text-muted")}>{a ? `✓ ${a.hops} hop${a.hops === 1 ? "" : "s"}` : "…"}</span>
                </li>
              );
            })}
          </ul>
          <p className="label mt-1">
            {acks.length}/{PHONES.length - 1} {t("dash.acks")}
          </p>
        </div>
      )}
      <div className="mono mt-auto pt-2 text-[0.62rem] leading-snug text-muted" dir="ltr">
        {node.log.slice(0, 3).map((l) => (
          <div key={l.at + l.text} className={cn(l.tone === "bad" && "text-oxide")}>
            {l.text}
          </div>
        ))}      </div>
    </Panel>
  );
}

export function PhonesGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" dir="ltr">
      {PHONES.filter((p) => p.slot !== 0).map((p) => (
        <div key={p.slot} className="overflow-hidden rounded-[26px] border-[6px] border-ink bg-ink shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)]">
          <iframe title={`${p.name} phone`} src={phoneUrl(p.slot)} className="block h-[560px] w-full rounded-[20px] bg-paper" />
        </div>
      ))}
    </div>
  );
}
