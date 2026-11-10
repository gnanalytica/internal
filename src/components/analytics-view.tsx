"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { MetricDialog } from "@/components/analytics/metric-dialog";
import { Button } from "@/components/ui/button";
import { addSuggestedMetrics, setMetricWeekValue } from "@/lib/actions";
import {
  AUTO_SOURCES,
  formatValue,
  parseCell,
  SCORECARD_AREAS,
  scoreStatus,
  SUGGESTED_METRICS,
  summarize,
  targetLabel,
  weekLabel,
  type ScorecardRow,
  type ScoreStatus,
} from "@/lib/scorecard";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** Blue for on track, orange for behind, grey for no number yet — never red and green. */
const STATUS: Record<ScoreStatus, { label: string; dot: string; chip: string; bar: string }> = {
  on: { label: "On track", dot: tone("blue").dot, chip: tone("blue").chip, bar: tone("blue").bar },
  behind: { label: "Behind", dot: tone("orange").dot, chip: tone("orange").chip, bar: tone("orange").bar },
  empty: { label: "No number yet", dot: tone("gray").dot, chip: tone("gray").chip, bar: tone("gray").bar },
  untargeted: { label: "Trend only", dot: tone("gray").dot, chip: "text-muted-foreground", bar: tone("gray").bar },
};

/** The typed-in look: the brand tint, because it is the one thing on the page you can change. */
const TYPED = "bg-brand/10 ring-1 ring-inset ring-brand/30";
const COUNTED = "bg-muted ring-1 ring-inset ring-border";

type Row = ScorecardRow & { now: number | null; status: ScoreStatus };

/** How many rows the compact scorecard shows before "Show all metrics". */
const COMPACT_ROWS = 6;

/**
 * The weekly scorecard, as the first section of a project's Overview. A
 * handful of numbers, each with its target, the last four weeks and this one.
 * Numbers the app counts are read-only; the rest are typed straight into this
 * week's cell.
 *
 * Compact by default: the summary and the metrics that need a look (behind,
 * or still waiting for this week's number). "Show all metrics" opens the whole
 * table, and "Enter this week" opens it too when the cell it wants is hidden.
 */
