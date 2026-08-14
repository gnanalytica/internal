"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StatusIcon, UserAvatar } from "@/components/glyphs";
import type { StatusId } from "@/lib/constants";
import { PRIORITY_MAP, type PriorityId } from "@/lib/constants";
import { issueBelongsToDepartment, type DepartmentSlug } from "@/lib/departments";
import { formatDate } from "@/lib/matrix-format";
import { issueIdentifier } from "@/lib/types";
import type { IssueWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The tasks on one department's surface — the same issues as the global board,
 * filtered to the tracks that department owns. Each row shows the gate it
 * clears, so the milestones can stay project-level and shared rather than
 * being duplicated per department.
 */
export function DepartmentTasks({
  issues,
  department,
  emptyLabel,
}: {
  issues: IssueWithRelations[];
  department: DepartmentSlug;
  emptyLabel?: string;
}) {
  const [q, setQ] = useState("");
  const [hideDone, setHideDone] = useState(true);

  // Top-level tasks only. Sub-issues carry the same labels as their parent, so
  // including them would list every item twice — once as work and once as its
  // own breakdown. The parent's detail page is where the breakdown belongs.
  const mine = useMemo(
    () =>
      issues.filter((i) => !i.parentId && issueBelongsToDepartment(i.labels, department)),
    [issues, department],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return mine
      .filter((i) => !hideDone || (i.status !== "done" && i.status !== "canceled"))
      .filter(
        (i) =>
          !needle ||
          i.title.toLowerCase().includes(needle) ||
          i.assignee?.name.toLowerCase().includes(needle) ||
          i.milestone?.name.toLowerCase().includes(needle),
      );
  }, [mine, q, hideDone]);

  const done = mine.filter((i) => i.status === "done").length;

  if (mine.length === 0)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {emptyLabel ?? "No tasks on this surface yet."}
      </p>
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search task, owner, gate"
          className="h-8 w-64 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Search tasks"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="size-3.5"
          />
          Hide done
        </label>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {shown.length} of {mine.length} · {done} done
        </span>
      </div>

      <ul className="divide-y rounded-md border bg-background">
        {shown.map((t) => {
          const p = PRIORITY_MAP[t.priority as PriorityId];
          return (
            <li key={t.id}>
              <Link
                href={`/issues/${t.id}`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                <StatusIcon status={t.status as StatusId} />
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {issueIdentifier(t)}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.milestone && (
                  <span
                    className="hidden shrink-0 truncate rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block lg:max-w-52"
                    title={`Clears: ${t.milestone.name}`}
                  >
                    {t.milestone.name}
                  </span>
                )}
                {p && p.id !== "none" && (
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-medium uppercase",
                      p.id === "urgent" ? "text-rose-600" : "text-muted-foreground",
                    )}
                  >
                    {p.label}
                  </span>
                )}
                {t.cycle && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {t.cycle.name.split(" — ")[0]}
                  </span>
                )}
                {t.dueDate && (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {formatDate(t.dueDate)}
                  </span>
                )}
                {t.assignee && (
                  <UserAvatar
                    name={t.assignee.name}
                    color={t.assignee.avatarColor}
                    className="size-5"
                  />
                )}
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nothing matches. {done > 0 && !q && "Untick “hide done” to see completed work."}
          </li>
        )}
      </ul>
    </div>
  );
}
