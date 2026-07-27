"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  MultiAssigneePicker,
  PriorityPicker,
  StatusPicker,
  TypeChip,
} from "@/components/pickers";
import { IssueContextMenu } from "@/components/issue-context-menu";
import { LabelChips } from "@/components/label-chips";
import { setIssueAssignees, updateIssue } from "@/lib/actions";
import { formatDue, isOverdue } from "@/lib/issue-dates";
import type { IssueWithRelations, Member } from "@/lib/types";
import { issueIdentifier } from "@/lib/types";
import type { PriorityId, StatusId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CalendarClock, ListTree } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

export function IssueRow({
  issue,
  members,
  selected,
  onToggleSelect,
  depth = 0,
  subProgress,
  expandToggle,
}: {
  issue: IssueWithRelations;
  members: Member[];
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Indent level for nested sub-issues. */
  depth?: number;
  /** Sub-issue roll-up badge shown when the issue has children. */
  subProgress?: { done: number; total: number };
  /** Optional expand/collapse control rendered at the row start. */
  expandToggle?: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <IssueContextMenu issue={issue} members={members}>
    <div
      className={cn(
        "group flex items-center gap-2 border-b border-border/60 px-4 py-2 hover:bg-accent/40",
        selected && "bg-brand/5",
      )}
      style={depth ? { paddingLeft: 16 + depth * 20 } : undefined}
    >
      {expandToggle ?? (depth > 0 && <span className="w-4 shrink-0" />)}
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={onToggleSelect}
          className="size-3.5 shrink-0 accent-[var(--brand)]"
          aria-label="Select task"
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
      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
        {issueIdentifier(issue)}
      </span>
      <Link
        href={`/issues/${issue.id}`}
        className="min-w-0 flex-1 truncate text-sm hover:underline"
      >
        {issue.title}
      </Link>

      {subProgress && subProgress.total > 0 && (
        <span
          className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          title={`${subProgress.done} of ${subProgress.total} sub-tasks done`}
        >
          <ListTree className="size-3" />
          {subProgress.done}/{subProgress.total}
        </span>
      )}

      {issue.labels.length > 0 && (
        <span className="hidden shrink-0 md:flex">
          <LabelChips labels={issue.labels} />
        </span>
      )}

      {/* Surface non-engineering tasks; keep default eng rows uncluttered. */}
      {issue.type && issue.type !== "engineering" && (
        <span className="hidden shrink-0 sm:inline">
          <TypeChip type={issue.type} />
        </span>
      )}

      {issue.estimate != null && (
        <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          {issue.estimate}
        </span>
      )}

      {issue.dueDate && (
        <span
          className={cn(
            "hidden shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] sm:flex",
            isOverdue(issue.dueDate, issue.status)
              ? "bg-destructive/10 text-destructive"
              : "text-muted-foreground",
          )}
        >
          <CalendarClock className="size-3" />
          {formatDue(issue.dueDate)}
        </span>
      )}

      {issue.project && (
        <span className="hidden items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground md:flex">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: issue.project.color }}
          />
          {issue.project.key}
        </span>
      )}

      <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground lg:block">
        {formatDistanceToNowStrict(new Date(issue.createdAt), { addSuffix: false })}
      </span>

      <div className="shrink-0">
        <MultiAssigneePicker
          members={members}
          value={issue.assignees.map((a) => a.id)}
          onChange={(ids) => persist(() => setIssueAssignees(issue.id, ids))}
          compact
        />
      </div>
    </div>
    </IssueContextMenu>
  );
}
