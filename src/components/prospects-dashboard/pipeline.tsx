"use client";

import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveProspect } from "@/lib/prospects/actions";
import { displayDate } from "@/lib/prospects/parse";
import { STAGES } from "@/lib/prospects/schema";
import { addDays, dueBucket, isAssignedTo, isOpen, type ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { BandBadge, DueChip, Owner, Segmented } from "./bits";

const COLUMN_CAP = 30;

export type Filters = { owner: string; band: string; q: string };

export function applyFilters(rows: ProspectRow[], f: Filters, me: string): ProspectRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.owner === "me" && !isAssignedTo(r.assigned, me)) return false;
    if (f.owner === "none" && r.assigned) return false;
    if (f.owner && !["me", "none"].includes(f.owner) && !isAssignedTo(r.assigned, f.owner)) return false;
    if (f.band && r.band !== f.band) return false;
    if (q && !`${r.name} ${r.id} ${r.city} ${r.state}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function FilterBar({ filters, setFilters, team, children }: { filters: Filters; setFilters: (f: Filters) => void; team: string[]; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="sr-only" htmlFor="pf-q">
        Search
      </label>
      <input id="pf-q" type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search name, reg no, city" className="h-9 w-full rounded-md border bg-background px-2.5 text-sm sm:order-1 sm:h-8 sm:w-56" />
      {/* On a phone the pickers share one row that scrolls; on a desktop they sit in line with the search. */}
      <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 sm:contents">
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
        <label className="sr-only" htmlFor="pf-owner">
          Owner
        </label>
        <select id="pf-owner" value={filters.owner} onChange={(e) => setFilters({ ...filters, owner: e.target.value })} className="h-8 shrink-0 rounded-md border bg-background px-2 text-sm sm:order-2">
          <option value="">Owner: everyone</option>
          <option value="me">Owner: me</option>
          <option value="none">Owner: nobody</option>
          {team.map((t) => (
            <option key={t} value={t}>
              Owner: {t}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="pf-band">
          Band
        </label>
        <select id="pf-band" value={filters.band} onChange={(e) => setFilters({ ...filters, band: e.target.value })} className="h-8 shrink-0 rounded-md border bg-background px-2 text-sm sm:order-2">
          <option value="">Band: any</option>
          {["A", "B", "C", "Watch", "Incomplete", "Disqualified"].map((b) => (
            <option key={b} value={b}>
              Band: {b}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function sortForBoard(a: ProspectRow, b: ProspectRow, today: string): number {
  const rank = (r: ProspectRow) => ({ overdue: 0, today: 1, soon: 2, later: 3, none: 4 })[dueBucket(r.nextStepDate, today)];
  return rank(a) - rank(b) || (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name);
}

function BoardCard({ r, today, onOpen, overlay }: { r: ProspectRow; today: string; onOpen?: (r: ProspectRow) => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${r.kind}:${r.id}`, data: { row: r }, disabled: overlay });
  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      type="button"
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => onOpen?.(r)}
      className={cn("flex w-full flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left shadow-xs hover:border-foreground/30", isDragging && "opacity-40", overlay && "rotate-1 shadow-lg")}
    >
      <span className="text-[13px] leading-tight font-medium">{r.name}</span>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="flex-1 truncate">{r.city || r.state || "—"}</span>
        <BandBadge band={r.band} score={r.score} />
      </span>
      <span className="text-[11px] text-muted-foreground">
        {r.lenders ? `${r.lenders} panels` : "panels ?"} · {r.cases !== null ? `${r.cases}/mo` : "volume ?"}
      </span>
      {r.nextStep && <span className="line-clamp-2 text-xs leading-snug">{r.nextStep}</span>}
      <span className="flex items-center justify-between">
        {r.nextStepDate ? <DueChip date={r.nextStepDate} today={today} /> : <span />}
        <Owner name={r.assigned} />
      </span>
    </button>
  );
}

