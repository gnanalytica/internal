"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { MilestoneStatusPicker } from "@/components/pickers";
import { TaskPanel } from "@/components/task-panel";
import { Topbar } from "@/components/topbar";
import { updateMilestone } from "@/lib/actions";
import type { MilestoneDetail, TaskContext } from "@/lib/types";

const toDateInput = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export function MilestoneDetailView({
  milestone,
  ctx,
}: {
  milestone: MilestoneDetail;
  ctx: TaskContext;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [name, setName] = useState(milestone.name);
  const projectId = milestone.project?.id ?? milestone.projectId;

  const save = (patch: Parameters<typeof updateMilestone>[1]) =>
    start(async () => {
      await updateMilestone(milestone.id, patch);
      router.refresh();
    });

  const { done, total, pct } = milestone.progress;

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          { label: milestone.project?.name ?? "Project", href: `/projects/${projectId}/product` },
          { label: name },
        ]}
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const v = name.trim();
              if (v && v !== milestone.name) save({ name: v });
            }}
            className="w-full bg-transparent text-2xl font-bold outline-none"
            aria-label="Milestone name"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <MilestoneStatusPicker
              value={milestone.status}
              onChange={(status) => save({ status })}
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Target
              <input
                type="date"
                defaultValue={toDateInput(milestone.targetDate)}
                onChange={(e) => save({ targetDate: e.target.value || null })}
                className="rounded border bg-transparent px-1.5 py-1"
              />
            </label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {total > 0 ? `${done}/${total} tasks · ${pct}%` : "no tasks yet"}
            </span>
          </div>

          {/* Progress */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>

          {/* Description */}
          <textarea
            defaultValue={milestone.description ?? ""}
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (milestone.description ?? "")) save({ description: v || null });
            }}
            placeholder="Add a description for this milestone…"
            rows={2}
            className="mt-4 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        {/* The tasks that deliver this gate. Wider than the prose column above:
            the task tool needs room for its toolbar and titles, and cramming it
            into a reading measure made both unreadable. */}
        <div className="mx-auto w-full max-w-6xl px-8 pb-10">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tasks
          </h3>
          {milestone.directIssues.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing delivers this gate yet.
            </p>
          ) : (
            <TaskPanel
              heading="Delivering this gate"
              issues={milestone.directIssues}
              ctx={ctx}
              projectId={projectId}
              storageScope={`milestone:${milestone.id}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
