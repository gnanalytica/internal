"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
          // Legacy Strategy tab (the vision placeholder). Only for projects
          // still on the default department set — once a project names its
          // departments it has opted into the current model, and leaving
          // Strategy out of that list means it should not appear at all.
          ...(project.enabledDepartments == null
            ? [{ href: `${base}/vision`, label: "Strategy" }]
            : []),
          ...visibleDepartments(
            project.enabledDepartments,
            isAdmin ? "admin" : "member",
            isOwner,
          ).map((d) => ({ href: `${base}/${d.slug}`, label: d.label })),
          { href: `${base}/docs`, label: "Docs" },
        ];
  return (
    <div className="flex items-center gap-1 border-b px-4 pt-2.5">
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
            className={cn(
              "-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-brand font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
      {/* Sits with the project, not a department, because what you follow here
          is the project's status updates. */}
      <div className="ml-auto pl-2">
        <WatchButton kind="project" targetId={project.id} initial={watching} />
      </div>
    </div>
  );
}
