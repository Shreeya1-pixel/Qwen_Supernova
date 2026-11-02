"use client";

import { CrewGrid, CrewTable } from "@/components/dash/people";
import { PageHead } from "@/components/dash/page-head";
import { useNabd } from "@/lib/store";

export default function CrewScreen() {
  const { ramadan, t } = useNabd();
  return (
    <>
      <PageHead title="side.crew" sub={t("crew.aside") + (ramadan ? ` ${t("crew.ramadanOn")}` : "")}>
        <span className="label">{t("crew.sim")}</span>
      </PageHead>
      <CrewTable />
      <div className="mt-3">
        <CrewGrid />
      </div>
    </>
  );
}
