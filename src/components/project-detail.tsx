"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FavoriteButton } from "@/components/favorite-button";
import { StatusIcon } from "@/components/glyphs";
import { IssueRow } from "@/components/issue-row";
import { Topbar } from "@/components/topbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { deleteProject, updateProject } from "@/lib/actions";
import { STATUSES } from "@/lib/constants";
import type { Member, ProjectDetail as ProjectDetailType } from "@/lib/types";

export function ProjectDetail({
  project,
  members,
  isAdmin,
  favorited,
}: {
  project: ProjectDetailType;
  members: Member[];
  isAdmin: boolean;
  favorited: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const total = project.issues.length;
  const done = project.issues.filter((i) => i.status === "done").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const grouped = STATUSES.map((s) => ({
    status: s,
    items: project.issues.filter((i) => i.status === s.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          { label: "Projects", href: "/projects" },
          { label: name || "Untitled" },
        ]}
        actions={
          <>
            <FavoriteButton kind="project" targetId={project.id} initial={favorited} />
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" className="size-7" />}
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      persist(async () => {
                        await deleteProject(project.id);
                        toast.success("Project deleted");
                        router.push("/projects");
                      })
                    }
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" /> Delete project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-10">
          {/* Title */}
          <div className="flex items-start gap-3">
            <span
              className="mt-2 size-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: project.color }}
            />
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                void updateProject(project.id, {
                  name: e.target.value.trim() || "Untitled project",
                });
              }}
              placeholder="Project name"
              className="flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
            />
            <span className="mt-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              {project.key}
            </span>
          </div>

          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              void updateProject(project.id, { description: e.target.value });
            }}
            placeholder="Add a description…"
            rows={2}
            className="mt-3 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />

          {/* Progress + initiative */}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">
                {done}/{total} done · {pct}%
              </span>
            </div>
            {project.initiative && (
              <Link
                href={`/initiatives/${project.initiative.id}`}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Target className="size-3.5" style={{ color: project.initiative.color }} />
                {project.initiative.name}
              </Link>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Start</label>
              <input
                type="date"
                defaultValue={
                  project.startDate
                    ? new Date(project.startDate).toISOString().slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  void updateProject(project.id, { startDate: e.target.value || null })
                }
                className="rounded-md border bg-transparent px-2 py-1 text-xs outline-none focus:border-brand"
              />
              <label className="text-xs text-muted-foreground">Target</label>
              <input
                type="date"
                defaultValue={
                  project.targetDate
                    ? new Date(project.targetDate).toISOString().slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  void updateProject(project.id, { targetDate: e.target.value || null })
                }
                className="rounded-md border bg-transparent px-2 py-1 text-xs outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Issues */}
          <h3 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Issues
          </h3>
          {total === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No issues yet. Set an issue&apos;s <strong>Project</strong> to add it here.
            </p>
          ) : (
            <div className="mt-2 overflow-hidden rounded-xl border">
              {grouped.map((g) => (
                <div key={g.status.id}>
                  <div className="flex items-center gap-2 bg-muted/60 px-4 py-1.5">
                    <StatusIcon status={g.status.id} />
                    <span className="text-xs font-semibold">{g.status.label}</span>
                    <span className="text-xs text-muted-foreground">{g.items.length}</span>
                  </div>
                  {g.items.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} members={members} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
