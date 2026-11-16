"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { monthMatrix, WEEKDAYS } from "@/lib/calendar";
import { spanLabel, type DateSpan } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";

function monthOf(iso: string) {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 };
}

/**
 * Pick a start day and an end day on a month grid; a second click before the
 * first swaps them, and a single day is a span of one. Days after `today` are
 * not offered — nothing has been logged on them.
 */
export function DateRangePicker({ value, today, onChange }: { value: DateSpan | null; today: string; onChange: (span: DateSpan) => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(value?.to ?? today));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setStart(value?.from ?? null);
      setEnd(value?.to ?? null);
      setView(monthOf(value?.to ?? today));
    }
  }

  function pick(key: string) {
    if (key > today) return;
    if (!start || end) {
      setStart(key);
      setEnd(null);
    } else if (key < start) {
      setEnd(start);
      setStart(key);
    } else {
      setEnd(key);
    }
  }

  function shift(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  const weeks = monthMatrix(view.year, view.month);
  const monthName = new Date(Date.UTC(view.year, view.month, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const atCurrentMonth = `${view.year}-${String(view.month + 1).padStart(2, "0")}` >= today.slice(0, 7);
  const chosen: DateSpan | null = start ? { from: start, to: end ?? start } : null;

  return (
    <Popover open={open} onOpenChange={reset}>
      <PopoverTrigger
        aria-label="Pick dates"
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] whitespace-nowrap transition-colors",
          value ? "bg-foreground font-medium text-background" : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        <CalendarDays className="size-3.5" />
        {value ? spanLabel(value) : "Pick dates"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[17.5rem]">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} className="grid size-7 place-items-center rounded-md hover:bg-accent" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-[13px] font-medium">{monthName}</span>
          <button
            type="button"
            onClick={() => shift(1)}
            disabled={atCurrentMonth}
            className="grid size-7 place-items-center rounded-md hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div role="grid" aria-label={monthName} className="grid grid-cols-7 gap-y-0.5 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1 text-[11px] text-muted-foreground">
              {w.slice(0, 2)}
            </span>
          ))}
          {weeks.flat().map((d) => {
            const future = d.key > today;
            const inSpan = chosen && d.key >= chosen.from && d.key <= chosen.to;
            const edge = chosen && (d.key === chosen.from || d.key === chosen.to);
            return (
              <button
                key={d.key}
                type="button"
                disabled={future}
                onClick={() => pick(d.key)}
                aria-pressed={!!inSpan}
                aria-label={d.key}
                className={cn(
                  "h-8 text-[13px] tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-30",
                  !d.inMonth && "text-muted-foreground/60",
                  inSpan && !edge && "bg-accent",
                  edge ? "rounded-md bg-foreground font-medium text-background" : "rounded-md hover:bg-accent",
                  d.key === today && !edge && "font-semibold underline underline-offset-4",
                )}
              >
                {d.day}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-2.5">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {chosen ? spanLabel(chosen) : "Click a start day, then an end day"}
          </span>
          <button
            type="button"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onChange(chosen);
              setOpen(false);
            }}
            className="h-7 shrink-0 rounded-md bg-foreground px-3 text-[13px] font-medium text-background disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
