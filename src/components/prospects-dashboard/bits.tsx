"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayDate } from "@/lib/prospects/parse";
import { STAGES, type Channel, type Outcome, type ProspectKind } from "@/lib/prospects/schema";
import { addDays, dueBucket, isAssignedTo, type Due } from "@/lib/prospects/stats";
import { tone, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** The stages the pipeline walks through; Lost (index 6) sits outside it. */
export const PATH = STAGES.slice(0, 6);

/**
 * One hue per stage, cool to warm as a prospect moves: grey before anyone has
 * spoken to them, blue and violet while we learn, indigo at the demo, amber
 * while a pilot runs, green for Won and red for Lost.
 */
export const STAGE_TONE: Tone[] = ["gray", "blue", "violet", "indigo", "amber", "green", "red"];
export const stageTone = (stage: number) => tone(STAGE_TONE[stage] ?? "gray");

/** Each kind of prospect keeps its hue wherever it appears (tabs, related rows, search). */
export const KIND_TONE: Record<ProspectKind, Tone> = { valuer: "blue", firm: "violet", rvo: "teal", panel: "orange", bank: "pink" };

export const CHANNEL_TONE: Record<Channel, Tone> = { WhatsApp: "green", Email: "violet", Call: "blue", Meeting: "amber", Other: "gray" };

/** Good news green, a door closing red, everything in between neutral. */
export function outcomeTone(o: string): Tone {
  if ((["Replied", "Connected", "Demo booked", "Meeting held"] as Outcome[]).includes(o as Outcome)) return "green";
  if ((["Not interested", "Wrong number"] as Outcome[]).includes(o as Outcome)) return "red";
  if ((["No answer", "Busy — call back"] as Outcome[]).includes(o as Outcome)) return "amber";
  return "gray";
}

export function StageDot({ stage, className }: { stage: number; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-[7px] shrink-0 rounded-full", stageTone(stage).dot, className)} />;
}

/** A stage as a tinted chip with its dot, so the column reads at a glance. */
export function StagePill({ stage, className }: { stage: number; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full pr-2 pl-1.5 text-xs font-medium whitespace-nowrap", stageTone(stage).chip, className)}>
      <StageDot stage={stage} />
      {STAGES[stage] ?? STAGES[0]}
    </span>
  );
}

/** A small tinted chip: a channel, an outcome, a kind. */
export function ToneChip({ t, children, className }: { t: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap", tone(t).chip, className)}>{children}</span>;
}

export function KindDot({ kind, className }: { kind: ProspectKind; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-[7px] shrink-0 rounded-[2px]", tone(KIND_TONE[kind]).dot, className)} />;
}

/** Six segments for the six open stages; a Lost record shows them all muted. */
export function StageBar({ stage, labels, className }: { stage: number; labels?: boolean; className?: string }) {
  const lost = stage === 6;
  return (
    <div role="img" aria-label={lost ? "Stage: Lost" : `Stage: ${STAGES[stage]}, ${stage + 1} of ${PATH.length}`} className={cn("grid grid-cols-6 gap-1", className)}>
      {PATH.map((s, i) => (
        <div key={s} className="flex min-w-0 flex-col gap-1.5">
          <span className={cn("h-1 rounded-full transition-colors duration-300", !lost && i <= stage ? stageTone(stage).bar : "bg-muted-foreground/20")} />
          {labels && <span className={cn("truncate text-xs", i === stage && !lost ? "font-medium text-foreground" : "text-muted-foreground/70")}>{s}</span>}
        </div>
      ))}
    </div>
  );
}

export function BandBadge({ band, score, className }: { band: string; score?: number | null; className?: string }) {
  if (!band) return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  const graded = band === "A" || band === "B" || band === "C";
  const text = graded ? `${band}${score !== null && score !== undefined ? ` ${score}` : ""}` : band;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded px-1.5 font-mono text-[11px] font-medium whitespace-nowrap tabular-nums",
        band === "A" ? tone("green").chip : band === "B" ? tone("blue").chip : band === "C" ? tone("amber").chip : band === "Disqualified" ? tone("red").chip : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {text}
    </span>
  );
}

const DUE_CLASS: Record<Due, string> = {
  overdue: cn("rounded-md px-1.5 py-0.5 font-medium", tone("red").chip),
  today: cn("rounded-md px-1.5 py-0.5 font-medium", tone("amber").chip),
  soon: "text-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

/** "Today", "Tomorrow", "Fri 8 Nov" — short enough for a card. */
export function shortDate(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function dueLabel(date: string | null, today: string): string {
  const b = dueBucket(date, today);
  if (b === "none" || !date) return "No date";
  if (b === "overdue") return `Overdue · ${new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}`;
  return shortDate(date, today);
}

export function DueChip({ date, today, className }: { date: string | null; today: string; className?: string }) {
  const b = dueBucket(date, today);
  return <span className={cn("text-xs whitespace-nowrap", DUE_CLASS[b], className)}>{dueLabel(date, today)}</span>;
}

/** A horizontal bar for a single magnitude; one hue, the value always written beside it. */
export function Bar({ value, max, className, fill = "bg-foreground/80" }: { value: number; max: number; className?: string; fill?: string }) {
  const w = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("h-2 w-full rounded-r bg-muted", className)}>
      <div className={cn("h-full rounded-r transition-[width] duration-500 ease-out", fill)} style={{ width: `${w}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, className }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex shrink-0 rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("h-7 rounded-md px-3 text-[13px] whitespace-nowrap transition-colors", o.value === value ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pill-shaped choices: one can be on at a time, or none when `allowNone`. */
export function Chips<T extends string>({ value, options, onChange, label, allowNone, className }: { value: T | ""; options: readonly T[]; onChange: (v: T | "") => void; label: string; allowNone?: boolean; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o === value && allowNone ? "" : o)}
          className={cn("h-8 rounded-md border px-2.5 text-[13px] whitespace-nowrap transition-colors sm:h-7", o === value ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** A filter shown as "Label Value", opening a menu of options. */
export function FilterMenu({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string; separatorBefore?: boolean }[]; onChange: (v: string) => void }) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const active = value !== options[0]?.value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] whitespace-nowrap hover:bg-muted aria-expanded:bg-muted", active && "border-foreground/40")}
      >
        <span className="text-muted-foreground">{label}</span>
        <span>{current?.label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(String(v))}>
          {options.map((o) => (
            <div key={o.value} className="contents">
              {o.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuRadioItem value={o.value}>{o.label}</DropdownMenuRadioItem>
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Card({ title, aside, children, className }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
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
  return <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] leading-relaxed text-muted-foreground">{children}</p>;
}

/** Initials for an owner avatar, from "Sandeep" or "Sandeep Kumar". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function Owner({ name, className }: { name: string; className?: string }) {
  if (!name) return <span className={cn("text-[11px] text-muted-foreground", className)}>—</span>;
  return (
    <span title={name} className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-foreground/80", className)}>
      {initials(name)}
    </span>
  );
}

/** The team members to offer as owners, "me" first. `assigned` is written as a first name, as the team types it. */
export function OwnerPicker({ value, me, team, onPick, children, disabled }: { value: string; me: string; team: string[]; onPick: (firstName: string) => void; children: React.ReactElement; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const people = [me, ...team.filter((t) => !isAssignedTo(t, me))].filter(Boolean);
  const shown = people.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (name: string) => {
    setOpen(false);
    setQ("");
    onPick(name ? name.trim().split(/\s+/)[0] : "");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} render={children} />
      <PopoverContent align="start" className="w-60 gap-1 p-1.5">
        <label className="sr-only" htmlFor="owner-q">
          Assign to
        </label>
        <input id="owner-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Assign to…" className="mb-1 h-8 rounded-md border bg-background px-2 text-sm outline-none" />
        {shown.map((p) => (
          <button key={p} type="button" onClick={() => pick(p)} className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted">
            <Owner name={p} />
            <span className="flex-1 truncate">{p === me ? `Me · ${p}` : p}</span>
            {isAssignedTo(value, p) && <span className="text-xs text-muted-foreground">✓</span>}
          </button>
        ))}
        <div className="my-0.5 h-px bg-border" />
        <button type="button" onClick={() => pick("")} className="flex h-8 items-center rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-muted">
          Nobody
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** Quick follow-up dates plus a calendar; returns yyyy-mm-dd, or null to clear. */
export function DatePicker({ value, today, onPick, children, disabled, allowClear = true }: { value: string | null; today: string; onPick: (iso: string | null) => void; children: React.ReactElement; disabled?: boolean; allowClear?: boolean }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (value ?? today).slice(0, 7));
  const pick = (iso: string | null) => {
    setOpen(false);
    onPick(iso);
  };
  const quick = [
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "Next week", days: 7 },
    { label: "In 2 weeks", days: 14 },
  ];
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} render={children} />
      <PopoverContent align="start" className="w-72 gap-0 p-0">
        <div className="flex flex-col p-1.5">
          {quick.map((q) => {
            const iso = addDays(today, q.days);
            return (
              <button key={q.label} type="button" onClick={() => pick(iso)} className={cn("flex h-8 items-center justify-between rounded-md px-2 text-sm hover:bg-muted", value === iso && "bg-muted")}>
                <span>{q.label}</span>
                <span className="text-xs text-muted-foreground">{shortDate(iso, today)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5 border-t p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
            <span className="flex gap-1">
              <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="size-6 rounded hover:bg-muted">
                ‹
              </button>
              <button type="button" aria-label="Next month" onClick={() => shift(1)} className="size-6 rounded hover:bg-muted">
                ›
              </button>
            </span>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={i} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {cells.map((iso, i) =>
              iso ? (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  aria-label={displayDate(iso)}
                  className={cn("h-7 rounded-md hover:bg-muted", iso < today && "text-muted-foreground/50", iso === today && "ring-1 ring-foreground ring-inset", iso === value && "bg-foreground text-background hover:bg-foreground")}
                >
                  {Number(iso.slice(8))}
                </button>
              ) : (
                <span key={`b${i}`} />
              ),
            )}
          </div>
          {allowClear && value && (
            <button type="button" onClick={() => pick(null)} className="mt-1 self-start text-xs text-muted-foreground hover:text-foreground">
              Clear date
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** How the Prospects tab lays out its rows: a list, a board by stage, or a timeline by due date. */
export type ProspectLayout = "list" | "board" | "timeline";

/** The List / By stage / By due date switch, the same on every Prospects layout. */
export function LayoutSwitch({ value, onChange }: { value: ProspectLayout; onChange: (l: ProspectLayout) => void }) {
  return (
    <Segmented
      label="Layout"
      value={value}
      onChange={onChange}
      options={[
        { value: "list", label: "List" },
        { value: "board", label: "By stage" },
        { value: "timeline", label: "By due date" },
      ]}
    />
  );
}
