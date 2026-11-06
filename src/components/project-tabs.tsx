"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TabIndicator } from "@/components/tab-indicator";
import { WatchButton } from "@/components/watch-button";
import { visibleDepartments } from "@/lib/departments";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

/** Tab strip shown at the top of every project's department pages. */
export function ProjectTabs({
  project,
  isAdmin = false,
  isOwner = false,
  watching = false,
}: {
  project: Project;
  isAdmin?: boolean;
  isOwner?: boolean;
  /** Whether the signed-in user follows this project's status updates. */
  watching?: boolean;
}) {
  const pathname = usePathname();
  const base = `/projects/${project.id}`;
  // Operations have no departments — just Overview + Docs.
  const tabs =
    project.kind === "operation"
      ? [
          { href: base, label: "Overview" },
          { href: `${base}/tasks`, label: "Tasks" },
          { href: `${base}/docs`, label: "Docs" },
        ]
      : [
          { href: base, label: "Overview" },
          ...visibleDepartments(
            project.enabledDepartments,
            isAdmin ? "admin" : "member",
            isOwner,
          ).map((d) => ({ href: `${base}/${d.slug}`, label: d.label })),
          // A cycle is the project's rhythm, not a department's.
          { href: `${base}/cycles`, label: "Cycles" },
          { href: `${base}/docs`, label: "Docs" },
        ];
  return (
    <div className="no-scrollbar relative flex items-center gap-1 overflow-x-auto border-b px-4 pt-2.5">
      <div className="mr-3 flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ backgroundColor: project.color }} />
        <span className="text-sm font-semibold">{project.name}</span>
      </div>
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            data-active={active ? "" : undefined}
            className={cn(
              "shrink-0 rounded-t-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
              active ? "font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
      {/* Sits with the project, not a department, because what you follow here
          is the project's status updates. */}
      <TabIndicator activeKey={pathname} />
      <div className="ml-auto pl-2">
        <WatchButton kind="project" targetId={project.id} initial={watching} />
      </div>
    </div>
  );
}
