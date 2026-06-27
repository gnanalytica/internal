"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import {
  barMetrics,
  computeRange,
  monthsForRange,
  quartersForRange,
  snapRangeToQuarters,
  todayOffset,
  type DateInput,
} from "@/lib/roadmap";
import { cn } from "@/lib/utils";

export type GanttItem = {
  id: string;
  title: string;
  href: string;
  startDate: DateInput;
  targetDate: DateInput;
  color: string;
  progress?: number;
  statusLabel?: string;
  meta?: ReactNode;
};

export type GanttGroup = { key: string; name: string; color: string; items: GanttItem[] };

type Dates = { startDate: Date | null; targetDate: Date | null };
type DragMode = "move" | "start" | "end";

const NAME_W = 260;
const DAY = 86_400_000;
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const clampZoom = (n: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, n));
const alpha = (c: string, a: string) => (c.length === 7 ? c + a : c);
const toMs = (d: DateInput) => (d ? new Date(d).getTime() : null);
const fmt = (d: DateInput) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : null;
const rangeText = (s: DateInput, t: DateInput) => {
  const a = fmt(s);
  const b = fmt(t);
  if (a && b) return `${a} – ${b}`;
  return a ?? b ?? "No dates";
};

export function RoadmapChart({
  groups,
  nowISO,
  scale: scaleProp = "quarter",
  labelHeader = "Item",
  showGroupHeaders = false,
  legend,
  onReschedule,
}: {
  groups: GanttGroup[];
  nowISO: string;
  scale?: "quarter" | "month";
  labelHeader?: string;
  showGroupHeaders?: boolean;
  legend?: ReactNode;
  /** When provided, bars become draggable/resizable; called on drop. */
  onReschedule?: (id: string, dates: Dates) => void;
}) {
  const router = useRouter();
  const [scale, setScale] = useState<"quarter" | "month">(scaleProp);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<{ id: string; startMs: number; endMs: number } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { startMs: number; endMs: number }>>({});
  // Horizontal zoom: 1 = fit width; >1 widens the track so it scrolls.
  const [zoom, setZoom] = useState(1);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<
    | { pointerX: number; startMs: number; endMs: number; curS: number; curE: number; mode: DragMode; id: string; trackW: number; moved: boolean; href: string }
    | null
  >(null);

  const zoomRef = useRef(1);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Trackpad: two-finger horizontal swipe pans (native); pinch (ctrl/⌘+wheel)
  // zooms; shift+wheel also pans. Native non-passive listener so we can
  // preventDefault on pinch (else the browser page-zooms).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const z = zoomRef.current;
        const next = clampZoom(z * (1 - e.deltaY * 0.01));
        if (next === z) return;
        // Keep the point under the cursor roughly fixed while zooming.
        const cursorX = e.clientX - el.getBoundingClientRect().left;
        const content = el.scrollLeft + cursorX;
        setZoom(next);
        requestAnimationFrame(() => {
          el.scrollLeft = content * (next / z) - cursorX;
        });
      } else if (e.shiftKey && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
      // Otherwise let the browser handle native deltaX (horizontal swipe) and
      // deltaY (vertical row scroll).
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const now = new Date(nowISO);
  const items = groups.flatMap((g) => g.items);

  // Clear optimistic overrides once incoming data reflects the new dates.
  // Render-time adjustment per the React docs (no effect needed).
  const sig = items.map((i) => `${i.id}:${i.startDate ?? ""}:${i.targetDate ?? ""}`).join("|");
  const [prevSig, setPrevSig] = useState(sig);
  if (prevSig !== sig) {
    setPrevSig(sig);
    setOverrides({});
  }

  const eff = (it: GanttItem): { s: DateInput; t: DateInput } => {
    if (drag && drag.id === it.id) return { s: new Date(drag.startMs), t: new Date(drag.endMs) };
    const o = overrides[it.id];
    if (o) return { s: new Date(o.startMs), t: new Date(o.endMs) };
    return { s: it.startDate, t: it.targetDate };
  };

  // Range uses committed/override dates (NOT the live drag preview) so the axis
  // stays stable while a bar is being dragged.
  const scheduled = items.filter((i) => i.startDate || i.targetDate || overrides[i.id]);
  const base = computeRange(
    scheduled.map((i) => {
      const o = overrides[i.id];
      return o
        ? { startDate: new Date(o.startMs), targetDate: new Date(o.endMs) }
        : { startDate: i.startDate, targetDate: i.targetDate };
    }),
    now,
  );
  const range = scale === "quarter" ? snapRangeToQuarters(base) : base;
  const cols = scale === "quarter" ? quartersForRange(range) : monthsForRange(range);
  const todayFrac = todayOffset(range, now);
  const todayPct = todayFrac === null ? null : todayFrac * 100;
  const isCurrent = (leftPct: number, widthPct: number) =>
    todayPct !== null && todayPct >= leftPct && todayPct < leftPct + widthPct;

  const beginDrag = (e: ReactPointerEvent, it: GanttItem, mode: DragMode) => {
    if (!onReschedule) return;
    e.preventDefault();
    e.stopPropagation();
    const { s, t } = eff(it);
    let sMs = toMs(s);
    let eMs = toMs(t);
    if (sMs !== null && eMs === null) eMs = sMs + 14 * DAY;
    if (eMs !== null && sMs === null) sMs = eMs - 14 * DAY;
    if (sMs === null || eMs === null) return;
    const trackW = trackRef.current?.offsetWidth ?? 1;
    const total = range.end.getTime() - range.start.getTime();
    dragRef.current = { pointerX: e.clientX, startMs: sMs, endMs: eMs, curS: sMs, curE: eMs, mode, id: it.id, trackW, moved: false, href: it.href };

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.pointerX;
      if (Math.abs(dx) > 3) d.moved = true;
      const deltaMs = Math.round(((dx / d.trackW) * total) / DAY) * DAY;
      let ns = d.startMs;
      let ne = d.endMs;
      if (mode === "move") {
        ns = d.startMs + deltaMs;
        ne = d.endMs + deltaMs;
      } else if (mode === "start") {
        ns = Math.min(d.startMs + deltaMs, d.endMs - DAY);
      } else {
        ne = Math.max(d.endMs + deltaMs, d.startMs + DAY);
      }
      d.curS = ns;
      d.curE = ne;
      setDrag({ id: d.id, startMs: ns, endMs: ne });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      if (d.moved) {
        setOverrides((prev) => ({ ...prev, [d.id]: { startMs: d.curS, endMs: d.curE } }));
        onReschedule(d.id, { startDate: new Date(d.curS), targetDate: new Date(d.curE) });
      } else {
        router.push(d.href);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const scrollToToday = () => {
    const sc = scrollRef.current;
    const tr = trackRef.current;
    if (!sc || !tr || todayFrac === null) return;
    const left = NAME_W + todayFrac * tr.offsetWidth - sc.clientWidth / 2;
    sc.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  };

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={cn("flex h-full flex-col", drag && "select-none")}>
      {/* Toolbar: legend + zoom + today */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">{legend}</div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex rounded-md border p-0.5">
            {(["month", "quarter"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                  scale === s ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Zoom: − / reset / + (pinch or ⌘-scroll also zoom) */}
          <div className="flex items-center rounded-md border p-0.5">
            <button
              onClick={() => setZoom((z) => clampZoom(z / 1.5))}
              disabled={zoom <= ZOOM_MIN}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              onClick={() => setZoom(1)}
              className="min-w-9 rounded px-1 py-0.5 text-center text-[11px] font-medium tabular-nums text-muted-foreground hover:text-foreground"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => clampZoom(z * 1.5))}
              disabled={zoom >= ZOOM_MAX}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          {todayPct !== null && (
            <button
              onClick={scrollToToday}
              className="rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-auto overscroll-x-contain">
        <div
          className="relative"
          style={{ width: `${zoom * 100}%`, minWidth: NAME_W + 640 }}
        >
          {/* Column header */}
          <div className="sticky top-0 z-20 flex border-b bg-background/95 backdrop-blur">
            <div
              className="shrink-0 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ width: NAME_W }}
            >
              {labelHeader}
            </div>
            <div className="relative h-10 flex-1">
              {cols.map((c, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute inset-y-0 flex items-center border-l px-2 text-[11px] font-medium",
                    isCurrent(c.leftPct, c.widthPct) ? "bg-brand/[0.06] text-foreground" : "text-muted-foreground",
                  )}
                  style={{ left: `${c.leftPct}%`, width: `${c.widthPct}%` }}
                >
                  {c.label}
                </div>
              ))}
              {todayPct !== null && (
                <div
                  className="absolute top-1 z-10 -translate-x-1/2 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm"
                  style={{ left: `${todayPct}%` }}
                >
                  Today
                </div>
              )}
            </div>
          </div>

          {/* Rows + shared background grid */}
          <div className="relative">
            <div ref={trackRef} className="pointer-events-none absolute inset-y-0 z-0" style={{ left: NAME_W, right: 0 }}>
              {cols.map((c, i) => (
                <div
                  key={i}
                  className={cn("absolute inset-y-0 border-l", isCurrent(c.leftPct, c.widthPct) && "bg-brand/[0.04]")}
                  style={{ left: `${c.leftPct}%`, width: `${c.widthPct}%` }}
                />
              ))}
              {todayPct !== null && (
                <div className="absolute inset-y-0 w-px bg-brand/60" style={{ left: `${todayPct}%` }} />
              )}
            </div>

            <div className="relative z-10">
              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.key);
                return (
                  <div key={g.key}>
                    {showGroupHeaders && (
                      <button
                        onClick={() => toggle(g.key)}
                        className="flex w-full items-center gap-2 border-b bg-muted/40 px-4 py-1.5 text-left hover:bg-muted/60"
                      >
                        <ChevronRight className={cn("size-3 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
                        <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="text-xs font-semibold">{g.name}</span>
                        <span className="text-[11px] text-muted-foreground">{g.items.length}</span>
                      </button>
                    )}
                    {!isCollapsed &&
                      g.items.map((it) => {
                        const { s, t } = eff(it);
                        const bar = barMetrics({ startDate: s, targetDate: t }, range);
                        const hasProgress = typeof it.progress === "number";
                        const tip = [it.title, it.statusLabel, rangeText(s, t)].filter(Boolean).join(" · ");
                        const barStyle = {
                          left: `${bar?.leftPct ?? 0}%`,
                          width: `${bar?.widthPct ?? 0}%`,
                          backgroundColor: hasProgress ? alpha(it.color, "33") : it.color,
                        };
                        return (
                          <div key={it.id} className="group/row flex items-stretch border-b last:border-b-0 hover:bg-accent/30">
                            <Link
                              href={it.href}
                              className="flex shrink-0 flex-col justify-center gap-0.5 px-4 py-2"
                              style={{ width: NAME_W }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="size-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                                  style={{ backgroundColor: it.color }}
                                />
                                <span className="truncate text-sm font-medium" title={it.title}>
                                  {it.title}
                                </span>
                              </div>
                              <span className="truncate pl-4 text-[11px] tabular-nums text-muted-foreground">
                                {rangeText(s, t)}
                                {it.meta ? <span className="normal-nums"> · {it.meta}</span> : null}
                              </span>
                            </Link>
                            <div className="relative flex-1">
                              {bar && onReschedule ? (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  title={tip}
                                  onPointerDown={(e) => beginDrag(e, it, "move")}
                                  className="group/bar absolute top-1/2 flex h-[22px] -translate-y-1/2 cursor-grab items-center overflow-hidden rounded-md shadow-sm ring-1 ring-inset ring-black/10 active:cursor-grabbing"
                                  style={barStyle}
                                >
                                  {hasProgress && (
                                    <div
                                      className="absolute inset-y-0 left-0 rounded-l-md"
                                      style={{ width: `${it.progress}%`, backgroundColor: it.color }}
                                    />
                                  )}
                                  <span
                                    onPointerDown={(e) => beginDrag(e, it, "start")}
                                    className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize bg-white/0 group-hover/bar:bg-white/40"
                                  />
                                  <span
                                    onPointerDown={(e) => beginDrag(e, it, "end")}
                                    className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize bg-white/0 group-hover/bar:bg-white/40"
                                  />
                                  {hasProgress && bar.widthPct > 7 && (
                                    <span className="relative ml-auto pr-1.5 text-[10px] font-semibold text-white/90">
                                      {it.progress}%
                                    </span>
                                  )}
                                </div>
                              ) : bar ? (
                                <Link
                                  href={it.href}
                                  title={tip}
                                  className="absolute top-1/2 flex h-[22px] -translate-y-1/2 items-center overflow-hidden rounded-md shadow-sm ring-1 ring-inset ring-black/10 hover:brightness-105"
                                  style={barStyle}
                                >
                                  {hasProgress && (
                                    <div
                                      className="absolute inset-y-0 left-0 rounded-l-md"
                                      style={{ width: `${it.progress}%`, backgroundColor: it.color }}
                                    />
                                  )}
                                  {hasProgress && bar.widthPct > 7 && (
                                    <span className="relative ml-auto pr-1.5 text-[10px] font-semibold text-white/90">
                                      {it.progress}%
                                    </span>
                                  )}
                                </Link>
                              ) : (
                                <Link
                                  href={it.href}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                                >
                                  Set start &amp; target dates
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className="px-4 py-16 text-center text-sm text-muted-foreground">Nothing scheduled yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
