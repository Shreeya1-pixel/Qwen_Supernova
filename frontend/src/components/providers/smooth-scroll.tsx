"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { intro } from "@/lib/intro";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    if (!intro.isDone()) {
      lenis.stop();
      window.scrollTo(0, 0);
    }
    const unsubscribe = intro.subscribe(() => lenis.start());
    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!anchor) return;
      const target = document.querySelector(anchor.getAttribute("href")!);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -64 });
    };
    document.addEventListener("click", onClick);
    document.documentElement.classList.add("lenis");

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      document.removeEventListener("click", onClick);
      lenis.destroy();
      document.documentElement.classList.remove("lenis");
    };
  }, []);

  return <>{children}</>;
}
