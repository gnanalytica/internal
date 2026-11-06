"use client";

import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * An underline that slides to the active tab. Put it as the last child of a
 * `relative` tab strip and pass the active tab's key; the active tab carries
 * `data-active`. It measures its own parent (a parent's ref is not attached
 * yet when a child's layout effect first runs) and follows the tab when the
 * strip resizes. Position is written straight to the element, so moving it
 * never re-renders the strip.
 */
export function TabIndicator({ activeKey, className }: { activeKey: string; className?: string }) {
  const bar = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const b = bar.current;
    const el = b?.parentElement;
    if (!el || !b) return;
    const measure = () => {
      const tab = el.querySelector<HTMLElement>("[data-active]");
      b.style.opacity = tab ? "1" : "0";
      if (!tab) return;
      b.style.left = `${tab.offsetLeft}px`;
      b.style.width = `${tab.offsetWidth}px`;
    };
    measure();
    // The first placement jumps; every move after it slides.
    const raf = requestAnimationFrame(() => (b.dataset.ready = ""));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [activeKey]);

  return (
    <span
      ref={bar}
      aria-hidden
      className={cn("pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-brand opacity-0 data-ready:transition-[left,width,opacity] data-ready:duration-300 data-ready:ease-[cubic-bezier(0.2,0,0,1)]", className)}
    />
  );
}
