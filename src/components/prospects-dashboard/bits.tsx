"use client";

import { cn } from "@/lib/utils";
import { displayDate } from "@/lib/prospects/parse";
import { STAGES } from "@/lib/prospects/schema";
import { dueBucket, type Due } from "@/lib/prospects/stats";

const BAND_CLASS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  B: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  C: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Watch: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  Disqualified: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  Incomplete: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export function BandBadge({ band, score, className }: { band: string; score?: number | null; className?: string }) {
  if (!band) return <span className={cn("text-xs text-muted-foreground", className)}>Not scored</span>;
  const text = band === "A" || band === "B" || band === "C" ? `${band}${score !== null && score !== undefined ? ` ${score}` : ""}` : band;
  return <span className={cn("inline-flex h-5 items-center rounded px-1.5 font-mono text-[11px] font-medium whitespace-nowrap tabular-nums", BAND_CLASS[band] ?? BAND_CLASS.C, className)}>{text}</span>;
}

const DUE_CLASS: Record<Due, string> = {
  overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  today: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  soon: "bg-muted text-foreground",
  later: "bg-muted text-muted-foreground",
  none: "text-muted-foreground",
};

export function dueLabel(date: string | null, today: string): string {
  const b = dueBucket(date, today);
  if (b === "none") return "No date";
  if (b === "today") return "Today";
  if (b === "overdue") return `Overdue · ${displayDate(date)}`;
  return displayDate(date);
}

export function DueChip({ date, today, className }: { date: string | null; today: string; className?: string }) {
  const b = dueBucket(date, today);
  return <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium whitespace-nowrap", DUE_CLASS[b], className)}>{dueLabel(date, today)}</span>;
}

const STAGE_CLASS = [
  "bg-muted text-muted-foreground",
  "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
];

export function StagePill({ stage, className }: { stage: number; className?: string }) {
  return <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap", STAGE_CLASS[stage] ?? STAGE_CLASS[0], className)}>{STAGES[stage] ?? STAGES[0]}</span>;
}

/** A horizontal bar for a single magnitude; one hue, the value always written beside it. */
export function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const w = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("h-2 w-full rounded-r bg-muted", className)}>
      <div className="h-full rounded-r bg-brand" style={{ width: `${w}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
            o.value === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({ title, aside, children, className }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4", className)}>
      {(title || aside) && (
        <div className="flex items-baseline gap-2">
          {title && <h3 className="flex-1 text-sm font-semibold">{title}</h3>}
          {aside && <div className="text-xs text-muted-foreground">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{children}</p>;
}

/** Initials for an owner avatar, from "Sandeep" or "Sandeep Kumar". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function Owner({ name, className }: { name: string; className?: string }) {
  if (!name) return <span className={cn("text-[11px] text-muted-foreground", className)}>Unassigned</span>;
  return (
    <span title={name} className={cn("inline-flex size-6 items-center justify-center rounded-full bg-foreground/80 text-[10px] font-semibold text-background", className)}>
      {initials(name)}
    </span>
  );
}

export function MissingValue({ children = "Not known — research" }: { children?: React.ReactNode }) {
  return <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">{children}</span>;
}
