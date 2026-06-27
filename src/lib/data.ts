import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { featureProgress } from "@/lib/feature-progress";
import { db } from "@/db";
import {
  activity,
  apiKeys,
  attachments,
  campaigns,
  comments,
  contentItems,
  crmAccounts,
  crmActivities,
  crmContacts,
  cycles,
  deals,
  expenses,
  favorites,
  features,
  feedback,
  databaseFields,
  databaseRows,
  databases,
  invoices,
  issueLabels,
  issuePageLinks,
  issueRelations,
  issues,
  labels,
  metricPoints,
  milestones,
  orgRoles,
  metrics,
  notifications,
  pages,
  projectStatusUpdates,
  references,
  savedViews,
  projects,
  ticketComments,
  tickets,
  users,
  webhooks,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

import type {
  AccountDetail,
  CampaignWithRelations,
  ContactWithAccount,
  ContentItemWithCampaign,
  CrmAccount,
  Cycle,
  CycleWithCount,
  Database,
  DatabaseWithSchema,
  DealWithRelations,
  ExpenseWithRelations,
  FeedbackWithRelations,
  FlatIssue,
  FeatureWithRelations,
  InvoiceWithRelations,
  IssueWithRelations,
  Label,
  Member,
  MemberWithRole,
  MetricWithRelations,
  MilestoneDetail,
  MilestoneWithProgress,
  OrgRoleNode,
  Page,
  PageNode,
  PortfolioRow,
  Project,
  ProjectSummary,
  ProjectWithIssueCount,
  Role,
  TicketWithRelations,
  TimelineItem,
  Workspace,
  WorkspaceWithRole,
} from "@/lib/types";

export type {
  Cycle,
  CycleWithCount,
  Database,
  DatabaseField,
  DatabaseRow,
  DatabaseWithSchema,
  FlatIssue,
  FlatPage,
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
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      githubRepo: workspaces.githubRepo,
      bets: workspaces.bets,
      createdAt: workspaces.createdAt,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, me.id))
    .orderBy(asc(workspaces.name));
  return rows.map(({ role, ...ws }) => ({ ...ws, role }));
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
    .select({
      user: users,
      role: workspaceMembers.role,
      title: workspaceMembers.title,
      entity: workspaceMembers.entity,
      employment: workspaceMembers.employment,
      startDate: workspaceMembers.startDate,
      managerId: workspaceMembers.managerId,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.name));
  return rows.map((r) => ({
    ...r.user,
    role: r.role,
    title: r.title,
    entity: r.entity,
    employment: r.employment,
    startDate: r.startDate,
    managerId: r.managerId,
  }));
}

/** The org-chart positions for a workspace, assembled into a sorted tree.
 *  Decoupled from member managers so one person can hold several positions. */
