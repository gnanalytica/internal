import "server-only";

import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { entityCurrency, formatCurrency } from "@/lib/currency";
import {
  crmAccounts,
  crmContacts,
  cycles,
  databases,
  deals,
  features,
  issues,
  milestones,
  pages,
  projects,
  tickets,
} from "@/db/schema";

import type { ApiScope } from "./scope-rules";
import {
  fields,
  humanize,
  isoDay,
  subtitle,
  visibleHits,
  webPath,
  type SearchHit,
  type SearchType,
} from "./search-rules";

const LIMIT = 10;

/**
 * Global search for the API (and the mobile app's Search screen).
 *
 * Every hit names its owning project when it has one, so a client can open it
 * in context, and carries a few facts so a record without its own detail
 * screen can still be shown. Visibility is applied after the query, the same
 * rule every other endpoint uses: a member never sees what sits inside a
 * confidential project, nor deals.
 */
export async function searchForApi(workspaceId: string, query: string, scope: ApiScope): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const term = `%${q}%`;
  const base = process.env.NEXT_PUBLIC_APP_URL || "";

  const [projectRows, issueRows, pageRows, databaseRows, cycleRows, milestoneRows, featureRows, ticketRows, dealRows, accountRows, contactRows] =
    await Promise.all([
      db
        .select({ id: projects.id, name: projects.name, key: projects.key, kind: projects.kind })
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId)),
      db
        .select({ id: issues.id, title: issues.title, projectId: issues.projectId, number: issues.number, status: issues.status })
        .from(issues)
        .where(and(eq(issues.workspaceId, workspaceId), ilike(issues.title, term)))
        .orderBy(desc(issues.createdAt))
        .limit(LIMIT),
      db
        .select({ id: pages.id, title: pages.title, icon: pages.icon, projectId: pages.projectId })
        .from(pages)
        .where(and(eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt), or(ilike(pages.title, term), ilike(pages.contentText, term))))
        .limit(LIMIT),
      db
        .select({ id: databases.id, name: databases.name, icon: databases.icon })
        .from(databases)
        .where(and(eq(databases.workspaceId, workspaceId), ilike(databases.name, term)))
        .limit(LIMIT),
      db
        .select({ id: cycles.id, name: cycles.name, number: cycles.number, projectId: cycles.projectId, startDate: cycles.startDate, endDate: cycles.endDate })
        .from(cycles)
        .where(and(eq(cycles.workspaceId, workspaceId), ilike(cycles.name, term)))
        .orderBy(desc(cycles.startDate))
        .limit(LIMIT),
      db
        .select({ id: milestones.id, name: milestones.name, projectId: milestones.projectId, status: milestones.status, targetDate: milestones.targetDate })
        .from(milestones)
        .where(and(eq(milestones.workspaceId, workspaceId), ilike(milestones.name, term)))
        .limit(LIMIT),
      db
        .select({ id: features.id, title: features.title, projectId: features.projectId, status: features.status, targetDate: features.targetDate })
        .from(features)
        .where(and(eq(features.workspaceId, workspaceId), ilike(features.title, term)))
        .limit(LIMIT),
      db
        .select({ id: tickets.id, subject: tickets.subject, projectId: tickets.projectId, status: tickets.status, priority: tickets.priority, requesterEmail: tickets.requesterEmail })
        .from(tickets)
        .where(and(eq(tickets.workspaceId, workspaceId), ilike(tickets.subject, term)))
        .limit(LIMIT),
      db
        .select({ id: deals.id, name: deals.name, projectId: deals.projectId, stage: deals.stage, value: deals.value, entity: deals.entity, expectedClose: deals.expectedClose })
        .from(deals)
        .where(and(eq(deals.workspaceId, workspaceId), ilike(deals.name, term)))
        .limit(LIMIT),
      db
        .select({ id: crmAccounts.id, name: crmAccounts.name, type: crmAccounts.type, industry: crmAccounts.industry, website: crmAccounts.website })
        .from(crmAccounts)
        .where(and(eq(crmAccounts.workspaceId, workspaceId), ilike(crmAccounts.name, term)))
        .limit(LIMIT),
      db
        .select({ id: crmContacts.id, name: crmContacts.name, email: crmContacts.email, title: crmContacts.title, phone: crmContacts.phone, stage: crmContacts.lifecycleStage })
        .from(crmContacts)
        .where(and(eq(crmContacts.workspaceId, workspaceId), or(ilike(crmContacts.name, term), ilike(crmContacts.email, term))))
        .limit(LIMIT),
    ]);

  const projectById = new Map(projectRows.map((p) => [p.id, p]));
  const projectName = (id: string | null) => (id ? (projectById.get(id)?.name ?? null) : null);
  const hit = (type: SearchType, h: Omit<SearchHit, "type" | "url">): SearchHit => ({ type, ...h, url: `${base}${webPath(type, h.id, h.projectId)}` });
  const lower = q.toLowerCase();

  const hits: SearchHit[] = [
    ...issueRows.map((r) => {
      const key = r.projectId ? projectById.get(r.projectId)?.key : undefined;
      const identifier = key ? `${key}-${r.number}` : `#${r.number}`;
      return hit("issue", {
        id: r.id,
        title: r.title,
        subtitle: subtitle(identifier, projectName(r.projectId), humanize(r.status)),
        projectId: r.projectId,
        fields: fields(["ID", identifier], ["Status", humanize(r.status)], ["Project", projectName(r.projectId)]),
      });
    }),
    ...pageRows.map((r) =>
      hit("page", { id: r.id, title: r.title || "Untitled", subtitle: projectName(r.projectId), projectId: r.projectId, fields: fields(["Project", projectName(r.projectId)]) }),
    ),
    ...projectRows
      .filter((p) => p.name.toLowerCase().includes(lower) || p.key.toLowerCase() === lower)
      .slice(0, LIMIT)
      .map((p) =>
        hit("project", {
          id: p.id,
          title: p.name,
          subtitle: subtitle(p.key, p.kind === "operation" ? "Operation" : "Project"),
          projectId: p.id,
          fields: fields(["Key", p.key], ["Kind", humanize(p.kind)]),
        }),
      ),
    ...databaseRows.map((r) => hit("database", { id: r.id, title: `${r.icon} ${r.name}`.trim(), subtitle: "Database", projectId: null, fields: [] })),
    ...cycleRows.map((r) =>
      hit("cycle", {
        id: r.id,
        title: r.name,
        subtitle: subtitle(projectName(r.projectId), `${isoDay(r.startDate)} – ${isoDay(r.endDate)}`),
        projectId: r.projectId,
        fields: fields(["Project", projectName(r.projectId)], ["Number", r.number], ["Starts", isoDay(r.startDate)], ["Ends", isoDay(r.endDate)]),
      }),
    ),
    ...milestoneRows.map((r) =>
      hit("milestone", {
        id: r.id,
        title: r.name,
        subtitle: subtitle(projectName(r.projectId), humanize(r.status)),
        projectId: r.projectId,
        fields: fields(["Project", projectName(r.projectId)], ["Status", humanize(r.status)], ["Target", isoDay(r.targetDate)]),
      }),
    ),
    ...featureRows.map((r) =>
      hit("feature", {
        id: r.id,
        title: r.title,
        subtitle: subtitle(projectName(r.projectId), humanize(r.status)),
        projectId: r.projectId,
        fields: fields(["Project", projectName(r.projectId)], ["Status", humanize(r.status)], ["Target", isoDay(r.targetDate)]),
      }),
    ),
    ...ticketRows.map((r) =>
      hit("ticket", {
        id: r.id,
        title: r.subject,
        subtitle: subtitle(projectName(r.projectId), humanize(r.status)),
        projectId: r.projectId,
        fields: fields(["Project", projectName(r.projectId)], ["Status", humanize(r.status)], ["Priority", humanize(r.priority)], ["Requester", r.requesterEmail]),
      }),
    ),
    ...dealRows.map((r) =>
      hit("deal", {
        id: r.id,
        title: r.name,
        subtitle: subtitle(projectName(r.projectId), humanize(r.stage)),
        projectId: r.projectId,
        fields: fields(["Project", projectName(r.projectId)], ["Stage", humanize(r.stage)], ["Value", r.value ? formatCurrency(r.value, entityCurrency(r.entity)) : null], ["Expected close", isoDay(r.expectedClose)]),
      }),
    ),
    ...accountRows.map((r) =>
      hit("account", {
        id: r.id,
        title: r.name,
        subtitle: subtitle(humanize(r.type), r.industry),
        projectId: null,
        fields: fields(["Type", humanize(r.type)], ["Industry", r.industry], ["Website", r.website]),
      }),
    ),
    ...contactRows.map((r) =>
      hit("contact", {
        id: r.id,
        title: r.name,
        subtitle: subtitle(r.title, r.email),
        projectId: null,
        fields: fields(["Title", r.title], ["Email", r.email], ["Phone", r.phone], ["Stage", humanize(r.stage)]),
      }),
    ),
  ];

  return visibleHits(hits, scope);
}
