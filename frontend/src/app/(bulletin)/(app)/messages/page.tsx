"use client";

import { CrewTable, IntakePanel } from "@/components/dash/people";
import { CouncilPanel } from "@/components/dash/decide";
import { PageHead } from "@/components/dash/page-head";
import { useNabd } from "@/lib/store";

export default function MessagesScreen() {
  const { t } = useNabd();
  return (
    <>
      <PageHead title="side.messages" sub={t("words.aside")} />
      <div className="grid gap-3 xl:grid-cols-12">
        <IntakePanel className="xl:col-span-7" large />
        <CouncilPanel className="xl:col-span-5" />
        <CrewTable className="xl:col-span-12" />
      </div>
    </>
  );
}