export async function getOrgRoles(workspaceId: string): Promise<OrgRoleNode[]> {
  const rows = await db
    .select({ role: orgRoles, user: users })
    .from(orgRoles)
    .leftJoin(users, eq(orgRoles.userId, users.id))
    .where(eq(orgRoles.workspaceId, workspaceId))
    .orderBy(asc(orgRoles.sortKey));

  const nodes = new Map<string, OrgRoleNode>();
  for (const r of rows) {
    nodes.set(r.role.id, {
      id: r.role.id,
      title: r.role.title,
      sortKey: r.role.sortKey,
      user: r.user ?? null,
      children: [],
    });
  }
  const roots: OrgRoleNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.role.id)!;
    const parent = r.role.parentId ? nodes.get(r.role.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
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

/**
 * Company portfolio for the Overview home: every project and operation with its
 * owner, latest health, current milestone (projects only), and issue progress.
 * One pass over projects + a few aggregate queries (no per-project round-trips).
 */
export async function getPortfolio(workspaceId: string): Promise<PortfolioRow[]> {
  const [projs, members] = await Promise.all([
    db.select().from(projects).where(eq(projects.workspaceId, workspaceId)).orderBy(asc(projects.name)),
    getMembers(workspaceId),
  ]);
  const ownerName = (id: string | null) =>
    id ? (members.find((m) => m.id === id)?.name ?? null) : null;

  // Issue counts per project (done / total, canceled excluded).
  const issueRows = (await db.execute(sql`
    SELECT project_id AS pid,
           count(*) FILTER (WHERE status <> 'canceled')::int AS total,
           count(*) FILTER (WHERE status = 'done')::int AS done
    FROM issues WHERE workspace_id = ${workspaceId} AND project_id IS NOT NULL
    GROUP BY project_id`)).rows as { pid: string; total: number; done: number }[];
  const counts = new Map(issueRows.map((r) => [r.pid, r]));

  // Latest health per project.
  const healthRows = (await db.execute(sql`
    SELECT DISTINCT ON (project_id) project_id AS pid, health
    FROM project_status_updates WHERE workspace_id = ${workspaceId}
    ORDER BY project_id, created_at DESC`)).rows as { pid: string; health: string }[];
  const healthByProject = new Map(healthRows.map((r) => [r.pid, r.health]));

  // Current milestone per project: next-upcoming target, else the latest.
  const msRows = (await db.execute(sql`
    SELECT project_id AS pid, name, target_date AS target
    FROM milestones WHERE workspace_id = ${workspaceId}
    ORDER BY project_id, target_date ASC NULLS LAST`)).rows as {
    pid: string;
    name: string;
    target: string | null;
  }[];
  const now = Date.now();
  const milestoneByProject = new Map<string, { name: string; target: Date | null }>();
  for (const r of msRows) {
    const existing = milestoneByProject.get(r.pid);
    const t = r.target ? new Date(r.target) : null;
    // Prefer the earliest still-upcoming milestone; fall back to the latest seen.
    if (!existing) {
      milestoneByProject.set(r.pid, { name: r.name, target: t });
    } else if (t && t.getTime() >= now && (!existing.target || existing.target.getTime() < now)) {
      milestoneByProject.set(r.pid, { name: r.name, target: t });
    }
  }

  const VALID = new Set(["on_track", "at_risk", "off_track"]);
  return projs.map((p): PortfolioRow => {
    const c = counts.get(p.id);
    const h = healthByProject.get(p.id);
    const ms = p.kind === "project" ? milestoneByProject.get(p.id) : undefined;
    return {
      id: p.id,
      name: p.name,
      key: p.key,
      color: p.color,
      kind: p.kind,
      tagline: p.tagline,
      url: p.url,
      ownerName: ownerName(p.ownerId),
      health: h && VALID.has(h) ? (h as PortfolioRow["health"]) : "none",
      milestoneName: ms?.name ?? null,
      milestoneTarget: ms?.target ?? null,
      doneIssues: c?.done ?? 0,
      totalIssues: c?.total ?? 0,
    };
  });
}

export async function getProjectsWithCounts(
  workspaceId: string,
): Promise<ProjectWithIssueCount[]> {
  const rows = await db.query.projects.findMany({
    where: eq(projects.workspaceId, workspaceId),
    orderBy: [asc(projects.name)],
    with: { issues: { columns: { id: true, status: true } } },
  });
  return rows.map((p) => ({
    ...p,
    issueCount: p.issues.length,
    doneCount: p.issues.filter((i) => i.status === "done").length,
  }));
}

export async function getStatusUpdates(
  workspaceId: string,
  projectId: string,
): Promise<import("@/lib/types").StatusUpdateItem[]> {
  const rows = await db.query.projectStatusUpdates.findMany({
    where: and(
      eq(projectStatusUpdates.workspaceId, workspaceId),
      eq(projectStatusUpdates.projectId, projectId),
    ),
    orderBy: [desc(projectStatusUpdates.createdAt)],
    with: { author: true },
  });
  return rows.map((r) => ({
    id: r.id,
    health: r.health,
    body: r.body,
    createdAt: r.createdAt,
    author: r.author,
  }));
}

export type RoadmapProject = Project;

export async function getRoadmap(workspaceId: string): Promise<RoadmapProject[]> {
  const rows = await db.query.projects.findMany({
    where: eq(projects.workspaceId, workspaceId),
    orderBy: [asc(projects.startDate), asc(projects.name)],
  });
  return rows;
}

export async function getProject(
  workspaceId: string,
  id: string,
): Promise<import("@/lib/types").ProjectDetail | null> {
  const row = await db.query.projects.findFirst({
    where: and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)),
    with: {
      owner: true,
      issues: {
        orderBy: [asc(issues.sortKey), desc(issues.createdAt)],
        with: {
          project: true,
          cycle: true,
          assignee: true,
          labels: { with: { label: true } },
          milestone: { columns: { id: true, name: true } },
          assignees: { with: { user: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    issues: row.issues.map((i) => ({ ...i, labels: i.labels.map((l) => l.label), assignees: i.assignees.map((a) => a.user) })),
  };
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
      milestone: { columns: { id: true, name: true } },
      assignees: { with: { user: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    labels: r.labels.map((l) => l.label), assignees: r.assignees.map((a) => a.user),
  }));
}

/** Keyset-paginated issues for the API (newest first). */
export async function getIssuesPage(
  workspaceId: string,
  opts: {
    limit: number;
    cursor?: { createdAt: string; id: string } | null;
    status?: string | null;
    projectId?: string | null;
    assigneeId?: string | null;
  },
): Promise<{ items: IssueWithRelations[]; nextCursor: import("@/lib/api/pagination").Cursor | null }> {
  const conds = [eq(issues.workspaceId, workspaceId)];
  if (opts.status) conds.push(eq(issues.status, opts.status));
  if (opts.projectId) conds.push(eq(issues.projectId, opts.projectId));
  if (opts.assigneeId) conds.push(eq(issues.assigneeId, opts.assigneeId));
  if (opts.cursor) {
    const at = new Date(opts.cursor.createdAt);
    conds.push(
      or(
        lt(issues.createdAt, at),
        and(eq(issues.createdAt, at), lt(issues.id, opts.cursor.id)),
      )!,
    );
  }

  const rows = await db.query.issues.findMany({
    where: and(...conds),
    orderBy: [desc(issues.createdAt), desc(issues.id)],
    limit: opts.limit + 1,
    with: {
      project: true,
      cycle: true,
      assignee: true,
      labels: { with: { label: true } },
      milestone: { columns: { id: true, name: true } },
      assignees: { with: { user: true } },
    },
  });

  const hasMore = rows.length > opts.limit;
  const page = (hasMore ? rows.slice(0, opts.limit) : rows).map((r) => ({
    ...r,
    labels: r.labels.map((l) => l.label), assignees: r.assignees.map((a) => a.user),
  }));
  const last = hasMore ? page[page.length - 1] : null;
  return {
    items: page,
    nextCursor: last
      ? { createdAt: new Date(last.createdAt).toISOString(), id: last.id }
      : null,
  };
}

export async function getIssue(
  workspaceId: string,
  id: string,
): Promise<import("@/lib/types").IssueDetail | null> {
  const row = await db.query.issues.findFirst({
    where: and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)),
    with: {
      project: true,
      cycle: true,
      assignee: true,
      labels: { with: { label: true } },
      milestone: { columns: { id: true, name: true } },
      assignees: { with: { user: true } },
      feature: {
        columns: { id: true, title: true },
        with: { milestone: { columns: { id: true, name: true } } },
      },
      pageLinks: { with: { page: true } },
      parent: { with: { project: true } },
      subIssues: {
        orderBy: [asc(issues.sortKey), desc(issues.createdAt)],
        with: {
          project: true,
          cycle: true,
          assignee: true,
          labels: { with: { label: true } },
          milestone: { columns: { id: true, name: true } },
          assignees: { with: { user: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    labels: row.labels.map((l) => l.label), assignees: row.assignees.map((a) => a.user),
    feature: row.feature
      ? { id: row.feature.id, title: row.feature.title, milestone: row.feature.milestone }
      : null,
    linkedPages: row.pageLinks.map((p) => p.page),
    parent: row.parent
      ? {
          id: row.parent.id,
          number: row.parent.number,
          title: row.parent.title,
          project: row.parent.project,
        }
      : null,
    subIssues: row.subIssues.map((s) => ({ ...s, labels: s.labels.map((l) => l.label), assignees: s.assignees.map((a) => a.user) })),
  };
}

export async function getIssueRelations(
  workspaceId: string,
  issueId: string,
): Promise<import("@/lib/types").RelationItem[]> {
  const select = {
    relationId: issueRelations.id,
    type: issueRelations.type,
    issueId: issues.id,
    number: issues.number,
    title: issues.title,
    status: issues.status,
    project: projects,
  };

  const [outgoing, incoming] = await Promise.all([
    db
      .select(select)
      .from(issueRelations)
      .innerJoin(issues, eq(issues.id, issueRelations.relatedIssueId))
      .leftJoin(projects, eq(projects.id, issues.projectId))
      .where(
        and(
          eq(issueRelations.workspaceId, workspaceId),
          eq(issueRelations.issueId, issueId),
        ),
      ),
    db
      .select(select)
      .from(issueRelations)
      .innerJoin(issues, eq(issues.id, issueRelations.issueId))
      .leftJoin(projects, eq(projects.id, issues.projectId))
      .where(
        and(
          eq(issueRelations.workspaceId, workspaceId),
          eq(issueRelations.relatedIssueId, issueId),
        ),
      ),
  ]);

  const map = (
    rows: typeof outgoing,
    direction: "outgoing" | "incoming",
  ): import("@/lib/types").RelationItem[] =>
    rows.map((r) => ({
      relationId: r.relationId,
      type: r.type as "blocks" | "related" | "duplicate",
      direction,
      issue: {
        id: r.issueId,
        number: r.number,
        title: r.title,
        status: r.status,
        project: r.project,
      },
    }));

  return [...map(outgoing, "outgoing"), ...map(incoming, "incoming")];
}

export async function getPageTree(
  workspaceId: string,
  projectId?: string,
): Promise<PageNode[]> {
  const all = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        isNull(pages.deletedAt),
        // No projectId → the company wiki (pages not tied to a project).
        projectId ? eq(pages.projectId, projectId) : isNull(pages.projectId),
      ),
    )
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
    .where(and(eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt)))
    .orderBy(asc(pages.title));
}

/** Keyset-paginated pages for the API (newest first, excludes trash). */
export async function getPagesPage(
  workspaceId: string,
  opts: { limit: number; cursor?: { createdAt: string; id: string } | null },
): Promise<{
  items: Pick<Page, "id" | "title" | "icon">[];
  nextCursor: import("@/lib/api/pagination").Cursor | null;
}> {
  const conds = [eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt)];
  if (opts.cursor) {
    const at = new Date(opts.cursor.createdAt);
    conds.push(
      or(
        lt(pages.createdAt, at),
        and(eq(pages.createdAt, at), lt(pages.id, opts.cursor.id)),
      )!,
    );
  }
  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      icon: pages.icon,
      createdAt: pages.createdAt,
    })
    .from(pages)
    .where(and(...conds))
    .orderBy(desc(pages.createdAt), desc(pages.id))
    .limit(opts.limit + 1);

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  const last = hasMore ? page[page.length - 1] : null;
  return {
    items: page.map((p) => ({ id: p.id, title: p.title, icon: p.icon })),
    nextCursor: last
      ? { createdAt: new Date(last.createdAt).toISOString(), id: last.id }
      : null,
  };
}

/** Trashed pages for the workspace, most recently deleted first. */
export async function getTrashedPages(
  workspaceId: string,
): Promise<Pick<Page, "id" | "title" | "icon" | "deletedAt">[]> {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      icon: pages.icon,
      deletedAt: pages.deletedAt,
    })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), isNotNull(pages.deletedAt)))
    .orderBy(desc(pages.deletedAt));
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
              milestone: { columns: { id: true, name: true } },
              assignees: { with: { user: true } },
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
      assignees: l.issue.assignees.map((a) => a.user),
    })),
  };
}

