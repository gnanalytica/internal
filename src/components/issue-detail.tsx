"use client";

import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CornerLeftUp,
  FileText,
  Link2,
  MoreHorizontal,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { RichEditor } from "@/components/editor/rich-editor";
import { GitHubIcon } from "@/components/auth/provider-icons";
import { FavoriteButton } from "@/components/favorite-button";
import { StatusIcon, UserAvatar } from "@/components/glyphs";
import { IssueTimeline } from "@/components/issue-timeline";
import {
  CyclePicker,
  FeaturePicker,
  MilestonePicker,
  MultiAssigneePicker,
  PriorityPicker,
  ProjectPicker,
  StatusPicker,
  TypePicker,
} from "@/components/pickers";
import { Topbar } from "@/components/topbar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addIssueRelation,
  createIssue,
  deleteIssue,
  linkIssueToFeature,
  linkIssueToPage,
  pushIssueToGithub,
  removeIssueRelation,
  setIssueAssignees,
  unlinkIssueFromPage,
  updateIssue,
} from "@/lib/actions";
import { isOverdue } from "@/lib/issue-dates";
import { cn } from "@/lib/utils";
import { issueIdentifier } from "@/lib/types";
import { Backlinks } from "@/components/backlinks";
import type {
  BacklinkItem,
  Cycle,
  FlatIssue,
  IssueDetail as IssueDetailData,
  IssueWithRelations,
  Label,
  Member,
  MentionItem,
  Page,
  Project,
  RelationItem,
  TimelineItem,
} from "@/lib/types";
import {
  RELATION_TYPES,
  relationLabel,
  type RelationType,
} from "@/lib/issue-relations";
import type { IssueTypeId, PriorityId, StatusId } from "@/lib/constants";

type FlatPage = Pick<Page, "id" | "title" | "icon">;

