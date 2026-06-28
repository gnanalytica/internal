"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { RoadmapChart, type GanttGroup } from "@/components/roadmap-chart";
import { updateIssue } from "@/lib/actions";
import { STATUSES } from "@/lib/constants";
import type { IssueWithRelations, Member } from "@/lib/types";
import { issueIdentifier } from "@/lib/types";

/**
 * Gantt-style schedule of issues by start → due date, grouped by status.
 * Reuses the roadmap chart; dragging a bar reschedules the issue. Issues with
 * no dates show a "Set dates" prompt rather than a bar.
 */
export function IssueTimelineView({
  issues,
  members,
}: {
  issues: IssueWithRelations[];
  members: Member[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Stable "now" for the today marker; client-only value avoids SSR drift.
  const [nowISO] = useState(() => new Date().toISOString());

  const memberName = (id: string | null) =>
    id ? (members.find((m) => m.id === id)?.name ?? null) : null;

  const groups: GanttGroup[] = STATUSES.map((s) => ({
    key: s.id,
    name: s.label,
    color: s.color,
    items: issues
      .filter((i) => i.status === s.id)
      .map((i) => ({
        id: i.id,
        title: i.title,
        href: `/issues/${i.id}`,
        startDate: i.startDate,
        targetDate: i.dueDate,
        color: s.color,
        statusLabel: s.label,
        meta: [issueIdentifier(i), memberName(i.assigneeId)]
          .filter(Boolean)
          .join(" · "),
      })),
  })).filter((g) => g.items.length > 0);

  function reschedule(
    id: string,
    dates: { startDate: Date | null; targetDate: Date | null },
  ) {
    startTransition(async () => {
      await updateIssue(id, {
        startDate: dates.startDate ? dates.startDate.toISOString() : null,
        dueDate: dates.targetDate ? dates.targetDate.toISOString() : null,
      });
      router.refresh();
    });
  }

  return (
    <RoadmapChart
      groups={groups}
      nowISO={nowISO}
      scale="month"
      labelHeader="Task"
      showGroupHeaders
      onReschedule={reschedule}
      legend={
        <span className="text-[11px] text-muted-foreground">
          Drag a bar to reschedule · grouped by status
        </span>
      }
    />
  );
}
