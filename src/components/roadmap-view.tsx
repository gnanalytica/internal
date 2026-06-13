"use client";

import Link from "next/link";
import { Map as MapIcon } from "lucide-react";

import { Topbar } from "@/components/topbar";
import type { RoadmapProject } from "@/lib/data";
import {
  barMetrics,
  computeRange,
  monthLabel,
  todayOffset,
} from "@/lib/roadmap";

const NAME_W = 200; // px, left label column
const MONTH_W = 130; // px per month

export function RoadmapView({
  projects,
  nowISO,
}: {
  projects: RoadmapProject[];
  nowISO: string;
}) {
  const now = new Date(nowISO);
  const range = computeRange(projects, now);
  const trackWidth = range.months.length * MONTH_W;
  const totalWidth = NAME_W + trackWidth;
  const todayFrac = todayOffset(range, now);

  // Group by initiative, with undated/un-initiatived projects last.
  const groupsMap = new Map<string, { name: string; color: string; items: RoadmapProject[] }>();
  for (const p of projects) {
    const key = p.initiative?.id ?? "none";
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        name: p.initiative?.name ?? "No initiative",
        color: p.initiative?.color ?? "#94a3b8",
        items: [],
      });
    }
    groupsMap.get(key)!.items.push(p);
  }
  const groups = [...groupsMap.entries()]
    .sort((a, b) => (a[0] === "none" ? 1 : b[0] === "none" ? -1 : a[1].name.localeCompare(b[1].name)))
    .map(([, g]) => g);

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
        <div className="scrollbar-thin flex-1 overflow-auto">
          <div className="relative" style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Month header */}
            <div className="sticky top-0 z-10 flex border-b bg-background/95 backdrop-blur">
              <div
                className="shrink-0 px-4 py-2 text-xs font-semibold text-muted-foreground"
                style={{ width: NAME_W }}
              >
                Project
              </div>
              <div className="flex" style={{ width: trackWidth }}>
                {range.months.map((m, i) => (
                  <div
                    key={i}
                    className="shrink-0 border-l px-2 py-2 text-[11px] font-medium text-muted-foreground"
                    style={{ width: MONTH_W }}
                  >
                    {monthLabel(m)}
                  </div>
                ))}
              </div>
            </div>

            {/* Today marker spanning the body */}
            {todayFrac !== null && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-0 w-px bg-brand/50"
                style={{ left: NAME_W + todayFrac * trackWidth }}
              />
            )}

            {/* Groups */}
            {groups.map((g) => (
              <div key={g.name}>
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: g.color }}
                  />
                  <span className="text-xs font-semibold">{g.name}</span>
                  <span className="text-xs text-muted-foreground">{g.items.length}</span>
                </div>

                {g.items.map((p) => {
                  const bar = barMetrics(p, range);
                  return (
                    <div key={p.id} className="flex items-center border-b hover:bg-accent/30">
                      <div
                        className="flex shrink-0 items-center gap-2 px-4 py-2"
                        style={{ width: NAME_W }}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                          style={{ backgroundColor: p.color }}
                        />
                        <Link
                          href={`/projects/${p.id}`}
                          className="truncate text-sm hover:underline"
                        >
                          {p.name}
                        </Link>
                      </div>
                      <div className="relative h-9" style={{ width: trackWidth }}>
                        {bar ? (
                          <Link
                            href={`/projects/${p.id}`}
                            className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                            style={{
                              left: `${bar.leftPct}%`,
                              width: `${bar.widthPct}%`,
                              backgroundColor: p.color,
                            }}
                            title={p.name}
                          >
                            <span className="truncate">{p.name}</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/projects/${p.id}`}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Set start &amp; target dates
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
