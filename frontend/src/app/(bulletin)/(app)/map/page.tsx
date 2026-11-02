"use client";

import { LiveMap } from "@/components/dash/live-map";

export default function MapScreen() {
  return <LiveMap className="-mx-4 -my-4 h-[calc(100dvh-var(--topbar,3.4rem))] lg:-mx-6 lg:-my-5" />;
}
