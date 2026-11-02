"use client";

import { Bluetooth, BluetoothOff, Check, WifiOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ACTION_LABEL, ACTION_TEXT, GOT_IT, PHONES, RTL_LANGS, type AlertLang } from "@/lib/alerts";
import { ACTIONS, FRAME_BYTES, LEVELS, SITES, type Action } from "@/lib/mesh";
import { LEVEL_COPY, cn } from "@/lib/format";
import { useMeshNode, type Heard } from "@/lib/use-mesh";

const SITE_NAME: Record<(typeof SITES)[number], string> = {
  "al-quaa": "Al Qua'a",
  "das-island": "Das Island",
  "fujairah-coast": "Fujairah coast",
  "dubai-south": "Dubai South",
  hatta: "Hatta",
};

const online = {
  get: () => navigator.onLine,
  subscribe(f: () => void) {
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    return () => {
      window.removeEventListener("online", f);
      window.removeEventListener("offline", f);
    };
  },
};

const hhmm = (ms: number) => new Date(ms).toTimeString().slice(0, 5);

export function Phone() {
  const q = useSearchParams();
  const slot = Number(q.get("slot") ?? 0);
  const preset = PHONES.find((p) => p.slot === slot);
  const name = q.get("name") ?? preset?.name ?? `Phone ${slot}`;
  const lang = (q.get("lang") ?? preset?.lang ?? "en") as AlertLang;
  const node = useMeshNode(slot, q.get("room") ?? "open");
  const isOnline = useSyncExternalStore(online.subscribe, online.get, () => true);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[380px] flex-col bg-paper text-ink">
      <div className="mono flex items-center justify-between border-b border-ink px-4 py-2 text-[0.65rem] uppercase tracking-widest">
        <span>
          {name} · {slot === 0 ? "office" : `phone ${slot}`}
        </span>
        <span className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1 text-oxide">
              <WifiOff className="size-3" /> no internet
            </span>
          )}
          {node.inRange ? <Bluetooth className="size-3.5 text-gulf" /> : <BluetoothOff className="size-3.5 text-muted" />}
        </span>
      </div>

      <div className="flex-1 px-4 py-4">{slot === 0 ? <Office node={node} /> : <Worker node={node} lang={lang} />}</div>

      <div className="border-t border-[var(--rule)] px-4 py-3">
        <button className={cn("chip w-full justify-center !text-[0.75rem]", !node.inRange && "!bg-ink !text-paper")} onClick={() => node.setInRange(!node.inRange)}>
          {node.inRange ? "Walk out of range" : "Back in range"}
        </button>
        <ol className="mono mt-3 space-y-0.5 text-[0.6rem] leading-snug" dir="ltr">
          {node.log.map((l) => (
            <li key={l.at + l.text} className={cn(l.tone === "bad" ? "text-oxide" : l.tone === "ok" ? "text-ink" : "text-muted")}>
              {hhmm(l.at)} {l.text}
            </li>
          ))}
          {!node.log.length && <li className="text-muted">listening…</li>}
        </ol>
      </div>
    </div>
  );
}

type Node = ReturnType<typeof useMeshNode>;

function latestAlert(heard: Heard[]) {
  return heard.find((h) => h.packet.kind === "alert");
}