// ---- Cycles ----

export async function getCycles(
  workspaceId: string,
  projectId?: string,
): Promise<CycleWithCount[]> {
  const rows = await db.query.cycles.findMany({
    where: projectId
      ? and(eq(cycles.workspaceId, workspaceId), eq(cycles.projectId, projectId))
      : eq(cycles.workspaceId, workspaceId),
    orderBy: [desc(cycles.startDate)],
    with: {
      issues: { columns: { id: true, status: true } },
      project: { columns: { name: true, color: true } },
    },
  });
  return rows.map((c) => ({
    ...c,
    projectName: c.project?.name ?? "",
    projectColor: c.project?.color ?? "#94a3b8",
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
          milestone: { columns: { id: true, name: true } },
          assignees: { with: { user: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    issues: row.issues.map((i) => ({ ...i, labels: i.labels.map((l) => l.label), assignees: i.assignees.map((a) => a.user) })),
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

// ---- Databases ----

export async function getDatabases(workspaceId: string): Promise<Database[]> {
  return db
    .select()
    .from(databases)
    .where(eq(databases.workspaceId, workspaceId))
    .orderBy(asc(databases.name));
}

export async function getDatabase(
  workspaceId: string,
  id: string,
): Promise<DatabaseWithSchema | null> {
  const row = await db.query.databases.findFirst({
    where: and(eq(databases.workspaceId, workspaceId), eq(databases.id, id)),
    with: {
      fields: { orderBy: [asc(databaseFields.position)] },
      rows: { orderBy: [asc(databaseRows.position)] },
    },
  });
  if (!row) return null;

  // Load any databases referenced by relation fields so the client can render
  // relation chips and compute rollups.
  const targetIds = [
    ...new Set(
      row.fields
        .filter((f) => f.type === "relation" && f.relationDatabaseId)
        .map((f) => f.relationDatabaseId as string),
    ),
  ];

  const related: Record<string, import("@/lib/types").RelatedDatabase> = {};
  if (targetIds.length) {
    const targets = await db.query.databases.findMany({
      where: and(
        eq(databases.workspaceId, workspaceId),
        inArray(databases.id, targetIds),
      ),
      with: {
        fields: { orderBy: [asc(databaseFields.position)] },
        rows: { orderBy: [asc(databaseRows.position)] },
      },
    });
    for (const t of targets) {
      const primary = t.fields.find((f) => f.type === "text") ?? t.fields[0] ?? null;
      related[t.id] = {
        id: t.id,
        name: t.name,
        primaryFieldId: primary?.id ?? null,
        fields: t.fields,
        rows: t.rows,
      };
    }
  }

  return { ...row, related };
}

// ---- Comments & activity timeline ----

export async function getIssueTimeline(
  issueId: string,
): Promise<TimelineItem[]> {
  const me = await getCurrentUser();
  const [cs, as] = await Promise.all([
    db.query.comments.findMany({
      where: eq(comments.issueId, issueId),
      with: { author: true, reactions: true },
    }),
    db.query.activity.findMany({
      where: eq(activity.issueId, issueId),
      with: { actor: true },
    }),
  ]);
  const items: TimelineItem[] = [
    ...cs.map((c) => {
      // Aggregate reactions by emoji, preserving first-seen order.
      const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
      for (const r of c.reactions) {
        const cur = byEmoji.get(r.emoji) ?? { count: 0, reactedByMe: false };
        cur.count += 1;
        if (r.userId === me.id) cur.reactedByMe = true;
        byEmoji.set(r.emoji, cur);
      }
      return {
        kind: "comment" as const,
        id: c.id,
        createdAt: c.createdAt,
        author: c.author,
        body: c.body,
        reactions: [...byEmoji.entries()].map(([emoji, v]) => ({
          emoji,
          count: v.count,
          reactedByMe: v.reactedByMe,
        })),
      };
    }),
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

// ---- Favorites ----

export async function isFavorite(
  workspaceId: string,
  kind: string,
  targetId: string,
): Promise<boolean> {
  const me = await getCurrentUser(workspaceId);
  const [row] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, me.id),
        eq(favorites.kind, kind),
        eq(favorites.targetId, targetId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getFavorites(
  workspaceId: string,
): Promise<import("@/lib/types").FavoriteItem[]> {
  const me = await getCurrentUser(workspaceId);
  const favs = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.workspaceId, workspaceId), eq(favorites.userId, me.id)))
    .orderBy(asc(favorites.createdAt));
  if (favs.length === 0) return [];

  const issueIds = favs.filter((f) => f.kind === "issue").map((f) => f.targetId);
  const pageIds = favs.filter((f) => f.kind === "page").map((f) => f.targetId);
  const projectIds = favs.filter((f) => f.kind === "project").map((f) => f.targetId);

  const [issueRows, pageRows, projectRows] = await Promise.all([
    issueIds.length
      ? db
          .select({
            id: issues.id,
            title: issues.title,
            number: issues.number,
            projectKey: projects.key,
          })
          .from(issues)
          .leftJoin(projects, eq(issues.projectId, projects.id))
          .where(inArray(issues.id, issueIds))
      : Promise.resolve([]),
    pageIds.length
      ? db
          .select({ id: pages.id, title: pages.title, icon: pages.icon, deletedAt: pages.deletedAt })
          .from(pages)
          .where(inArray(pages.id, pageIds))
      : Promise.resolve([]),
    projectIds.length
      ? db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : Promise.resolve([]),
  ]);

  const issueMap = new Map(issueRows.map((r) => [r.id, r]));
  const pageMap = new Map(pageRows.map((r) => [r.id, r]));
  const projectMap = new Map(projectRows.map((r) => [r.id, r]));

  const items: import("@/lib/types").FavoriteItem[] = [];
  for (const f of favs) {
    if (f.kind === "issue") {
      const r = issueMap.get(f.targetId);
      if (!r) continue;
      items.push({
        id: f.id,
        kind: "issue",
        targetId: f.targetId,
        title: r.title,
        icon: r.projectKey ? `${r.projectKey}-${r.number}` : `#${r.number}`,
        href: `/issues/${f.targetId}`,
      });
    } else if (f.kind === "page") {
      const r = pageMap.get(f.targetId);
      if (!r || r.deletedAt) continue;
      items.push({
        id: f.id,
        kind: "page",
        targetId: f.targetId,
        title: r.title || "Untitled",
        icon: r.icon,
        href: `/pages/${f.targetId}`,
      });
    } else if (f.kind === "project") {
      const r = projectMap.get(f.targetId);
      if (!r) continue;
      items.push({
        id: f.id,
        kind: "project",
        targetId: f.targetId,
        title: r.name,
        icon: null,
        href: `/projects/${f.targetId}`,
      });
    }
  }
  return items;
}

// ---- Attachments ----

export async function getAttachments(
  issueId: string,
): Promise<import("@/lib/types").Attachment[]> {
  const rows = await db.query.attachments.findMany({
    where: eq(attachments.issueId, issueId),
    orderBy: [desc(attachments.createdAt)],
    with: { uploader: true },
  });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    contentType: a.contentType,
    size: a.size,
    createdAt: a.createdAt,
    uploader: a.uploader,
  }));
}

// ---- API keys ----

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export async function getApiKeys(workspaceId: string): Promise<ApiKeyRow[]> {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.workspaceId, workspaceId))
    .orderBy(desc(apiKeys.createdAt));
}

// ---- Webhooks ----

export type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastStatus: number | null;
  lastDeliveryAt: Date | null;
  createdAt: Date;
};

