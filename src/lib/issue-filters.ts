import { PRIORITIES, STATUSES } from "@/lib/constants";
import type { IssueWithRelations, Member, Project } from "@/lib/types";

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
  issue: Pick<IssueWithRelations, "status" | "priority" | "assigneeId" | "labels"> & {
    assignees?: { id: string }[];
  },
  f: IssueFilters,
): boolean {
  if (f.status.size && !f.status.has(issue.status)) return false;
  if (f.priority.size && !f.priority.has(issue.priority)) return false;
  if (f.assignee.size) {
    // Match if any assignee is selected (or "none" for unassigned). Falls back
    // to the primary assigneeId when the full set isn't loaded.
    const ids = issue.assignees?.length
      ? issue.assignees.map((a) => a.id)
      : issue.assigneeId
        ? [issue.assigneeId]
        : ["none"];
    if (!ids.some((id) => f.assignee.has(id))) return false;
  }
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
export type GroupBy = "status" | "priority" | "assignee" | "project" | "none";

export const GROUP_BYS: { id: GroupBy; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "assignee", label: "Assignee" },
  { id: "project", label: "Project" },
  { id: "none", label: "None" },
];

export type IssueGroup = {
  key: string;
  label: string;
  color?: string;
  items: IssueWithRelations[];
};

/** Partition issues into ordered, non-empty groups by the chosen dimension. */
export function groupIssues(
  issues: IssueWithRelations[],
  groupBy: GroupBy,
  ctx: { members: Member[]; projects: Project[] },
): IssueGroup[] {
  let defs: { key: string; label: string; color?: string; match: (i: IssueWithRelations) => boolean }[];

  switch (groupBy) {
    case "priority":
      defs = PRIORITIES.map((p) => ({
        key: p.id,
        label: p.label,
        match: (i) => i.priority === p.id,
      }));
      break;
    case "assignee":
      defs = [
        ...ctx.members.map((m) => ({
          key: m.id,
          label: m.name,
          color: m.avatarColor,
          match: (i: IssueWithRelations) => i.assigneeId === m.id,
        })),
        { key: "none", label: "Unassigned", match: (i) => !i.assigneeId },
      ];
      break;
    case "project":
      defs = [
        ...ctx.projects.map((p) => ({
          key: p.id,
          label: p.name,
          color: p.color,
          match: (i: IssueWithRelations) => i.projectId === p.id,
        })),
        { key: "none", label: "No project", match: (i) => !i.projectId },
      ];
      break;
    case "none":
      defs = [{ key: "all", label: "All issues", match: () => true }];
      break;
    default:
      defs = STATUSES.map((s) => ({
        key: s.id,
        label: s.label,
        color: s.color,
        match: (i) => i.status === s.id,
      }));
  }

  return defs
    .map((d) => ({
      key: d.key,
      label: d.label,
      color: d.color,
      items: issues.filter(d.match),
    }))
    .filter((g) => g.items.length > 0);
}

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
