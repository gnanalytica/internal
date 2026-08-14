import { ISSUE_TYPES, PRIORITIES, STATUSES } from "@/lib/constants";
import type { Cycle, IssueWithRelations, Member, Milestone, Project } from "@/lib/types";

/** Active issue filters. Empty set = no constraint for that dimension. */
export type IssueFilters = {
  status: Set<string>;
  priority: Set<string>;
  /** Functional task type ids (engineering, legal, …). */
  type: Set<string>;
  /** User ids; the sentinel "none" matches unassigned issues. */
  assignee: Set<string>;
  /** Label ids; an issue matches if it carries ANY selected label. */
  label: Set<string>;
  /** Cycle ids; the sentinel "none" matches tasks in no cycle. */
  cycle: Set<string>;
  /** Milestone ids; the sentinel "none" matches tasks clearing no gate. */
  milestone: Set<string>;
  /**
   * "blocked" / "unblocked". Reads `issue.blockedBy`, which the view stamps
   * from the workspace's blocked-id set — so a surface that never loaded that
   * set sees every task as unblocked rather than as an error.
   */
  blocked: Set<string>;
};

export type SortId = "manual" | "priority" | "due" | "created" | "updated" | "title";

export const SORTS: { id: SortId; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "priority", label: "Priority" },
  { id: "due", label: "Due date" },
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
    type: new Set(),
    assignee: new Set(),
    label: new Set(),
    cycle: new Set(),
    milestone: new Set(),
    blocked: new Set(),
  };
}

export function activeFilterCount(f: IssueFilters): number {
  return (
    f.status.size +
    f.priority.size +
    f.type.size +
    f.assignee.size +
    f.label.size +
    f.cycle.size +
    f.milestone.size +
    f.blocked.size
  );
}

/** Whether a single issue passes all active filter dimensions (AND across dimensions). */
export function matchesFilters(
  issue: Pick<
    IssueWithRelations,
    "status" | "priority" | "type" | "assigneeId" | "labels" | "cycleId" | "milestoneId"
  > & {
    assignees?: { id: string }[];
    blockedBy?: number;
  },
  f: IssueFilters,
): boolean {
  if (f.status.size && !f.status.has(issue.status)) return false;
  if (f.priority.size && !f.priority.has(issue.priority)) return false;
  if (f.type.size && !f.type.has(issue.type)) return false;
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
  if (f.cycle.size && !f.cycle.has(issue.cycleId ?? "none")) return false;
  if (f.milestone.size && !f.milestone.has(issue.milestoneId ?? "none")) return false;
  if (f.blocked.size && !f.blocked.has(issue.blockedBy ? "blocked" : "unblocked"))
    return false;
  return true;
}

export function filterIssues<T extends IssueWithRelations>(
  issues: T[],
  f: IssueFilters,
): T[] {
  return issues.filter((i) => matchesFilters(i, f));
}

/** Comparator for the chosen sort. "manual" falls back to the persisted sortKey. */
export type GroupBy =
  | "status"
  | "priority"
  | "type"
  | "assignee"
  | "project"
  | "cycle"
  | "milestone"
  | "none";

export const GROUP_BYS: { id: GroupBy; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "type", label: "Type" },
  { id: "assignee", label: "Assignee" },
  { id: "project", label: "Project" },
  { id: "cycle", label: "Cycle" },
  { id: "milestone", label: "Milestone" },
  { id: "none", label: "None" },
];

/**
 * Lookup lists that give groups their order and their labels.
 *
 * `cycles` and `milestones` are optional: when a surface doesn't have them the
 * groups are derived from the tasks themselves (each issue carries its own
 * cycle and milestone), which costs only the ordering — a passed list sorts
 * cycles newest-first and milestones by gate date, matching the roadmap.
 */
export type GroupContext = {
  members: Member[];
  projects: Project[];
  cycles?: Pick<Cycle, "id" | "name">[];
  milestones?: Pick<Milestone, "id" | "name">[];
};

export type IssueGroup = {
  key: string;
  label: string;
  color?: string;
  items: IssueWithRelations[];
};

/**
 * The distinct cycles or milestones carried by a set of issues, in first-seen
 * order. Used to build groups when the caller has no ordered lookup list.
 */
function derive(
  issues: IssueWithRelations[],
  pick: (i: IssueWithRelations) => { id: string; name: string } | null,
): { id: string; name: string }[] {
  const seen = new Map<string, { id: string; name: string }>();
  for (const i of issues) {
    const v = pick(i);
    if (v && !seen.has(v.id)) seen.set(v.id, { id: v.id, name: v.name });
  }
  return [...seen.values()];
}

/** Partition issues into ordered, non-empty groups by the chosen dimension. */
export function groupIssues(
  issues: IssueWithRelations[],
  groupBy: GroupBy,
  ctx: GroupContext,
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
    case "type":
      defs = ISSUE_TYPES.map((t) => ({
        key: t.id,
        label: t.label,
        color: t.color,
        match: (i) => i.type === t.id,
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
    case "cycle": {
      const list = ctx.cycles ?? derive(issues, (i) => i.cycle);
      defs = [
        ...list.map((c) => ({
          key: c.id,
          label: c.name,
          match: (i: IssueWithRelations) => i.cycleId === c.id,
        })),
        { key: "none", label: "No cycle", match: (i) => !i.cycleId },
      ];
      break;
    }
    case "milestone": {
      const list = ctx.milestones ?? derive(issues, (i) => i.milestone);
      defs = [
        ...list.map((m) => ({
          key: m.id,
          label: m.name,
          match: (i: IssueWithRelations) => i.milestoneId === m.id,
        })),
        { key: "none", label: "No milestone", match: (i) => !i.milestoneId },
      ];
      break;
    }
    case "none":
      defs = [{ key: "all", label: "All tasks", match: () => true }];
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
    // Soonest first, undated last — the question this answers is "what's due",
    // and a task with no date is never the answer.
    case "due":
      return (a, b) => {
        const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return at - bt;
      };
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
