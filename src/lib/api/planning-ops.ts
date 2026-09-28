import "server-only";

import { and, eq, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { favorites, features, issues, projects, subscriptions } from "@/db/schema";
import { computeBurndown } from "@/lib/burndown";
import { formatMoney } from "@/lib/matrix-format";
import { docToMarkdown, markdownToDoc } from "@/lib/markdown";
import { audienceFor, notify, subscribe } from "@/lib/notify";
import { computeVelocity } from "@/lib/velocity";
import {
  getCycle,
  getCycles,
  getFeature,
  getMembers,
  getMilestone,
  getMilestones,
  getMilestonesFlat,
  getPageTree,
  getPortfolio,
  getProjectSummaries,
  getProjects,
  getStatusUpdates,
} from "@/lib/data";
import type { CycleWithCount, PageNode, Project } from "@/lib/types";

import type { ApiAuth } from "./auth";
import { featureDto, issueDto, milestoneDto } from "./dto";
import { ApiInputError } from "./errors";
import { apiInvalidate } from "./invalidate";
import { apiCreateProject } from "./ops";
import { apiCreateStatusUpdate } from "./dept-ops";
import {
  activeCycle,
  currentMilestone,
  cyclePoints,
  cycleState,
  departmentsForCaller,
  healthOf,
  progressOf,
  type DepartmentView,
} from "./planning";
import { apiUpdateRecord, writableFields } from "./records";
import { assertProjectVisible, assertRecordAccess, canSeeFinance, canSeeSales, visibleRows } from "./scope";

const ref = (m: { id: string; name: string } | null | undefined) => (m ? { id: m.id, name: m.name } : null);

async function memberRef(workspaceId: string) {
  const members = await getMembers(workspaceId);
  const byId = new Map(members.map((m) => [m.id, m]));
  return (id: string | null | undefined) => ref(id ? byId.get(id) : null);
}

function cycleRow(c: CycleWithCount, now: Date) {
  return {
    id: c.id,
    name: c.name,
    number: c.number,
    startDate: c.startDate,
    endDate: c.endDate,
    projectId: c.projectId,
    project: { id: c.projectId, name: c.projectName, color: c.projectColor },
    state: cycleState(c, now),
    issueCount: c.issueCount,
    doneCount: c.doneCount,
    progress: progressOf(c.doneCount, c.issueCount),
    points: cyclePoints(c.issues),
  };
}

type Summary = Awaited<ReturnType<typeof getProjectSummaries>>[number];

/**
 * What each department card on a project's overview says, in the web's words.
 * Only the departments this caller may open are described.
 */
function departmentCards(depts: DepartmentView[], s: Summary | undefined, auth: ApiAuth, projectId: string) {
  const tasks = (slug: string) => s?.openIssuesByDepartment[slug] ?? 0;
  const withTasks = (slug: string, stat: string) => (tasks(slug) > 0 ? `${tasks(slug)} tasks · ${stat}` : stat);
  const stat: Record<string, () => string> = {
    product: () => withTasks("product", `${s?.openMilestones ?? 0} open gates`),
    engineering: () => `${tasks("engineering")} open tasks`,
    analytics: () => `${s?.metricCount ?? 0} metrics`,
    marketing: () => withTasks("marketing", `${s?.activeCampaigns ?? 0} active campaigns`),
    sales: () => (canSeeSales(auth.scope) ? withTasks("sales", `${formatMoney(s?.pipelineValue)} · ${s?.openDeals ?? 0} open deals`) : ""),
    "customer-success": () => withTasks("customer-success", `${s?.openTickets ?? 0} open tickets`),
    finance: () => (canSeeFinance(auth.scope, projectId) ? `${formatMoney(s?.revenue)} revenue` : ""),
    strategy: () => "Vision, stages and economics",
  };
  return depts.map((d) => ({ ...d, stat: stat[d.slug]?.() ?? "" }));
}

async function findProject(auth: ApiAuth, id: string): Promise<Project> {
  assertProjectVisible(auth, id, "Project");
  const project = (await getProjects(auth.workspaceId)).find((p) => p.id === id);
  if (!project) throw new ApiInputError("Project not found.", 404);
  return project;
}

async function followState(auth: ApiAuth, kind: string, targetId: string) {
  if (!auth.userId) return { watching: false, favorite: false };
  const [sub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, auth.userId), eq(subscriptions.kind, kind), eq(subscriptions.targetId, targetId)))
    .limit(1);
  const [fav] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, auth.userId), eq(favorites.kind, kind), eq(favorites.targetId, targetId)))
    .limit(1);
  return { watching: Boolean(sub), favorite: Boolean(fav) };
}

