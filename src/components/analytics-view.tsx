"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Star, Trash2 } from "lucide-react";

import { AreaChart } from "@/components/charts";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import {
  addMetricPoint,
  createMetric,
  deleteMetric,
  deleteMetricPoint,
  updateMetric,
} from "@/lib/actions";
import { METRIC_CADENCES } from "@/lib/departments";
import { formatDate } from "@/lib/matrix-format";
import type { MetricWithRelations, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const fieldCls =
  "h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

function fmt(value: number, unit?: string | null) {
  const n = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (!unit) return n;
  return unit === "%" || unit.startsWith("/") ? `${n}${unit}` : `${n} ${unit}`;
}

export function AnalyticsView({
  heading,
  scopeProjectId,
  initialMetrics,
  groupByProject = false,
}: {
  heading: string;
  scopeProjectId: string | null;
  projects: Project[];
  initialMetrics: MetricWithRelations[];
  groupByProject?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const refresh = () => router.refresh();

  const northStars = initialMetrics.filter((m) => m.isNorthStar).length;

  const groups = groupByProject
    ? Array.from(
        initialMetrics.reduce((map, m) => {
          const key = m.project?.name ?? "Company-wide";
          (map.get(key) ?? map.set(key, []).get(key)!).push(m);
          return map;
        }, new Map<string, MetricWithRelations[]>()),
      )
    : [["", initialMetrics] as const];

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {initialMetrics.length} metrics · {northStars} north-star
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              onClick={() => start(async () => { await createMetric({ projectId: scopeProjectId }); refresh(); })}
            >
              <Plus className="size-4" /> New metric
            </Button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {initialMetrics.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            No metrics yet. Add your north-star and key KPIs to track product health.
          </div>
        ) : (
          groups.map(([label, ms]) => (
            <div key={label} className="mb-6">
              {label && (
                <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h2>
              )}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ms.map((m) => (
                  <MetricCard key={m.id} metric={m} onChanged={refresh} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MetricCard({ metric, onChanged }: { metric: MetricWithRelations; onChanged: () => void }) {
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [period, setPeriod] = useState("");
  const [value, setValue] = useState("");

  const upd = (patch: Parameters<typeof updateMetric>[1]) =>
    start(async () => { await updateMetric(metric.id, patch); onChanged(); });

  const delta =
    metric.latest != null && metric.previous != null ? metric.latest - metric.previous : null;
  const deltaPct =
    delta != null && metric.previous ? Math.round((delta / Math.abs(metric.previous)) * 100) : null;

  const chartData = metric.points.map((p) => ({
    label: formatDate(p.periodDate),
    value: p.value,
  }));

  function savePoint() {
    if (!period || value === "") return;
    start(async () => {
      await addMetricPoint({ metricId: metric.id, periodDate: period, value: Number(value) });
      setAdding(false);
      setPeriod("");
      setValue("");
      onChanged();
    });
  }

  return (
    <div className="flex flex-col rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <button
          title={metric.isNorthStar ? "North-star metric" : "Mark as north-star"}
          onClick={() => upd({ isNorthStar: !metric.isNorthStar })}
          className={cn("mt-0.5 shrink-0", metric.isNorthStar ? "text-amber-400" : "text-muted-foreground hover:text-foreground")}
        >
          <Star className={cn("size-4", metric.isNorthStar && "fill-amber-400")} />
        </button>
        <input
          defaultValue={metric.name}
          onBlur={(e) => e.target.value !== metric.name && upd({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold focus:outline-none"
        />
        <button
          onClick={() => start(async () => { await deleteMetric(metric.id); onChanged(); })}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Delete metric"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-bold leading-none">
          {metric.latest != null ? fmt(metric.latest, metric.unit) : "—"}
        </span>
        {delta != null && (
          <span
            className={cn(
              "mb-0.5 text-xs font-medium",
              delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-muted-foreground",
            )}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {fmt(Math.abs(delta), metric.unit)}
            {deltaPct != null && ` (${Math.abs(deltaPct)}%)`}
          </span>
        )}
      </div>

      {chartData.length > 1 ? (
        <div className="mt-2">
          <AreaChart data={chartData} color="#14b8a6" height={64} format={(n) => fmt(n, metric.unit)} />
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {chartData.length === 1 ? "Add another point to see a trend." : "No data yet."}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <select
          defaultValue={metric.cadence}
          onChange={(e) => upd({ cadence: e.target.value })}
          className="h-7 rounded border bg-background px-1 text-xs text-muted-foreground"
        >
          {METRIC_CADENCES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input
          defaultValue={metric.unit ?? ""}
          onBlur={(e) => (e.target.value || null) !== metric.unit && upd({ unit: e.target.value || null })}
          placeholder="unit (%, users, €)"
          className="h-7 w-28 rounded border bg-background px-1.5 text-xs"
        />
        {!adding && (
          <button onClick={() => setAdding(true)} className="ml-auto text-xs text-brand hover:underline">
            + data point
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 flex items-center gap-1.5">
          <input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} className={fieldCls + " flex-1"} />
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="value"
            className={fieldCls + " w-24"}
          />
          <Button size="sm" className="h-8" onClick={savePoint}>Save</Button>
        </div>
      )}

      {metric.points.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">{metric.points.length} points</summary>
          <div className="mt-1 space-y-0.5">
            {[...metric.points].reverse().map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">{formatDate(p.periodDate)}</span>
                <span className="font-medium">{fmt(p.value, metric.unit)}</span>
                <button
                  onClick={() => start(async () => { await deleteMetricPoint(p.id); onChanged(); })}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
