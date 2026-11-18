"use client";

import { ArrowDown, ArrowUp, ChevronDown, Phone, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { saveProspects } from "@/lib/prospects/actions";
import { KIND_LABEL, PROSPECT_KINDS, STAGES, UNSCORED_KINDS, type ProspectKind } from "@/lib/prospects/schema";
import { SAVED_VIEWS, type ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { BandBadge, DatePicker, DueChip, FilterMenu, KindDot, LayoutSwitch, Owner, OwnerPicker, StageDot, StagePill, type ProspectLayout } from "./bits";
import { rowKey as keyOf, usePatchRows, useRowSave } from "./optimistic";
import { applyFilters, FilterBar, type Filters } from "./pipeline";
import { useStageMove } from "./stage-check";

const PAGE = 100;

function csv(rows: ProspectRow[]): string {
  const head = ["type", "id", "name", "city", "state", "status", "band", "score", "assigned", "next_step", "next_step_date", "last_contacted", "lenders", "lb_cases_per_month", "current_software"];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head.join(","), ...rows.map((r) => [KIND_LABEL[r.kind].one, r.id, r.name, r.city, r.state, STAGES[r.stage], r.band, r.score, r.assigned, r.nextStep, r.nextStepDate, r.lastContacted, r.lenders, r.cases, r.software].map(esc).join(","))].join("\n");
}

/** Columns the list can be sorted by, and how each compares two rows. Blanks sort last either way. */
type SortKey = "name" | "stage" | "score" | "city" | "due" | "owner";
const SORTS: Record<SortKey, (a: ProspectRow, b: ProspectRow) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  stage: (a, b) => a.stage - b.stage,
  score: (a, b) => (a.score ?? -1) - (b.score ?? -1),
  city: (a, b) => (a.city || a.state).localeCompare(b.city || b.state),
  due: (a, b) => (a.nextStepDate ?? "").localeCompare(b.nextStepDate ?? ""),
  owner: (a, b) => a.assigned.localeCompare(b.assigned),
};
const SORT_LABEL: Record<SortKey, string> = { score: "Score", name: "Name", stage: "Stage", city: "City", due: "Follow-up date", owner: "Owner" };
/** The URL's `sort` ("due", "-score") as a column and direction; empty is score, highest first. */
function parseSort(v: string): { key: SortKey; dir: 1 | -1 } {
  const key = v.replace(/^-/, "") as SortKey;
  return key in SORTS ? { key, dir: v.startsWith("-") ? -1 : 1 } : { key: "score", dir: -1 };
}
const sortParam = (s: { key: SortKey; dir: 1 | -1 }) => (s.key === "score" && s.dir === -1 ? "" : `${s.dir === -1 ? "-" : ""}${s.key}`);

/** Typing, or a menu, picker or dialog open: list shortcuts stand aside. */
function shortcutsBlocked(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement;
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return true;
  return Boolean(document.querySelector('[role="dialog"], [role="menu"], [role="listbox"], [data-slot="popover-content"]'));
}

const isBlank = (k: SortKey, r: ProspectRow) => (k === "score" ? r.score === null : k === "due" ? !r.nextStepDate : k === "owner" ? !r.assigned : k === "city" ? !(r.city || r.state) : false);

/** A column header that sorts the list; clicking the active column flips its direction. */
function SortHead({ k, sort, onSort, children, className }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-3 font-normal", className)} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => onSort(k)} className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground", sort.key === k && "text-foreground")}>
        {children}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

/** Views of follow-ups, where working through them one call at a time makes sense. */
const CALL_VIEWS = new Set(["mine", "due", "overdue"]);

