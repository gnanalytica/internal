"use client";

import { useEffect } from "react";

/**
 * One global pointer listener that feeds the cursor position into any `.glow`
 * surface under it (as the --mx/--my CSS vars the spotlight reads). A single
 * rAF-throttled listener keeps it cheap regardless of how many cards exist.
 */
export function PointerGlow() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;

    const flush = () => {
      raf = 0;
      if (!pending) return;
      const { el, x, y } = pending;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) {
        el.style.setProperty("--mx", `${((x - r.left) / r.width) * 100}%`);
        el.style.setProperty("--my", `${((y - r.top) / r.height) * 100}%`);
      }
      pending = null;
    };

    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.<HTMLElement>(".glow");
      if (!el) return;
      pending = { el, x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(flush);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
