"use client";

import { useState } from "react";
import { AuditPanel, PlaybookPanel } from "@/components/dash/decide";
import { JiraPanel } from "@/components/dash/jira-panel";
import { PageHead } from "@/components/dash/page-head";
import { Panel } from "@/components/dash/ui";
import { useNabd } from "@/lib/store";

export default function AuditScreen() {
  const { snapshot: s, t } = useNabd();
  const [filed, setFiled] = useState(0);
  return (
    <>
      <PageHead title="side.audit" sub="Every council decision is hash-chained: change one record and every later hash breaks. An inspector can verify the whole log." />
      <div className="grid gap-3 xl:grid-cols-12">
        <AuditPanel className="xl:col-span-7" limit={20} refresh={filed} />
        <div className="space-y-3 xl:col-span-5">
          <JiraPanel onFiled={() => setFiled((n) => n + 1)} />
          <PlaybookPanel />
          <Panel title={t("foot.sources")}>
            <ul className="space-y-1 text-[0.82rem]" dir="ltr">
              {(s?.sources ?? []).map((x) => (
                <li key={x} className="font-semibold">
                  {x}
                </li>
              ))}
              <li className="font-semibold">NASA GIBS · geoBoundaries · Google News RSS · Yahoo Finance</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
