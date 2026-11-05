"use client";

import { ChevronDown, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { saveProspect } from "@/lib/prospects/actions";
import { KIND_LABEL, PROSPECT_KINDS, STAGES, UNSCORED_KINDS, type ProspectKind } from "@/lib/prospects/schema";
import { SAVED_VIEWS, type ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { BandBadge, DatePicker, DueChip, FilterMenu, Owner, OwnerPicker, StageDot, StagePill } from "./bits";
import { applyFilters, FilterBar, NO_FILTERS, type Filters } from "./pipeline";

const PAGE = 100;

function csv(rows: ProspectRow[]): string {
  const head = ["type", "id", "name", "city", "state", "status", "band", "score", "assigned", "next_step", "next_step_date", "last_contacted", "lenders", "lb_cases_per_month", "current_software"];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head.join(","), ...rows.map((r) => [KIND_LABEL[r.kind].one, r.id, r.name, r.city, r.state, STAGES[r.stage], r.band, r.score, r.assigned, r.nextStep, r.nextStepDate, r.lastContacted, r.lenders, r.cases, r.software].map(esc).join(","))].join("\n");
}

const keyOf = (r: { kind: ProspectKind; id: string }) => `${r.kind}:${r.id}`;

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
  onOpen,
  onChanged,
  openKey,
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
  onOpen: (r: ProspectRow) => void;
  onChanged: () => void;
  openKey: string | null;
}) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [pending, start] = useTransition();
  const ctx = { person: me, today };
  const ofKind = useMemo(() => (kind ? rows.filter((r) => r.kind === kind) : rows), [rows, kind]);
  const current = SAVED_VIEWS.find((v) => v.id === view) ?? SAVED_VIEWS[0];
  const shown = useMemo(() => {
    const base = applyFilters(ofKind, filters, me).filter((r) => current.test(r, ctx) && (stage === null || r.stage === stage));
    return base.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofKind, filters, me, current, stage, today]);
  const selected = shown.filter((r) => checked.has(keyOf(r)));
  const page = shown.slice(0, limit);
  const allOn = page.length > 0 && page.every((r) => checked.has(keyOf(r)));
  const toggle = (r: ProspectRow) => {
    const next = new Set(checked);
    if (next.has(keyOf(r))) next.delete(keyOf(r));
    else next.add(keyOf(r));
    setChecked(next);
  };
  const showBand = kind ? !UNSCORED_KINDS.has(kind) : true;
  const counts = useMemo(() => Object.fromEntries(PROSPECT_KINDS.map((k) => [k, rows.filter((r) => r.kind === k).length])), [rows]);

  /** Writes the same cells to each selected row, one at a time, stopping at the first failure. */
  const bulk = (patch: Record<string, string | null>, done: string) =>
    start(async () => {
      let n = 0;
      for (const r of selected.slice(0, 50)) {
        const res = await saveProspect(r.kind, r.id, patch);
        if (!res.ok) {
          toast.error(`${n} updated; stopped at ${r.name}: ${res.message}`);
          onChanged();
          return;
        }
        n++;
      }
      toast.success(`${n} ${done}${selected.length > 50 ? " (the first 50)" : ""}`);
      setChecked(new Set());
      onChanged();
    });

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
            className={cn("h-8 shrink-0 rounded-md px-2.5 text-[13px] whitespace-nowrap", t.value === kind ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label} <span className="font-mono text-[11px] text-muted-foreground/70">{t.n.toLocaleString("en-IN")}</span>
          </button>
        ))}
      </div>

      <FilterBar filters={filters} setFilters={setFilters} team={team} scope={scope} setScope={setScope} showKind={false}>
        <FilterMenu label="View" value={view} onChange={(v) => setView(v)} options={SAVED_VIEWS.map((v) => ({ value: v.id, label: v.id === "all" ? "Everything" : v.label }))} />
        <FilterMenu label="Stage" value={stage === null ? "" : String(stage)} onChange={(v) => setStage(v === "" ? null : Number(v))} options={[{ value: "", label: "Any" }, ...STAGES.map((s, i) => ({ value: String(i), label: s }))]} />
      </FilterBar>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{shown.length.toLocaleString("en-IN")} prospects</span>
        <span className="flex-1" />
        <button type="button" onClick={exportCsv} className="hover:text-foreground">
          Export CSV
        </button>
      </div>

      <ul className="divide-y rounded-lg border md:hidden">
        {page.map((r) => (
          <li key={keyOf(r)} className={cn("flex items-start gap-3 px-3 py-2.5", (checked.has(keyOf(r)) || openKey === keyOf(r)) && "bg-muted/60")}>
            <input type="checkbox" aria-label={`Select ${r.name}`} checked={checked.has(keyOf(r))} onChange={() => toggle(r)} className="mt-1 size-4 shrink-0 accent-foreground" />
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
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="w-9 py-2 pl-1 font-normal">
                <input type="checkbox" aria-label="Select all on this page" checked={allOn} onChange={() => setChecked(allOn ? new Set() : new Set(page.map(keyOf)))} className="accent-foreground" />
              </th>
              <th className="w-[30%] py-2 pr-3 font-normal">Name</th>
              <th className="w-[14%] px-3 font-normal">Stage</th>
              {showBand && <th className="w-16 px-3 font-normal">Band</th>}
              <th className="w-[12%] px-3 font-normal">City</th>
              <th className="px-3 font-normal">Next step</th>
              <th className="w-32 px-3 font-normal">Due</th>
              <th className="w-28 px-3 font-normal">Owner</th>
            </tr>
          </thead>
          <tbody>
            {page.map((r) => (
              <tr key={keyOf(r)} onClick={() => onOpen(r)} className={cn("h-10 cursor-pointer border-b border-border/60 hover:bg-muted/40", (checked.has(keyOf(r)) || openKey === keyOf(r)) && "bg-muted/60")}>
                <td className="pl-1" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${r.name}`} checked={checked.has(keyOf(r))} onChange={() => toggle(r)} className="accent-foreground" />
                </td>
                <td className="truncate pr-3">
                  <button type="button" onClick={() => onOpen(r)} className="font-medium hover:underline">
                    {r.name}
                  </button>
                  {!kind && <span className="ml-2 font-mono text-[10px] text-muted-foreground uppercase">{r.kind.slice(0, 3)}</span>}
                </td>
                <td className="truncate px-3">
                  <StagePill stage={r.stage} />
                </td>
                {showBand && <td className="px-3">{r.band ? <BandBadge band={r.band} score={r.score} /> : <span className="text-muted-foreground">—</span>}</td>}
                <td className="truncate px-3">{r.city || <span className="text-muted-foreground">{r.state || "—"}</span>}</td>
                <td className="truncate px-3 text-muted-foreground">{r.nextStep || "—"}</td>
                <td className="px-3">{r.nextStepDate ? <DueChip date={r.nextStepDate} today={today} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="truncate px-3 text-muted-foreground">
                  {r.assigned ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Owner name={r.assigned} /> {r.assigned}
                    </span>
                  ) : (
                    "—"
                  )}
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
      <span className="sr-only" aria-live="polite">
        {pending ? "Saving to the sheet" : ""}
      </span>
    </div>
  );
}
