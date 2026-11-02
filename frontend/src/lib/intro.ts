import { useSyncExternalStore } from "react";

let done = false;
const listeners = new Set<() => void>();

export const intro = {
  isDone: () => done,
  finish() {
    if (done) return;
    done = true;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useIntroDone() {
  return useSyncExternalStore(intro.subscribe, intro.isDone, () => false);
}
