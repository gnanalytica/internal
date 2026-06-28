"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { visibleDepartments } from "@/lib/departments";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

/** Tab strip shown at the top of every project's department pages. */
export function ProjectTabs({ project, isAdmin = false }: { project: Project; isAdmin?: boolean }) {
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
          { href: `${base}/vision`, label: "Vision" },
          ...visibleDepartments(project.enabledDepartments, isAdmin ? "admin" : "member").map(
            (d) => ({ href: `${base}/${d.slug}`, label: d.label }),
          ),
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
    </div>
  );
}
