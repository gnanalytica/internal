import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import {
  issueLabels,
  issuePageLinks,
  issues,
  labels,
  pages,
  projects,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

import type {
  FlatIssue,
  IssueWithRelations,
  Label,
  Member,
  Page,
  PageNode,
  Project,
} from "@/lib/types";
import { issueIdentifier } from "@/lib/types";

export type {
  FlatIssue,
  FlatPage,
  Issue,
  IssueWithRelations,
  Label,
  Member,
  Page,
  PageNode,
  Project,
} from "@/lib/types";
export { issueIdentifier } from "@/lib/types";

/** The single workspace for v1. */
export async function getWorkspace() {
  const ws = await db.query.workspaces.findFirst();
  if (!ws) throw new Error("No workspace found. Run `npm run db:seed`.");
  return ws;
}

export async function getMembers(workspaceId: string): Promise<Member[]> {
  const rows = await db
    .select({ user: users })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.name));
  return rows.map((r) => r.user);
}

/** Minimal session: current user is read from the `uid` cookie, else first member. */
export async function getCurrentUser(workspaceId: string): Promise<Member> {
  const members = await getMembers(workspaceId);
  const uid = (await cookies()).get("uid")?.value;
  return members.find((m) => m.id === uid) ?? members[0];
}

export async function getProjects(workspaceId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.name));
}

export async function getLabels(workspaceId: string): Promise<Label[]> {
  return db
    .select()
    .from(labels)
    .where(eq(labels.workspaceId, workspaceId))
    .orderBy(asc(labels.name));
}

export async function getIssues(
  workspaceId: string,
): Promise<IssueWithRelations[]> {
  const rows = await db.query.issues.findMany({
    where: eq(issues.workspaceId, workspaceId),
    orderBy: [asc(issues.sortKey), desc(issues.createdAt)],
    with: {
      project: true,
      assignee: true,
      labels: { with: { label: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    labels: r.labels.map((l) => l.label),
  }));
}

export async function getIssue(
  workspaceId: string,
  id: string,
): Promise<(IssueWithRelations & { linkedPages: Page[] }) | null> {
  const row = await db.query.issues.findFirst({
    where: and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)),
    with: {
      project: true,
      assignee: true,
      labels: { with: { label: true } },
      pageLinks: { with: { page: true } },
    },
  });
  if (!row) return null;
  return {
    ...row,
    labels: row.labels.map((l) => l.label),
    linkedPages: row.pageLinks.map((p) => p.page),
  };
}

export async function getPageTree(workspaceId: string): Promise<PageNode[]> {
  const all = await db
    .select()
    .from(pages)
    .where(eq(pages.workspaceId, workspaceId))
    .orderBy(asc(pages.position), asc(pages.createdAt));

  const byParent = new Map<string | null, Page[]>();
  for (const p of all) {
    const key = p.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(p);
  }
  const build = (parentId: string | null): PageNode[] =>
    (byParent.get(parentId) ?? []).map((p) => ({
      ...p,
      children: build(p.id),
    }));
  return build(null);
}

/** Flat list of issues for link pickers. */
export async function getIssuesFlat(workspaceId: string): Promise<FlatIssue[]> {
  const rows = await db
    .select({
      id: issues.id,
      title: issues.title,
      number: issues.number,
      status: issues.status,
      projectKey: projects.key,
    })
    .from(issues)
    .leftJoin(projects, eq(issues.projectId, projects.id))
    .where(eq(issues.workspaceId, workspaceId))
    .orderBy(desc(issues.createdAt));
  return rows;
}

/** Flat list of pages (id/title/icon) for link pickers. */
export async function getPagesFlat(
  workspaceId: string,
): Promise<Pick<Page, "id" | "title" | "icon">[]> {
  return db
    .select({ id: pages.id, title: pages.title, icon: pages.icon })
    .from(pages)
    .where(eq(pages.workspaceId, workspaceId))
    .orderBy(asc(pages.title));
}

export async function getPage(
  workspaceId: string,
  id: string,
): Promise<(Page & { linkedIssues: IssueWithRelations[] }) | null> {
  const row = await db.query.pages.findFirst({
    where: and(eq(pages.workspaceId, workspaceId), eq(pages.id, id)),
    with: {
      issueLinks: {
        with: {
          issue: {
            with: { project: true, assignee: true, labels: { with: { label: true } } },
          },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    linkedIssues: row.issueLinks.map((l) => ({
      ...l.issue,
      labels: l.issue.labels.map((x) => x.label),
    })),
  };
}

// Re-export table objects used by actions.
export { issues, pages, projects, labels, issueLabels, issuePageLinks, workspaces };
