"use client";

import { Kpis } from "@/components/dash/kpis";
import { DriversPanel, ExposedPanel, TrendPanel } from "@/components/dash/land";
import { LiveMap } from "@/components/dash/live-map";
import { CouncilPanel, PlaybookPanel } from "@/components/dash/decide";
import { CrewTable } from "@/components/dash/people";
import { RelayPanel } from "@/components/dash/relay";
import { NewsPanel } from "@/components/dash/world";
import { PageHead } from "@/components/dash/page-head";
import { useNabd } from "@/lib/store";
import { headline } from "@/lib/story";

export default function Overview() {
  const { snapshot, lang } = useNabd();
  return (
    <>
      <PageHead title="side.overview" sub={snapshot ? `${headline(snapshot, lang).title.replace(/\*/g, "")} ${headline(snapshot, lang).deck}` : undefined} />
      <Kpis />
      <div className="mt-3 grid gap-3 xl:grid-cols-12">
        <LiveMap compact className="min-h-[440px] rounded-[14px] border border-[var(--line)] xl:col-span-5 xl:row-span-2" />
        <TrendPanel className="xl:col-span-4" />
        <CouncilPanel className="xl:col-span-3 xl:row-span-2" />
        <DriversPanel className="xl:col-span-2" />
        <ExposedPanel className="xl:col-span-2" />
        <CrewTable className="xl:col-span-5" />
        <PlaybookPanel className="xl:col-span-4" />
        <RelayPanel className="xl:col-span-3" />
        <NewsPanel className="xl:col-span-12" limit={4} />
      </div>
    </>
  );
}
