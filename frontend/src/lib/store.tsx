"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api, type Scenario, type SiteSummary, type Snapshot } from "./api";
import { DICTS, type Lang, type TKey } from "./i18n";

interface NabdState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
  siteId: string;
  setSiteId: (id: string) => void;
  replay: string | null;
  setReplay: (at: string | null, siteId?: string) => void;
  ramadan: boolean;
  setRamadan: (on: boolean) => void;
  glare: boolean;
  setGlare: (on: boolean) => void;
  sites: SiteSummary[];
  scenarios: Scenario[];
  snapshot: Snapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const Ctx = createContext<NabdState | null>(null);
const POLL_MS = 5 * 60 * 1000;
const LANG_KEY = "nabd:lang";

const langListeners = new Set<() => void>();
const langStore = {
  get: (): Lang => (localStorage.getItem(LANG_KEY) === "ar" ? "ar" : "en"),
  set(l: Lang) {
    localStorage.setItem(LANG_KEY, l);
    langListeners.forEach((f) => f());
  },
  subscribe(f: () => void) {
    langListeners.add(f);
    window.addEventListener("storage", f);
    return () => {
      langListeners.delete(f);
      window.removeEventListener("storage", f);
    };
  },
};

export function NabdProvider({ children }: { children: React.ReactNode }) {
  const [siteId, setSiteId] = useState("dubai-south");
  const [replay, setReplayState] = useState<string | null>(null);
  const [ramadan, setRamadan] = useState(false);
  const [glare, setGlare] = useState(false);
  const lang = useSyncExternalStore(langStore.subscribe, langStore.get, () => "en" as Lang);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const request = useRef(0);

  const setReplay = useCallback((at: string | null, site?: string) => {
    setReplayState(at);
    if (site) setSiteId(site);
  }, []);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    api.scenarios().then((r) => setScenarios(r.scenarios)).catch(() => {});
  }, [error]);

  useEffect(() => {
    api.sites(replay).then((r) => setSites(r.sites)).catch(() => {});
  }, [replay, tick]);

  const requestKey = `${siteId}|${replay}|${ramadan}|${tick}`;
  const loading = settledKey !== requestKey;

  useEffect(() => {
    const id = ++request.current;
    api
      .site(siteId, { replay, ramadan })
      .then((s) => {
        if (id !== request.current) return;
        setSnapshot(s);
        setError(null);
      })
      .catch((e: Error) => id === request.current && setError(e.message))
      .finally(() => id === request.current && setSettledKey(`${siteId}|${replay}|${ramadan}|${tick}`));
  }, [siteId, replay, ramadan, tick]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(refresh, 5000);
    return () => clearTimeout(t);
  }, [error, refresh]);

  useEffect(() => {
    if (replay) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [replay, refresh]);

  useEffect(() => {
    document.documentElement.classList.toggle("glare", glare);
  }, [glare]);

  const setLang = useCallback((l: Lang) => langStore.set(l), []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const t = useCallback((key: TKey) => DICTS[lang][key], [lang]);

  const value = useMemo(
    () => ({
      lang, setLang, t,
      siteId, setSiteId, replay, setReplay, ramadan, setRamadan, glare, setGlare, sites, scenarios, snapshot, loading, error, refresh,
    }),
    [lang, setLang, t, siteId, replay, setReplay, ramadan, glare, sites, scenarios, snapshot, loading, error, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNabd() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNabd must be used inside <NabdProvider>");
  return ctx;
}