/** GET /projects/{id}: everything the project overview needs in one read. */
export async function apiProjectDetail(auth: ApiAuth, id: string) {
  const project = await findProject(auth, id);
  const now = new Date();
  const [person, updates, milestones, portfolio, summaries, cycles, follow] = await Promise.all([
    memberRef(auth.workspaceId),
    getStatusUpdates(auth.workspaceId, id),
    getMilestones(auth.workspaceId, id),
    getPortfolio(auth.workspaceId),
    getProjectSummaries(auth.workspaceId),
    getCycles(auth.workspaceId, id),
    followState(auth, "project", id),
  ]);
  const row = portfolio.find((p) => p.id === id);
  const ms = project.kind === "project" ? currentMilestone(milestones, now) : null;
  const cycle = activeCycle(cycles, now);
  const depts = departmentsForCaller(project, { scope: auth.scope, userId: auth.userId });
  const latest = updates[0];
  return {
    id: project.id,
    name: project.name,
    key: project.key,
    kind: project.kind,
    confidential: project.confidential,
    color: project.color,
    description: project.description,
    tagline: project.tagline,
    url: project.url,
    startDate: project.startDate,
    targetDate: project.targetDate,
    ownerId: project.ownerId,
    owner: person(project.ownerId),
    strategistId: project.strategistId,
    strategist: person(project.strategistId),
    enabledDepartments: project.enabledDepartments,
    visibleDepartments: departmentCards(depts, summaries.find((s) => s.id === id), auth, id),
    cycleCadence: project.cycleCadence,
    health: healthOf(latest?.health),
    latestStatusUpdate: latest ? statusUpdateDto(latest) : null,
    statusUpdates: updates.slice(0, 20).map(statusUpdateDto),
    currentMilestone: ms ? milestoneDto(ms) : null,
    openMilestones: milestones.filter((m) => ["planned", "on_track", "at_risk", "off_track"].includes(m.status)).length,
    progress: progressOf(row?.doneIssues ?? 0, row?.totalIssues ?? 0),
    activeCycle: cycle ? cycleRow(cycle, now) : null,
    canEditOwner: !auth.scope.restricted,
    ...follow,
  };
}

function statusUpdateDto(u: Awaited<ReturnType<typeof getStatusUpdates>>[number]) {
  return { id: u.id, health: u.health, body: u.body, createdAt: u.createdAt, author: ref(u.author) };
}

/**
 * GET /projects/summaries: the projects list, timeline and "this week" in one
 * read — every project and operation the caller may see, with health, the
 * milestone it is working towards, progress and its running cycle.
 */
export async function apiProjectSummaries(auth: ApiAuth) {
  const now = new Date();
  const [all, portfolio, summaries, milestones, cycles, person] = await Promise.all([
    getProjects(auth.workspaceId),
    getPortfolio(auth.workspaceId),
    getProjectSummaries(auth.workspaceId),
    getMilestonesFlat(auth.workspaceId),
    getCycles(auth.workspaceId),
    memberRef(auth.workspaceId),
  ]);
  const visible = visibleRows(auth, all, (p) => p.id);
  return visible.map((p) => {
    const row = portfolio.find((r) => r.id === p.id);
    const s = summaries.find((r) => r.id === p.id);
    const ms = p.kind === "project" ? currentMilestone(milestones.filter((m) => m.projectId === p.id), now) : null;
    const cycle = activeCycle(cycles.filter((c) => c.projectId === p.id), now);
    const sales = canSeeSales(auth.scope);
    const finance = canSeeFinance(auth.scope, p.id);
    return {
      id: p.id,
      name: p.name,
      key: p.key,
      kind: p.kind,
      confidential: p.confidential,
      color: p.color,
      description: p.description,
      tagline: p.tagline,
      url: p.url,
      startDate: p.startDate,
      targetDate: p.targetDate,
      ownerId: p.ownerId,
      owner: person(p.ownerId),
      health: row?.health ?? "none",
      currentMilestone: ms ? { id: ms.id, name: ms.name, status: ms.status, targetDate: ms.targetDate } : null,
      progress: progressOf(row?.doneIssues ?? 0, row?.totalIssues ?? 0),
      openIssues: s?.openIssues ?? Math.max(0, (row?.totalIssues ?? 0) - (row?.doneIssues ?? 0)),
      openMilestones: s?.openMilestones ?? 0,
      activeCampaigns: s?.activeCampaigns ?? 0,
      openTickets: s?.openTickets ?? 0,
      metricCount: s?.metricCount ?? 0,
      openDeals: sales ? (s?.openDeals ?? 0) : null,
      pipelineValue: sales ? (s?.pipelineValue ?? 0) : null,
      revenue: finance ? (s?.revenue ?? 0) : null,
      visibleDepartments: departmentsForCaller(p, { scope: auth.scope, userId: auth.userId }),
      activeCycle: cycle ? cycleRow(cycle, now) : null,
    };
  });
}

