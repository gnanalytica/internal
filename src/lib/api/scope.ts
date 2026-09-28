import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  attachments,
  campaigns,
  comments,
  contentItems,
  crmActivities,
  deals,
  expenses,
  feedback,
  features,
  invoices,
  issueRelations,
  issues,
  metrics,
  milestones,
  pageComments,
  pages,
  projectStatusUpdates,
  projects,
  tickets,
} from "@/db/schema";

import type { ApiAuth } from "./auth";
import { ApiInputError } from "./errors";
import { canSeeFinance, canSeeProject, canSeeSales, UNRESTRICTED, type ApiScope } from "./scope-rules";
import type { ResourceName } from "./records";

/**
 * What a caller may see, mirroring the web app's rules for members:
 *
 * - confidential projects (the Finance and People & HR operations) are hidden
 *   entirely, and so is everything inside them;
 * - Sales (deals and the deal activity log) is for admins;
 * - Finance (invoices, expenses) is for admins and each project's own owner.
 *
 * Until the mobile app, every API key was made by an admin, so the API never
 * needed these rules. A member signing in on their phone gets a key that acts
 * as them, and must not see through the API what the web hides from them.
 * Admins, and Settings-made integration keys, are unrestricted exactly as before.
 */
export { canSeeFinance, canSeeProject, canSeeSales, UNRESTRICTED, type ApiScope } from "./scope-rules";

export async function loadScope(workspaceId: string, userId: string | null, isAdmin: boolean): Promise<ApiScope> {
  if (isAdmin) return UNRESTRICTED;
  const rows = await db
    .select({ id: projects.id, confidential: projects.confidential, ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));
  return {
    restricted: true,
    hiddenProjectIds: new Set(rows.filter((p) => p.confidential).map((p) => p.id)),
    ownedProjectIds: new Set(rows.filter((p) => userId && p.ownerId === userId).map((p) => p.id)),
  };
}

/** Keep the rows whose project the caller may see. */
export function visibleRows<T>(auth: ApiAuth, rows: T[], projectOf: (row: T) => string | null | undefined): T[] {
  return auth.scope.restricted ? rows.filter((r) => canSeeProject(auth.scope, projectOf(r))) : rows;
}

/** A project the caller may not see does not exist, as far as they are told. */
export function assertProjectVisible(auth: ApiAuth, projectId: string | null | undefined, what = "Resource"): void {
  if (!canSeeProject(auth.scope, projectId)) throw new ApiInputError(`${what} not found.`, 404);
}

export function assertSales(auth: ApiAuth): void {
  if (!canSeeSales(auth.scope)) throw new ApiInputError("Sales is only available to workspace admins.", 403);
}

export function assertFinance(auth: ApiAuth, projectId: string | null | undefined): void {
  if (!canSeeFinance(auth.scope, projectId))
    throw new ApiInputError("Finance is only available to workspace admins and the project's owner.", 403);
}

/** The project an issue belongs to, or undefined when there is no such issue. */
export async function issueProject(workspaceId: string, issueId: string): Promise<string | null | undefined> {
  const [row] = await db
    .select({ projectId: issues.projectId })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
    .limit(1);
  return row ? row.projectId : undefined;
}

export async function pageProject(workspaceId: string, pageId: string): Promise<string | null | undefined> {
  const [row] = await db
    .select({ projectId: pages.projectId })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, pageId)))
    .limit(1);
  return row ? row.projectId : undefined;
}

export async function assertIssueVisible(auth: ApiAuth, issueId: string): Promise<void> {
  if (!auth.scope.restricted) return;
  assertProjectVisible(auth, await issueProject(auth.workspaceId, issueId), "Issue");
}

export async function assertPageVisible(auth: ApiAuth, pageId: string): Promise<void> {
  if (!auth.scope.restricted) return;
  assertProjectVisible(auth, await pageProject(auth.workspaceId, pageId), "Page");
}

type ProjectLookup = (workspaceId: string, id: string) => Promise<string | null | undefined>;

