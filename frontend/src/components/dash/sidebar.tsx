"use client";

import { Activity, BellRing, FileClock, LayoutDashboard, Map, MessagesSquare, Satellite, ShieldCheck, Users, Waves } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNabd } from "@/lib/store";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/format";

const GROUPS: { head: TKey; items: { href: string; key: TKey; icon: typeof Map }[] }[] = [
  {
    head: "side.monitor",
    items: [
      { href: "/", key: "side.overview", icon: LayoutDashboard },
      { href: "/map", key: "side.map", icon: Map },
      { href: "/signals", key: "side.signals", icon: Activity },
      { href: "/crew", key: "side.crew", icon: Users },
    ],
  },
  {
    head: "side.respond",
    items: [
      { href: "/orbit", key: "side.orbit", icon: Satellite },
      { href: "/alerts", key: "side.alerts", icon: BellRing },
      { href: "/messages", key: "side.messages", icon: MessagesSquare },
      { href: "/scenario", key: "side.scenario", icon: Waves },
    ],
  },
  {
    head: "side.verify",
    items: [
      { href: "/sensors", key: "side.sensors", icon: ShieldCheck },
      { href: "/audit", key: "side.audit", icon: FileClock },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  const { snapshot, error, apiOnline, t } = useNabd();
  const crossing = snapshot?.crew.filter((w) => w.eta_hours !== null).length ?? 0;
  const online = apiOnline || (!!snapshot && !error);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-e border-[var(--line)] bg-[var(--panel)] lg:flex">
      <Link href="/" className="flex items-baseline gap-2 px-5 pb-4 pt-5">
        <span className="num text-[1.9rem]">NABD</span>
        <span className="arabic text-xl text-oxide">نبض</span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3">
        {GROUPS.map((g) => (
          <div key={g.head}>
            <p className="label px-2 pb-1.5">{t(g.head)}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ href, key, icon: Icon }) => {
                const on = href === "/" ? path === "/" : path.startsWith(href);
                const badge = href === "/crew" && crossing ? crossing : null;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.88rem] font-bold transition-colors",
                        on ? "bg-ink text-paper" : "text-ink/75 hover:bg-sand/70 hover:text-ink",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="flex-1">{t(key)}</span>
                      {badge && <span className="num grid min-w-5 place-items-center rounded-full bg-oxide px-1.5 text-[0.7rem] text-paper">{badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-[var(--line)] p-3">
        <div className="flex items-center gap-2 px-2.5 text-[0.75rem] font-semibold text-muted">
          <span className={cn("size-2 rounded-full", online ? "beat bg-gulf" : "bg-oxide")} />
          {t("side.backend")} · {online ? t("side.online") : t("side.offline")}
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  const { t } = useNabd();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-[var(--line)] px-3 py-2 lg:hidden">
      {GROUPS.flatMap((g) => g.items).map(({ href, key, icon: Icon }) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-bold", on ? "bg-ink text-paper" : "bg-[var(--panel)]")}>
            <Icon className="size-3.5" /> {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
