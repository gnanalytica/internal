"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ArrowRightToLine, CalendarSync, MoreHorizontal, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AreaChart } from "@/components/charts";
import { IssuesView } from "@/components/issues-view";
import { Topbar } from "@/components/topbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { applyCadenceToCycle, deleteCycle, rollOverCycle, updateCycle } from "@/lib/actions";
import type { Cycle, IssueWithRelations, TaskContext } from "@/lib/types";
import { cycleStatus } from "@/lib/types";

export function CycleDetail({
  cycle,
  ctx,
  burndownPoints,
  totalPoints,
}: {
  cycle: Cycle & { issues: IssueWithRelations[] };
  ctx: TaskContext;
  burndownPoints: { date: string; remaining: number; ideal: number }[];
  totalPoints: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(cycle.name);
  const now = new Date();

  const persist = (patch: Parameters<typeof updateCycle>[1]) =>
    startTransition(async () => {
      await updateCycle(cycle.id, patch);
      router.refresh();
    });
  const toInputDate = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");
  const status = cycleStatus(cycle, now);
  const done = cycle.issues.filter((i) => i.status === "done").length;
  const pct = cycle.issues.length ? Math.round((done / cycle.issues.length) * 100) : 0;

  const unfinished = cycle.issues.filter(
    (i) => i.status !== "done" && i.status !== "canceled",
  ).length;

  function onDelete() {
    startTransition(async () => {
      await deleteCycle(cycle.id);
      toast.success("Cycle deleted");
      router.push("/projects");
      router.refresh();
    });
  }

  function onApplyCadence() {
    startTransition(async () => {
      const added = await applyCadenceToCycle(cycle.id);
      toast.success(
        added === 0
          ? "Cadence already applied — nothing missing"
          : `Added ${added} ceremon${added === 1 ? "y" : "ies"}`,
      );
      router.refresh();
    });
  }

  function onRollOver() {
    startTransition(async () => {
      const { movedCount, cycle: target, created } = await rollOverCycle(cycle.id);
      toast.success(
        movedCount === 0
          ? `Nothing to carry — ${target.name} is ready`
          : `Moved ${movedCount} task${movedCount === 1 ? "" : "s"} to ${target.name}`,
        { description: created ? "Created the next cycle to receive them." : undefined },
      );
      router.push(`/cycles/${target.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          { label: "Cycles", href: `/projects/${cycle.projectId}/engineering` },
          { label: cycle.name },
        ]}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-7" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRollOver} className="gap-2">
                <ArrowRightToLine className="size-4" /> Move unfinished to next cycle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onApplyCadence} className="gap-2">
                <CalendarSync className="size-4" /> Apply cadence
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Delete cycle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Timer className="size-5 shrink-0 text-muted-foreground" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim() || cycle.name;
              if (trimmed !== cycle.name) persist({ name: trimmed });
            }}
            className="min-w-0 flex-1 rounded-md bg-transparent text-lg font-semibold focus:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring/40"
            aria-label="Cycle name"
          />
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
            {status}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="date"
            defaultValue={toInputDate(cycle.startDate)}
            onChange={(e) => e.target.value && persist({ startDate: e.target.value })}
            className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
            aria-label="Start date"
          />
          <span>–</span>
          <input
            type="date"
            defaultValue={toInputDate(cycle.endDate)}
            onChange={(e) => e.target.value && persist({ endDate: e.target.value })}
            className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
            aria-label="End date"
          />
        </div>
        <div className="mt-3 flex max-w-md items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {done}/{cycle.issues.length} done
          </span>
        </div>

        {/* A finished cycle still holding work is the moment rollover exists for. */}
        {status === "completed" && unfinished > 0 && (
          <div className="mt-3 flex max-w-md flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              This cycle ended with {unfinished} unfinished task
              {unfinished === 1 ? "" : "s"}.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-6 gap-1.5 text-xs"
              onClick={onRollOver}
            >
              <ArrowRightToLine className="size-3.5" /> Roll over
            </Button>
          </div>
        )}

        {/* Burndown */}
        <div className="mt-4 max-w-md">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Burndown (points)
            </span>
            <span className="text-[11px] text-muted-foreground">
              {totalPoints} pts total
            </span>
          </div>
          {burndownPoints.length > 0 && totalPoints > 0 ? (
            <AreaChart
              data={burndownPoints.map((p) => ({
                label: p.date.slice(5),
                value: p.remaining,
              }))}
              overlay={burndownPoints.map((p) => ({
                label: p.date.slice(5),
                value: p.ideal,
              }))}
              height={100}
              format={(n) => `${n} pts`}
            />
          ) : (
            <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
              No burndown yet — add estimated tasks to this cycle.
            </p>
          )}
        </div>
      </div>

      {/* Issues — the full task tool, so a cycle can be planned in place. */}
      <div className="min-h-0 flex-1">
        {cycle.issues.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <p className="text-sm font-medium">No tasks in this cycle</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Add tasks by opening a task and setting its <strong>Cycle</strong> property.
            </p>
          </div>
        ) : (
          <IssuesView
            embedded
            heading="Cycle tasks"
            initialIssues={cycle.issues}
            defaultProjectId={cycle.projectId}
            storageScope={`cycle:${cycle.id}`}
            projects={ctx.projects}
            members={ctx.members}
            labels={ctx.labels}
            savedViews={ctx.savedViews}
            cycles={ctx.cycles}
            milestones={ctx.milestones}
            blockedIds={ctx.blockedIds}
          />
        )}
      </div>
    </div>
  );
}