export function ScorecardSection({ projectId, weeks, rows, notes }: { projectId: string; weeks: string[]; rows: ScorecardRow[]; notes: string[] }) {
  const router = useRouter();
  const thisWeek = weeks[weeks.length - 1];
  // Numbers typed this visit, shown at once while the save and refresh land.
  const [typed, setTyped] = useState<Record<string, number | null>>({});
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setTyped({});
  }
  const [dialog, setDialog] = useState<{ open: boolean; metric: ScorecardRow | null }>({ open: false, metric: null });
  const [seeding, startSeed] = useTransition();
  const [expanded, setExpanded] = useState(false);
  // Rows typed into this visit stay on the compact view, so a cell doesn't vanish once it has its number.
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  // A row to focus as soon as its cell mounts (after "Enter this week" opens the full table).
  const pendingFocus = useRef<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const view: Row[] = rows.map((r) => {
    const now = Object.hasOwn(typed, r.id) ? typed[r.id] : r.values[r.values.length - 1];
    return { ...r, values: [...r.values.slice(0, -1), now], now, status: scoreStatus(now, r.target, r.targetDirection) };
  });
  const allGroups = SCORECARD_AREAS.map((a) => ({ ...a, rows: view.filter((r) => r.area === a.id) })).filter((g) => g.rows.length > 0);
  const ordered = allGroups.flatMap((g) => g.rows);
  const typedRows = ordered.filter((r) => r.source === "manual");
  const counts = summarize(view);
  // Compact: the rows that need a look by their saved numbers (plus any typed into this visit),
  // in scorecard order, a screenful at most.
  const savedStatus = new Map(rows.map((r) => [r.id, scoreStatus(r.values[r.values.length - 1] ?? null, r.target, r.targetDirection)]));
  const needsLook = (r: Row) => touched.has(r.id) || savedStatus.get(r.id) === "behind" || savedStatus.get(r.id) === "empty";
  const attention = new Set(ordered.filter(needsLook).slice(0, COMPACT_ROWS).map((r) => r.id));
  const groups = expanded ? allGroups : allGroups.map((g) => ({ ...g, rows: g.rows.filter((r) => attention.has(r.id)) })).filter((g) => g.rows.length > 0);
  const hidden = expanded ? 0 : ordered.length - attention.size;

  const focusEl = (el: HTMLInputElement) => {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
    el.select();
  };
  const focusRow = (id: string | undefined) => {
    const el = id ? inputs.current.get(id) : undefined;
    if (!el) return false;
    focusEl(el);
    return true;
  };

  const enterThisWeek = () => {
    if (!typedRows.length) {
      toast("The app counts every number here. Add a metric to type one in.");
      return;
    }
    const first = typedRows.find((r) => r.now === null);
    if (!first) toast("Every typed-in number is in for this week.");
    const id = (first ?? typedRows[0]).id;
    if (!focusRow(id)) {
      pendingFocus.current = id;
      setExpanded(true);
    }
  };

  const commit = async (row: Row, value: number | null) => {
    setTyped((t) => ({ ...t, [row.id]: value }));
    setTouched((t) => new Set(t).add(row.id));
    try {
      const res = await setMetricWeekValue({ metricId: row.id, weekStart: thisWeek, value });
      if (!res.ok) throw new Error(res.message);
      router.refresh();
    } catch (err) {
      setTyped((t) => {
        const next = { ...t };
        delete next[row.id];
        return next;
      });
      toast.error(err instanceof Error && err.message ? err.message : `Couldn't save ${row.name}. Try again.`);
    }
  };

  const next = (id: string) => {
    // Enter walks the typed-in rows on screen, so the compact view doesn't jump open mid-entry.
    const shown = typedRows.filter((r) => expanded || attention.has(r.id));
    const i = shown.findIndex((r) => r.id === id);
    focusRow(shown[i + 1]?.id);
  };

  const seed = () =>
    startSeed(async () => {
      try {
        const { added } = await addSuggestedMetrics(projectId);
        toast.success(`${added} metric${added === 1 ? "" : "s"} added`);
        router.refresh();
      } catch {
        toast.error("Couldn't add the metrics. Try again.");
      }
    });

  return (
    <section id="scorecard" aria-labelledby="scorecard-title" className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <h2 id="scorecard-title" className="mr-auto text-sm font-semibold">
          Scorecard
        </h2>
        <span className="mr-1.5 text-xs text-muted-foreground max-md:hidden">Numbers due every Monday</span>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setDialog({ open: true, metric: null })} aria-label="Add a metric">
          <Plus /> <span className="max-sm:hidden">Add metric</span>
        </Button>
        {rows.length > 0 && (
          <Button size="sm" className="h-8" onClick={enterThisWeek}>
            Enter this week
          </Button>
        )}
      </div>

      <div className="min-w-0">
        {rows.length === 0 ? (
          <EmptyState onSeed={seed} seeding={seeding} onAdd={() => setDialog({ open: true, metric: null })} />
        ) : (
          <div className="animate-enter flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 divide-border rounded-xl border sm:grid-cols-4 sm:divide-x max-sm:[&>*:nth-child(even)]:border-l max-sm:[&>*:nth-child(n+3)]:border-t">
              <Stat label="On track" value={counts.on} dot={STATUS.on.dot} />
              <Stat label="Behind" value={counts.behind} dot={STATUS.behind.dot} />
              <Stat label="Waiting for a number" value={counts.waiting} dot={STATUS.empty.dot} />
              <Stat label="Metrics" value={counts.total} dot="bg-foreground" />
            </div>

            {expanded && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2.5 rounded-[3px]", COUNTED)} />
                Counted by the app
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2.5 rounded-[3px]", TYPED)} />
                You type it in
              </span>
              <span className="flex-1" />
              <span>Weeks start Monday · this week is {weekLabel(thisWeek)}</span>
            </div>
            )}

            {groups.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
                Every metric has this week&apos;s number and none is behind.
              </p>
            ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[860px] border-collapse text-[13px]">
                <caption className="sr-only">Weekly scorecard: each metric&apos;s target, the last four weeks, this week and its status</caption>
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-2.5 pl-3.5 text-left font-medium">
                      Metric
                    </th>
                    <th scope="col" className="px-2.5 py-2 text-right font-medium">
                      Target
                    </th>
                    {weeks.slice(0, -1).map((w) => (
                      <th key={w} scope="col" className="px-2.5 py-2 text-right font-medium whitespace-nowrap">
                        {weekLabel(w)}
                      </th>
                    ))}
                    <th scope="col" className="px-2.5 py-2 text-right font-medium whitespace-nowrap text-brand">
                      This week
                    </th>
                    <th scope="col" className="px-2.5 py-2 text-left font-medium">
                      Trend
                    </th>
                    <th scope="col" className="py-2 pr-3.5 pl-2.5 text-left font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.id}>
                    <tr>
                      <th scope="colgroup" colSpan={weeks.length + 4} className="border-t px-3.5 pt-3.5 pb-1.5 text-left text-xs font-semibold text-foreground/80">
                        {g.label} <span className="font-normal text-muted-foreground">· {g.rows.every((r) => r.source === "manual") ? "you type these in" : g.from}</span>
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <ScoreRow
                        key={r.id}
                        row={r}
                        onEdit={() => setDialog({ open: true, metric: r })}
                        onCommit={(v) => commit(r, v)}
                        onNext={() => next(r.id)}
                        inputRef={(el) => {
                          if (el) inputs.current.set(r.id, el);
                          else inputs.current.delete(r.id);
                          if (el && pendingFocus.current === r.id) {
                            pendingFocus.current = null;
                            focusEl(el);
                          }
                        }}
                      />
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
            )}

            {(hidden > 0 || expanded) && (
              <Button variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
                <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
                {expanded ? "Show only what needs a look" : `Show all ${ordered.length} metrics`}
              </Button>
            )}

            {expanded && notes.length > 0 && (
              <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                {notes.map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <MetricDialog projectId={projectId} metric={dialog.metric} open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} onSaved={() => router.refresh()} />
    </section>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
        {label}
      </span>
      <span className="text-[22px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

const cell = "h-[42px] border-t px-2.5 text-right whitespace-nowrap";

function ScoreRow({ row, onEdit, onCommit, onNext, inputRef }: { row: Row; onEdit: () => void; onCommit: (v: number | null) => void; onNext: () => void; inputRef: (el: HTMLInputElement | null) => void }) {
  const auto = row.source !== "manual";
  const past = row.values.slice(0, -1);
  return (
    <tr className="transition-colors hover:bg-muted/30">
      <td className={cn(cell, "pl-3.5 text-left whitespace-normal")}>
        <button type="button" onClick={onEdit} title="Edit this metric" className="rounded-sm text-left font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none">
          {row.name}
        </button>
        {row.unit && <span className="ml-1.5 text-xs text-muted-foreground">{row.unit}</span>}
      </td>
      <td className={cn(cell, "font-mono text-xs text-muted-foreground tabular-nums")}>{targetLabel(row.target, row.targetDirection)}</td>
      {past.map((v, i) => (
        <td key={i} className={cn(cell, "font-mono text-xs tabular-nums", v === null && "text-muted-foreground/60")}>
          {formatValue(v)}
        </td>
      ))}
      <td className={cell}>
        {auto ? (
          <span title={AUTO_SOURCES[row.source as keyof typeof AUTO_SOURCES].how} className={cn("inline-block min-w-[52px] rounded-md px-2 py-1.5 font-mono text-xs font-medium tabular-nums", COUNTED)}>
            {formatValue(row.now)}
          </span>
        ) : (
          <WeekInput key={String(row.now)} name={row.name} value={row.now} onCommit={onCommit} onNext={onNext} inputRef={inputRef} />
        )}
      </td>
      <td className={cn(cell, "text-left")}>
        <Trend values={row.values} target={row.target} bar={STATUS[row.status].bar} />
      </td>
      <td className={cn(cell, "pr-3.5 text-left")}>
        <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs", STATUS[row.status].chip)}>
          {row.status !== "untargeted" && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS[row.status].dot)} />}
          {STATUS[row.status].label}
        </span>
      </td>
    </tr>
  );
}