export function IssueDetail({
  issue,
  projects,
  members,
  allPages,
  cycles,
  features,
  milestones,
  timeline,
  githubConnected,
  favorited,
  relations,
  allIssues,
  mentionItems,
  backlinks,
}: {
  issue: IssueDetailData;
  projects: Project[];
  members: Member[];
  labels: Label[];
  allPages: FlatPage[];
  cycles: Cycle[];
  features: { id: string; title: string }[];
  milestones: { id: string; name: string }[];
  timeline: TimelineItem[];
  githubConnected: boolean;
  favorited: boolean;
  relations: RelationItem[];
  allIssues: FlatIssue[];
  mentionItems: MentionItem[];
  backlinks: BacklinkItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(issue.title);
  const [linkOpen, setLinkOpen] = useState(false);

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const copyLink = () => {
    void navigator.clipboard?.writeText(`${window.location.origin}/issues/${issue.id}`);
    toast.success("Link copied");
  };

  const linkedIds = new Set(issue.linkedPages.map((p) => p.id));
  const linkable = allPages.filter((p) => !linkedIds.has(p.id));

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          { label: "Issues", href: "/issues" },
          { label: issueIdentifier(issue) },
        ]}
        actions={
          <>
          <FavoriteButton kind="issue" targetId={issue.id} initial={favorited} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-7" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyLink} className="gap-2">
                <Link2 className="size-4" /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  persist(async () => {
                    await deleteIssue(issue.id);
                    toast.success("Issue deleted");
                    router.push("/issues");
                  })
                }
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Delete issue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        {/* Main */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-10 md:py-10">
            {issue.parent && (
              <Link
                href={`/issues/${issue.parent.id}`}
                className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CornerLeftUp className="size-3.5" />
                <span className="font-mono">{issueIdentifier(issue.parent)}</span>
                <span className="max-w-48 truncate">{issue.parent.title}</span>
              </Link>
            )}
            <textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                void updateIssue(issue.id, { title: e.target.value.trim() || "Untitled issue" });
              }}
              rows={1}
              placeholder="Issue title"
              className="w-full resize-none overflow-hidden bg-transparent text-2xl font-semibold leading-snug outline-none placeholder:text-muted-foreground/40"
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${t.scrollHeight}px`;
              }}
            />
            <div className="mt-3 text-[15px]">
              <RichEditor
                content={(issue.description as JSONContent) ?? null}
                placeholder="Add a description… ('/' for blocks, '@' to link)"
                onChange={(json) => void updateIssue(issue.id, { description: json })}
                mentionItems={mentionItems}
              />
            </div>

            {/* Sub-issues */}
            <div className="mt-10 border-t pt-5">
              <SubIssues
                parentId={issue.id}
                parentProjectId={issue.projectId}
                subIssues={issue.subIssues}
                onChange={() => router.refresh()}
              />
            </div>

            {/* Linked pages */}
            <div className="mt-10 border-t pt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Linked pages
                </h3>
                <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                  <PopoverTrigger
                    render={<Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" />}
                  >
                    <Link2 className="size-3.5" /> Link page
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-0">
                    <Command>
                      <CommandInput placeholder="Search pages…" className="h-9" />
                      <CommandList>
                        <CommandEmpty>No pages found.</CommandEmpty>
                        <CommandGroup>
                          {linkable.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.title}
                              onSelect={() => {
                                setLinkOpen(false);
                                persist(() => linkIssueToPage(issue.id, p.id));
                              }}
                              className="gap-2"
                            >
                              <span>{p.icon}</span>
                              <span className="truncate">{p.title || "Untitled"}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {issue.linkedPages.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No linked pages. Connect docs to this issue.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {issue.linkedPages.map((p) => (
                    <div
                      key={p.id}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <span>{p.icon}</span>
                      <Link href={`/pages/${p.id}`} className="flex-1 truncate hover:underline">
                        {p.title || "Untitled"}
                      </Link>
                      <button
                        onClick={() => persist(() => unlinkIssueFromPage(issue.id, p.id))}
                        className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-black/5 hover:text-foreground group-hover:opacity-100"
                        aria-label="Unlink page"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Backlinks */}
            {backlinks.length > 0 && (
              <div className="mt-10 border-t pt-5">
                <Backlinks items={backlinks} />
              </div>
            )}

            {/* Activity & comments */}
            <div className="mt-10 border-t pt-5">
              <IssueTimeline
                issueId={issue.id}
                timeline={timeline}
                members={members}
              />
            </div>
          </div>
        </div>

        {/* Properties */}
        <aside className="w-full shrink-0 border-b bg-muted/20 p-4 md:w-64 md:border-b-0 md:border-l">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Properties
          </h3>
          <div className="space-y-1">
            <PropRow label="Status">
              <StatusPicker
                value={issue.status as StatusId}
                onChange={(v) => persist(() => updateIssue(issue.id, { status: v }))}
              />
            </PropRow>
            <PropRow label="Priority">
              <PriorityPicker
                value={issue.priority as PriorityId}
                onChange={(v) => persist(() => updateIssue(issue.id, { priority: v }))}
              />
            </PropRow>
            <PropRow label="Type">
              <TypePicker
                value={issue.type as IssueTypeId}
                onChange={(v) => persist(() => updateIssue(issue.id, { type: v }))}
              />
            </PropRow>
            <PropRow label="Assignees">
              <MultiAssigneePicker
                members={members}
                value={issue.assignees.map((a) => a.id)}
                onChange={(ids) => persist(() => setIssueAssignees(issue.id, ids))}
              />
            </PropRow>
            <PropRow label="Project">
              <ProjectPicker
                projects={projects}
                value={issue.projectId}
                onChange={(v) => persist(() => updateIssue(issue.id, { projectId: v }))}
              />
            </PropRow>
            <PropRow label="Cycle">
              <CyclePicker
                cycles={cycles}
                value={issue.cycleId}
                onChange={(v) => persist(() => updateIssue(issue.id, { cycleId: v }))}
              />
            </PropRow>
            <PropRow label="Feature">
              <FeaturePicker
                features={features}
                value={issue.featureId}
                onChange={(v) => persist(() => linkIssueToFeature(issue.id, v))}
              />
            </PropRow>
            {issue.feature?.milestone ? (
              <PropRow label="Milestone">
                <Link
                  href={`/projects/${issue.projectId}/milestones/${issue.feature.milestone.id}`}
                  className="flex items-center gap-1.5 truncate text-xs text-foreground hover:underline"
                  title={`Via feature · ${issue.feature.milestone.name}`}
                >
                  <Target className="size-3.5 shrink-0 text-brand" />
                  <span className="truncate">{issue.feature.milestone.name}</span>
                  <span className="text-[10px] text-muted-foreground">via feature</span>
                </Link>
              </PropRow>
            ) : (
              <PropRow label="Milestone">
                <MilestonePicker
                  milestones={milestones}
                  value={issue.milestoneId}
                  onChange={(v) => persist(() => updateIssue(issue.id, { milestoneId: v }))}
                />
              </PropRow>
            )}
            <PropRow label="Start">
              <input
                type="date"
                value={
                  issue.startDate
                    ? new Date(issue.startDate).toISOString().slice(0, 10)
                    : ""
                }
                max={
                  issue.dueDate
                    ? new Date(issue.dueDate).toISOString().slice(0, 10)
                    : undefined
                }
                onChange={(e) =>
                  persist(() =>
                    updateIssue(issue.id, { startDate: e.target.value || null }),
                  )
                }
                className="w-full rounded-md border bg-transparent px-2 py-1 text-xs outline-none focus:border-brand"
              />
            </PropRow>
            <PropRow label="Due">
              <input
                type="date"
                value={
                  issue.dueDate
                    ? new Date(issue.dueDate).toISOString().slice(0, 10)
                    : ""
                }
                min={
                  issue.startDate
                    ? new Date(issue.startDate).toISOString().slice(0, 10)
                    : undefined
                }
                onChange={(e) =>
                  persist(() =>
                    updateIssue(issue.id, { dueDate: e.target.value || null }),
                  )
                }
                className={cn(
                  "w-full rounded-md border bg-transparent px-2 py-1 text-xs outline-none focus:border-brand",
                  isOverdue(issue.dueDate, issue.status) && "border-destructive/50 text-destructive",
                )}
              />
            </PropRow>
            <PropRow label="Estimate">
              <select
                value={issue.estimate ?? ""}
                onChange={(e) =>
                  persist(() =>
                    updateIssue(issue.id, {
                      estimate: e.target.value === "" ? null : Number(e.target.value),
                    }),
                  )
                }
                className="w-full rounded-md border bg-transparent px-2 py-1 text-xs outline-none focus:border-brand"
              >
                <option value="">—</option>
                {[1, 2, 3, 5, 8, 13].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "point" : "points"}
                  </option>
                ))}
              </select>
            </PropRow>
          </div>

          {/* Relations live with the other metadata (Linear-style). */}
          <div className="mt-4 border-t pt-3">
            <IssueRelations
              issueId={issue.id}
              relations={relations}
              allIssues={allIssues}
              onChange={() => router.refresh()}
            />
          </div>

          <div className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileText className="size-3" />
              {issue.linkedPages.length} linked page
              {issue.linkedPages.length === 1 ? "" : "s"}
            </div>
          </div>

          {/* GitHub */}
          {issue.githubUrl ? (
            <a
              href={issue.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-xs text-brand hover:underline"
            >
              <GitHubIcon className="size-3.5" />
              View on GitHub #{issue.githubNumber}
            </a>
          ) : githubConnected ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full gap-1.5"
              onClick={() =>
                persist(async () => {
                  await pushIssueToGithub(issue.id);
                  toast.success("Pushed to GitHub");
                })
              }
            >
              <GitHubIcon className="size-4" /> Push to GitHub
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function flatIdentifier(i: FlatIssue): string {
  return i.projectKey ? `${i.projectKey}-${i.number}` : `#${i.number}`;
}

