"use client";

import { DriversPanel, ExposedPanel, SignalsPanel, TrendPanel } from "@/components/dash/land";
import { CouncilPanel } from "@/components/dash/decide";
import { PageHead } from "@/components/dash/page-head";
import { ValidationPanel } from "@/components/dash/validation";
import { useNabd } from "@/lib/store";

export default function SignalsScreen() {
  const { t } = useNabd();
  return (
    <>
      <PageHead title="side.signals" sub={t("tip.aside")} />
      <div className="grid gap-3 xl:grid-cols-12">
        <TrendPanel className="xl:col-span-8" height={180} />
        <DriversPanel className="xl:col-span-4" />
        <SignalsPanel className="xl:col-span-8" detailed />
        <CouncilPanel className="xl:col-span-4" detailed />
        <ValidationPanel className="xl:col-span-12" />
        <ExposedPanel className="xl:col-span-12" graph />
      </div>
    </>
  );
}