export async function getWebhooks(workspaceId: string): Promise<WebhookRow[]> {
  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      active: webhooks.active,
      lastStatus: webhooks.lastStatus,
      lastDeliveryAt: webhooks.lastDeliveryAt,
      createdAt: webhooks.createdAt,
    })
    .from(webhooks)
    .where(eq(webhooks.workspaceId, workspaceId))
    .orderBy(desc(webhooks.createdAt));
  return rows.map((r) => ({ ...r, events: (r.events as string[]) ?? [] }));
}

// ---- Saved views ----

export async function getSavedViews(
  workspaceId: string,
): Promise<import("@/lib/types").SavedView[]> {
  const rows = await db
    .select({ id: savedViews.id, name: savedViews.name, config: savedViews.config })
    .from(savedViews)
    .where(eq(savedViews.workspaceId, workspaceId))
    .orderBy(asc(savedViews.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    config: r.config as import("@/lib/types").SavedViewConfig,
  }));
}

// ---- References / backlinks (the graph) ----

export async function getMentionItems(
  workspaceId: string,
): Promise<import("@/lib/types").MentionItem[]> {
  const [memberRows, issueRows, pageRows, projectRows] = await Promise.all([
    getMembers(workspaceId),
    db
      .select({
        id: issues.id,
        title: issues.title,
        number: issues.number,
        projectKey: projects.key,
      })
      .from(issues)
      .leftJoin(projects, eq(issues.projectId, projects.id))
      .where(eq(issues.workspaceId, workspaceId))
      .orderBy(desc(issues.createdAt))
      .limit(200),
    db
      .select({ id: pages.id, title: pages.title })
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt)))
      .orderBy(asc(pages.title))
      .limit(200),
    db
      .select({ id: projects.id, name: projects.name, key: projects.key })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(asc(projects.name)),
  ]);

  const items: import("@/lib/types").MentionItem[] = [];
  // People first — @ is most often used to tag a teammate.
  for (const r of memberRows) {
    items.push({ kind: "user", id: r.id, label: r.name, hint: "Person" });
  }
  for (const r of issueRows) {
    items.push({
      kind: "issue",
      id: r.id,
      label: r.title,
      hint: r.projectKey ? `${r.projectKey}-${r.number}` : `#${r.number}`,
    });
  }
  for (const r of pageRows) {
    items.push({ kind: "page", id: r.id, label: r.title || "Untitled", hint: "Page" });
  }
  for (const r of projectRows) {
    items.push({ kind: "project", id: r.id, label: r.name, hint: r.key });
  }
  return items;
}

