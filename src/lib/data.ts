import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { db } from "@/db";
import {
  activity,
  comments,
  cycles,
  initiatives,
  issueLabels,
  issuePageLinks,
  issues,
  labels,
  pages,
  projects,
  teamMembers,
  teams,
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
  MemberWithRole,
  Page,
  PageNode,
  Project,
  ProjectWithIssueCount,
  Role,
  Team,
  TeamWithCount,
  TimelineItem,
  Workspace,
  WorkspaceWithRole,
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
  MemberWithRole,
  Page,
  PageNode,
  Project,
  ProjectWithIssueCount,
  Role,
  Team,
  TeamWithCount,
  TimelineItem,
  Workspace,
  WorkspaceWithRole,
} from "@/lib/types";
export { issueIdentifier } from "@/lib/types";

/** Resolve the app user from the Neon Auth session (create on first sign-in). */
async function resolveSessionUser(): Promise<Member> {
  const { data: session } = await auth.getSession();
  const sUser = session?.user;
  if (!sUser?.email) redirect("/auth/sign-in");
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, sUser.email))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(users)
    .values({
      name: sUser.name?.trim() || sUser.email.split("@")[0],
      email: sUser.email,
      avatarColor: pickColor(sUser.email),
    })
    .returning();
  return created;
}

/** All workspaces the current user is a member of, with their role. */
export async function getMyWorkspaces(): Promise<WorkspaceWithRole[]> {
  const me = await resolveSessionUser();
  const rows = await db
    .select({ ws: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, me.id))
    .orderBy(asc(workspaces.name));
  return rows.map((r) => ({ ...r.ws, role: r.role }));
}

/**
 * The active workspace for the current user, chosen by the `active_ws` cookie
 * (validated against membership) or the first workspace they belong to.
 * Users with no workspace are sent to onboarding.
 */
export async function getWorkspace(): Promise<Workspace> {
  const mine = await getMyWorkspaces();
  if (mine.length === 0) redirect("/onboarding");
  const activeId = (await cookies()).get("active_ws")?.value;
  return mine.find((w) => w.id === activeId) ?? mine[0];
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

export function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** The current app user (membership is enforced by getWorkspace). */
export async function getCurrentUser(
  _workspaceId?: string,
): Promise<Member> {
  return resolveSessionUser();
}

export async function getMembersWithRole(
  workspaceId: string,
): Promise<MemberWithRole[]> {
  const rows = await db
    .select({ user: users, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.name));
  return rows.map((r) => ({ ...r.user, role: r.role }));
}

/** The current user's role in the workspace ("admin" | "member"). */
export async function getMyRole(workspaceId: string): Promise<Role> {
  const me = await getCurrentUser(workspaceId);
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, me.id),
      ),
    )
    .limit(1);
  return m?.role === "admin" ? "admin" : "member";
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
      team: true,
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
      team: true,
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
              team: true,
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
          team: true,
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

// ---- Comments & activity timeline ----

export async function getIssueTimeline(
  issueId: string,
): Promise<TimelineItem[]> {
  const [cs, as] = await Promise.all([
    db.query.comments.findMany({
      where: eq(comments.issueId, issueId),
      with: { author: true },
    }),
    db.query.activity.findMany({
      where: eq(activity.issueId, issueId),
      with: { actor: true },
    }),
  ]);
  const items: TimelineItem[] = [
    ...cs.map((c) => ({
      kind: "comment" as const,
      id: c.id,
      createdAt: c.createdAt,
      author: c.author,
      body: c.body,
    })),
    ...as.map((a) => ({
      kind: "activity" as const,
      id: a.id,
      createdAt: a.createdAt,
      actor: a.actor,
      type: a.type,
      data: a.data as { from?: string | null; to?: string | null } | null,
    })),
  ];
  items.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
  return items;
}

// ---- Teams ----

export async function getTeams(workspaceId: string): Promise<TeamWithCount[]> {
  const rows = await db.query.teams.findMany({
    where: eq(teams.workspaceId, workspaceId),
    orderBy: [asc(teams.name)],
    with: {
      issues: { columns: { id: true } },
      members: { columns: { userId: true } },
    },
  });
  return rows.map((t) => ({
    ...t,
    issueCount: t.issues.length,
    memberCount: t.members.length,
  }));
}

export async function getTeam(
  workspaceId: string,
  id: string,
): Promise<(Team & { issues: IssueWithRelations[]; members: Member[] }) | null> {
  const row = await db.query.teams.findFirst({
    where: and(eq(teams.workspaceId, workspaceId), eq(teams.id, id)),
    with: {
      issues: {
        orderBy: [asc(issues.sortKey)],
        with: {
          project: true,
          cycle: true,
          team: true,
          assignee: true,
          labels: { with: { label: true } },
        },
      },
      members: { with: { user: true } },
    },
  });
  if (!row) return null;
  return {
    ...row,
    issues: row.issues.map((i) => ({ ...i, labels: i.labels.map((l) => l.label) })),
    members: row.members.map((m) => m.user),
  };
}

export async function getTeamsFlat(workspaceId: string): Promise<Team[]> {
  return db
    .select()
    .from(teams)
    .where(eq(teams.workspaceId, workspaceId))
    .orderBy(asc(teams.name));
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