function IssueRelations({
  issueId,
  relations,
  allIssues,
  onChange,
}: {
  issueId: string;
  relations: RelationItem[];
  allIssues: FlatIssue[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RelationType>("blocks");
  const [, startTransition] = useTransition();

  const relatedIds = new Set<string>([issueId, ...relations.map((r) => r.issue.id)]);
  const pickable = allIssues.filter((i) => !relatedIds.has(i.id));

  // Group by the human label (e.g. "Blocking", "Blocked by", "Related").
  const groups = new Map<string, RelationItem[]>();
  for (const r of relations) {
    const label = relationLabel(r.type, r.direction);
    const arr = groups.get(label) ?? [];
    arr.push(r);
    groups.set(label, arr);
  }

  function add(relatedIssueId: string) {
    setOpen(false);
    startTransition(async () => {
      await addIssueRelation(issueId, relatedIssueId, type);
      onChange();
    });
  }

  function remove(relationId: string) {
    startTransition(async () => {
      await removeIssueRelation(relationId, issueId);
      onChange();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Relations
        </h3>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={<Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" />}
          >
            <Plus className="size-3.5" /> Add relation
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="flex gap-1 border-b p-1.5">
              {RELATION_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-xs",
                    type === t.id
                      ? "bg-brand/10 font-medium text-brand"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Command>
              <CommandInput placeholder="Search issues…" className="h-9" />
              <CommandList>
                <CommandEmpty>No issues.</CommandEmpty>
                <CommandGroup>
                  {pickable.map((i) => (
                    <CommandItem
                      key={i.id}
                      value={`${flatIdentifier(i)} ${i.title}`}
                      onSelect={() => add(i.id)}
                      className="gap-2"
                    >
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {flatIdentifier(i)}
                      </span>
                      <span className="truncate">{i.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {relations.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Link blocking, related, or duplicate issues.
        </p>
      ) : (
        <div className="space-y-3">
          {[...groups.entries()].map(([label, items]) => (
            <div key={label}>
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</div>
              <div className="space-y-0.5">
                {items.map((r) => (
                  <div
                    key={r.relationId}
                    className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <StatusIcon status={r.issue.status as StatusId} />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {issueIdentifier(r.issue)}
                    </span>
                    <Link href={`/issues/${r.issue.id}`} className="flex-1 truncate hover:underline">
                      {r.issue.title}
                    </Link>
                    <button
                      onClick={() => remove(r.relationId)}
                      className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-black/5 hover:text-foreground group-hover:opacity-100"
                      aria-label="Remove relation"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubIssues({
  parentId,
  parentProjectId,
  subIssues,
  onChange,
}: {
  parentId: string;
  parentProjectId: string | null;
  subIssues: IssueWithRelations[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const done = subIssues.filter((s) => s.status === "done").length;
  const total = subIssues.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  function create() {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await createIssue({ title: t, parentId, projectId: parentProjectId });
      setTitle("");
      onChange();
    });
  }

  function detach(id: string) {
    startTransition(async () => {
      await updateIssue(id, { parentId: null });
      onChange();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sub-issues
          </h3>
          {total > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-[11px] text-muted-foreground">
                {done}/{total}
              </span>
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-xs"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-3.5" /> Add sub-issue
        </Button>
      </div>

      {subIssues.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">
          Break this issue down into smaller sub-issues.
        </p>
      ) : (
        <div className="space-y-0.5">
          {subIssues.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <StatusIcon status={s.status as StatusId} />
              <span className="font-mono text-[11px] text-muted-foreground">
                {issueIdentifier(s)}
              </span>
              <Link href={`/issues/${s.id}`} className="flex-1 truncate hover:underline">
                {s.title}
              </Link>
              {s.assignee && (
                <UserAvatar
                  name={s.assignee.name}
                  color={s.assignee.avatarColor}
                  className="size-4 text-[8px]"
                />
              )}
              <button
                onClick={() => detach(s.id)}
                className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-black/5 hover:text-foreground group-hover:opacity-100"
                aria-label="Remove from parent"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Sub-issue title…"
            className="h-8 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-brand"
          />
          <Button size="sm" className="h-8" onClick={create} disabled={pending || !title.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