export async function getBacklinks(
  workspaceId: string,
  targetType: string,
  targetId: string,
): Promise<import("@/lib/types").BacklinkItem[]> {
  const rows = await db
    .select({ sourceType: references.sourceType, sourceId: references.sourceId })
    .from(references)
    .where(
      and(
        eq(references.workspaceId, workspaceId),
        eq(references.targetType, targetType),
        eq(references.targetId, targetId),
      ),
    );
  if (rows.length === 0) return [];

  const issueIds = rows.filter((r) => r.sourceType === "issue").map((r) => r.sourceId);
  const pageIds = rows.filter((r) => r.sourceType === "page").map((r) => r.sourceId);

  const [issueRows, pageRows] = await Promise.all([
    issueIds.length
      ? db
          .select({
            id: issues.id,
            title: issues.title,
            number: issues.number,
            projectKey: projects.key,
          })
          .from(issues)
          .leftJoin(projects, eq(issues.projectId, projects.id))
          .where(inArray(issues.id, issueIds))
      : Promise.resolve([]),
    pageIds.length
      ? db
          .select({ id: pages.id, title: pages.title, deletedAt: pages.deletedAt })
          .from(pages)
          .where(inArray(pages.id, pageIds))
      : Promise.resolve([]),
  ]);

  const items: import("@/lib/types").BacklinkItem[] = [];
  for (const r of issueRows) {
    items.push({
      kind: "issue",
      id: r.id,
      title: `${r.projectKey ? `${r.projectKey}-${r.number}` : `#${r.number}`} ${r.title}`,
      href: `/issues/${r.id}`,
    });
  }
  for (const r of pageRows) {
    if (r.deletedAt) continue;
    items.push({ kind: "page", id: r.id, title: r.title || "Untitled", href: `/pages/${r.id}` });
  }
  return items;
}

// ---- Notifications ----

export async function getNotifications(
  workspaceId: string,
): Promise<import("@/lib/types").NotificationItem[]> {
  const me = await getCurrentUser(workspaceId);
  const rows = await db.query.notifications.findMany({
    where: and(
      eq(notifications.workspaceId, workspaceId),
      eq(notifications.userId, me.id),
    ),
    orderBy: [desc(notifications.createdAt)],
    limit: 50,
    with: { actor: true },
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    issueId: n.issueId,
    createdAt: n.createdAt,
    actor: n.actor,
  }));
}

export async function getUnreadCount(workspaceId: string): Promise<number> {
  const me = await getCurrentUser(workspaceId);
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.userId, me.id),
        isNull(notifications.read),
      ),
    );
  return rows.length;
}

// ---- CRM / Sales / Marketing (Project × Department matrix) ----

/**
 * Deals with relations. Pass `projectId` for the project lens (one project's
 * pipeline); omit it for the company-wide Sales lens (all projects).
 */
