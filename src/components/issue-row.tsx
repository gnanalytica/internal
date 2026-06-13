"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  AssigneePicker,
  LabelChip,
  PriorityPicker,
  StatusPicker,
} from "@/components/pickers";
import { updateIssue } from "@/lib/actions";
import type { IssueWithRelations, Member } from "@/lib/types";
import { issueIdentifier } from "@/lib/types";
import type { PriorityId, StatusId } from "@/lib/constants";
import { formatDistanceToNowStrict } from "date-fns";

export function IssueRow({
  issue,
  members,
}: {
  issue: IssueWithRelations;
  members: Member[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="group flex items-center gap-2 border-b border-border/60 px-4 py-2 hover:bg-accent/40">
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
        <AssigneePicker
          members={members}
          value={issue.assigneeId}
          onChange={(v) => persist(() => updateIssue(issue.id, { assigneeId: v }))}
          compact
        />
      </div>
    </div>
  );
}