function Column({ stage, rows, total, today, onOpen, onMore }: { stage: number; rows: ProspectRow[]; total: number; today: string; onOpen: (r: ProspectRow) => void; onMore: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage}` });
  return (
    <section ref={setNodeRef} className={cn("flex min-h-[420px] w-[82vw] max-w-80 shrink-0 snap-start flex-col gap-2 rounded-xl bg-muted/60 p-2 sm:w-[232px]", isOver && "ring-2 ring-brand")}>
      <div className="flex items-center justify-between px-1 pt-1 text-xs">
        <span className="font-semibold">{STAGES[stage]}</span>
        <span className="font-mono text-muted-foreground tabular-nums">{total.toLocaleString("en-IN")}</span>
      </div>
      {rows.map((r) => (
        <BoardCard key={r.id} r={r} today={today} onOpen={onOpen} />
      ))}
      {total > rows.length && (
        <button type="button" onClick={onMore} className="rounded-md py-1.5 text-xs font-medium text-brand hover:bg-background">
          + {(total - rows.length).toLocaleString("en-IN")} more — open in List
        </button>
      )}
    </section>
  );
}

function Board({ rows, today, onOpen, onMore, onChanged }: { rows: ProspectRow[]; today: string; onOpen: (r: ProspectRow) => void; onMore: (stage: number) => void; onChanged: () => void }) {
  const [moved, setMoved] = useState<Record<string, number>>({});
  const [active, setActive] = useState<ProspectRow | null>(null);
  const [, start] = useTransition();
  // A touch drag starts only after a press-and-hold, so a swipe still scrolls the board.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }));
  const effective = useMemo(() => rows.map((r) => (moved[`${r.kind}:${r.id}`] !== undefined ? { ...r, stage: moved[`${r.kind}:${r.id}`] } : r)), [rows, moved]);
  const columns = useMemo(
    () =>
      STAGES.map((_, i) => {
        const all = effective.filter((r) => r.stage === i).sort((a, b) => sortForBoard(a, b, today));
        return { all: all.length, shown: all.slice(0, COLUMN_CAP) };
      }),
    [effective, today],
  );
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const row = e.active.data.current?.row as ProspectRow | undefined;
    const target = e.over ? Number(String(e.over.id).replace("stage-", "")) : NaN;
    if (!row || Number.isNaN(target)) return;
    const key = `${row.kind}:${row.id}`;
    const from = moved[key] ?? row.stage;
    if (from === target) return;
    setMoved((m) => ({ ...m, [key]: target }));
    start(async () => {
      const res = await saveProspect(row.kind, row.id, { status: STAGES[target] });
      if (res.ok) {
        toast.success(`${row.name}: status → ${STAGES[target]}`);
        onChanged();
      } else {
        toast.error(res.message);
        setMoved((m) => ({ ...m, [key]: from }));
      }
    });
  };
  return (
    <DndContext id="prospects-board" sensors={sensors} onDragStart={(e) => setActive((e.active.data.current?.row as ProspectRow) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto px-3 pb-4 sm:mx-0 sm:snap-none sm:px-0">
        {columns.map((c, i) => (
          <Column key={STAGES[i]} stage={i} rows={c.shown} total={c.all} today={today} onOpen={onOpen} onMore={() => onMore(i)} />
        ))}
      </div>
      <DragOverlay>{active ? <BoardCard r={active} today={today} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Timeline({ rows, today, team, onOpen }: { rows: ProspectRow[]; today: string; team: string[]; onOpen: (r: ProspectRow) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const cols = [{ key: "overdue", label: "Overdue" }, ...days.map((d, i) => ({ key: d, label: i === 0 ? `Today · ${displayDate(d).slice(0, 5)}` : new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" }) })), { key: "later", label: "Next 2 weeks" }];
  const open = rows.filter((r) => isOpen(r) && r.nextStepDate);
  const people = [...new Set([...team, ...open.map((r) => r.assigned).filter(Boolean)])].filter((p, i, all) => all.findIndex((o) => isAssignedTo(o, p)) === i);
  const lanes = [...people.map((p) => ({ name: p, rows: open.filter((r) => isAssignedTo(r.assigned, p)) })), { name: "Unassigned", rows: open.filter((r) => !r.assigned) }].filter((l) => l.rows.length);
  const colOf = (r: ProspectRow) => {
    const d = r.nextStepDate!;
    if (d < today) return "overdue";
    if (d <= days[6]) return d;
    return d <= addDays(today, 21) ? "later" : null;
  };
  if (!lanes.length) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No next steps are scheduled. Set a next-step date on a record and it appears here.</p>;
  const scheduled = lanes.flatMap((l) => l.rows);
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {cols.map((c) => {
          const items = scheduled.filter((r) => colOf(r) === c.key).sort((a, b) => (a.nextStepDate ?? "").localeCompare(b.nextStepDate ?? ""));
          if (!items.length) return null;
          return (
            <section key={c.key} className="overflow-hidden rounded-xl border bg-card">
              <h4 className={cn("flex items-center justify-between bg-muted/60 px-3 py-2 text-xs font-semibold", c.key === "overdue" && "text-red-700 dark:text-red-400", c.key === today && "text-emerald-700 dark:text-emerald-400")}>
                {c.label}
                <span className="font-mono font-normal text-muted-foreground tabular-nums">{items.length}</span>
              </h4>
              <ul className="divide-y">
                {items.map((r) => (
                  <li key={`${r.kind}:${r.id}`}>
                    <button type="button" onClick={() => onOpen(r)} className="flex w-full items-start gap-3 px-3 py-2 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{r.name}</span>
                        {r.nextStep && <span className="block truncate text-xs text-muted-foreground">{r.nextStep}</span>}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{r.assigned || "Unassigned"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card max-md:hidden">
        <div className="grid min-w-[1100px]" style={{ gridTemplateColumns: `140px repeat(${cols.length}, minmax(0, 1fr))` }}>
          <div className="border-b bg-muted/60 px-3 py-2 text-xs font-semibold">Next step due</div>
          {cols.map((c) => (
            <div key={c.key} className={cn("border-b border-l bg-muted/60 px-2 py-2 text-xs font-semibold", c.key === "overdue" && "text-red-700 dark:text-red-400", c.key === today && "text-emerald-700 dark:text-emerald-400")}>
              {c.label}
            </div>
          ))}
          {lanes.map((l) => (
            <div key={l.name} className="contents">
              <div className="border-b px-3 py-2 text-[13px] font-medium">
                {l.name}
                <span className="block text-[11px] font-normal text-muted-foreground">{l.rows.length} scheduled</span>
              </div>
              {cols.map((c) => {
                const items = l.rows.filter((r) => colOf(r) === c.key).sort((a, b) => (a.nextStepDate ?? "").localeCompare(b.nextStepDate ?? ""));
                return (
                  <div key={c.key} className={cn("flex flex-col gap-1 border-b border-l p-1.5", c.key === "overdue" && "bg-red-50/60 dark:bg-red-950/30", c.key === today && "bg-emerald-50/60 dark:bg-emerald-950/30")}>
                    {items.slice(0, 5).map((r) => (
                      <button key={r.id} type="button" onClick={() => onOpen(r)} className="rounded-md border bg-background px-1.5 py-1 text-left text-[11px] leading-tight font-medium hover:border-foreground/30">
                        {r.name}
                        {r.nextStep && <span className="block truncate font-normal text-muted-foreground">{r.nextStep}</span>}
                      </button>
                    ))}
                    {items.length > 5 && <span className="px-1 text-[11px] text-muted-foreground">+{items.length - 5} more</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function Pipeline({ rows, today, me, team, layout, setLayout, onOpen, onMore, onChanged }: { rows: ProspectRow[]; today: string; me: string; team: string[]; layout: "board" | "timeline"; setLayout: (l: "board" | "timeline") => void; onOpen: (r: ProspectRow) => void; onMore: (stage: number) => void; onChanged: () => void }) {
  const [filters, setFilters] = useState<Filters>({ owner: "", band: "", q: "" });
  const shown = useMemo(() => applyFilters(rows, filters, me), [rows, filters, me]);
  return (
    <div className="flex flex-col gap-3">
      <FilterBar filters={filters} setFilters={setFilters} team={team}>
        <Segmented label="Pipeline layout" value={layout} onChange={setLayout} options={[{ value: "board", label: "Board" }, { value: "timeline", label: "Timeline" }]} />
      </FilterBar>
      {layout === "board" ? (
        <>
          <p className="text-xs text-muted-foreground">
            <span className="sm:hidden">Swipe across the stages. Press and hold a card, then drag it to another stage to change its status — it is written to the sheet.</span>
            <span className="max-sm:hidden">Drag a card to another column to change its status — it is written to the sheet. Overdue first, then highest score.</span>
          </p>
          <Board rows={shown} today={today} onOpen={onOpen} onMore={onMore} onChanged={onChanged} />
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Placed by next_step_date. It shows what is coming up, not a history — that is in the Activity tab.</p>
          <Timeline rows={shown} today={today} team={team} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}