export async function getDeals(
  workspaceId: string,
  projectId?: string,
): Promise<DealWithRelations[]> {
  const rows = await db.query.deals.findMany({
    where: projectId
      ? and(eq(deals.workspaceId, workspaceId), eq(deals.projectId, projectId))
      : eq(deals.workspaceId, workspaceId),
    orderBy: [asc(deals.sortKey), desc(deals.createdAt)],
    with: { account: true, contact: true, owner: true, project: true },
  });
  return rows;
}

export async function getAccounts(workspaceId: string): Promise<CrmAccount[]> {
  return db
    .select()
    .from(crmAccounts)
    .where(eq(crmAccounts.workspaceId, workspaceId))
    .orderBy(asc(crmAccounts.name));
}

export async function getContacts(
  workspaceId: string,
): Promise<ContactWithAccount[]> {
  return db.query.crmContacts.findMany({
    where: eq(crmContacts.workspaceId, workspaceId),
    orderBy: [asc(crmContacts.name)],
    with: { account: true, owner: true },
  });
}

export async function getAccount(
  workspaceId: string,
  id: string,
): Promise<AccountDetail | null> {
  const row = await db.query.crmAccounts.findFirst({
    where: and(eq(crmAccounts.workspaceId, workspaceId), eq(crmAccounts.id, id)),
    with: {
      owner: true,
      contacts: { orderBy: [asc(crmContacts.name)] },
      deals: { orderBy: [asc(deals.sortKey)] },
    },
  });
  if (!row) return null;
  const activities = await db.query.crmActivities.findMany({
    where: eq(crmActivities.accountId, id),
    orderBy: [desc(crmActivities.createdAt)],
    with: { actor: true },
  });
  return { ...row, activities };
}

/** Campaigns with content counts. Pass `projectId` for the project lens. */
export async function getCampaigns(
  workspaceId: string,
  projectId?: string,
): Promise<CampaignWithRelations[]> {
  const rows = await db.query.campaigns.findMany({
    where: projectId
      ? and(
          eq(campaigns.workspaceId, workspaceId),
          eq(campaigns.projectId, projectId),
        )
      : eq(campaigns.workspaceId, workspaceId),
    orderBy: [desc(campaigns.createdAt)],
    with: { owner: true, project: true, content: { columns: { id: true } } },
  });
  return rows.map(({ content, ...c }) => ({ ...c, contentCount: content.length }));
}

export async function getContentItems(
  workspaceId: string,
  projectId?: string,
): Promise<ContentItemWithCampaign[]> {
  return db.query.contentItems.findMany({
    where: projectId
      ? and(
          eq(contentItems.workspaceId, workspaceId),
          eq(contentItems.projectId, projectId),
        )
      : eq(contentItems.workspaceId, workspaceId),
    orderBy: [asc(contentItems.publishDate), desc(contentItems.createdAt)],
    with: { campaign: true, owner: true },
  });
}

/** Per-project rollup counts for the projects list / hub cards. */
export async function getProjectSummaries(
  workspaceId: string,
): Promise<ProjectSummary[]> {
  const [projects, allDeals, allIssues, allCampaigns, allInvoices, allTickets, allFeatures, allMetrics] =
    await Promise.all([
    getProjects(workspaceId),
    db
      .select({
        projectId: deals.projectId,
        stage: deals.stage,
        value: deals.value,
      })
      .from(deals)
      .where(eq(deals.workspaceId, workspaceId)),
    db
      .select({ projectId: issues.projectId, status: issues.status })
      .from(issues)
      .where(eq(issues.workspaceId, workspaceId)),
    db
      .select({ projectId: campaigns.projectId, status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.workspaceId, workspaceId)),
    db
      .select({ projectId: invoices.projectId, status: invoices.status, amount: invoices.amount })
      .from(invoices)
      .where(eq(invoices.workspaceId, workspaceId)),
    db
      .select({ projectId: tickets.projectId, status: tickets.status })
      .from(tickets)
      .where(eq(tickets.workspaceId, workspaceId)),
    db
      .select({ projectId: features.projectId, status: features.status })
      .from(features)
      .where(eq(features.workspaceId, workspaceId)),
    db
      .select({ projectId: metrics.projectId })
      .from(metrics)
      .where(eq(metrics.workspaceId, workspaceId)),
  ]);

  const openStages = new Set(["lead", "qualified", "proposal", "negotiation"]);
  const openTicketStatuses = new Set(["open", "pending"]);
  const openFeatureStatuses = new Set(["idea", "planned", "building"]);
  return projects
    .filter((p) => p.kind === "project")
    .map((p) => {
    const pDeals = allDeals.filter((d) => d.projectId === p.id);
    const open = pDeals.filter((d) => openStages.has(d.stage));
    return {
      ...p,
      openDeals: open.length,
      pipelineValue: open.reduce((sum, d) => sum + (d.value ?? 0), 0),
      openIssues: allIssues.filter(
        (i) => i.projectId === p.id && i.status !== "done" && i.status !== "canceled",
      ).length,
      activeCampaigns: allCampaigns.filter(
        (c) => c.projectId === p.id && c.status === "active",
      ).length,
      revenue: allInvoices
        .filter((inv) => inv.projectId === p.id && inv.status === "paid")
        .reduce((sum, inv) => sum + (inv.amount ?? 0), 0),
      openTickets: allTickets.filter(
        (t) => t.projectId === p.id && openTicketStatuses.has(t.status),
      ).length,
      openFeatures: allFeatures.filter(
        (f) => f.projectId === p.id && openFeatureStatuses.has(f.status),
      ).length,
      metricCount: allMetrics.filter((m) => m.projectId === p.id).length,
    };
  });
}

