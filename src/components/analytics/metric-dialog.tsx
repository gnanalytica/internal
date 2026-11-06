"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createMetric, deleteMetric, updateMetric } from "@/lib/actions";
import { AUTO_SOURCE_KEYS, AUTO_SOURCES, isAutoSource, parseCell, SCORECARD_AREAS, type MetricSource, type ScorecardArea, type ScorecardRow } from "@/lib/scorecard";
import { cn } from "@/lib/utils";

const fieldCls = "h-9 w-full min-w-0 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-8";
const UNITS = ["per week", "total", "%", "count", "min", "hours", "₹"];

function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Add a metric to the scorecard, or change or remove one. `metric` null adds. */
export function MetricDialog({ projectId, metric, open, onOpenChange, onSaved }: { projectId: string; metric: ScorecardRow | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        {/* Keyed so each metric opens on a clean form. */}
        <MetricForm key={metric?.id ?? "new"} projectId={projectId} metric={metric} onDone={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function MetricForm({ projectId, metric, onDone, onSaved }: { projectId: string; metric: ScorecardRow | null; onDone: () => void; onSaved: () => void }) {
  const [name, setName] = useState(metric?.name ?? "");
  const [unit, setUnit] = useState(metric?.unit ?? "");
  const [area, setArea] = useState<ScorecardArea>(metric?.area ?? "product");
  const [source, setSourceState] = useState<MetricSource>(metric?.source ?? "manual");
  const [target, setTarget] = useState(metric?.target === null || metric?.target === undefined ? "" : String(metric.target));
  const [direction, setDirection] = useState<"above" | "below">(metric?.targetDirection ?? "above");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const parsedTarget = parseCell(target);
  const invalid = !name.trim() || parsedTarget === undefined;

  // Picking something the app counts fills in what it would be called and where it sits, if those are still blank or untouched.
  const setSource = (s: MetricSource) => {
    setSourceState(s);
    if (!isAutoSource(s)) return;
    const def = AUTO_SOURCES[s];
    if (!name.trim()) setName(def.label);
    if (!metric) setArea(def.area);
    if (!unit.trim()) setUnit(def.kind === "week" ? "per week" : "total");
  };

  const save = () =>
    start(async () => {
      if (invalid) return;
      const fields = { name: name.trim(), unit: unit.trim() || null, area, source, target: parsedTarget ?? null, targetDirection: direction };
      try {
        if (metric) await updateMetric(metric.id, fields);
        else await createMetric({ projectId, cadence: "weekly", ...fields });
        toast.success(metric ? "Metric saved" : `${fields.name} added`);
        onSaved();
        onDone();
      } catch {
        toast.error("Couldn't save the metric. Try again.");
      }
    });

  const remove = () =>
    start(async () => {
      if (!metric) return;
      try {
        await deleteMetric(metric.id);
        toast.success(`${metric.name} removed`);
        onSaved();
        onDone();
      } catch {
        toast.error("Couldn't remove the metric. Try again.");
      }
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <DialogHeader className="gap-0.5 px-5 pt-5 pb-1">
        <DialogTitle>{metric ? "Edit metric" : "Add a metric"}</DialogTitle>
        <DialogDescription>{metric ? "Typed-in numbers already recorded stay with it." : "One number a week, with a target to read it against."}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-5 pt-3 pb-5">
        <Field label="Name" htmlFor="metric-name">
          <input id="metric-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Demos done" className={fieldCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit" htmlFor="metric-unit">
            <input id="metric-unit" list="metric-units" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="per week" className={fieldCls} />
            <datalist id="metric-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <Field label="Group" htmlFor="metric-area">
            <select id="metric-area" value={area} onChange={(e) => setArea(e.target.value as ScorecardArea)} className={fieldCls}>
              {SCORECARD_AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Where the number comes from" htmlFor="metric-source" hint={isAutoSource(source) ? `Counted by the app: ${AUTO_SOURCES[source].how.toLowerCase()}` : "You type it in once a week."}>
          <select id="metric-source" value={source} onChange={(e) => setSource(e.target.value as MetricSource)} className={fieldCls}>
            <option value="manual">Typed in each week</option>
            {SCORECARD_AREAS.map((a) => {
              const keys = AUTO_SOURCE_KEYS.filter((k) => AUTO_SOURCES[k].area === a.id);
              if (!keys.length) return null;
              return (
                <optgroup key={a.id} label={`Counted by the app · ${a.label}`}>
                  {keys.map((k) => (
                    <option key={k} value={k}>
                      {AUTO_SOURCES[k].label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Good when it is" htmlFor="metric-direction">
            <select id="metric-direction" value={direction} onChange={(e) => setDirection(e.target.value === "below" ? "below" : "above")} className={fieldCls}>
              <option value="above">At least the target</option>
              <option value="below">At most the target</option>
            </select>
          </Field>
          <Field label="Target" htmlFor="metric-target" hint={parsedTarget === undefined ? <span className="text-destructive">Enter a number, or leave it blank.</span> : target.trim() ? undefined : "Blank: trend only."}>
            <input id="metric-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="None" aria-invalid={parsedTarget === undefined || undefined} className={cn(fieldCls, "font-mono")} />
          </Field>
        </div>
      </div>
      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-muted/50 px-5 py-3">
        {metric && (
          <Button type="button" variant={confirmDelete ? "destructive" : "ghost"} onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))} disabled={pending} className={cn(!confirmDelete && "text-muted-foreground")}>
            {confirmDelete ? "Remove for good" : "Remove"}
          </Button>
        )}
        <span className="flex-1" />
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || invalid}>
          {pending ? "Saving…" : metric ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
