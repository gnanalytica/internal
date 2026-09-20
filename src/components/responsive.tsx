"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * A tab strip that scrolls sideways instead of overflowing the page.
 *
 * `TabsList` is `inline-flex w-fit`, so seven triggers are ~700px wide and on a
 * phone the last three were simply unreachable — clipped by the `overflow-hidden`
 * main element, with no way to scroll to them. The scrollbar is hidden because
 * the strip is short enough that a visible one costs more than it explains.
 */
export function ScrollTabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 overflow-x-auto overscroll-x-contain px-4 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList className={cn("w-max", className)}>{children}</TabsList>
    </div>
  );
}

/**
 * A table that keeps its own horizontal scroll rather than widening the page.
 * Anything wider than the viewport goes in one of these — the page body itself
 * must never scroll sideways.
 *
 * A silently clipped table is the failure this exists to avoid being: the
 * columns past the right edge were reachable by swiping and there was nothing
 * on screen to say so. A fade at the live edge is the cue; it is drawn only
 * while there is actually something to scroll to, so it never implies content
 * that is not there. `aria-hidden`, because a screen reader is already reading
 * the whole table — the fade is for eyes, and the region is focusable so a
 * keyboard can scroll it too.
 */
export function TableScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 1, right: max > 1 && el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The table's own width changes when rows load, not just when the box does.
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        onScroll={measure}
        tabIndex={0}
        className="-mx-1 overflow-x-auto overscroll-x-contain px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {children}
      </div>
      {edges.left && <ScrollEdge side="left" />}
      {edges.right && <ScrollEdge side="right" />}
      {edges.right && (
        // The fade alone is a white gradient over a white card — it softens the
        // cut without proving anything is past it. On a phone, where sideways
        // scrolling inside a page is not a thing people try, say it.
        <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">Swipe the table sideways for the rest of the columns</p>
      )}
    </div>
  );
}

function ScrollEdge({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 w-8",
        side === "right"
          ? "right-0 bg-gradient-to-l from-background to-transparent"
          : "left-0 bg-gradient-to-r from-background to-transparent",
      )}
    />
  );
}

/**
 * Filters: inline on a laptop, behind a toggle on a phone.
 *
 * Eight selects and four checkboxes wrap into six rows at 360px, which pushes
 * the results themselves below the fold on the screen whose whole job is to
 * show them. `summary` stays visible so the active-filter count is legible
 * without opening anything.
 */
export function FilterBar({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm"
        >
          <SlidersHorizontal className="size-4" />
          Filters
        </button>
        <span className="ml-auto truncate text-xs text-muted-foreground">{summary}</span>
      </div>
      <div className={cn("gap-2 sm:flex sm:flex-wrap sm:items-center", open ? "grid grid-cols-2" : "hidden sm:flex")}>
        {children}
        <span className="col-span-2 hidden text-xs text-muted-foreground sm:ml-auto sm:inline">{summary}</span>
      </div>
    </div>
  );
}

/**
 * Names a control on a phone and gets out of the way on a laptop.
 *
 * A dense editable row identifies its fields by column order and a
 * placeholder — and a placeholder is gone the moment there is a value in it.
 * Stacked two-across on a phone there is no column order left to read, so the
 * label shows below `lg`; from `lg` the wrapper is `display: contents` and the
 * control is a direct child of the row's flex container, exactly as before.
 */
export function Labelled({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("min-w-0 lg:contents", className)}>
      <span className="mb-0.5 block text-[11px] text-muted-foreground lg:hidden">{label}</span>
      {children}
    </label>
  );
}