/** Invoices with relations. Pass `projectId` for the project lens. */
export async function getInvoices(
  workspaceId: string,
  projectId?: string,
): Promise<InvoiceWithRelations[]> {
  return db.query.invoices.findMany({
    where: projectId
      ? and(eq(invoices.workspaceId, workspaceId), eq(invoices.projectId, projectId))
      : eq(invoices.workspaceId, workspaceId),
    orderBy: [desc(invoices.issueDate), desc(invoices.createdAt)],
    with: { account: true, project: true, owner: true },
  });
}

/** Expenses with relations. Pass `projectId` for the project lens. */
export async function getExpenses(
  workspaceId: string,
  projectId?: string,
): Promise<ExpenseWithRelations[]> {
  return db.query.expenses.findMany({
    where: projectId
      ? and(eq(expenses.workspaceId, workspaceId), eq(expenses.projectId, projectId))
      : eq(expenses.workspaceId, workspaceId),
    orderBy: [desc(expenses.spentDate), desc(expenses.createdAt)],
    with: { project: true, owner: true },
  });
}

/** Support tickets with relations. Pass `projectId` for the project lens. */
export async function getTickets(
  workspaceId: string,
  projectId?: string,
): Promise<TicketWithRelations[]> {
  return db.query.tickets.findMany({
    where: projectId
      ? and(eq(tickets.workspaceId, workspaceId), eq(tickets.projectId, projectId))
      : eq(tickets.workspaceId, workspaceId),
    orderBy: [asc(tickets.sortKey), desc(tickets.createdAt)],
    with: { account: true, contact: true, assignee: true, project: true },
  });
}

/** Features with relations. Pass `projectId` for the project lens. */
export async function getFeatures(
  workspaceId: string,
  projectId?: string,
): Promise<FeatureWithRelations[]> {
  const rows = await db.query.features.findMany({
    where: projectId
      ? and(eq(features.workspaceId, workspaceId), eq(features.projectId, projectId))
      : eq(features.workspaceId, workspaceId),
    orderBy: [asc(features.sortKey), desc(features.createdAt)],
    with: {
      project: true,
      milestone: { columns: { id: true, name: true } },
      owner: true,
      page: { columns: { id: true, title: true, icon: true } },
    },
  });
  if (rows.length === 0) return [];

  // Roll up linked-issue progress per feature in one query (canceled excluded).
  const counts = await db
    .select({ featureId: issues.featureId, status: issues.status })
    .from(issues)
    .where(
      and(
        eq(issues.workspaceId, workspaceId),
        inArray(
          issues.featureId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const byFeature = new Map<string, { done: number; total: number }>();
  for (const c of counts) {
    if (!c.featureId || c.status === "canceled") continue;
    const e = byFeature.get(c.featureId) ?? { done: 0, total: 0 };
    e.total += 1;
    if (c.status === "done") e.done += 1;
    byFeature.set(c.featureId, e);
  }

  return rows.map((r) => {
    const e = byFeature.get(r.id) ?? { done: 0, total: 0 };
    return {
      ...r,
      progress: { done: e.done, total: e.total, pct: e.total ? Math.round((e.done / e.total) * 100) : 0 },
    };
  });
}

/**
 * Milestones (release phases) for a project, each with its feature count and
 * issue-progress rollup (issues under the milestone's features; canceled
 * excluded). Ordered by sort key, then target date.
 */
export async function getMilestones(
  workspaceId: string,
  projectId: string,
): Promise<MilestoneWithProgress[]> {
  const ms = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.workspaceId, workspaceId), eq(milestones.projectId, projectId)))
    .orderBy(asc(milestones.sortKey), asc(milestones.targetDate));
  if (ms.length === 0) return [];

  // Features assigned to these milestones (id → milestoneId).
  const feats = await db
    .select({ id: features.id, milestoneId: features.milestoneId })
    .from(features)
    .where(
      and(
        eq(features.workspaceId, workspaceId),
        inArray(
          features.milestoneId,
          ms.map((m) => m.id),
        ),
      ),
    );
  const milestoneOfFeature = new Map(feats.map((f) => [f.id, f.milestoneId]));
  const featureCount = new Map<string, number>();
  for (const f of feats) {
    if (f.milestoneId) featureCount.set(f.milestoneId, (featureCount.get(f.milestoneId) ?? 0) + 1);
  }

  // Issue progress under those features, attributed up to the milestone.
  const prog = new Map<string, { done: number; total: number }>();
  if (feats.length > 0) {
    const counts = await db
      .select({ featureId: issues.featureId, status: issues.status })
      .from(issues)
      .where(
        and(
          eq(issues.workspaceId, workspaceId),
          inArray(
            issues.featureId,
            feats.map((f) => f.id),
          ),
        ),
      );
    for (const c of counts) {
      const mid = c.featureId ? milestoneOfFeature.get(c.featureId) : null;
      if (!mid || c.status === "canceled") continue;
      const e = prog.get(mid) ?? { done: 0, total: 0 };
      e.total += 1;
      if (c.status === "done") e.done += 1;
      prog.set(mid, e);
    }
  }

  // Tasks attached directly to a milestone (no feature) also count toward it.
  const directCounts = await db
    .select({ milestoneId: issues.milestoneId, status: issues.status })
    .from(issues)
    .where(
      and(
        eq(issues.workspaceId, workspaceId),
        inArray(
          issues.milestoneId,
          ms.map((m) => m.id),
        ),
      ),
    );
  for (const c of directCounts) {
    if (!c.milestoneId || c.status === "canceled") continue;
    const e = prog.get(c.milestoneId) ?? { done: 0, total: 0 };
    e.total += 1;
    if (c.status === "done") e.done += 1;
    prog.set(c.milestoneId, e);
  }

  return ms.map((m) => {
    const e = prog.get(m.id) ?? { done: 0, total: 0 };
    return {
      ...m,
      featureCount: featureCount.get(m.id) ?? 0,
      progress: {
        done: e.done,
        total: e.total,
        pct: e.total ? Math.round((e.done / e.total) * 100) : 0,
      },
    };
  });
}

