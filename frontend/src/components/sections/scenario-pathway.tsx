"use client";

import Link from "next/link";
import { useScenario } from "@/lib/scenario";
import { useNabd } from "@/lib/store";

/** Extra exposure row while a scenario zone is active: hazard → zone → residents. */
export function ScenarioPathway() {
  const { t } = useNabd();
  const sc = useScenario();
  if (!sc.zone || sc.population === null) return null;
  return (
    <Link href="/scenario" className="mt-3 block rounded-xl border-2 border-dashed border-[#ff3b30] p-2.5">
      <span className="label block text-[#ff3b30]">{t("scen.sim")}</span>
      <span className="block text-[0.85rem] font-bold">
        {t(`scen.h.${sc.hazard}`)} → {sc.zoneName} ({t("scen.zone")}) → {t("scen.residents")}
      </span>
      <span className="num text-xl">~{Math.round(sc.population).toLocaleString()}</span>
      {sc.sample && <span className="label ms-2 text-[#ff3b30]">SAMPLE DATA</span>}
    </Link>
  );
}
