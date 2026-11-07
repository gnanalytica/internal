"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  AtSign,
  Bell,
  ChevronRight,
  CircleDot,
  House,
  MessageSquare,
  Plus,
  UserPlus,
} from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { IssueRow } from "@/components/issue-row";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { RelativeTime } from "@/components/relative-time";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { MY_WORK_BUCKETS, groupMyWork, longDate, type MyWorkBucketId } from "@/lib/my-work";
import type { IssueListItem, Label, Member, NotificationItem, PortfolioHealth, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A project you lead or have open work in, for the side panel. */
export type MyProject = {
  id: string;
  name: string;
  key: string;
  color: string;
  health: PortfolioHealth;
  done: number;
  total: number;
  /** Your open tasks in it. */
  mine: number;
  lead: boolean;
};

export const HEALTH_META: Record<PortfolioHealth, { label: string; dot: string; text: string }> = {
  on_track: { label: "On track", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  at_risk: { label: "At risk", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  off_track: { label: "Off track", dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  none: { label: "No update", dot: "bg-faint-foreground/60", text: "text-muted-foreground" },
};

/** Collapsed past this many rows per bucket, with a "Show all" to open it up. */
const BUCKET_PAGE = 8;

/**
 * Home: your own work, first thing after sign-in. One list — every open task
 * assigned to you, in the bucket it belongs in today — and a narrow side
 * column for what's waiting on you (inbox), the projects you're in, and the
 * company's focus. The full filterable list lives one click away in My tasks.
 */
export function MyWorkView({
  issues,
  nowISO,
  members,
  projects,
  labels,
  notifications,
  unreadCount,
  myProjects,
  bets,
}: {
  issues: IssueListItem[];
  /** The server's clock, so the first render and hydration bucket alike. */
  nowISO: string;
  members: Member[];
  projects: Project[];
  labels: Label[];
  notifications: NotificationItem[];
  unreadCount: number;
  myProjects: MyProject[];
  bets: string[];
}) {
  const [now] = useState(() => new Date(nowISO));
  const groups = useMemo(() => groupMyWork(issues, now), [issues, now]);
  const count = (id: MyWorkBucketId) => groups.find((g) => g.id === id)?.items.length ?? 0;
  const open = issues.filter((i) => i.status !== "done" && i.status !== "canceled").length;

  // Focus: narrow the list to one bucket from the summary strip.
  const [focus, setFocus] = useState<MyWorkBucketId | null>(null);
  const [folded, setFolded] = useState<Set<MyWorkBucketId>>(
    () => new Set(MY_WORK_BUCKETS.filter((b) => b.folded).map((b) => b.id)),
  );
  const [expanded, setExpanded] = useState<Set<MyWorkBucketId>>(new Set());

  const shownGroups = groups.filter((g) => g.items.length > 0 && (!focus || g.id === focus));
  const nothingOpen = open === 0;

  const newTask = (
    <NewIssueDialog
      projects={projects}
      members={members}
      labels={labels}
      trigger={
        <Button size="sm" className="h-7 gap-1.5">
          <Plus className="size-4" /> New task
        </Button>
      }
    />
  );

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Home", icon: <House className="size-3.5" /> }]} actions={newTask} />

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-[1200px] gap-x-8 gap-y-6 px-4 py-6 sm:px-6 lg:py-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-labelledby="my-work-title" className="min-w-0">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                <h1 id="my-work-title" className="text-xl font-semibold tracking-tight">
                  My work
                </h1>
                <p className="mt-0.5 text-ui text-muted-foreground" suppressHydrationWarning>
                  {longDate(now)} · {open} open {open === 1 ? "task" : "tasks"}
                </p>
              </div>
              <Link
                href="/my-issues"
                className="inline-flex items-center gap-1 rounded-md text-ui text-muted-foreground hover:text-foreground"
              >
                Open My tasks <ArrowRight className="size-3.5" />
              </Link>
            </header>

            {/* Summary strip — each count is also a one-click focus. */}
            <div
              role="group"
              aria-label="Focus the list"
              className="mb-6 grid grid-cols-4 overflow-hidden rounded-lg border"
            >
              {(
                [
                  { id: "overdue", label: "Overdue", tone: "text-destructive" },
                  { id: "today", label: "Due today", tone: "text-amber-600 dark:text-amber-400" },
                  { id: "active", label: "In progress", tone: "text-foreground" },
                  { id: "week", label: "Next 7 days", tone: "text-foreground" },
                ] as const
              ).map((s, i) => {
                const n = count(s.id);
                const on = focus === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    disabled={n === 0 && !on}
                    onClick={() => setFocus(on ? null : s.id)}
                    className={cn(
                      "flex min-w-0 flex-col items-start gap-0.5 px-2.5 py-2 text-left transition-colors disabled:cursor-default sm:px-4 sm:py-3",
                      i > 0 && "border-l",
                      on ? "bg-selected" : "enabled:hover:bg-muted/60",
                    )}
                  >
                    <span className="w-full truncate text-xs text-muted-foreground">{s.label}</span>
                    <span
                      className={cn(
                        "text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
                        n === 0 ? "text-faint-foreground" : s.tone,
                      )}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>

            {focus && (
              <div className="mb-3 flex items-center gap-2 text-ui">
                <span className="text-muted-foreground">
                  Showing {MY_WORK_BUCKETS.find((b) => b.id === focus)?.label.toLowerCase()} only
                </span>
                <button onClick={() => setFocus(null)} className="font-medium text-brand hover:underline">
                  Show everything
                </button>
              </div>
            )}

            {nothingOpen && !groups.some((g) => g.id === "done" && g.items.length) ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
                <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                  <CircleDot className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Nothing assigned to you</p>
                  <p className="mt-0.5 text-ui text-muted-foreground">
                    Tasks assigned to you appear here, sorted by when they&apos;re due.
                  </p>
                </div>
                {newTask}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                {shownGroups.map((g, gi) => {
                  const meta = MY_WORK_BUCKETS.find((b) => b.id === g.id)!;
                  const isFolded = folded.has(g.id) && focus !== g.id;
                  const isExpanded = expanded.has(g.id);
                  const rows = isExpanded ? g.items : g.items.slice(0, BUCKET_PAGE);
                  return (
                    <div key={g.id} className={cn(gi > 0 && "border-t")}>
                      <button
                        type="button"
                        aria-expanded={!isFolded}
                        title={meta.hint}
                        onClick={() =>
                          setFolded((prev) => {
                            const next = new Set(prev);
                            if (next.has(g.id)) next.delete(g.id);
                            else next.add(g.id);
                            return next;
                          })
                        }
                        className="flex h-9 w-full items-center gap-2 bg-surface px-3 text-left hover:bg-muted/60"
                      >
                        <ChevronRight
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                            !isFolded && "rotate-90",
                          )}
                        />
                        <BucketDot id={g.id} />
                        <span className="text-ui font-medium">{meta.label}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{g.items.length}</span>
                      </button>
                      {!isFolded && (
                        <div className="border-t border-border-subtle [&>*:last-child>div]:border-b-0">
                          {rows.map((issue) => (
                            <IssueRow
                              key={issue.id}
                              issue={issue}
                              members={members}
                              now={now}
                              showAssignees={false}
                              showCreated={false}
                            />
                          ))}
                          {g.items.length > BUCKET_PAGE && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(g.id)) next.delete(g.id);
                                  else next.add(g.id);
                                  return next;
                                })
                              }
                              className="h-8 w-full border-t border-border-subtle px-3 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:pl-12"
                            >
                              {isExpanded ? "Show fewer" : `Show all ${g.items.length}`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="flex min-w-0 flex-col gap-6" aria-label="Around your work">
            <Panel
              title="Inbox"
              count={unreadCount}
              href="/inbox"
              linkLabel={unreadCount > 0 ? "Open inbox" : "View all"}
            >
              {notifications.length === 0 ? (
                <p className="px-3 py-4 text-ui text-muted-foreground">You&apos;re all caught up.</p>
              ) : (
                <ul>
                  {notifications.map((n) => (
                    <li key={n.id} className="border-t border-border-subtle first:border-t-0">
                      <Link
                        href={
                          n.issueId
                            ? `/issues/${n.issueId}`
                            : n.pageId
                              ? `/pages/${n.pageId}`
                              : n.projectId
                                ? `/projects/${n.projectId}`
                                : "/inbox"
                        }
                        className="flex gap-2.5 px-3 py-2.5 hover:bg-muted/60"
                      >
                        <span className="mt-0.5 shrink-0">
                          {n.actor ? (
                            <UserAvatar name={n.actor.name} color={n.actor.avatarColor} className="size-6" />
                          ) : (
                            <span className="grid size-6 place-items-center rounded-full bg-muted">
                              <Bell className="size-3.5 text-muted-foreground" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "line-clamp-2 text-ui leading-snug",
                              n.read ? "text-muted-foreground" : "text-foreground",
                            )}
                          >
                            {n.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <NotificationGlyph type={n.type} />
                            <RelativeTime date={n.createdAt} />
                          </span>
                        </span>
                        {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Your projects" href="/projects" linkLabel="All projects">
              {myProjects.length === 0 ? (
                <p className="px-3 py-4 text-ui text-muted-foreground">
                  Projects you lead or have tasks in show up here.
                </p>
              ) : (
                <ul>
                  {myProjects.map((p) => {
                    const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                    const h = HEALTH_META[p.health];
                    return (
                      <li key={p.id} className="border-t border-border-subtle first:border-t-0">
                        <Link href={`/projects/${p.id}`} className="block px-3 py-2.5 hover:bg-muted/60">
                          <div className="flex items-center gap-2">
                            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="truncate text-ui font-medium">{p.name}</span>
                            {p.mine > 0 && (
                              <span
                                className="rounded-sm border px-1 text-[10px] tabular-nums text-muted-foreground"
                                title={`${p.mine} open ${p.mine === 1 ? "task" : "tasks"} assigned to you`}
                              >
                                {p.mine}
                              </span>
                            )}
                            {p.lead && (
                              <span className="rounded-sm bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                                Lead
                              </span>
                            )}
                            <span className={cn("ml-auto flex shrink-0 items-center gap-1.5 text-xs", h.text)}>
                              <span className={cn("size-1.5 rounded-full", h.dot)} />
                              {h.label}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            {bets.length > 0 && (
              <Panel title="Focus this quarter" href="/projects" linkLabel="View">
                <ol className="space-y-2 px-3 py-3">
                  {bets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-ui leading-snug">
                      <span className="mt-px grid size-4 shrink-0 place-items-center rounded-sm bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  count,
  href,
  linkLabel,
  children,
}: {
  title: string;
  count?: number;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border">
      <header className="flex h-9 items-center gap-2 border-b bg-surface px-3">
        <h2 className="text-ui font-medium">{title}</h2>
        {count ? (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold tabular-nums text-brand-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
        <Link href={href} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
          {linkLabel}
        </Link>
      </header>
      {children}
    </section>
  );
}

function BucketDot({ id }: { id: MyWorkBucketId }) {
  const cls: Record<MyWorkBucketId, string> = {
    overdue: "bg-red-500",
    today: "bg-amber-500",
    active: "bg-yellow-400",
    week: "bg-brand",
    next: "bg-faint-foreground/70",
    backlog: "border border-dashed border-faint-foreground bg-transparent",
    done: "bg-emerald-500",
  };
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", cls[id])} />;
}

function NotificationGlyph({ type }: { type: string }) {
  const c = "size-3";
  switch (type) {
    case "assigned":
      return <UserPlus className={c} />;
    case "mentioned":
      return <AtSign className={c} />;
    case "commented":
      return <MessageSquare className={c} />;
    case "status":
      return <CircleDot className={c} />;
    default:
      return <Bell className={c} />;
  }
}
