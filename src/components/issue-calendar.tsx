"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { StatusIcon } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
import { byDueDay, monthGrid, shiftMonth } from "@/lib/task-calendar";
import type { StatusId } from "@/lib/constants";
import { istDay } from "@/lib/scorecard";
import { issueIdentifier, type IssueListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Chips shown per day before "+N more". */
const PER_DAY = 4;
const CLOSED = new Set(["done", "canceled"]);

/**
 * Tasks on a month grid by due date, Notion-style. Drag a task to another day
 * to reschedule it, or drag one from the "No due date" tray onto a day to give
 * it one. Days are India-time days, the same ones the list's due labels use.
 */
export function IssueCalendar({
  issues,
  now,
  onMove,
}: {
  issues: IssueListItem[];
  now: Date;
  /** Set a task's due date (yyyy-mm-dd). */
  onMove: (id: string, day: string) => void;
}) {
  const today = istDay(now);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [over, setOver] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const weeks = monthGrid(month);
  const { days, undated } = byDueDay(issues);
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  const drop = (day: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    if (id) onMove(id, day);
  };

  const chip = (i: IssueListItem) => (
    <Link
      key={i.id}
      href={`/issues/${i.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", i.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      title={`${issueIdentifier(i)} · ${i.title}`}
      className={cn(
        "flex min-w-0 cursor-grab items-center gap-1 rounded border bg-background px-1 py-0.5 text-[11px] hover:bg-muted active:cursor-grabbing",
        CLOSED.has(i.status) && "text-muted-foreground line-through decoration-muted-foreground/50",
      )}
    >
      <StatusIcon status={i.status as StatusId} />
      <span className="truncate">{i.title}</span>
    </Link>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <h2 className="min-w-36 text-sm font-semibold">{label}</h2>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMonth(today.slice(0, 7))}>
          Today
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">Drag a task to another day to change its due date</span>
      </div>

      <div className="grid grid-cols-7 border-b text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {weeks.map((w) => (
          <div key={w[0]} className="grid min-h-28 grid-cols-7 border-b">
            {w.map((day) => {
              const items = days.get(day) ?? [];
              const open = expanded === day;
              const shown = open ? items : items.slice(0, PER_DAY);
              return (
                <div
                  key={day}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(day);
                  }}
                  onDragLeave={() => setOver((o) => (o === day ? null : o))}
                  onDrop={drop(day)}
                  className={cn(
                    "flex min-w-0 flex-col gap-0.5 border-r p-1 last:border-r-0",
                    day.slice(0, 7) !== month && "bg-muted/30",
                    over === day && "bg-brand/10 ring-1 ring-brand/40 ring-inset",
                  )}
                >
                  <span
                    className={cn(
                      "mb-0.5 self-end rounded px-1 text-[11px] tabular-nums",
                      day === today ? "bg-brand font-semibold text-white" : day < today ? "text-muted-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {shown.map(chip)}
                  {items.length > PER_DAY && (
                    <button type="button" onClick={() => setExpanded(open ? null : day)} className="text-left text-[11px] text-muted-foreground hover:text-foreground">
                      {open ? "Show less" : `+${items.length - PER_DAY} more`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="px-4 py-3">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            No due date · {undated.length}
            {undated.length > 0 && <span className="font-normal"> — drag one onto a day to schedule it</span>}
          </h3>
          {undated.length > 0 ? (
            <div className="flex flex-wrap gap-1">{undated.slice(0, 60).map((i) => <div key={i.id} className="max-w-60">{chip(i)}</div>)}</div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Every task in view has a due date.</p>
          )}
          {undated.length > 60 && <p className="mt-1 text-[11px] text-muted-foreground">and {undated.length - 60} more — filter the list to narrow it down.</p>}
        </div>
      </div>
    </div>
  );
}