function byProjectColumn(table: typeof milestones | typeof features | typeof metrics | typeof feedback | typeof campaigns | typeof contentItems | typeof tickets | typeof projectStatusUpdates | typeof invoices | typeof expenses | typeof deals | typeof crmActivities): ProjectLookup {
  return async (workspaceId, id) => {
    const t = table as unknown as typeof milestones;
    const [row] = await db
      .select({ projectId: t.projectId })
      .from(t)
      .where(and(eq(t.workspaceId, workspaceId), eq(t.id, id)))
      .limit(1);
    return row ? row.projectId : undefined;
  };
}

/**
 * How the generic record routes decide access for a restricted caller, per
 * resource. "sales" and "finance" follow those rules; "project" hides records
 * of confidential projects; "none" leaves the resource as the web does.
 */
const POLICY: Partial<Record<ResourceName, { rule: "sales" | "finance" | "project" | "salesWrite"; lookup?: ProjectLookup }>> = {
  deals: { rule: "sales", lookup: byProjectColumn(deals) },
  activities: { rule: "sales", lookup: byProjectColumn(crmActivities) },
  accounts: { rule: "salesWrite" },
  contacts: { rule: "salesWrite" },
  invoices: { rule: "finance", lookup: byProjectColumn(invoices) },
  expenses: { rule: "finance", lookup: byProjectColumn(expenses) },
  milestones: { rule: "project", lookup: byProjectColumn(milestones) },
  features: { rule: "project", lookup: byProjectColumn(features) },
  metrics: { rule: "project", lookup: byProjectColumn(metrics) },
  feedback: { rule: "project", lookup: byProjectColumn(feedback) },
  campaigns: { rule: "project", lookup: byProjectColumn(campaigns) },
  content: { rule: "project", lookup: byProjectColumn(contentItems) },
  tickets: { rule: "project", lookup: byProjectColumn(tickets) },
  "status-updates": { rule: "project", lookup: byProjectColumn(projectStatusUpdates) },
  projects: { rule: "project", lookup: async (_ws, id) => id },
  attachments: {
    rule: "project",
    lookup: async (workspaceId, id) => {
      const [row] = await db
        .select({ issueId: attachments.issueId })
        .from(attachments)
        .where(and(eq(attachments.workspaceId, workspaceId), eq(attachments.id, id)))
        .limit(1);
      return row ? issueProject(workspaceId, row.issueId) : undefined;
    },
  },
  "page-comments": {
    rule: "project",
    lookup: async (workspaceId, id) => {
      const [row] = await db
        .select({ pageId: pageComments.pageId })
        .from(pageComments)
        .where(and(eq(pageComments.workspaceId, workspaceId), eq(pageComments.id, id)))
        .limit(1);
      return row ? pageProject(workspaceId, row.pageId) : undefined;
    },
  },
};

/** Throws when a restricted caller may not read or change this record. */
export async function assertRecordAccess(auth: ApiAuth, name: ResourceName, id: string): Promise<void> {
  if (!auth.scope.restricted) return;
  const policy = POLICY[name];
  if (!policy) return;
  if (policy.rule === "sales" || policy.rule === "salesWrite") return assertSales(auth);
  const projectId = policy.lookup ? await policy.lookup(auth.workspaceId, id) : null;
  if (projectId === undefined) return; // no such record: the route answers 404 itself
  if (policy.rule === "finance") return assertFinance(auth, projectId);
  assertProjectVisible(auth, projectId);
}

/** The pre-scope name, kept for the generic record routes. */
export const assertRecordWritable = assertRecordAccess;

export async function assertCommentVisible(auth: ApiAuth, commentId: string): Promise<void> {
  if (!auth.scope.restricted) return;
  const [row] = await db
    .select({ issueId: comments.issueId })
    .from(comments)
    .where(and(eq(comments.workspaceId, auth.workspaceId), eq(comments.id, commentId)))
    .limit(1);
  if (row) await assertIssueVisible(auth, row.issueId);
}

export async function assertRelationVisible(auth: ApiAuth, relationId: string): Promise<void> {
  if (!auth.scope.restricted) return;
  const [row] = await db
    .select({ issueId: issueRelations.issueId })
    .from(issueRelations)
    .where(and(eq(issueRelations.workspaceId, auth.workspaceId), eq(issueRelations.id, relationId)))
    .limit(1);
  if (row) await assertIssueVisible(auth, row.issueId);
}
