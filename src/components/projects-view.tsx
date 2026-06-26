"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Folder, Loader2, Plus } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/actions";
import type { ProjectWithIssueCount } from "@/lib/types";

export function ProjectsView({
  projects,
}: {
  projects: ProjectWithIssueCount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newProject() {
    startTransition(async () => {
      const p = await createProject({ name: "New project" });
      router.push(`/projects/${p.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Projects" }]}
        actions={
          <Button size="sm" className="h-7 gap-1.5" onClick={newProject} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New
            project
          </Button>
        }
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
                <Folder className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No projects yet</p>
                <p className="text-xs text-muted-foreground">
                  Projects group issues and give them an identifier prefix.
                </p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={newProject} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New
            project
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              <ProjectGroup
                title="Products"
                projects={projects.filter((p) => p.kind === "product")}
              />
              <ProjectGroup
                title="Operations"
                projects={projects.filter((p) => p.kind === "ops")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectGroup({
  title,
  projects,
}: {
  title: string;
  projects: ProjectWithIssueCount[];
}) {
  if (projects.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {projects.map((p) => {
        const pct = p.issueCount ? Math.round((p.doneCount / p.issueCount) * 100) : 0;
        return (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
          >
            <span
              className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: p.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
              </div>
              {p.description && (
                <div className="truncate text-xs text-muted-foreground">{p.description}</div>
              )}
            </div>
            <div className="flex w-32 shrink-0 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-16 text-right text-xs text-muted-foreground">
                {p.doneCount}/{p.issueCount}
              </span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
