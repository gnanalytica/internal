import { PRIORITIES } from "@/lib/constants";
import type { IssueWithRelations } from "@/lib/types";

/** Active issue filters. Empty set = no constraint for that dimension. */
export type IssueFilters = {
  status: Set<string>;
  priority: Set<string>;
  /** User ids; the sentinel "none" matches unassigned issues. */
  assignee: Set<string>;
  /** Label ids; an issue matches if it carries ANY selected label. */
  label: Set<string>;
};

export type SortId = "manual" | "priority" | "created" | "updated" | "title";

export const SORTS: { id: SortId; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "priority", label: "Priority" },
  { id: "created", label: "Created date" },
  { id: "updated", label: "Last updated" },
  { id: "title", label: "Title" },
];

const PRIORITY_RANK = new Map<string, number>(
  PRIORITIES.map((p) => [p.id, p.rank]),
);

export function emptyFilters(): IssueFilters {
  return {
    status: new Set(),
    priority: new Set(),
    assignee: new Set(),
    label: new Set(),
  };
}

export function activeFilterCount(f: IssueFilters): number {
  return f.status.size + f.priority.size + f.assignee.size + f.label.size;
}

/** Whether a single issue passes all active filter dimensions (AND across dimensions). */
export function matchesFilters(
  issue: Pick<IssueWithRelations, "status" | "priority" | "assigneeId" | "labels">,
  f: IssueFilters,
): boolean {
  if (f.status.size && !f.status.has(issue.status)) return false;
  if (f.priority.size && !f.priority.has(issue.priority)) return false;
  if (f.assignee.size && !f.assignee.has(issue.assigneeId ?? "none")) return false;
  if (f.label.size && !issue.labels.some((l) => f.label.has(l.id))) return false;
  return true;
}

export function filterIssues<T extends IssueWithRelations>(
  issues: T[],
  f: IssueFilters,
): T[] {
  return issues.filter((i) => matchesFilters(i, f));
}

/** Comparator for the chosen sort. "manual" falls back to the persisted sortKey. */
export function issueComparator(
  sort: SortId,
): (a: IssueWithRelations, b: IssueWithRelations) => number {
  switch (sort) {
    case "priority":
      return (a, b) =>
        (PRIORITY_RANK.get(a.priority) ?? 99) - (PRIORITY_RANK.get(b.priority) ?? 99);
    case "created":
      return (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "updated":
      return (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    case "title":
      return (a, b) => a.title.localeCompare(b.title);
    default:
      return (a, b) => a.sortKey.localeCompare(b.sortKey);
  }
}
