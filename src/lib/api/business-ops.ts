import "server-only";

import { and, eq, gte, max } from "drizzle-orm";

import { db } from "@/db";
import { deals, issues, milestones, projects, tickets } from "@/db/schema";
import { apiInvalidate } from "@/lib/api/invalidate";
import { isDepartmentEnabled, type DepartmentSlug } from "@/lib/departments";
import type { PricingModel } from "@/lib/pricing";
import { applyStrategyOp, type StrategyModel, type StrategyOp } from "@/lib/strategy";
import type { DeriveCtx } from "@/lib/strategy-derive";
import { ticketToIssueFields } from "@/lib/ticket-to-issue";

import { ApiInputError } from "./errors";
import { buildStrategyView, type StrategyView } from "./strategy-view";

/**
 * The per-project business departments (Sales, Customer Success, Marketing,
 * Finance, Strategy) for the REST API: what the web's server actions and
 * department pages do, keyed on the API caller's workspace and user instead of
 * the session cookie. Visibility is the route's job (see scope.ts).
 */

export type ProjectMeta = {
  id: string;
  name: string;
  key: string;
  ownerId: string | null;
  enabledDepartments: string[] | null;
  pricingModel: PricingModel | null;
  strategyModel: StrategyModel | null;
};

export async function loadProjectMeta(workspaceId: string, projectId: string): Promise<ProjectMeta> {
  const [row] = await db
    .select({
      id: projects.id,
      name: projects.name,
      key: projects.key,
      ownerId: projects.ownerId,
      enabledDepartments: projects.enabledDepartments,
      pricingModel: projects.pricingModel,
      strategyModel: projects.strategyModel,
    })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
    .limit(1);
  if (!row) throw new ApiInputError("Project not found.", 404);
  return row as ProjectMeta;
}

export const departmentOn = (p: ProjectMeta, slug: DepartmentSlug) => isDepartmentEnabled(p.enabledDepartments, slug);

/** The product's own currency, which the web's Finance page opens in. */
export const projectCurrency = (p: Pick<ProjectMeta, "pricingModel">): string => p.pricingModel?.currency ?? "INR";

// ---- Customer Success: a ticket becomes a task ----

/**
 * Mirrors `convertTicketToIssue` in lib/actions.ts: idempotent (a ticket that
 * already has a task returns it), numbered within the ticket's project, and the
 * ticket is linked back to the task it became.
 */
export async function apiConvertTicketToIssue(
  workspaceId: string,
  userId: string | null,
  ticketId: string,
): Promise<{ issueId: string; created: boolean }> {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.id, ticketId)))
    .limit(1);
  if (!ticket) throw new ApiInputError("Ticket not found.", 404);

  if (ticket.issueId) {
    const [existing] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, ticket.issueId)))
      .limit(1);
    if (existing) return { issueId: existing.id, created: false };
  }

  const [{ value: maxNumber }] = await db
    .select({ value: max(issues.number) })
    .from(issues)
    .where(
      ticket.projectId
        ? and(eq(issues.workspaceId, workspaceId), eq(issues.projectId, ticket.projectId))
        : eq(issues.workspaceId, workspaceId),
    );

  const [created] = await db
    .insert(issues)
    .values({
      workspaceId,
      number: (maxNumber ?? 0) + 1,
      creatorId: userId,
      sortKey: `a${Date.now()}`,
      ...ticketToIssueFields(ticket),
    })
    .returning({ id: issues.id });

  await db
    .update(tickets)
    .set({ issueId: created.id, updatedAt: new Date() })
    .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.id, ticketId)));

  apiInvalidate(workspaceId, "issues", "tickets");
  return { issueId: created.id, created: true };
}

// ---- Strategy ----

function quarterStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
}

/** The same derivation context the web's strategy page assembles. */
async function strategyContext(project: ProjectMeta): Promise<DeriveCtx> {
  const [msRows, issueRows, wonRows] = await Promise.all([
    db.select({ id: milestones.id, name: milestones.name }).from(milestones).where(eq(milestones.projectId, project.id)),
    db.select({ milestoneId: issues.milestoneId, status: issues.status }).from(issues).where(eq(issues.projectId, project.id)),
    db
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.projectId, project.id), eq(deals.stage, "won"), gte(deals.updatedAt, quarterStart()))),
  ]);
  return {
    pricingModel: project.pricingModel,
    milestones: msRows.map((m) => {
      const rows = issueRows.filter((i) => i.milestoneId === m.id);
      return { id: m.id, name: m.name, total: rows.length, closed: rows.filter((i) => i.status === "done").length };
    }),
    dealsWonThisQuarter: wonRows.length,
  };
}

export type StrategyPayload = {
  project: { id: string; name: string; key: string };
  enabled: boolean;
  milestones: DeriveCtx["milestones"];
  view: StrategyView | null;
};

export async function apiGetStrategy(project: ProjectMeta): Promise<StrategyPayload> {
  const base = { project: { id: project.id, name: project.name, key: project.key } };
  if (!departmentOn(project, "strategy")) return { ...base, enabled: false, milestones: [], view: null };
  const ctx = await strategyContext(project);
  return {
    ...base,
    enabled: true,
    milestones: ctx.milestones,
    view: project.strategyModel ? buildStrategyView(project.strategyModel, ctx) : null,
  };
}

/** Mirrors `applyStrategyOpAction`: the project must exist and have Strategy on. */
export async function apiApplyStrategyOp(workspaceId: string, project: ProjectMeta, op: StrategyOp): Promise<StrategyPayload> {
  if (!departmentOn(project, "strategy")) throw new ApiInputError("Strategy isn't turned on for this project.", 409);
  const next = applyStrategyOp(project.strategyModel, op);
  await db
    .update(projects)
    .set({ strategyModel: next })
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, project.id)));
  apiInvalidate(workspaceId, "projects");
  return apiGetStrategy({ ...project, strategyModel: next });
}
