"use client";

import { Map as MapIcon } from "lucide-react";

import { RoadmapChart, type GanttGroup } from "@/components/roadmap-chart";
import { Topbar } from "@/components/topbar";
import type { RoadmapProject } from "@/lib/data";

export function RoadmapView({
  projects,
  nowISO,
}: {
  projects: RoadmapProject[];
  nowISO: string;
}) {
  // Group by initiative; undated / un-initiatived projects sort last.
  const groupsMap = new Map<string, GanttGroup>();
  for (const p of projects) {
    const key = p.initiative?.id ?? "none";
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        name: p.initiative?.name ?? "No initiative",
        color: p.initiative?.color ?? "#94a3b8",
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
    a.key === "none" ? 1 : b.key === "none" ? -1 : a.name.localeCompare(b.name),
  );

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Roadmap" }]} />
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
          />
        </div>
      )}
    </div>
  );
}
