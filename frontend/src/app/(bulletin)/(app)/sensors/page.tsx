"use client";

import { CouncilPanel } from "@/components/dash/decide";
import { TrustPanel } from "@/components/dash/trust";
import { PageHead } from "@/components/dash/page-head";
import { Panel } from "@/components/dash/ui";
import { useNabd } from "@/lib/store";
import { num } from "@/lib/format";

export default function SensorsScreen() {
  const { snapshot: s, t } = useNabd();
  const ref = s?.fusion.reference ?? {};
  const ground = s?.fusion.ground ?? {};
  return (
    <>
      <PageHead title="side.sensors" sub={t("trust.aside")} />
      <div className="grid gap-3 xl:grid-cols-12">
        <TrustPanel className="xl:col-span-8" consoleHeight={420} />
        <div className="space-y-3 xl:col-span-4">
          <Panel title="Fusion — satellite vs ground">
            <table className="w-full text-[0.82rem]" dir="ltr">
              <thead>
                <tr className="label border-b border-[var(--line)]">
                  <th className="pb-1.5 text-start font-medium">signal</th>
                  <th className="pb-1.5 text-end font-medium">reference</th>
                  <th className="pb-1.5 text-end font-medium">ground</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys({ ...ref, ...ground }).map((k) => (
                  <tr key={k} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-1.5 font-semibold">{k}</td>
                    <td className="py-1.5 text-end tabular-nums">{num(ref[k] ?? null, 1)}</td>
                    <td className="py-1.5 text-end tabular-nums">{num(ground[k] ?? null, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="label mt-2 normal-case">{s?.fusion.applied.join(" · ") || "Ground data may raise risk, never lower it."}</p>
          </Panel>
          <CouncilPanel />
        </div>
      </div>
    </>
  );
}
