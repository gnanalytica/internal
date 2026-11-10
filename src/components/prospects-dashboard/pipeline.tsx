"use client";

import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { formatCurrency } from "@/lib/currency";
import { dealsByProspect, openDealTotal, type DealSummary } from "@/lib/prospects/deal-values";
import { displayDate } from "@/lib/prospects/parse";
import { KIND_LABEL, PROSPECT_KINDS, STAGES, type ProspectKind } from "@/lib/prospects/schema";
import { addDays, dueBucket, isAssignedTo, isOpen, type ProspectRow } from "@/lib/prospects/stats";
import { tone } from "@/lib/tones";
import type { DealWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DueChip, FilterMenu, KIND_TONE, LayoutSwitch, Owner, PATH, StageDot, stageTone, type ProspectLayout } from "./bits";
import { useStageMove } from "./stage-check";

const COLUMN_CAP = 30;

export type Filters = { kind: ProspectKind | ""; owner: string; band: string; q: string };
export const NO_FILTERS: Filters = { kind: "", owner: "", band: "", q: "" };

export function applyFilters(rows: ProspectRow[], f: Filters, me: string): ProspectRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.kind && r.kind !== f.kind) return false;
    if (f.owner === "me" && !isAssignedTo(r.assigned, me)) return false;
    if (f.owner === "none" && r.assigned) return false;
    if (f.owner && !["me", "none"].includes(f.owner) && !isAssignedTo(r.assigned, f.owner)) return false;
    if (f.band && r.band !== f.band) return false;
    if (q && !`${r.name} ${r.id} ${r.city} ${r.state}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Search plus filter menus, shared by the board and the list. `kind` is left out where the page already picks it. */
export function FilterBar({ filters, setFilters, team, scope, setScope, showKind = true, children }: { filters: Filters; setFilters: (f: Filters) => void; team: string[]; scope: "focus" | "all"; setScope: (s: "focus" | "all") => void; showKind?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="relative sm:order-1">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Name, reg no, city" className="h-9 w-full rounded-md border bg-background pr-2.5 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-8 sm:w-52" />
      </label>
      {/* On a phone the menus share one row that scrolls; on a desktop they sit in line with the search. */}
      <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 sm:contents">
        {showKind && (
          <span className="sm:order-2">
            <FilterMenu label="Type" value={filters.kind} onChange={(v) => setFilters({ ...filters, kind: v as ProspectKind | "" })} options={[{ value: "", label: "All" }, ...PROSPECT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k].many }))]} />
          </span>
        )}
        <span className="sm:order-2">
          <FilterMenu
            label="Owner"
            value={filters.owner}
            onChange={(v) => setFilters({ ...filters, owner: v })}
            options={[{ value: "", label: "Anyone" }, { value: "me", label: "Me" }, { value: "none", label: "Nobody" }, ...team.map((t, i) => ({ value: t, label: t, separatorBefore: i === 0 }))]}
          />
        </span>
        <span className="sm:order-2">
          <FilterMenu label="Band" value={filters.band} onChange={(v) => setFilters({ ...filters, band: v })} options={[{ value: "", label: "Any" }, ...["A", "B", "C", "Watch", "Incomplete", "Disqualified"].map((b) => ({ value: b, label: b }))]} />
        </span>
        <span className="sm:order-2">
          <FilterMenu
            label="Region"
            value={scope}
            onChange={(v) => setScope(v as "focus" | "all")}
            options={[
              { value: "focus", label: "KA · AP · TS" },
              { value: "all", label: "All India" },
            ]}
          />
        </span>
        {children && <span className="flex shrink-0 items-center gap-2 sm:order-3 sm:ml-auto">{children}</span>}
      </div>
    </div>
  );
}

function sortForBoard(a: ProspectRow, b: ProspectRow, today: string): number {
  const rank = (r: ProspectRow) => ({ overdue: 0, today: 1, soon: 2, later: 3, none: 4 })[dueBucket(r.nextStepDate, today)];
  return rank(a) - rank(b) || (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name);
}

/** A prospect's deal on its card: the value, and Won or Lost once it closes. */
function DealChip({ deal }: { deal: DealSummary }) {
  const money = deal.value ? formatCurrency(deal.value, deal.currency) : null;
  const label = deal.state === "won" ? (money ? `Won · ${money}` : "Won") : deal.state === "lost" ? (money ? `Lost · ${money}` : "Lost") : (money ?? "Deal, no amount");
  return (
    <span
      title={deal.state === "open" ? "Open deal" : `Deal ${deal.state}`}
      className={cn(
        "inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[11px] font-medium whitespace-nowrap tabular-nums",
        deal.state === "won" ? tone("green").chip : deal.state === "lost" ? cn(tone("gray").chip, "line-through") : "bg-muted text-foreground",
      )}
    >
      <span className="sr-only">{deal.state === "open" ? "Open deal: " : "Deal: "}</span>
      {label}
    </span>
  );
}

function BoardCard({ r, today, deal, onOpen, overlay }: { r: ProspectRow; today: string; deal?: DealSummary; onOpen?: (r: ProspectRow) => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${r.kind}:${r.id}`, data: { row: r }, disabled: overlay });
  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      type="button"
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => onOpen?.(r)}
      className={cn("hover-lift flex w-full flex-col gap-1.5 rounded-lg border border-l-[3px] bg-card p-3 text-left shadow-xs hover:border-foreground/20", stageTone(r.stage).edgeL, isDragging && "opacity-40", overlay && "rotate-2 scale-[1.03] shadow-xl")}
    >
      <span className="flex items-baseline gap-1.5">
        <span className="min-w-0 flex-1 text-[13px] leading-tight font-medium">{r.name}</span>
        <span className={cn("font-mono text-[10px] font-medium uppercase", tone(KIND_TONE[r.kind]).text)}>{r.kind.slice(0, 3)}</span>
      </span>
      {r.nextStep ? <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{r.nextStep}</span> : <span className="text-xs text-muted-foreground">{r.city || r.state || "—"}</span>}
      <span className="mt-0.5 flex items-center gap-2">
        <DueChip date={r.nextStepDate} today={today} />
        <span className="flex-1" />
        {deal && <DealChip deal={deal} />}
        <Owner name={r.assigned} />
      </span>
    </button>
  );
}