/** Points of unfinished work in a project, weighted as velocity weighs them. */
async function outstandingPoints(workspaceId: string, projectId: string): Promise<number> {
  const [row] = await db
    .select({ points: sql<number>`coalesce(sum(coalesce(${issues.estimate}, 1)), 0)::int` })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.projectId, projectId), notInArray(issues.status, ["done", "canceled"])));
  return row?.points ?? 0;
}

/** GET /cycles[?project=]: cycles the caller may see, with counts, and velocity for one project. */
export async function apiCycleList(auth: ApiAuth, projectId: string | null) {
  if (projectId) assertProjectVisible(auth, projectId, "Project");
  const now = new Date();
  const rows = visibleRows(auth, await getCycles(auth.workspaceId, projectId ?? undefined), (c) => c.projectId);
  const velocity = projectId
    ? computeVelocity({
        cycles: rows.map((c) => ({ id: c.id, name: c.name, endDate: c.endDate, issues: c.issues })),
        outstandingPoints: await outstandingPoints(auth.workspaceId, projectId),
        now,
      })
    : null;
  return { data: rows.map((c) => cycleRow(c, now)), velocity };
}

/** GET /cycles/{id}: dates, progress and the estimate-weighted burndown. */
export async function apiCycleDetail(auth: ApiAuth, id: string) {
  const cycle = await getCycle(auth.workspaceId, id);
  if (!cycle) throw new ApiInputError("Cycle not found.", 404);
  assertProjectVisible(auth, cycle.projectId, "Cycle");
  const now = new Date();
  const project = (await getProjects(auth.workspaceId)).find((p) => p.id === cycle.projectId);
  const burndown = computeBurndown({
    issues: cycle.issues.map((i) => ({ id: i.id, estimate: i.estimate, createdAt: i.createdAt })),
    doneEvents: cycle.doneEvents,
    start: cycle.startDate,
    end: cycle.endDate,
    now,
  });
  const counted = cycle.issues.filter((i) => i.status !== "canceled");
  const byStatus: Record<string, number> = {};
  for (const i of cycle.issues) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
  return {
    id: cycle.id,
    name: cycle.name,
    number: cycle.number,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    projectId: cycle.projectId,
    project: project ? { id: project.id, name: project.name, key: project.key, color: project.color } : null,
    state: cycleState(cycle, now),
    issueCount: cycle.issues.length,
    doneCount: cycle.issues.filter((i) => i.status === "done").length,
    progress: progressOf(counted.filter((i) => i.status === "done").length, counted.length),
    points: cyclePoints(cycle.issues),
    byStatus,
    burndown,
  };
}

/** GET /milestones/{id}: the gate, its features and the tasks attached straight to it. */
export async function apiMilestoneDetail(auth: ApiAuth, id: string) {
  const m = await getMilestone(auth.workspaceId, id);
  if (!m) throw new ApiInputError("Milestone not found.", 404);
  assertProjectVisible(auth, m.projectId, "Milestone");
  return {
    ...milestoneDto(m),
    sortKey: m.sortKey,
    project: m.project ? { id: m.project.id, name: m.project.name, key: m.project.key, color: m.project.color } : null,
    features: m.features.map(featureDto),
    issues: m.directIssues.map(issueDto),
  };
}

/** GET /features/{id}: the feature with its PRD as Markdown and its linked tasks. */
export async function apiFeatureDetail(auth: ApiAuth, id: string) {
  const f = await getFeature(auth.workspaceId, id);
  if (!f) throw new ApiInputError("Feature not found.", 404);
  assertProjectVisible(auth, f.projectId, "Feature");
  return {
    ...featureDto(f),
    project: f.project ? { id: f.project.id, name: f.project.name, key: f.project.key, color: f.project.color } : null,
    page: f.page ? { id: f.page.id, title: f.page.title, icon: f.page.icon } : null,
    spec: docToMarkdown(f.spec),
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    issues: f.issues.map(issueDto),
  };
}

/**
 * PATCH /features/{id}: the generic writable fields, plus `spec` as Markdown —
 * converted to the editor's TipTap JSON the same way a page's content is.
 */
