import type {
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

export type IssueWithRelations = Issue & {
  project: Project | null;
  assignee: Member | null;
  labels: Label[];
};

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