function Column({ stage, rows, total, today, deals, onOpen, onMore }: { stage: number; rows: ProspectRow[]; total: number; today: string; deals: Map<string, DealSummary>; onOpen: (r: ProspectRow) => void; onMore: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage}` });
  return (
    <section ref={setNodeRef} aria-label={STAGES[stage]} className={cn("flex min-h-[420px] w-[82vw] max-w-80 shrink-0 snap-start flex-col gap-2 rounded-xl border-t-2 bg-muted/50 p-2 transition-[box-shadow,background-color] duration-150 sm:w-auto sm:max-w-none sm:min-w-[176px] sm:flex-1", stageTone(stage).edgeT, isOver && "bg-muted ring-2 ring-brand/40")}>
      <div className="flex items-center gap-1.5 px-1.5 pt-1 pb-0.5 text-[13px]">
        <StageDot stage={stage} />
        <span className="flex-1 font-medium">{STAGES[stage]}</span>
        <span className={cn("rounded-full px-1.5 font-mono text-[11px] tabular-nums", stageTone(stage).chip)}>{total.toLocaleString("en-IN")}</span>
      </div>
      {rows.map((r) => (
        <BoardCard key={`${r.kind}:${r.id}`} r={r} today={today} deal={deals.get(`${r.kind}:${r.id}`)} onOpen={onOpen} />
      ))}
      {total === 0 && <p className="px-1.5 py-2 text-xs text-muted-foreground">Nothing here yet</p>}
      {total > rows.length && (
        <button type="button" onClick={onMore} className="rounded-md py-1.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground">
          Show all {total.toLocaleString("en-IN")} in Prospects →
        </button>
      )}
    </section>
  );
}

function Board({ rows, today, deals, onOpen, onMore, onChanged }: { rows: ProspectRow[]; today: string; deals: Map<string, DealSummary>; onOpen: (r: ProspectRow) => void; onMore: (stage: number) => void; onChanged: () => void }) {
  const [active, setActive] = useState<ProspectRow | null>(null);
  const { move, dialog } = useStageMove(onChanged);
  // A touch drag starts only after a press-and-hold, so a swipe still scrolls the board.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }));
  const columns = useMemo(
    () =>
      STAGES.map((_, i) => {
        const all = rows.filter((r) => r.stage === i).sort((a, b) => sortForBoard(a, b, today));
        return { all: all.length, shown: all.slice(0, COLUMN_CAP) };
      }),
    [rows, today],
  );
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const row = e.active.data.current?.row as ProspectRow | undefined;
    const target = e.over ? Number(String(e.over.id).replace("stage-", "")) : NaN;
    if (row && !Number.isNaN(target)) move(row, target);
  };
  return (
    <DndContext id="prospects-board" sensors={sensors} onDragStart={(e) => setActive((e.active.data.current?.row as ProspectRow) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto px-3 pb-2 sm:mx-0 sm:snap-none sm:px-0">
        {PATH.map((s, i) => (
          <Column key={s} stage={i} rows={columns[i].shown} total={columns[i].all} today={today} deals={deals} onOpen={onOpen} onMore={() => onMore(i)} />
        ))}
      </div>
      <LostDrop count={columns[6].all} onMore={() => onMore(6)} />
      <DragOverlay>{active ? <BoardCard r={active} today={today} deal={deals.get(`${active.kind}:${active.id}`)} overlay /> : null}</DragOverlay>
      {dialog}
    </DndContext>
  );
}

function LostDrop({ count, onMore }: { count: number; onMore: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "stage-6" });
  return (
    <div ref={setNodeRef} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px]", isOver && "ring-2 ring-red-300")}>
      <button type="button" onClick={onMore} className="inline-flex items-center gap-1.5 hover:underline">
        <StageDot stage={6} /> Lost <span className="font-mono text-xs text-muted-foreground">{count.toLocaleString("en-IN")}</span>
      </button>
      <span className="text-muted-foreground max-sm:hidden">·</span>
      <span className="text-muted-foreground">
        <span className="sm:hidden">Press and hold a card to drag it to another stage.</span>
        <span className="max-sm:hidden">Drag a card to change its stage, or here to mark it lost. Moving forward asks for what the stage needs, and the deal follows.</span>
      </span>
    </div>
  );
}

function Timeline({ rows, today, team, onOpen }: { rows: ProspectRow[]; today: string; team: string[]; onOpen: (r: ProspectRow) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const cols = [{ key: "overdue", label: "Overdue" }, ...days.map((d, i) => ({ key: d, label: i === 0 ? "Today" : new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" }) })), { key: "later", label: "Next 2 weeks" }];
  const open = rows.filter((r) => isOpen(r) && r.nextStepDate);
  const people = [...new Set([...team, ...open.map((r) => r.assigned).filter(Boolean)])].filter((p, i, all) => all.findIndex((o) => isAssignedTo(o, p)) === i);
  const lanes = [...people.map((p) => ({ name: p, rows: open.filter((r) => isAssignedTo(r.assigned, p)) })), { name: "Unassigned", rows: open.filter((r) => !r.assigned) }].filter((l) => l.rows.length);
  const colOf = (r: ProspectRow) => {
    const d = r.nextStepDate!;
    if (d < today) return "overdue";
    if (d <= days[6]) return d;
    return d <= addDays(today, 21) ? "later" : null;
  };
  if (!lanes.length) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No next steps are scheduled. Set a follow-up date on a record and it appears here.</p>;
  const scheduled = lanes.flatMap((l) => l.rows);
  const headTone = (k: string) => (k === "overdue" ? "text-red-700 dark:text-red-400" : k === today ? "text-foreground" : "text-muted-foreground");
  return (
    <>
      <div className="flex flex-col gap-4 md:hidden">
        {cols.map((c) => {
          const items = scheduled.filter((r) => colOf(r) === c.key).sort((a, b) => (a.nextStepDate ?? "").localeCompare(b.nextStepDate ?? ""));
          if (!items.length) return null;
          return (
            <section key={c.key} className="flex flex-col">
              <h4 className={cn("flex items-center justify-between px-1 pb-1 text-xs font-medium", headTone(c.key))}>
                {c.label}
                <span className="font-mono font-normal text-muted-foreground tabular-nums">{items.length}</span>
              </h4>
              <ul className="divide-y rounded-lg border">
                {items.map((r) => (
                  <li key={`${r.kind}:${r.id}`}>
                    <button type="button" onClick={() => onOpen(r)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{r.name}</span>
                        {r.nextStep && <span className="block truncate text-xs text-muted-foreground">{r.nextStep}</span>}
                      </span>
                      <Owner name={r.assigned} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="overflow-x-auto rounded-xl border max-md:hidden">
        <div className="grid min-w-[1100px]" style={{ gridTemplateColumns: `140px repeat(${cols.length}, minmax(0, 1fr))` }}>
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">Owner</div>
          {cols.map((c) => (
            <div key={c.key} className={cn("border-b border-l px-2 py-2 text-xs font-medium", headTone(c.key))}>
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
                  <div key={c.key} className={cn("flex flex-col gap-1 border-b border-l p-1.5", c.key === today && "bg-muted/40")}>
                    {items.slice(0, 5).map((r) => (
                      <button key={`${r.kind}:${r.id}`} type="button" onClick={() => onOpen(r)} title={r.nextStepDate ? displayDate(r.nextStepDate) : undefined} className="rounded-md border bg-background px-1.5 py-1 text-left text-[11px] leading-tight font-medium hover:border-foreground/25">
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

export function Pipeline({
  rows,
  today,
  me,
  team,
  layout,
  setLayout,
  scope,
  setScope,
  deals,
  onOpen,
  onMore,
  onChanged,
}: {
  rows: ProspectRow[];
  today: string;
  me: string;
  team: string[];
  layout: Exclude<ProspectLayout, "list">;
  setLayout: (l: ProspectLayout) => void;
  scope: "focus" | "all";
  setScope: (s: "focus" | "all") => void;
  /**
   * The product's deals. One opens when a prospect reaches Demo done and
   * follows its stage to Won or Lost; its value shows on the prospect's card.
   */
  deals?: DealWithRelations[];
  onOpen: (r: ProspectRow) => void;
  onMore: (stage: number, kind: ProspectKind | "") => void;
  onChanged: () => void;
}) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const shown = useMemo(() => applyFilters(rows, filters, me), [rows, filters, me]);
  const byProspect = useMemo(() => dealsByProspect(deals ?? []), [deals]);
  const open = useMemo(() => openDealTotal(deals ?? []), [deals]);
  return (
    <div className="flex flex-col gap-3">
      {deals && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{formatCurrency(open.inr, "INR")}</span> in {open.count.toLocaleString("en-IN")} open {open.count === 1 ? "deal" : "deals"}
          <span className="max-sm:hidden"> · a deal opens at Demo done and moves with its prospect</span>
        </p>
      )}
      <FilterBar filters={filters} setFilters={setFilters} team={team} scope={scope} setScope={setScope}>
        <LayoutSwitch value={layout} onChange={setLayout} />
      </FilterBar>
      {layout === "board" ? <Board rows={shown} today={today} deals={byProspect} onOpen={onOpen} onMore={(s) => onMore(s, filters.kind)} onChanged={onChanged} /> : <Timeline rows={shown} today={today} team={team} onOpen={onOpen} />}
    </div>
  );
}
