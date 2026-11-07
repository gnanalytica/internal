"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  MultiAssigneePicker,
  PriorityPicker,
  StatusPicker,
  TypeChip,
} from "@/components/pickers";
import { RelativeTime } from "@/components/relative-time";
import { IssueContextMenu } from "@/components/issue-context-menu";
import { LabelChips } from "@/components/label-chips";
import { setIssueAssignees, updateIssue } from "@/lib/actions";
import { dueLabel, type DueTone } from "@/lib/my-work";
import type { IssueListItem, Member } from "@/lib/types";
import { issueIdentifier } from "@/lib/types";
import type { PriorityId, StatusId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Ban, CalendarClock, ListTree } from "lucide-react";

const DUE_TONE: Record<DueTone, string> = {
  overdue: "text-destructive",
  today: "text-amber-700 dark:text-amber-400",
  soon: "text-foreground/80",
  later: "text-muted-foreground",
};

/**
 * One task as every list shows it. Left to right: priority, status, ID, title,
 * then the properties that are set — nothing renders for an empty property.
 * The whole row opens the task; the pickers and checkbox sit above that link.
 */
export function IssueRow({
  issue,
  members,
  selected,
  onToggleSelect,
  selecting = false,
  depth = 0,
  subProgress,
  expandToggle,
  now,
  showAssignees = true,
  showCreated = true,
  showProject = true,
}: {
  issue: IssueListItem;
  members: Member[];
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Some row in the list is selected: keep every checkbox visible. */
  selecting?: boolean;
  /** Indent level for nested sub-issues. */
  depth?: number;
  /** Sub-issue roll-up badge shown when the issue has children. */
  subProgress?: { done: number; total: number };
  /** Optional expand/collapse control rendered at the row start. */
  expandToggle?: React.ReactNode;
  /** One clock for the whole list, so due labels agree row to row. */
  now?: Date;
  /** Off on lists that are all yours anyway (Home). */
  showAssignees?: boolean;
  showCreated?: boolean;
  showProject?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [fallbackNow] = useState(() => new Date());
  const due = issue.dueDate ? dueLabel(issue.dueDate, now ?? fallbackNow, issue.status) : null;

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const href = `/issues/${issue.id}`;

  return (
    <IssueContextMenu issue={issue} members={members}>
      <div
        className={cn(
          "group/row relative flex h-9 items-center gap-1.5 border-b border-border-subtle pr-3 pl-2 text-ui sm:pr-4 sm:pl-3",
          "hover:bg-muted/60",
          selected && "bg-selected hover:bg-selected",
        )}
        style={depth ? { paddingLeft: 12 + depth * 22 } : undefined}
      >
        {/* The row-wide hit target. Hidden from assistive tech: the title link
            below is the accessible way in, so the row isn't announced twice. */}
        <Link href={href} aria-hidden tabIndex={-1} className="absolute inset-0" />

        {expandToggle ? (
          <span className="relative">{expandToggle}</span>
        ) : (
          depth > 0 && <span className="w-4 shrink-0" />
        )}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={onToggleSelect}
            className={cn(
              "relative size-3.5 shrink-0 accent-[var(--brand)]",
              // Hover-reveal with a fine pointer; always there on touch, and
              // whenever a selection is in progress or this row is in it.
              !selected &&
                !selecting &&
                "[@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
            )}
            aria-label={`Select ${issueIdentifier(issue)}`}
          />
        )}
        <PriorityPicker
          value={issue.priority as PriorityId}
          onChange={(v) => persist(() => updateIssue(issue.id, { priority: v }))}
          compact
        />
        <StatusPicker
          value={issue.status as StatusId}
          onChange={(v) => persist(() => updateIssue(issue.id, { status: v }))}
          compact
        />
        <span className="hidden w-[4.25rem] shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground sm:block">
          {issueIdentifier(issue)}
        </span>
        <Link
          href={href}
          className={cn(
            "relative min-w-0 flex-1 truncate rounded-sm outline-offset-2",
            issue.status === "done" || issue.status === "canceled"
              ? "text-muted-foreground"
              : "text-foreground",
          )}
        >
          {issue.title}
        </Link>

        <div className="relative flex shrink-0 items-center gap-1.5">
          {subProgress && subProgress.total > 0 && (
            <span
              className="flex items-center gap-1 rounded-sm px-1 text-[11px] tabular-nums text-muted-foreground"
              title={`${subProgress.done} of ${subProgress.total} sub-tasks done`}
            >
              <ListTree className="size-3" />
              {subProgress.done}/{subProgress.total}
            </span>
          )}

          {issue.labels.length > 0 && (
            <span className="hidden lg:flex">
              <LabelChips labels={issue.labels} />
            </span>
          )}

          {/* Blocked by unfinished work — the one thing that changes whether this
              row can be picked up at all, so it sits ahead of the softer chips. */}
          {issue.blockedBy ? (
            <span
              className="flex items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
              title="Blocked by unfinished work"
            >
              <Ban className="size-3" />
              <span className="hidden sm:inline">Blocked</span>
            </span>
          ) : null}

          {/* Surface non-engineering tasks; keep default eng rows uncluttered. */}
          {issue.type && issue.type !== "engineering" && (
            <span className="hidden md:inline">
              <TypeChip type={issue.type} />
            </span>
          )}

          {issue.estimate != null && (
            <span
              className="hidden min-w-5 rounded-sm border px-1 text-center text-[11px] tabular-nums text-muted-foreground md:inline"
              title={`Estimate: ${issue.estimate}`}
            >
              {issue.estimate}
            </span>
          )}

          {due && (
            <span
              className={cn("flex items-center gap-1 text-[12px] tabular-nums", DUE_TONE[due.tone])}
              title={`Due ${new Date(issue.dueDate!).toDateString()}`}
            >
              <CalendarClock className="size-3.5 opacity-70" />
              {due.text}
            </span>
          )}

          {showProject && issue.project && (
            <span
              className="hidden w-12 items-center gap-1.5 text-[12px] text-muted-foreground md:flex"
              title={issue.project.name}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: issue.project.color }} />
              <span className="truncate font-mono text-[11px]">{issue.project.key}</span>
            </span>
          )}

          {showCreated && (
            <span className="hidden w-16 text-right text-[12px] tabular-nums text-muted-foreground xl:block">
              <RelativeTime date={issue.createdAt} addSuffix={false} />
            </span>
          )}

          {showAssignees && (
            <MultiAssigneePicker
              members={members}
              value={issue.assignees.map((a) => a.id)}
              onChange={(ids) => persist(() => setIssueAssignees(issue.id, ids))}
              compact
            />
          )}
        </div>
      </div>
    </IssueContextMenu>
  );
}
