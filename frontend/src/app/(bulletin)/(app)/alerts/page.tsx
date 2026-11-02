"use client";

import { PlaybookPanel } from "@/components/dash/decide";
import { PhonesGrid, RelayPanel } from "@/components/dash/relay";
import { MarketsPanel } from "@/components/dash/world";
import { PageHead } from "@/components/dash/page-head";
import { Panel } from "@/components/dash/ui";
import { useNabd } from "@/lib/store";

export default function AlertsScreen() {
  const { t } = useNabd();
  return (
    <>
      <PageHead title="side.alerts" sub={t("act.aside")} />
      <div className="grid gap-3 xl:grid-cols-12">
        <PlaybookPanel className="xl:col-span-5" detailed />
        <RelayPanel className="xl:col-span-4" />
        <MarketsPanel className="xl:col-span-3" />
        <Panel title={t("off.kicker")} className="xl:col-span-12" action={<span className="label">{t("off.title").replace(/\*/g, "")}</span>}>
          <div className="mb-3 grid gap-3 text-[0.82rem] text-muted md:grid-cols-3">
            <p>{t("off.how1")}</p>
            <p>{t("off.how2")}</p>
            <p>{t("off.how3")}</p>
          </div>
          <PhonesGrid />
          <p className="label mt-3 normal-case">{t("off.honest")}</p>
        </Panel>
      </div>
    </>
  );
}