export async function apiUpdateFeature(auth: ApiAuth, id: string, patch: Record<string, unknown>): Promise<boolean> {
  await assertRecordAccess(auth, "features", id);
  const { spec, ...rest } = patch;
  if (spec !== undefined && spec !== null && typeof spec !== "string") throw new ApiInputError("`spec` must be Markdown text.");
  const generic = Object.fromEntries(Object.entries(rest).filter(([k]) => writableFields("features").includes(k)));
  if (typeof generic.projectId === "string") assertProjectVisible(auth, generic.projectId, "Project");
  if (spec === undefined && Object.keys(generic).length === 0)
    throw new ApiInputError(`No writable fields in the patch. Writable: ${[...writableFields("features"), "spec"].join(", ")}.`);

  if (Object.keys(generic).length > 0) {
    let updated: boolean;
    try {
      updated = await apiUpdateRecord("features", auth.workspaceId, id, generic);
    } catch (err) {
      throw new ApiInputError(err instanceof Error ? err.message : "Invalid value.");
    }
    if (!updated) return false;
  }
  if (spec !== undefined) {
    const res = await db
      .update(features)
      .set({ spec: spec ? markdownToDoc(spec) : null, updatedAt: new Date() })
      .where(and(eq(features.workspaceId, auth.workspaceId), eq(features.id, id)))
      .returning({ id: features.id });
    if (res.length === 0) return false;
    apiInvalidate(auth.workspaceId, "features");
  }
  return true;
}

/**
 * POST /projects: the plain create, plus the web's `kind` (project or
 * operation) and owner. A member may only name themselves as owner — the owner
 * decides who sees the project's Finance.
 */
export async function apiCreateProjectFull(
  auth: ApiAuth,
  body: { name?: string; key?: string; description?: string; kind?: string; ownerId?: string | null },
): Promise<string> {
  if (!body.name?.trim()) throw new ApiInputError("`name` is required.");
  if (body.kind !== undefined && body.kind !== "project" && body.kind !== "operation")
    throw new ApiInputError("`kind` must be one of: project, operation.");
  if (body.ownerId && auth.scope.restricted && body.ownerId !== auth.userId)
    throw new ApiInputError("Only workspace admins can make someone else a project's owner.", 403);
  if (body.ownerId && !(await getMembers(auth.workspaceId)).some((m) => m.id === body.ownerId))
    throw new ApiInputError("`ownerId`: no such member in this workspace.");
  const id = await apiCreateProject(auth.workspaceId, { name: body.name, key: body.key, description: body.description });
  const values: Partial<typeof projects.$inferInsert> = {};
  if (body.kind) values.kind = body.kind;
  if (body.ownerId) values.ownerId = body.ownerId;
  if (Object.keys(values).length > 0) {
    await db.update(projects).set(values).where(and(eq(projects.workspaceId, auth.workspaceId), eq(projects.id, id)));
    apiInvalidate(auth.workspaceId, "projects");
  }
  return id;
}

/**
 * POST /projects/{id}/status-updates: post a health update the way the web
 * does — the poster starts following the project, and everyone following it
 * hears about the update in their inbox.
 */
export async function apiPostStatusUpdate(auth: ApiAuth, projectId: string, body: { health?: string; body?: string }) {
  const project = await findProject(auth, projectId);
  const health = body.health ?? "on_track";
  if (!["on_track", "at_risk", "off_track"].includes(health))
    throw new ApiInputError("`health` must be one of: on_track, at_risk, off_track.");
  const text = (body.body ?? "").trim();
  const id = await apiCreateStatusUpdate(auth.workspaceId, auth.userId, { projectId, health, body: text });
  if (auth.userId) {
    const target = { kind: "project" as const, id: projectId };
    await subscribe(auth.workspaceId, auth.userId, "project", projectId);
    const me = (await getMembers(auth.workspaceId)).find((m) => m.id === auth.userId);
    await notify({
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      type: "status",
      target,
      userIds: await audienceFor(auth.workspaceId, target, auth.userId),
      title: `${me?.name ?? "Someone"} posted a ${health.replace("_", " ")} update on ${project.name}`,
      body: text.slice(0, 140),
    });
  }
  return id;
}

/**
 * GET /projects/{id}/pages: the project's Docs as the web shows them — the page
 * tree in the editor's order, flattened with a depth for each row.
 */
export async function apiProjectPages(auth: ApiAuth, projectId: string) {
  await findProject(auth, projectId);
  const tree = await getPageTree(auth.workspaceId, projectId);
  const out: { id: string; title: string; icon: string; parentId: string | null; depth: number; childCount: number; updatedAt: Date }[] = [];
  const walk = (nodes: PageNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ id: n.id, title: n.title, icon: n.icon, parentId: n.parentId, depth, childCount: n.children.length, updatedAt: n.updatedAt });
      walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}
