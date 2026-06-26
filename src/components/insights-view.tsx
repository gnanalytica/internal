"use client";

import { ChartCard, Donut, Legend, type Slice } from "@/components/charts";
import { UserAvatar } from "@/components/glyphs";
import { Topbar } from "@/components/topbar";
import { PRIORITIES, STATUSES } from "@/lib/constants";
import type { Insights } from "@/lib/types";

export function InsightsView({ insights }: { insights: Insights }) {
  const { total, completed } = insights;
  const open = total - completed - (insights.statusCounts["canceled"] ?? 0);
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const priorityMax = Math.max(1, ...PRIORITIES.map((p) => insights.priorityCounts[p.id] ?? 0));
  const assigneeMax = Math.max(1, ...insights.assignees.map((a) => a.open));

  const statusSlices: Slice[] = STATUSES.map((s) => ({
    label: s.label,
    value: insights.statusCounts[s.id] ?? 0,
    color: s.color,
  }));

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Insights" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          {/* Hero: status donut + KPIs */}
          <div className="grid gap-3 md:grid-cols-3">
            <ChartCard title="Issues by status" className="md:col-span-1">
              <div className="flex items-center gap-4">
                <Donut
                  data={statusSlices}
                  center={
                    <div>
                      <div className="text-2xl font-bold leading-none">{pct}%</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">done</div>
                    </div>
                  }
                />
                <Legend data={statusSlices.filter((s) => s.value > 0)} className="flex-col" />
              </div>
            </ChartCard>
            <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-rows-2">
              <Stat label="Total issues" value={total} />
              <Stat label="Open" value={open} />
              <Stat label="Completed" value={completed} />
              <Stat label="Completion" value={`${pct}%`} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* By priority */}
            <Card title="Issues by priority">
              {PRIORITIES.map((p) => {
                const n = insights.priorityCounts[p.id] ?? 0;
                return (
                  <BarRow
                    key={p.id}
                    label={p.label}
                    value={n}
                    pct={(n / priorityMax) * 100}
                    color="#6366f1"
                  />
                );
              })}
            </Card>

            {/* Workload */}
            <Card title="Open issues by assignee">
              {insights.assignees.length === 0 ? (
                <Empty>No assigned open issues.</Empty>
              ) : (
                insights.assignees.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 py-1">
                    <UserAvatar name={a.name} color={a.color} className="size-5 text-[9px]" />
                    <span className="w-28 shrink-0 truncate text-xs">{a.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${(a.open / assigneeMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">
                      {a.open}
                    </span>
                  </div>
                ))
              )}
            </Card>

            {/* Cycle progress */}
            <Card title="Cycle progress">
              {insights.cycles.length === 0 ? (
                <Empty>No cycles with issues yet.</Empty>
              ) : (
                insights.cycles.map((c) => {
                  const cpct = c.total ? Math.round((c.done / c.total) * 100) : 0;
                  return (
                    <div key={c.id} className="py-1">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate">{c.name}</span>
                        <span className="text-muted-foreground">
                          {c.done}/{c.total} · {cpct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${cpct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-24 shrink-0 text-xs">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
