import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { db } from "@/db";
import {
  cycles,
  initiatives,
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
  Cycle,
  CycleWithCount,
  FlatIssue,
  Initiative,
  InitiativeWithCount,
  IssueWithRelations,
  Label,
  Member,
  Page,
  PageNode,
  Project,
  ProjectWithIssueCount,
} from "@/lib/types";
import { issueIdentifier } from "@/lib/types";

export type {
  Cycle,
  CycleWithCount,
  FlatIssue,
  FlatPage,
  Initiative,
  InitiativeWithCount,
  Issue,
  IssueWithRelations,
  Label,
  Member,
  Page,
  PageNode,
  Project,
  ProjectWithIssueCount,
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

const AVATAR_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6",
  "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6",
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/**
 * Resolve the current user from the Neon Auth session, bridging it to our own
 * `users` table by email (find-or-create) and ensuring workspace membership.
 * Seeded users (e.g. sandeep@gnanalytica.com) map to the matching real login.
 */
export async function getCurrentUser(workspaceId: string): Promise<Member> {
  const { data: session } = await auth.getSession();
  const sUser = session?.user;
  if (!sUser?.email) redirect("/auth/sign-in");

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, sUser.email))
    .limit(1);

  let user = existing[0];
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        name: sUser.name?.trim() || sUser.email.split("@")[0],
        email: sUser.email,
        avatarColor: pickColor(sUser.email),
      })
      .returning();
  }

  await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId: user.id, role: "member" })
    .onConflictDoNothing();

  return user;
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
      cycle: true,
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
      cycle: true,
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
            with: {
              project: true,
              cycle: true,
              assignee: true,
              labels: { with: { label: true } },
            },
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

// ---- Cycles ----

export async function getCycles(workspaceId: string): Promise<CycleWithCount[]> {
  const rows = await db.query.cycles.findMany({
    where: eq(cycles.workspaceId, workspaceId),
    orderBy: [desc(cycles.startDate)],
    with: { issues: { columns: { id: true, status: true } } },
  });
  return rows.map((c) => ({
    ...c,
    issueCount: c.issues.length,
    doneCount: c.issues.filter((i) => i.status === "done").length,
  }));
}

export async function getCycle(
  workspaceId: string,
  id: string,
): Promise<(Cycle & { issues: IssueWithRelations[] }) | null> {
  const row = await db.query.cycles.findFirst({
    where: and(eq(cycles.workspaceId, workspaceId), eq(cycles.id, id)),
    with: {
      issues: {
        orderBy: [asc(issues.sortKey)],
        with: {
          project: true,
          cycle: true,
          assignee: true,
          labels: { with: { label: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    issues: row.issues.map((i) => ({ ...i, labels: i.labels.map((l) => l.label) })),
  };
}

/** Cycles as a flat list for pickers. */
export async function getCyclesFlat(workspaceId: string): Promise<Cycle[]> {
  return db
    .select()
    .from(cycles)
    .where(eq(cycles.workspaceId, workspaceId))
    .orderBy(desc(cycles.startDate));
}

// ---- Initiatives ----

export async function getInitiatives(
  workspaceId: string,
): Promise<InitiativeWithCount[]> {
  const rows = await db.query.initiatives.findMany({
    where: eq(initiatives.workspaceId, workspaceId),
    orderBy: [asc(initiatives.name)],
    with: { projects: { columns: { id: true } } },
  });
  return rows.map((i) => ({ ...i, projectCount: i.projects.length }));
}

export async function getInitiative(
  workspaceId: string,
  id: string,
): Promise<(Initiative & { projects: ProjectWithIssueCount[] }) | null> {
  const row = await db.query.initiatives.findFirst({
    where: and(eq(initiatives.workspaceId, workspaceId), eq(initiatives.id, id)),
    with: { projects: { with: { issues: { columns: { id: true, status: true } } } } },
  });
  if (!row) return null;
  return {
    ...row,
    projects: row.projects.map((p) => ({
      ...p,
      issueCount: p.issues.length,
      doneCount: p.issues.filter((i) => i.status === "done").length,
    })),
  };
}

// Re-export table objects used by actions.
export {
  cycles,
  initiatives,
  issues,
  pages,
  projects,
  labels,
  issueLabels,
  issuePageLinks,
  workspaces,
};
