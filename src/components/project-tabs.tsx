"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TabIndicator } from "@/components/tab-indicator";
import { WatchButton } from "@/components/watch-button";
import { isTopLevelDepartment, visibleDepartments } from "@/lib/departments";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

/** Tab strip shown at the top of every project's department pages. */
export function ProjectTabs({
  project,
  isAdmin = false,
  isOwner = false,
  watching = false,
}: {
  /** Only what the strip renders — this is a client component, so every field
   *  passed here ships on every project page. */
  project: Pick<Project, "id" | "name" | "color" | "kind" | "enabledDepartments">;
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
          // Analytics (the Overview's scorecard), Customer Success (Sales →
          // Customers) and Cycles (Engineering → Cycles) are views inside
          // these tabs, not tabs of their own.
          ...visibleDepartments(
            project.enabledDepartments,
            isAdmin ? "admin" : "member",
            isOwner,
          )
            .filter((d) => isTopLevelDepartment(d.slug))
            .map((d) => ({ href: `${base}/${d.slug}`, label: d.label })),
          { href: `${base}/docs`, label: "Docs" },
        ];
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b pr-2 pl-3 sm:pr-4 sm:pl-4">
      <nav aria-label="Breadcrumb" className="flex shrink-0 items-center gap-1.5 text-ui">
        <Link href="/projects" className="hidden text-muted-foreground hover:text-foreground sm:inline">
          Projects
        </Link>
        <span aria-hidden className="hidden text-faint-foreground sm:inline">/</span>
        <Link href={base} className="flex items-center gap-2 rounded-sm font-medium">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: project.color }} />
          {project.name}
        </Link>
      </nav>
      <div className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
      <nav aria-label={`${project.name} sections`} className="no-scrollbar relative flex h-full min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              data-active={active ? "" : undefined}
              className={cn(
                "flex shrink-0 items-center px-2 text-ui whitespace-nowrap transition-colors",
                active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
        <TabIndicator activeKey={pathname} />
      </nav>
      {/* Sits with the project, not a department, because what you follow here
          is the project's status updates. */}
      <div className="shrink-0 pl-1">
        <WatchButton kind="project" targetId={project.id} initial={watching} />
      </div>
    </div>
  );
}