/** This week's cell for a typed-in metric: saves on Enter or leaving it, Escape puts it back. */
function WeekInput({ name, value, onCommit, onNext, inputRef }: { name: string; value: number | null; onCommit: (v: number | null) => void; onNext: () => void; inputRef: (el: HTMLInputElement | null) => void }) {
  const initial = value === null ? "" : String(value);
  const [text, setText] = useState(initial);
  const discard = useRef(false);
  const parsed = parseCell(text);
  const save = () => {
    if (discard.current) {
      discard.current = false;
      return;
    }
    if (parsed === undefined) {
      toast.error(`${name}: “${text}” isn't a number.`);
      setText(initial);
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <input
      ref={inputRef}
      inputMode="decimal"
      aria-label={`${name}, this week`}
      aria-invalid={parsed === undefined || undefined}
      value={text}
      placeholder="—"
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onNext();
          // Moving focus blurs this cell, which saves it; with nowhere to go, save here.
          if (document.activeElement === e.currentTarget) e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          discard.current = true;
          setText(initial);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "h-[30px] w-[72px] rounded-md px-2 text-right font-mono text-xs text-foreground tabular-nums outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-brand aria-invalid:ring-destructive",
        TYPED,
      )}
    />
  );
}

/** Five small bars, oldest first, scaled to the larger of the target and the biggest number. */
function Trend({ values, target, bar }: { values: (number | null)[]; target: number | null; bar: string }) {
  const max = Math.max(1, target ?? 0, ...values.map((v) => v ?? 0));
  return (
    <span role="img" aria-label={`Last ${values.length} weeks: ${values.map(formatValue).join(", ")}`} className="inline-flex h-5 items-end gap-0.5">
      {values.map((v, i) => (
        <span key={i} className={cn("w-1.5 rounded-[2px] transition-[height] duration-300", v === null ? "bg-muted-foreground/20" : bar)} style={{ height: v === null ? 2 : Math.max(3, Math.round((Math.max(0, v) / max) * 20)) }} />
      ))}
    </span>
  );
}

function EmptyState({ onSeed, seeding, onAdd }: { onSeed: () => void; seeding: boolean; onAdd: () => void }) {
  return (
    <div className="animate-enter flex flex-col items-center gap-4 rounded-xl border border-dashed px-4 py-8 text-center">
      <div className="flex max-w-lg flex-col gap-1.5">
        <h3 className="text-base font-medium">No metrics on the scorecard yet</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Start with the suggested {SUGGESTED_METRICS.length}: sales and marketing numbers the app counts from Prospects, Deals and the content calendar, plus the product and reliability numbers you type in each Monday.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onSeed} disabled={seeding}>
          {seeding ? "Adding…" : `Add the ${SUGGESTED_METRICS.length} suggested metrics`}
        </Button>
        <Button variant="outline" onClick={onAdd}>
          Add your own
        </Button>
      </div>
    </div>
  );
}
