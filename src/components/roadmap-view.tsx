"use client";

import { Map as MapIcon } from "lucide-react";

import { RoadmapChart, type GanttGroup } from "@/components/roadmap-chart";
import { Topbar } from "@/components/topbar";
import { updateProject } from "@/lib/actions";
import type { RoadmapProject } from "@/lib/data";

export function RoadmapView({
  projects,
  nowISO,
  embedded = false,
}: {
  projects: RoadmapProject[];
  nowISO: string;
  /** Hide the page Topbar when rendered inside the Projects tabs. */
  embedded?: boolean;
}) {
  // Group by kind: shippable Projects first, then Operations.
  const groupsMap = new Map<string, GanttGroup>();
  const meta: Record<string, { name: string; color: string }> = {
    project: { name: "Projects", color: "#6366f1" },
    operation: { name: "Operations", color: "#94a3b8" },
  };
  for (const p of projects) {
    const key = p.kind;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        name: meta[key]?.name ?? key,
        color: meta[key]?.color ?? "#94a3b8",
        items: [],
      });
    }
    groupsMap.get(key)!.items.push({
      id: p.id,
      title: p.name,
      href: `/projects/${p.id}`,
      startDate: p.startDate,
      targetDate: p.targetDate,
      color: p.color,
    });
  }
  const groups = [...groupsMap.values()].sort((a, b) =>
    a.key === "project" ? -1 : b.key === "project" ? 1 : a.name.localeCompare(b.name),
  );

  return (
    <div className="flex h-full flex-col">
      {!embedded && <Topbar breadcrumb={[{ label: "Roadmap" }]} />}
      {projects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
            <MapIcon className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No projects to plan yet</p>
            <p className="text-xs text-muted-foreground">
              Create projects and give them start/target dates to see them here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <RoadmapChart
            groups={groups}
            nowISO={nowISO}
            scale="month"
            labelHeader="Project"
            showGroupHeaders
            onReschedule={(id, dates) =>
              void updateProject(id, {
                startDate: dates.startDate ? dates.startDate.toISOString() : null,
                targetDate: dates.targetDate ? dates.targetDate.toISOString() : null,
              })
            }
          />
        </div>
      )}
    </div>
  );
}
