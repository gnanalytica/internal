"use client";

import { RoadmapChart, type GanttGroup } from "@/components/roadmap-chart";
import { updateFeature } from "@/lib/actions";
import { FEATURE_STATUSES } from "@/lib/departments";
import type { FeatureWithRelations } from "@/lib/types";

const statusMeta = (s: string) => FEATURE_STATUSES.find((x) => x.id === s);

function metaLine(f: FeatureWithRelations): string {
  const status = statusMeta(f.status)?.label ?? f.status;
  if (f.progress.total > 0) return `${status} · ${f.progress.done}/${f.progress.total} tasks`;
  return status;
}

export function FeatureTimeline({
  features,
  nowISO,
  groupByProject = false,
  milestones,
}: {
  features: FeatureWithRelations[];
  nowISO: string;
  groupByProject?: boolean;
  // When provided, group features under their milestone (release phase).
  milestones?: { id: string; name: string }[];
}) {
  const toItem = (f: FeatureWithRelations) => ({
    id: f.id,
    title: f.title,
    href: f.project ? `/projects/${f.project.id}/product/${f.id}` : `/product`,
    startDate: f.startDate,
    targetDate: f.targetDate,
    color: statusMeta(f.status)?.color ?? "#94a3b8",
    progress: f.progress.total > 0 ? f.progress.pct : undefined,
    statusLabel: statusMeta(f.status)?.label,
    meta: metaLine(f),
  });

  let groups: GanttGroup[];
  if (milestones) {
    // One group per milestone (in given order), then an "Unscheduled" catch-all.
    const ordered = [
      ...milestones.map((m) => ({ id: m.id, name: m.name })),
      { id: "none", name: "No milestone" },
    ];
    groups = ordered
      .map((m) => ({
        key: m.id,
        name: m.name,
        color: "#6366f1",
        items: features.filter((f) => (f.milestoneId ?? "none") === m.id).map(toItem),
      }))
      .filter((g) => g.items.length > 0);
  } else if (groupByProject) {
    groups = [
      ...new Map(features.map((f) => [f.project?.id ?? "none", f.project])).values(),
    ].map((prod) => ({
      key: prod?.id ?? "none",
      name: prod?.name ?? "No project",
      color: prod?.color ?? "#94a3b8",
      items: features
        .filter((f) => (f.project?.id ?? "none") === (prod?.id ?? "none"))
        .map(toItem),
    }));
  } else {
    groups = [{ key: "all", name: "", color: "", items: features.map(toItem) }];
  }

  return (
    <RoadmapChart
      groups={groups}
      nowISO={nowISO}
      scale="quarter"
      labelHeader="Feature"
      showGroupHeaders={groupByProject || Boolean(milestones)}
      onReschedule={(id, dates) => void updateFeature(id, dates)}
      legend={
        <>
          <span className="font-medium uppercase tracking-wide">Status</span>
          {FEATURE_STATUSES.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </>
      }
    />
  );
}