function Worker({ node, lang }: { node: Node; lang: AlertLang }) {
  const last = latestAlert(node.heard);
  if (!last) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <span className="beat size-3 rounded-full bg-gulf" />
        <p className="display mt-4 text-2xl italic">Waiting for the site office.</p>
        <p className="mt-2 text-[0.8rem] text-muted">No internet needed — alerts hop from phone to phone.</p>
      </div>
    );
  }
  const p = last.packet;
  const action = ACTIONS[p.action] ?? "stop";
  const level = LEVELS[p.level] ?? "WATCH";
  const acked = node.heard.some((h) => h.packet.kind === "ack" && h.mine && h.packet.id === p.id);
  const rtl = RTL_LANGS.has(lang);

  return (
    <div key={p.id} className="flex h-full flex-col">
      <div className="border-2 p-4" style={{ borderColor: LEVEL_COPY[level].tone }}>
        <p className="mono text-[0.65rem] font-semibold uppercase tracking-widest" style={{ color: LEVEL_COPY[level].tone }}>
          {LEVEL_COPY[level].en} · {SITE_NAME[SITES[p.site]] ?? "site"}
        </p>
        <p dir={rtl ? "rtl" : "ltr"} lang={lang} className={cn("mt-3 text-[1.7rem] font-semibold leading-tight", rtl && "arabic")}>
          {ACTION_TEXT[action][lang]}
        </p>
        {lang !== "en" && <p className="mt-2 text-[0.85rem] text-muted">{ACTION_TEXT[action].en}</p>}
        <p className="mono mt-4 text-[0.62rem] text-muted">
          {hhmm(p.issued * 60000)} · {p.hops === 0 ? "direct from office" : `relayed by ${p.hops} phone${p.hops > 1 ? "s" : ""}`} · {FRAME_BYTES} B signed
        </p>
      </div>
      <button
        className={cn("btn mt-4 justify-center py-4 text-lg", acked && "opacity-60")}
        disabled={acked}
        onClick={() => node.ack(p)}
        dir={rtl ? "rtl" : "ltr"}
      >
        {acked ? <Check className="size-5" /> : null} {GOT_IT[lang]}
      </button>
      {node.heard.filter((h) => h.packet.kind === "alert").length > 1 && (
        <ul className="mt-5 space-y-1 text-[0.75rem] text-muted">
          {node.heard
            .filter((h) => h.packet.kind === "alert" && h.packet.id !== p.id)
            .slice(0, 3)
            .map((h) => (
              <li key={h.packet.id} dir={rtl ? "rtl" : "ltr"}>
                {hhmm(h.packet.issued * 60000)} · {ACTION_TEXT[ACTIONS[h.packet.action] ?? "stop"][lang]}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Office({ node }: { node: Node }) {
  const q = useSearchParams();
  const [site, setSite] = useState(Math.max(0, SITES.indexOf((q.get("site") ?? "dubai-south") as (typeof SITES)[number])));
  const [level, setLevel] = useState(Math.max(0, LEVELS.indexOf((q.get("level") ?? "RESTRICT") as (typeof LEVELS)[number])));
  const sent = node.heard.find((h) => h.packet.kind === "alert" && h.mine);
  const acks = sent ? node.heard.filter((h) => h.packet.kind === "ack" && h.packet.id === sent.packet.id) : [];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 text-[0.8rem]">
        <select className="border border-ink bg-paper px-2 py-1.5" value={site} onChange={(e) => setSite(Number(e.target.value))}>
          {SITES.map((s, i) => (
            <option key={s} value={i}>
              {SITE_NAME[s]}
            </option>
          ))}
        </select>
        <select className="border border-ink bg-paper px-2 py-1.5" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
          {LEVELS.map((l, i) => (
            <option key={l} value={i}>
              {LEVEL_COPY[l].en}
            </option>
          ))}
        </select>
      </div>
      <p className="eyebrow mt-4 text-muted">Broadcast to the crew</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ACTIONS.map((a: Action) => (
          <button key={a} className={cn("chip justify-center !text-[0.78rem]", a === "stop" && "!border-oxide !text-oxide")} onClick={() => node.alert(site, level, a)}>
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>

      {sent && (
        <div className="mt-5 border-t border-ink pt-3">
          <p className="mono text-[0.65rem] text-muted">
            {hhmm(sent.at)} · {ACTION_LABEL[ACTIONS[sent.packet.action] ?? "stop"]} · {LEVEL_COPY[LEVELS[sent.packet.level] ?? "WATCH"].en}
          </p>
          <ul className="mt-2 divide-y divide-[var(--rule)]">
            {PHONES.filter((p) => p.slot !== 0).map((p) => {
              const a = acks.find((k) => k.packet.origin === p.slot);
              return (
                <li key={p.slot} className="flex items-center justify-between py-1.5 text-[0.85rem]">
                  <span>{p.name}</span>
                  <span className={cn("mono text-[0.65rem]", a ? "text-gulf" : "text-muted")}>
                    {a ? `✓ got it · ${a.hops} hop${a.hops === 1 ? "" : "s"}` : "…"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button className="mono mt-4 text-[0.6rem] text-muted underline" onClick={node.reset}>
        clear this phone
      </button>
    </div>
  );
}