export function ListView({
  kind,
  setKind,
  rows,
  today,
  me,
  team,
  view,
  setView,
  stage,
  setStage,
  scope,
  setScope,
  filters,
  setFilters,
  sort: sortValue,
  setSort,
  onOpen,
  openKey,
  onShareOut,
  setLayout,
  onStartCalls,
}: {
  kind: ProspectKind | "";
  setKind: (k: ProspectKind | "") => void;
  rows: ProspectRow[];
  today: string;
  me: string;
  team: string[];
  view: string;
  setView: (v: string) => void;
  stage: number | null;
  setStage: (s: number | null) => void;
  scope: "focus" | "all";
  setScope: (s: "focus" | "all") => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** The URL's `sort`; see parseSort. */
  sort: string;
  setSort: (v: string) => void;
  onOpen: (r: ProspectRow) => void;
  openKey: string | null;
  onShareOut: () => void;
  setLayout: (l: ProspectLayout) => void;
  /** Opens Your day: what is due for you, one prospect at a time. */
  onStartCalls: () => void;
}) {
  const patchRows = usePatchRows();
  const { save: saveRow } = useRowSave();
  const { move, dialog: stageDialog } = useStageMove(() => {});
  const sort = parseSort(sortValue);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [pending, start] = useTransition();
  const ctx = { person: me, today };
  const ofKind = useMemo(() => (kind ? rows.filter((r) => r.kind === kind) : rows), [rows, kind]);
  const current = SAVED_VIEWS.find((v) => v.id === view) ?? SAVED_VIEWS[0];
  const shown = useMemo(() => {
    const base = applyFilters(ofKind, { ...filters, kind: "" }, me).filter((r) => current.test(r, ctx) && (stage === null || r.stage === stage));
    const cmp = SORTS[sort.key];
    return base.sort((a, b) => Number(isBlank(sort.key, a)) - Number(isBlank(sort.key, b)) || sort.dir * cmp(a, b) || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofKind, filters, me, current, stage, today, sort]);
  const sortBy = (key: SortKey) => setSort(sortParam(sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: key === "score" ? -1 : 1 }));
  const selected = shown.filter((r) => checked.has(keyOf(r)));
  const page = shown.slice(0, limit);

  // j/k move a highlight through the rows, x ticks it, Enter opens it. Desktop list only.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const focusIdx = focusKey ? page.findIndex((r) => keyOf(r) === focusKey) : -1;
  const keys = useRef({ page, focusIdx, onOpen });
  useEffect(() => {
    keys.current = { page, focusIdx, onOpen };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcutsBlocked(e) || !["j", "k", "x", "Enter"].includes(e.key)) return;
      // Enter on a focused button or link is that control's, not the list's.
      if (e.key === "Enter" && (e.target as HTMLElement).closest("button, a, [role=button]")) return;
      const { page, focusIdx, onOpen } = keys.current;
      if (!page.length) return;
      if (e.key === "j" || e.key === "k") {
        // A filter or sort change can drop the highlighted row; then j starts from the top.
        const next = focusIdx < 0 ? 0 : Math.min(Math.max(focusIdx + (e.key === "j" ? 1 : -1), 0), page.length - 1);
        setFocusKey(keyOf(page[next]));
        document.querySelector(`[data-row="${CSS.escape(keyOf(page[next]))}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (focusIdx >= 0) {
        const r = page[focusIdx];
        if (e.key === "x") setChecked((c) => {
          const next = new Set(c);
          if (next.has(keyOf(r))) next.delete(keyOf(r));
          else next.add(keyOf(r));
          return next;
        });
        else onOpen(r);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const allOn = page.length > 0 && page.every((r) => checked.has(keyOf(r)));
  const toggle = (r: ProspectRow) => {
    const next = new Set(checked);
    if (next.has(keyOf(r))) next.delete(keyOf(r));
    else next.add(keyOf(r));
    setChecked(next);
  };
  const showBand = kind ? !UNSCORED_KINDS.has(kind) : true;
  const counts = useMemo(() => Object.fromEntries(PROSPECT_KINDS.map((k) => [k, rows.filter((r) => r.kind === k).length])), [rows]);

  /** Writes the same cells to the selected rows (the first 50) in one batch; the rows change on screen at once. */
  const bulk = (patch: Record<string, string | null>, done: string) => {
    // Taken now: the patch can move rows out of this view (a stage filter) before the save returns.
    const targets = selected.slice(0, 50).map((r) => ({ kind: r.kind, id: r.id }));
    const more = selected.length > 50;
    start(async () => {
      patchRows({ keys: targets.map(keyOf), patch });
      const res = await saveProspects(targets, patch);
      // Rows that saved leave the selection; failed ones stay ticked so they can be retried.
      if (res.ok) setChecked(new Set(res.failed.map((f) => keyOf(targets.find((t) => t.id === f.id)!))));
      if (res.failed.length) toast.error(res.message);
      else if (res.ok) toast.success(`${res.ok} ${done}${more ? " (the first 50)" : ""}`);
      else toast.error(res.message);
    });
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([csv(selected.length ? selected : shown)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects-${kind || "all"}-${view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Record type" className="no-scrollbar -mx-3 flex gap-0.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {[{ value: "" as const, label: "All", n: rows.length }, ...PROSPECT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k].many, n: counts[k] }))].map((t) => (
          <button
            key={t.value || "all"}
            type="button"
            role="tab"
            aria-selected={t.value === kind}
            onClick={() => {
              setKind(t.value);
              setChecked(new Set());
              setLimit(PAGE);
            }}
            className={cn("h-8 shrink-0 rounded-md px-2.5 text-[13px] whitespace-nowrap", t.value === kind ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}
          >
            <span className="inline-flex items-center gap-1.5">
              {t.value && <KindDot kind={t.value} />}
              {t.label} <span className="font-mono text-[11px] text-muted-foreground/70">{t.n.toLocaleString("en-IN")}</span>
            </span>
          </button>
        ))}
      </div>

      <FilterBar filters={filters} setFilters={setFilters} team={team} scope={scope} setScope={setScope} showKind={false}>
        <FilterMenu label="View" value={view} onChange={(v) => setView(v)} options={SAVED_VIEWS.map((v) => ({ value: v.id, label: v.id === "all" ? "Everything" : v.label }))} />
        <FilterMenu label="Stage" value={stage === null ? "" : String(stage)} onChange={(v) => setStage(v === "" ? null : Number(v))} options={[{ value: "", label: "Any" }, ...STAGES.map((s, i) => ({ value: String(i), label: s }))]} />
        <LayoutSwitch value="list" onChange={setLayout} />
      </FilterBar>

      {(() => {
        const chips = [
          filters.q.trim() && { label: `Search: ${filters.q.trim()}`, clear: () => setFilters({ ...filters, q: "" }) },
          filters.owner && { label: `Owner: ${filters.owner === "me" ? "Me" : filters.owner === "none" ? "Nobody" : filters.owner}`, clear: () => setFilters({ ...filters, owner: "" }) },
          filters.band && { label: `Band: ${filters.band}`, clear: () => setFilters({ ...filters, band: "" }) },
          view !== "all" && { label: `View: ${current.label}`, clear: () => setView("all") },
          stage !== null && { label: `Stage: ${STAGES[stage]}`, clear: () => setStage(null) },
        ].filter(Boolean) as { label: string; clear: () => void }[];
        if (!chips.length) return null;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <span key={c.label} className="inline-flex h-6 items-center gap-1 rounded-md border bg-muted/40 pr-0.5 pl-2 text-xs">
                {c.label}
                <button type="button" aria-label={`Remove ${c.label}`} onClick={c.clear} className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {chips.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setFilters({ ...filters, q: "", owner: "", band: "" });
                  setView("all");
                  setStage(null);
                }}
                className="h-6 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
        );
      })()}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{shown.length.toLocaleString("en-IN")} prospects</span>
        <span className="flex-1" />
        {CALL_VIEWS.has(view) && (
          <>
            <button type="button" onClick={onStartCalls} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
              <Phone className="size-3" /> Start calling
            </button>
            <span aria-hidden>·</span>
          </>
        )}
        <button type="button" onClick={onShareOut} className="hover:text-foreground">
          Share out…
        </button>
        <span aria-hidden>·</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded px-1 hover:bg-muted hover:text-foreground aria-expanded:bg-muted">
            <SlidersHorizontal className="size-3" /> Display
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-52">
            <DropdownMenuLabel>Order by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort.key} onValueChange={(k) => setSort(sortParam({ key: k as SortKey, dir: k === "score" ? -1 : 1 }))}>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {SORT_LABEL[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuItem onClick={() => setSort(sortParam({ key: sort.key, dir: sort.dir === 1 ? -1 : 1 }))}>
              {sort.dir === 1 ? <ArrowUp /> : <ArrowDown />} {sort.dir === 1 ? "Ascending" : "Descending"} · switch
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportCsv}>Export {(selected.length || shown.length).toLocaleString("en-IN")} to CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ul className="divide-y divide-border-subtle rounded-lg border md:hidden">
        {page.map((r) => (
          <li key={keyOf(r)} className={cn("flex items-start gap-3 px-3 py-2.5", (checked.has(keyOf(r)) || openKey === keyOf(r)) && "bg-selected")}>
            <input type="checkbox" aria-label={`Select ${r.name}`} checked={checked.has(keyOf(r))} onChange={() => toggle(r)} className="mt-1 size-4 shrink-0 accent-[var(--brand)]" />
            <button type="button" onClick={() => onOpen(r)} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                <Owner name={r.assigned} />
              </span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                <StagePill stage={r.stage} className="text-xs" />
                {r.band && <BandBadge band={r.band} score={r.score} />}
                <span className="truncate">{r.city || r.state || "—"}</span>
                {r.nextStepDate && <DueChip date={r.nextStepDate} today={today} />}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nothing matches.</li>}
      </ul>

      <div className="overflow-x-auto max-md:hidden">
        <table className="w-full min-w-[900px] table-fixed text-[13px]">
          <thead className="text-left text-xs font-medium text-muted-foreground">
            <tr className="border-b">
              <th className="w-9 py-2 pl-1 font-normal">
                <input type="checkbox" aria-label="Select all on this page" checked={allOn} onChange={() => setChecked(allOn ? new Set() : new Set(page.map(keyOf)))} className="accent-[var(--brand)]" />
              </th>
              <SortHead k="name" sort={sort} onSort={sortBy} className="w-[30%] py-2 pr-3 pl-0">
                Name
              </SortHead>
              <SortHead k="stage" sort={sort} onSort={sortBy} className="w-[14%]">
                Stage
              </SortHead>
              {showBand && (
                <SortHead k="score" sort={sort} onSort={sortBy} className="w-20">
                  Band
                </SortHead>
              )}
              <SortHead k="city" sort={sort} onSort={sortBy} className="w-[12%]">
                City
              </SortHead>
              <th className="px-3 font-normal">Next step</th>
              <SortHead k="due" sort={sort} onSort={sortBy} className="w-32">
                Due
              </SortHead>
              <SortHead k="owner" sort={sort} onSort={sortBy} className="w-32">
                Owner
              </SortHead>
            </tr>
          </thead>
          <tbody>
            {page.map((r) => (
              <tr
                key={keyOf(r)}
                data-row={keyOf(r)}
                onClick={() => onOpen(r)}
                className={cn("group h-9 cursor-pointer border-b border-border-subtle hover:bg-muted/60", (checked.has(keyOf(r)) || openKey === keyOf(r)) && "bg-selected hover:bg-selected", focusKey === keyOf(r) && "outline-2 -outline-offset-2 outline-brand/50")}
              >
                <td className="pl-1" onClick={(e) => e.stopPropagation()}>
                  {/* As on task rows: hidden until hover on a mouse, always shown once anything is ticked. */}
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    checked={checked.has(keyOf(r))}
                    onChange={() => toggle(r)}
                    className={cn("accent-[var(--brand)]", !checked.size && "[@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
                  />
                </td>
                <td className="truncate pr-3">
                  <button type="button" onClick={() => onOpen(r)} className="font-medium hover:underline">
                    {r.name}
                  </button>
                  {!kind && <span className="ml-2 font-mono text-[10px] text-muted-foreground uppercase">{r.kind.slice(0, 3)}</span>}
                </td>
                <td className="truncate px-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label={`Stage of ${r.name}: ${STAGES[r.stage]}. Change`} className="-mx-1 inline-flex items-center gap-1 rounded-full px-1 py-0.5 hover:bg-muted aria-expanded:bg-muted">
                      <StagePill stage={r.stage} />
                      <ChevronDown className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-auto min-w-44">
                      {STAGES.map((s, i) => (
                        <div key={s} className="contents">
                          {i === 6 && <DropdownMenuSeparator />}
                          <DropdownMenuItem onClick={() => move(r, i)}>
                            <StageDot stage={i} /> {s}
                          </DropdownMenuItem>
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
                {showBand && <td className="px-3">{r.band ? <BandBadge band={r.band} score={r.score} /> : <span className="text-muted-foreground">—</span>}</td>}
                <td className="truncate px-3">{r.city || <span className="text-muted-foreground">{r.state || "—"}</span>}</td>
                <td className="truncate px-3 text-muted-foreground">{r.nextStep || "—"}</td>
                <td className="px-3" onClick={(e) => e.stopPropagation()}>
                  <DatePicker value={r.nextStepDate} today={today} onPick={(iso) => saveRow(r, { next_step_date: iso })}>
                    <button type="button" aria-label={`Follow-up date for ${r.name}. Change`} className="-mx-1 rounded px-1 py-0.5 hover:bg-muted">
                      {r.nextStepDate ? <DueChip date={r.nextStepDate} today={today} /> : <span className="text-xs text-muted-foreground group-hover:text-foreground">—</span>}
                    </button>
                  </DatePicker>
                </td>
                <td className="truncate px-3 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <OwnerPicker value={r.assigned} me={me} team={team} onPick={(n) => saveRow(r, { assigned: n || null })}>
                    <button type="button" aria-label={`Owner of ${r.name}: ${r.assigned || "nobody"}. Change`} className="-mx-1 inline-flex max-w-full items-center gap-1.5 truncate rounded px-1 py-0.5 hover:bg-muted hover:text-foreground">
                      {r.assigned ? (
                        <>
                          <Owner name={r.assigned} /> <span className="truncate">{r.assigned}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </button>
                  </OwnerPicker>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing matches. Try another view or clear a filter.</p>}
      </div>

      {shown.length > limit && (
        <Button variant="outline" size="sm" className="self-center" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, shown.length - limit)} more of {(shown.length - limit).toLocaleString("en-IN")}
        </Button>
      )}

      {selected.length > 0 && (
        <div role="toolbar" aria-label="Bulk actions" className="fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-fit flex-wrap items-center gap-1 rounded-xl bg-foreground p-1.5 text-[13px] text-background shadow-2xl md:bottom-6">
          <span className="px-2.5">{selected.length} selected</span>
          <OwnerPicker value="" me={me} team={team} disabled={pending} onPick={(n) => bulk({ assigned: n || null }, n ? `assigned to ${n}` : "unassigned")}>
            <button type="button" className="h-8 rounded-lg bg-background/10 px-2.5 hover:bg-background/20">
              Assign to…
            </button>
          </OwnerPicker>
          <DropdownMenu>
            <DropdownMenuTrigger disabled={pending} className="inline-flex h-8 items-center gap-1 rounded-lg bg-background/10 px-2.5 hover:bg-background/20">
              Set stage <ChevronDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-auto min-w-44">
              {STAGES.map((s, i) => (
                <div key={s} className="contents">
                  {i === 6 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => bulk({ status: s }, `set to ${s}`)}>
                    <StageDot stage={i} /> {s}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DatePicker value={null} today={today} disabled={pending} allowClear={false} onPick={(iso) => iso && bulk({ next_step_date: iso }, "given a follow-up date")}>
            <button type="button" className="h-8 rounded-lg bg-background/10 px-2.5 hover:bg-background/20">
              Follow up…
            </button>
          </DatePicker>
          <button type="button" onClick={exportCsv} className="h-8 rounded-lg px-2.5 text-background/70 hover:text-background">
            Export
          </button>
          <button type="button" aria-label="Clear selection" onClick={() => setChecked(new Set())} className="grid size-8 place-items-center rounded-lg text-background/70 hover:text-background">
            <X className="size-4" />
          </button>
        </div>
      )}
      {stageDialog}
      <span className="sr-only" aria-live="polite">
        {pending ? "Saving to the sheet" : ""}
      </span>
    </div>
  );
}