/** A single milestone with its project and the features assigned to it. */
export async function getMilestone(
  workspaceId: string,
  id: string,
): Promise<MilestoneDetail | null> {
  const row = await db.query.milestones.findFirst({
    where: and(eq(milestones.workspaceId, workspaceId), eq(milestones.id, id)),
    with: { project: true },
  });
  if (!row) return null;

  const featRows = await db.query.features.findMany({
    where: and(eq(features.workspaceId, workspaceId), eq(features.milestoneId, id)),
    orderBy: [asc(features.sortKey), desc(features.createdAt)],
    with: {
      project: true,
      milestone: { columns: { id: true, name: true } },
      owner: true,
      page: { columns: { id: true, title: true, icon: true } },
    },
  });

  // Roll up linked-issue progress per feature (canceled excluded).
  const counts = featRows.length
    ? await db
        .select({ featureId: issues.featureId, status: issues.status })
        .from(issues)
        .where(
          and(
            eq(issues.workspaceId, workspaceId),
            inArray(
              issues.featureId,
              featRows.map((f) => f.id),
            ),
          ),
        )
    : [];
  const byFeature = new Map<string, { done: number; total: number }>();
  for (const c of counts) {
    if (!c.featureId || c.status === "canceled") continue;
    const e = byFeature.get(c.featureId) ?? { done: 0, total: 0 };
    e.total += 1;
    if (c.status === "done") e.done += 1;
    byFeature.set(c.featureId, e);
  }

  let done = 0;
  let total = 0;
  const featuresWithProgress = featRows.map((f) => {
    const e = byFeature.get(f.id) ?? { done: 0, total: 0 };
    done += e.done;
    total += e.total;
    return {
      ...f,
      progress: { done: e.done, total: e.total, pct: e.total ? Math.round((e.done / e.total) * 100) : 0 },
    };
  });

  // Tasks attached straight to the milestone (no feature).
  const directIssueRows = await db.query.issues.findMany({
    where: and(eq(issues.workspaceId, workspaceId), eq(issues.milestoneId, id)),
    orderBy: [asc(issues.sortKey), desc(issues.createdAt)],
    with: {
      project: true,
      cycle: true,
      assignee: true,
      milestone: { columns: { id: true, name: true } },
      labels: { with: { label: true } },
      assignees: { with: { user: true } },
    },
  });
  const directIssues = directIssueRows.map((r) => ({
    ...r,
    labels: r.labels.map((l) => l.label),
    assignees: r.assignees.map((a) => a.user),
  }));
  for (const i of directIssues) {
    if (i.status === "canceled") continue;
    total += 1;
    if (i.status === "done") done += 1;
  }

  return {
    ...row,
    project: row.project ?? null,
    features: featuresWithProgress,
    directIssues,
    featureCount: featuresWithProgress.length,
    progress: { done, total, pct: total ? Math.round((done / total) * 100) : 0 },
  };
}

/** A single feature with its linked issues (for progress rollup). */
export async function getFeature(
  workspaceId: string,
  id: string,
): Promise<import("@/lib/types").FeatureDetail | null> {
  const row = await db.query.features.findFirst({
    where: and(eq(features.workspaceId, workspaceId), eq(features.id, id)),
    with: {
      project: true,
      milestone: { columns: { id: true, name: true } },
      owner: true,
      page: { columns: { id: true, title: true, icon: true } },
      issues: {
        orderBy: [asc(issues.sortKey)],
        with: {
          project: true,
          cycle: true,
          assignee: true,
          labels: { with: { label: true } },
          milestone: { columns: { id: true, name: true } },
          assignees: { with: { user: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    progress: featureProgress(row.issues),
    issues: row.issues.map((i) => ({ ...i, labels: i.labels.map((l) => l.label), assignees: i.assignees.map((a) => a.user) })),
  };
}

/**
 * Metrics with their time-series points (ascending). `latest`/`previous` are
 * the last two points' values for the card delta. Pass `projectId` for the
 * project lens; omit for the company-wide Analytics lens.
 */
export async function getMetrics(
  workspaceId: string,
  projectId?: string,
): Promise<MetricWithRelations[]> {
  const rows = await db.query.metrics.findMany({
    where: projectId
      ? and(eq(metrics.workspaceId, workspaceId), eq(metrics.projectId, projectId))
      : eq(metrics.workspaceId, workspaceId),
    orderBy: [desc(metrics.isNorthStar), asc(metrics.sortKey), desc(metrics.createdAt)],
    with: {
      project: true,
      points: { orderBy: [asc(metricPoints.periodDate)] },
    },
  });
  return rows.map((r) => {
    const n = r.points.length;
    return {
      ...r,
      latest: n > 0 ? r.points[n - 1].value : null,
      previous: n > 1 ? r.points[n - 2].value : null,
    };
  });
}

/**
 * Feedback items. Pass `projectId` for the project lens; omit for the
 * company-wide view. Ordered by votes then recency.
 */
export async function getFeedback(
  workspaceId: string,
  projectId?: string,
): Promise<FeedbackWithRelations[]> {
  return db.query.feedback.findMany({
    where: projectId
      ? and(eq(feedback.workspaceId, workspaceId), eq(feedback.projectId, projectId))
      : eq(feedback.workspaceId, workspaceId),
    orderBy: [desc(feedback.votes), desc(feedback.createdAt)],
    with: {
      project: true,
      feature: { columns: { id: true, title: true } },
    },
  });
}

// Re-export table objects used by actions.
export {
  cycles,
  issues,
  pages,
  projects,
  labels,
  issueLabels,
  issuePageLinks,
  ticketComments,
  tickets,
  workspaces,
};
