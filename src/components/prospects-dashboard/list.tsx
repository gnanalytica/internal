"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assignToMe, saveProspect } from "@/lib/prospects/actions";
import { displayDate } from "@/lib/prospects/parse";
import { ID_COLUMN, STAGES, UNSCORED_KINDS, WRITABLE, type ProspectKind } from "@/lib/prospects/schema";
import { FACT_COUNT, SAVED_VIEWS, type ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { BandBadge, DueChip, StagePill } from "./bits";
import { applyFilters, FilterBar, type Filters } from "./pipeline";

const PAGE = 100;

function csv(kind: ProspectKind, rows: ProspectRow[]): string {
  const head = [ID_COLUMN[kind], "name", "city", "state", "status", "band", "score", "assigned", "next_step", "next_step_date", "last_contacted", "lenders", "lb_cases_per_month", "current_software"];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head.join(","), ...rows.map((r) => [r.id, r.name, r.city, r.state, STAGES[r.stage], r.band, r.score, r.assigned, r.nextStep, r.nextStepDate, r.lastContacted, r.lenders, r.cases, r.software].map(esc).join(","))].join("\n");
}

export function ListView({ kind, rows, today, me, team, view, setView, stage, setStage, onOpen, onChanged }: { kind: ProspectKind; rows: ProspectRow[]; today: string; me: string; team: string[]; view: string; setView: (v: string) => void; stage: number | null; setStage: (s: number | null) => void; onOpen: (r: ProspectRow) => void; onChanged: () => void }) {
  const [filters, setFilters] = useState<Filters>({ owner: "", band: "", q: "" });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [pending, start] = useTransition();
  const ctx = { person: me, today };
  const col = { band: kind === "valuer", lenders: WRITABLE[kind].has("lenders_empanelled_with"), cases: WRITABLE[kind].has("lb_cases_per_month"), software: WRITABLE[kind].has("current_software"), facts: !UNSCORED_KINDS.has(kind) };
  const current = SAVED_VIEWS.find((v) => v.id === view) ?? SAVED_VIEWS[0];
  const shown = useMemo(() => {
    const base = applyFilters(rows, filters, me).filter((r) => current.test(r, ctx) && (stage === null || r.stage === stage));
    return base.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, me, current, stage, today]);
  const selected = shown.filter((r) => checked.has(r.id));
  const allOnPage = shown.slice(0, limit);
  const toggleAll = () => setChecked(checked.size === allOnPage.length ? new Set() : new Set(allOnPage.map((r) => r.id)));

  const bulkStatus = (s: string) =>
    start(async () => {
      let n = 0;
      for (const r of selected.slice(0, 50)) {
        const res = await saveProspect(kind, r.id, { status: s });
        if (!res.ok) {
          toast.error(`${n} updated; stopped at ${r.name}: ${res.message}`);
          onChanged();
          return;
        }
        n++;
      }
      toast.success(`${n} set to ${s}`);
      setChecked(new Set());
      onChanged();
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Views</span>
        {SAVED_VIEWS.map((v) => {
          const n = rows.filter((r) => v.test(r, ctx)).length;
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === view}
              onClick={() => {
                setView(v.id);
                setLimit(PAGE);
                setChecked(new Set());
              }}
              className={cn("h-7 rounded-full border px-3 text-xs font-medium", v.id === view ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
            >
              {v.label} <span className="font-mono opacity-70">{n.toLocaleString("en-IN")}</span>
            </button>
          );
        })}
      </div>
      <FilterBar filters={filters} setFilters={setFilters} team={team}>
        <label className="sr-only" htmlFor="pf-stage">
          Status
        </label>
        <select id="pf-stage" value={stage ?? ""} onChange={(e) => setStage(e.target.value === "" ? null : Number(e.target.value))} className="h-8 rounded-md border bg-background px-2 text-sm">
          <option value="">Status: any</option>
          {STAGES.map((s, i) => (
            <option key={s} value={i}>
              Status: {s}
            </option>
          ))}
        </select>
      </FilterBar>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {current.chips.map((c) => (
          <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {c}
          </span>
        ))}
        <span className="text-xs text-muted-foreground">{shown.length.toLocaleString("en-IN")} rows</span>
        <span className="flex-1" />
        {selected.length > 0 ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-foreground px-2 py-1 text-xs text-background">
            <span className="px-1">{selected.length} selected</span>
            <Button
              size="xs"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await assignToMe(kind, selected.map((r) => r.id));
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.message);
                  setChecked(new Set());
                  onChanged();
                })
              }
            >
              Assign to me
            </Button>
            <label className="sr-only" htmlFor="pf-bulk-status">
              Set status
            </label>
            <select id="pf-bulk-status" value="" disabled={pending} onChange={(e) => e.target.value && bulkStatus(e.target.value)} className="h-6 rounded-md bg-secondary px-1.5 text-xs text-secondary-foreground">
              <option value="">Set status…</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([csv(kind, shown)], { type: "text/csv" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = `prospects-${view}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1080px] text-[13px]">
          <thead className="bg-muted/60 text-left text-[11px] text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2">
                <input type="checkbox" aria-label="Select all on this page" checked={allOnPage.length > 0 && checked.size === allOnPage.length} onChange={toggleAll} className="accent-foreground" />
              </th>
              <th className="py-2 pr-2 font-medium">Name</th>
              <th className="px-2 font-medium">City</th>
              <th className="px-2 font-medium">Status</th>
              {col.band && <th className="px-2 font-medium">Band</th>}
              {col.lenders && <th className="px-2 text-right font-medium">Lenders</th>}
              {col.cases && <th className="px-2 text-right font-medium">Cases</th>}
              {col.software && <th className="px-2 font-medium">Software</th>}
              <th className="px-2 font-medium">Contact</th>
              {col.facts && <th className="px-2 font-medium">Facts</th>}
              <th className="px-2 font-medium">Research</th>
              <th className="px-2 font-medium">Last touch</th>
              <th className="px-2 font-medium">Next step</th>
              <th className="pr-3 pl-2 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {allOnPage.map((r) => (
              <tr key={r.id} className={cn("border-t hover:bg-muted/40", checked.has(r.id) && "bg-muted/60")}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    checked={checked.has(r.id)}
                    onChange={() => {
                      const next = new Set(checked);
                      if (next.has(r.id)) next.delete(r.id);
                      else next.add(r.id);
                      setChecked(next);
                    }}
                    className="accent-foreground"
                  />
                </td>
                <td className="max-w-64 py-2 pr-2">
                  <button type="button" onClick={() => onOpen(r)} className="block max-w-full truncate text-left font-medium hover:underline">
                    {r.name}
                  </button>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">{r.id}</span>
                </td>
                <td className="px-2">{r.city || <span className="text-muted-foreground">{r.state || "—"}</span>}</td>
                <td className="px-2">
                  <StagePill stage={r.stage} />
                </td>
                {col.band && (
                  <td className="px-2">
                    <BandBadge band={r.band} score={r.score} />
                  </td>
                )}
                {col.lenders && <td className={cn("px-2 text-right font-mono tabular-nums", !r.lenders && "text-amber-700")}>{r.lenders || "?"}</td>}
                {col.cases && <td className={cn("px-2 text-right font-mono tabular-nums", r.cases === null && "text-amber-700")}>{r.cases ?? "?"}</td>}
                {col.software && <td className={cn("max-w-36 truncate px-2", !r.software && "text-amber-700")}>{r.software || "unknown"}</td>}
                <td className="px-2">
                  <span className="flex gap-1 text-[11px]">
                    <span className={cn("rounded px-1", r.hasPhone ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950")} title={r.hasPhone ? "Has phone" : "No phone"}>
                      ☎
                    </span>
                    <span className={cn("rounded px-1", r.hasEmail ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950")} title={r.hasEmail ? "Has email" : "No email"}>
                      @
                    </span>
                  </span>
                </td>
                {col.facts && (
                  <td className="px-2 font-mono text-[11px] tabular-nums">
                    {r.facts}/{FACT_COUNT}
                  </td>
                )}
                <td className="max-w-32 truncate px-2 text-[11px]">{r.researchStatus || <span className="text-muted-foreground">Not started</span>}</td>
                <td className="px-2 font-mono text-[11px] text-muted-foreground">{r.lastContacted ? displayDate(r.lastContacted) : "—"}</td>
                <td className="px-2">{r.nextStepDate ? <DueChip date={r.nextStepDate} today={today} /> : <span className="text-[11px] text-muted-foreground">—</span>}</td>
                <td className="pr-3 pl-2 text-[12px]">{r.assigned || <span className="text-muted-foreground">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nothing matches this view.</p>}
      </div>
      {shown.length > limit && (
        <Button variant="outline" size="sm" className="self-center" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, shown.length - limit)} more of {(shown.length - limit).toLocaleString("en-IN")}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Amber means not researched yet. Click a name for the side panel.</p>
    </div>
  );
}
