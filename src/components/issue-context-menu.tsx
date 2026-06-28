"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { UserAvatar } from "@/components/glyphs";
import { PRIORITIES, STATUSES } from "@/lib/constants";
import { deleteIssue, setIssueAssignees, updateIssue } from "@/lib/actions";
import type { IssueWithRelations, Member } from "@/lib/types";

/**
 * Right-click menu for an issue (list rows + board cards). Wraps a single
 * element as the trigger; quick-sets status / priority / assignee or deletes,
 * all without opening the issue.
 */
export function IssueContextMenu({
  issue,
  members,
  children,
}: {
  issue: IssueWithRelations;
  members: Member[];
  children: React.ReactElement;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Status</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {STATUSES.map((s) => (
              <ContextMenuItem
                key={s.id}
                onClick={() => run(() => updateIssue(issue.id, { status: s.id }))}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Priority</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {PRIORITIES.map((p) => (
              <ContextMenuItem
                key={p.id}
                onClick={() => run(() => updateIssue(issue.id, { priority: p.id }))}
              >
                {p.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Assignee</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() => run(() => setIssueAssignees(issue.id, []))}
            >
              <span className="size-4 rounded-full border border-dashed border-muted-foreground/60" />
              Unassigned
            </ContextMenuItem>
            {members.map((m) => (
              <ContextMenuItem
                key={m.id}
                onClick={() => run(() => setIssueAssignees(issue.id, [m.id]))}
              >
                <UserAvatar name={m.name} color={m.avatarColor} className="size-4 text-[8px]" />
                {m.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() =>
            run(async () => {
              await deleteIssue(issue.id);
              toast.success("Task deleted");
            })
          }
        >
          Delete task
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
