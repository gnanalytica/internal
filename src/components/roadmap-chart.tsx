"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  barMetrics,
  computeRange,
  monthsForRange,
  quartersForRange,
  snapRangeToQuarters,
  todayOffset,
  type DateInput,
} from "@/lib/roadmap";

export type GanttItem = {
  id: string;
  title: string;
  href: string;
  startDate: DateInput;
  targetDate: DateInput;
  color: string;
  /** 0–100; when set, the bar shows a progress fill over a translucent track. */
  progress?: number;
  statusLabel?: string;
  /** Small second line under the title in the label column. */
  meta?: ReactNode;
};

export type GanttGroup = { key: string; name: string; color: string; items: GanttItem[] };

const NAME_W = 260; // px, left label column
const alpha = (c: string, a: string) => (c.length === 7 ? c + a : c);

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
  scale = "quarter",
  labelHeader = "Item",
  showGroupHeaders = false,
  legend,
}: {
  groups: GanttGroup[];
  nowISO: string;
  scale?: "quarter" | "month";
  labelHeader?: string;
  showGroupHeaders?: boolean;
  legend?: ReactNode;
}) {
  const now = new Date(nowISO);
  const items = groups.flatMap((g) => g.items);
  const scheduled = items.filter((i) => i.startDate || i.targetDate);
  const base = computeRange(scheduled, now);
  const range = scale === "quarter" ? snapRangeToQuarters(base) : base;
  const cols = scale === "quarter" ? quartersForRange(range) : monthsForRange(range);
  const todayFrac = todayOffset(range, now);
  const todayPct = todayFrac === null ? null : todayFrac * 100;
  const isCurrent = (leftPct: number, widthPct: number) =>
    todayPct !== null && todayPct >= leftPct && todayPct < leftPct + widthPct;

  return (
    <div className="flex h-full flex-col">
      {legend && (
        <div className="flex items-center gap-3 border-b px-4 py-2 text-[11px] text-muted-foreground">
          {legend}
        </div>
      )}
      <div className="scrollbar-thin flex-1 overflow-auto">
        <div className="relative min-w-full" style={{ minWidth: NAME_W + 640 }}>
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
                  className={
                    "absolute inset-y-0 flex items-center border-l px-2 text-[11px] font-medium " +
                    (isCurrent(c.leftPct, c.widthPct)
                      ? "bg-brand/[0.06] text-foreground"
                      : "text-muted-foreground")
                  }
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

          {/* Rows with a shared background grid */}
          <div className="relative">
            {/* Grid + today line behind the rows */}
            <div
              className="pointer-events-none absolute inset-y-0 z-0"
              style={{ left: NAME_W, right: 0 }}
            >
              {cols.map((c, i) => (
                <div
                  key={i}
                  className={
                    "absolute inset-y-0 border-l " +
                    (isCurrent(c.leftPct, c.widthPct) ? "bg-brand/[0.04]" : "")
                  }
                  style={{ left: `${c.leftPct}%`, width: `${c.widthPct}%` }}
                />
              ))}
              {todayPct !== null && (
                <div
                  className="absolute inset-y-0 w-px bg-brand/60"
                  style={{ left: `${todayPct}%` }}
                />
              )}
            </div>

            {/* Rows */}
            <div className="relative z-10">
              {groups.map((g) => (
                <div key={g.key}>
                  {showGroupHeaders && (
                    <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="text-xs font-semibold">{g.name}</span>
                      <span className="text-[11px] text-muted-foreground">{g.items.length}</span>
                    </div>
                  )}
                  {g.items.map((it) => {
                    const bar = barMetrics(it, range);
                    const hasProgress = typeof it.progress === "number";
                    const tip = [it.title, it.statusLabel, rangeText(it.startDate, it.targetDate)]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div
                        key={it.id}
                        className="group/row flex items-stretch border-b last:border-b-0 hover:bg-accent/30"
                      >
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
                          {it.meta && (
                            <span className="truncate pl-4 text-[11px] text-muted-foreground">
                              {it.meta}
                            </span>
                          )}
                        </Link>
                        <div className="relative flex-1">
                          {bar ? (
                            <Link
                              href={it.href}
                              title={tip}
                              className="absolute top-1/2 flex h-[22px] -translate-y-1/2 items-center overflow-hidden rounded-md shadow-sm ring-1 ring-inset ring-black/10 transition-[filter] group-hover/row:brightness-105"
                              style={{
                                left: `${bar.leftPct}%`,
                                width: `${bar.widthPct}%`,
                                backgroundColor: hasProgress ? alpha(it.color, "33") : it.color,
                              }}
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
              ))}

              {items.length === 0 && (
                <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                  Nothing scheduled yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
