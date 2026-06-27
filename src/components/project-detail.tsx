"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Database, MoreHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Backlinks } from "@/components/backlinks";
import { FavoriteButton } from "@/components/favorite-button";
import { StatusIcon, UserAvatar } from "@/components/glyphs";
import { IssueRow } from "@/components/issue-row";
import { AssigneePicker } from "@/components/pickers";
import { Topbar } from "@/components/topbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  addStatusUpdate,
  deleteProject,
  deleteStatusUpdate,
  updateProject,
} from "@/lib/actions";
import { STATUSES } from "@/lib/constants";
import {
  PROJECT_HEALTH,
  type BacklinkItem,
  type Member,
  type ProjectDetail as ProjectDetailType,
  type ProjectHealth,
  type StatusUpdateItem,
} from "@/lib/types";

export function ProjectDetail({
  project,
  members,
  isAdmin,
  favorited,
  statusUpdates,
  backlinks,
  databases = [],
}: {
  project: ProjectDetailType;
  members: Member[];
  isAdmin: boolean;
  favorited: boolean;
  statusUpdates: StatusUpdateItem[];
  backlinks: BacklinkItem[];
  /** Databases owned by this operation (e.g. Tools & Subscriptions under IT). */
  databases?: { id: string; name: string; icon: string }[];
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
  const latestHealth = statusUpdates[0]
    ? PROJECT_HEALTH.find((h) => h.id === statusUpdates[0].health)
    : null;

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

          {/* Progress */}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">
                {done}/{total} done · {pct}%
              </span>
            </div>
            {latestHealth && (
              <span
                className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  color: latestHealth.color,
                  backgroundColor: `color-mix(in oklch, ${latestHealth.color} 16%, transparent)`,
                }}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: latestHealth.color }} />
                {latestHealth.label}
              </span>
            )}
            <div className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              <span>Owner</span>
              {isAdmin ? (
                <AssigneePicker
                  members={members}
                  value={project.ownerId}
                  onChange={(v) => persist(() => updateProject(project.id, { ownerId: v }))}
                />
              ) : (
                <span>{project.owner?.name ?? "Unassigned"}</span>
              )}
            </div>
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

          {/* Status updates */}
          <div className="mt-8">
            <ProjectStatusUpdates
              projectId={project.id}
              updates={statusUpdates}
              onChange={() => router.refresh()}
            />
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

          {/* Databases (e.g. Tools & Subscriptions under IT) */}
          {databases.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Databases
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {databases.map((d) => (
                  <Link
                    key={d.id}
                    href={`/databases/${d.id}`}
                    className="flex items-center gap-2 rounded-xl border bg-background p-3 text-sm shadow-sm transition-colors hover:border-foreground/20"
                  >
                    <span className="text-base leading-none">{d.icon || "🗃️"}</span>
                    <span className="flex-1 truncate font-medium">{d.name}</span>
                    <Database className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <div className="mt-8">
              <Backlinks items={backlinks} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectStatusUpdates({
  projectId,
  updates,
  onChange,
}: {
  projectId: string;
  updates: StatusUpdateItem[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<ProjectHealth>("on_track");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function post() {
    startTransition(async () => {
      await addStatusUpdate(projectId, health, body);
      setBody("");
      setOpen(false);
      onChange();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteStatusUpdate(id, projectId);
      onChange();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status updates
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Cancel" : "Post update"}
        </Button>
      </div>

      {open && (
        <div className="mb-3 rounded-lg border p-3">
          <div className="mb-2 flex gap-1.5">
            {PROJECT_HEALTH.map((h) => (
              <button
                key={h.id}
                onClick={() => setHealth(h.id)}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                style={
                  health === h.id
                    ? {
                        color: h.color,
                        borderColor: h.color,
                        backgroundColor: `color-mix(in oklch, ${h.color} 14%, transparent)`,
                      }
                    : undefined
                }
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: h.color }} />
                {h.label}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What changed? What's the plan?"
            rows={3}
            className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" className="h-7" onClick={post} disabled={pending}>
              Post
            </Button>
          </div>
        </div>
      )}

      {updates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No updates yet. Post one to keep the team in the loop.
        </p>
      ) : (
        <div className="space-y-2">
          {updates.map((u) => {
            const h = PROJECT_HEALTH.find((x) => x.id === u.health);
            return (
              <div key={u.id} className="group rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-2">
                  {u.author && (
                    <UserAvatar
                      name={u.author.name}
                      color={u.author.avatarColor}
                      className="size-5 text-[9px]"
                    />
                  )}
                  <span className="text-xs font-medium">{u.author?.name ?? "Someone"}</span>
                  {h && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        color: h.color,
                        backgroundColor: `color-mix(in oklch, ${h.color} 14%, transparent)`,
                      }}
                    >
                      {h.label}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(u.createdAt), { addSuffix: true })}
                  </span>
                  <button
                    onClick={() => remove(u.id)}
                    className="ml-auto text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete update"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {u.body && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{u.body}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
