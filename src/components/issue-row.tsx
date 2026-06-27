"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  LabelChip,
  MultiAssigneePicker,
  PriorityPicker,
  StatusPicker,
} from "@/components/pickers";
import { IssueContextMenu } from "@/components/issue-context-menu";
import { setIssueAssignees, updateIssue } from "@/lib/actions";
import { formatDue, isOverdue } from "@/lib/issue-dates";
import type { IssueWithRelations, Member } from "@/lib/types";
import { issueIdentifier } from "@/lib/types";
import type { PriorityId, StatusId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

export function IssueRow({
  issue,
  members,
  selected,
  onToggleSelect,
}: {
  issue: IssueWithRelations;
  members: Member[];
  selected?: boolean;
  onToggleSelect?: () => void;
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
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={onToggleSelect}
          className="size-3.5 shrink-0 accent-[var(--brand)]"
          aria-label="Select issue"
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

      <div className="hidden items-center gap-1 sm:flex">
        {issue.labels.slice(0, 3).map((l) => (
          <LabelChip key={l.id} label={l} />
        ))}
      </div>

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
