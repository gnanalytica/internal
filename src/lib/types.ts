import type {
  cycles,
  initiatives,
  issues,
  labels,
  pages,
  projects,
  users,
} from "@/db/schema";

// Shared, client-safe types and helpers (no server-only imports here).

export type Member = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Cycle = typeof cycles.$inferSelect;
export type Initiative = typeof initiatives.$inferSelect;

export type IssueWithRelations = Issue & {
  project: Project | null;
  cycle: Cycle | null;
  assignee: Member | null;
  labels: Label[];
};

export type CycleWithCount = Cycle & { issueCount: number; doneCount: number };
export type InitiativeWithCount = Initiative & { projectCount: number };
export type ProjectWithIssueCount = Project & {
  issueCount: number;
  doneCount: number;
};

/** Cycle status derived from its date range relative to `now`. */
export function cycleStatus(
  c: { startDate: Date | string; endDate: Date | string },
  now: Date,
): "upcoming" | "active" | "completed" {
  const start = new Date(c.startDate).getTime();
  const end = new Date(c.endDate).getTime();
  const t = now.getTime();
  if (t < start) return "upcoming";
  if (t > end) return "completed";
  return "active";
}

export const INITIATIVE_STATUSES = [
  { id: "planned", label: "Planned", color: "#bec2c8" },
  { id: "active", label: "Active", color: "#5e6ad2" },
  { id: "completed", label: "Completed", color: "#5e9b51" },
] as const;

export type PageNode = Page & { children: PageNode[] };

export type FlatIssue = {
  id: string;
  title: string;
  number: number;
  status: string;
  projectKey: string | null;
};

export type FlatPage = Pick<Page, "id" | "title" | "icon">;

/** Display identifier like ENG-12, falling back to a short id when no project. */
export function issueIdentifier(issue: {
  number: number;
  project?: { key: string } | null;
}): string {
  return issue.project ? `${issue.project.key}-${issue.number}` : `#${issue.number}`;
}
