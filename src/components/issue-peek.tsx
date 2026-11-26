"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarClock, Folder, Gauge, ListTree, Timer, X } from "lucide-react";

import { PriorityIcon, StatusIcon, UserAvatar } from "@/components/glyphs";
import { RelativeTime } from "@/components/relative-time";
import { Button } from "@/components/ui/button";
import { PRIORITY_MAP, STATUS_MAP, type PriorityId, type StatusId } from "@/lib/constants";
import { dueLabel } from "@/lib/my-work";
import { issueIdentifier, type IssueListItem } from "@/lib/types";

type PeekData = { description: string; comments: { id: string; body: string; author: string; createdAt: string }[]; subTasks: number };

/**
 * Linear-style peek: the task opens in a side panel over the list, so you can
 * read it and move on (J/K keep moving, the panel follows) without losing your
 * place, filters or selection. What the row already knows shows at once; the
 * description and latest comments load behind it.
 */
export function IssuePeek({ issue, now, onClose }: { issue: IssueListItem; now: Date; onClose: () => void }) {
  const [state, setState] = useState<{ id: string; data?: PeekData; error?: string } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/issues/${issue.id}/peek`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = (await res.json()) as { data?: PeekData; error?: string };
        setState({ id: issue.id, data: body.data, error: res.ok ? undefined : (body.error ?? "Couldn't load this task.") });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ id: issue.id, error: "Couldn't load this task." });
      });
    return () => ctrl.abort();
  }, [issue.id]);

  const loaded = state?.id === issue.id ? state : null;
  const due = issue.dueDate ? dueLabel(issue.dueDate, now, issue.status) : null;
  const status = STATUS_MAP[issue.status as StatusId];
  const priority = PRIORITY_MAP[issue.priority as PriorityId];

  return (
    <aside
      aria-label={`Peek: ${issue.title}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-background shadow-2xl animate-in slide-in-from-right-4 duration-150"
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">{issueIdentifier(issue)}</span>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" nativeButton={false} render={<Link href={`/issues/${issue.id}`} />}>
          Open <ArrowUpRight className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Close peek (Esc)" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-base leading-snug font-semibold">{issue.title}</h2>

        <dl className="mt-4 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-[13px]">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="flex items-center gap-1.5">
            <StatusIcon status={issue.status as StatusId} /> {status?.label ?? issue.status}
          </dd>
          <dt className="text-muted-foreground">Priority</dt>
          <dd className="flex items-center gap-1.5">
            <PriorityIcon priority={issue.priority as PriorityId} /> {priority?.label ?? issue.priority}
          </dd>
          <dt className="text-muted-foreground">Assignees</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            {issue.assignees.length ? (
              issue.assignees.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1">
                  <UserAvatar name={a.name} color={a.avatarColor} className="size-4 text-[8px]" /> {a.name}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </dd>
          {issue.labels.length > 0 && (
            <>
              <dt className="text-muted-foreground">Labels</dt>
              <dd className="flex flex-wrap gap-1">
                {issue.labels.map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-1.5 text-[11px]">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} /> {l.name}
                  </span>
                ))}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Due</dt>
          <dd className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5 text-muted-foreground" /> {due ? due.text : <span className="text-muted-foreground">None</span>}
          </dd>
          <dt className="text-muted-foreground">Points</dt>
          <dd className="flex items-center gap-1.5">
            <Gauge className="size-3.5 text-muted-foreground" /> {issue.estimate ?? <span className="text-muted-foreground">None</span>}
          </dd>
          {issue.project && (
            <>
              <dt className="text-muted-foreground">Project</dt>
              <dd className="flex items-center gap-1.5">
                <Folder className="size-3.5 text-muted-foreground" /> {issue.project.name}
              </dd>
            </>
          )}
          {issue.cycle && (
            <>
              <dt className="text-muted-foreground">Cycle</dt>
              <dd className="flex items-center gap-1.5">
                <Timer className="size-3.5 text-muted-foreground" /> {issue.cycle.name}
              </dd>
            </>
          )}
          {loaded?.data && loaded.data.subTasks > 0 && (
            <>
              <dt className="text-muted-foreground">Sub-tasks</dt>
              <dd className="flex items-center gap-1.5">
                <ListTree className="size-3.5 text-muted-foreground" /> {loaded.data.subTasks}
              </dd>
            </>
          )}
        </dl>

        <section className="mt-6">
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Description</h3>
          {!loaded ? (
            <div className="flex flex-col gap-1.5" aria-busy="true">
              <span className="h-3 w-full animate-pulse rounded bg-muted" />
              <span className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          ) : loaded.error ? (
            <p className="text-[13px] text-muted-foreground">{loaded.error}</p>
          ) : loaded.data?.description ? (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{loaded.data.description}</p>
          ) : (
            <p className="text-[13px] text-muted-foreground">No description.</p>
          )}
        </section>

        {loaded?.data && loaded.data.comments.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Latest comments</h3>
            <ul className="flex flex-col gap-2">
              {loaded.data.comments.map((c) => (
                <li key={c.id} className="rounded-lg border bg-muted/30 px-3 py-2 text-[13px]">
                  <div className="mb-0.5 flex items-center gap-2 text-xs">
                    <span className="font-medium">{c.author}</span>
                    <span className="text-muted-foreground">
                      <RelativeTime date={new Date(c.createdAt)} />
                    </span>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        <kbd className="rounded bg-muted px-1 font-mono">J</kbd>/<kbd className="rounded bg-muted px-1 font-mono">K</kbd> next / previous ·{" "}
        <kbd className="rounded bg-muted px-1 font-mono">Space</kbd> or <kbd className="rounded bg-muted px-1 font-mono">Esc</kbd> close ·{" "}
        <kbd className="rounded bg-muted px-1 font-mono">Enter</kbd> open
      </div>
    </aside>
  );
}
