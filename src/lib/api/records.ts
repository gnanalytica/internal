import "server-only";

import { and, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { apiInvalidate, apiInvalidateAttachments } from "@/lib/api/invalidate";
import type { CacheEntity } from "@/lib/cache-tags";
import {
  attachments,
  campaigns,
  contentItems,
  crmAccounts,
  crmActivities,
  crmContacts,
  cycles,
  databases,
  deals,
  expenses,
  feedback,
  features,
  invoices,
  labels,
  metrics,
  milestones,
  orgRoles,
  pageComments,
  projectStatusUpdates,
  projects,
  tickets,
} from "@/db/schema";

/**
 * Generic update/delete for the workspace-scoped records that are all shaped
 * the same way (a flat row owned by a workspace). Issues and pages are not
 * here — they carry activity, versioning and soft-delete rules of their own,
 * so they keep bespoke handlers in `ops.ts`.
 *
 * Every patch is filtered through an explicit field whitelist: an API client
 * can only write the columns listed below, never `workspaceId` or `id`.
 */

type Coerce = (value: unknown) => unknown;

const text: Coerce = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s.slice(0, 2000) : null;
};

const int: Coerce = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("Expected a number.");
  return Math.trunc(n);
};

const date: Coerce = (v) => {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error("Expected an ISO date.");
  return d;
};

/** A nullable foreign key — empty string and null both clear it. */
const ref: Coerce = (v) => {
  if (v == null || v === "") return null;
  return String(v);
};

const bool: Coerce = (v) => {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error("Expected true or false.");
};

const oneOf =
  (allowed: readonly string[]): Coerce =>
  (v) => {
    const s = String(v ?? "").trim();
    if (!allowed.includes(s))
      throw new Error(`Expected one of: ${allowed.join(", ")}.`);
    return s;
  };

/** A required text column — reject a patch that would blank it out. */
const required =
  (label: string): Coerce =>
  (v) => {
    const s = String(v ?? "").trim();
    if (!s) throw new Error(`\`${label}\` cannot be empty.`);
    return s.slice(0, 2000);
  };

const ENTITY = ["India", "Netherlands", "Global"] as const;

type Resource = {
  table: PgTable;
  fields: Record<string, Coerce>;
  /** Set when the table has an `updated_at` column. */
  touch?: boolean;
};

export const RESOURCES = {
  projects: {
    table: projects,
    fields: {
      name: required("name"),
      description: text,
      tagline: text,
      url: text,
      startDate: date,
      targetDate: date,
      ownerId: ref,
      strategistId: ref,
    },
  },
  deals: {
    table: deals,
    touch: true,
    fields: {
      name: required("name"),
      stage: oneOf(["lead", "qualified", "proposal", "negotiation", "won", "lost"]),
      value: int,
      entity: oneOf(ENTITY),
      expectedClose: date,
      projectId: ref,
      accountId: ref,
      contactId: ref,
      ownerId: ref,
    },
  },
  accounts: {
    table: crmAccounts,
    fields: {
      name: required("name"),
      website: text,
      industry: text,
      type: oneOf(["prospect", "customer", "partner", "churned"]),
      entity: oneOf(ENTITY),
      ownerId: ref,
    },
  },
  contacts: {
    table: crmContacts,
    fields: {
      name: required("name"),
      email: text,
      title: text,
      phone: text,
      lifecycleStage: oneOf(["lead", "qualified", "customer"]),
      source: text,
      accountId: ref,
      entity: oneOf(ENTITY),
      ownerId: ref,
    },
  },
  campaigns: {
    table: campaigns,
    fields: {
      name: required("name"),
      channel: oneOf(["email", "linkedin", "events", "content", "paid", "referral"]),
      status: oneOf(["planned", "active", "done"]),
      budget: int,
      reach: int,
      replies: int,
      conversions: int,
      startDate: date,
      endDate: date,
      projectId: ref,
      entity: oneOf(ENTITY),
      ownerId: ref,
    },
  },
  invoices: {
    table: invoices,
    fields: {
      number: text,
      status: oneOf(["draft", "sent", "paid", "overdue"]),
      amount: int,
      issueDate: date,
      dueDate: date,
      projectId: ref,
      accountId: ref,
      entity: oneOf(ENTITY),
      ownerId: ref,
    },
  },
  expenses: {
    table: expenses,
    fields: {
      vendor: text,
      category: oneOf(["tooling", "contractors", "marketing", "infra", "other"]),
      amount: int,
      status: oneOf(["planned", "paid"]),
      spentDate: date,
      projectId: ref,
      entity: oneOf(ENTITY),
      ownerId: ref,
    },
  },
  milestones: {
    table: milestones,
    fields: {
      name: required("name"),
      description: text,
      targetDate: date,
      status: oneOf([
        "planned",
        "on_track",
        "at_risk",
        "off_track",
        "achieved",
        "missed",
      ]),
      projectId: ref,
    },
  },
  features: {
    table: features,
    touch: true,
    fields: {
      title: required("title"),
      status: oneOf(["idea", "planned", "building", "shipped", "archived"]),
      startDate: date,
      targetDate: date,
      milestoneId: ref,
      projectId: ref,
      ownerId: ref,
      pageId: ref,
    },
  },
  cycles: {
    table: cycles,
    fields: {
      name: required("name"),
      startDate: date,
      endDate: date,
    },
  },
  labels: {
    table: labels,
    fields: {
      name: required("name"),
      color: text,
    },
  },
  metrics: {
    table: metrics,
    fields: {
      name: required("name"),
      unit: text,
      cadence: oneOf(["weekly", "monthly", "quarterly"]),
      isNorthStar: bool,
      projectId: ref,
    },
  },
  feedback: {
    table: feedback,
    touch: true,
    fields: {
      title: required("title"),
      body: text,
      source: oneOf([
        "customer",
        "sales",
        "support",
        "interview",
        "internal",
        "other",
      ]),
      status: oneOf(["new", "reviewing", "planned", "declined", "shipped"]),
      votes: int,
      contact: text,
      featureId: ref,
      projectId: ref,
    },
  },
  content: {
    table: contentItems,
    fields: {
      title: required("title"),
      channel: text,
      status: oneOf(["idea", "draft", "scheduled", "published"]),
      url: text,
      notes: text,
      publishDate: date,
      campaignId: ref,
      projectId: ref,
      ownerId: ref,
    },
  },
  "org-roles": {
    table: orgRoles,
    fields: {
      title: required("title"),
      userId: ref,
      parentId: ref,
    },
  },
  activities: {
    table: crmActivities,
    fields: {
      type: oneOf(["note", "call", "email", "task", "meeting"]),
      body: text,
      dueDate: date,
      done: bool,
      accountId: ref,
      contactId: ref,
      dealId: ref,
      projectId: ref,
    },
  },
  databases: {
    table: databases,
    fields: {
      name: required("name"),
      icon: text,
    },
  },
  "status-updates": {
    table: projectStatusUpdates,
    fields: {
      health: oneOf(["on_track", "at_risk", "off_track"]),
      body: text,
    },
  },
  attachments: {
    table: attachments,
    fields: {
      name: required("name"),
    },
  },
  "page-comments": {
    table: pageComments,
    fields: {
      body: required("body"),
    },
  },
  tickets: {
    table: tickets,
    touch: true,
    fields: {
      subject: required("subject"),
      body: text,
      status: oneOf(["open", "pending", "solved", "closed"]),
      priority: oneOf(["urgent", "high", "normal", "low"]),
      assigneeId: ref,
      requesterEmail: text,
      projectId: ref,
      accountId: ref,
      contactId: ref,
      entity: oneOf(ENTITY),
    },
  },
} satisfies Record<string, Resource>;

export type ResourceName = keyof typeof RESOURCES;

/**
 * Which cached reads each resource feeds, so a generic write can expire them.
 * Keep in step with the `cacheTag` calls in `src/lib/data.ts`.
 */
const RESOURCE_ENTITIES = {
  projects: ["projects"],
  deals: ["crm"],
  accounts: ["crm"],
  contacts: ["crm"],
  campaigns: ["campaigns"],
  invoices: ["finance"],
  expenses: ["finance"],
  milestones: ["milestones"],
  features: ["features"],
  cycles: ["cycles"],
  labels: ["labels"],
  metrics: ["metrics"],
  feedback: ["feedback"],
  content: ["campaigns"],
  activities: ["crm"],
  databases: ["databases"],
  // Attachments are cached per issue, so they are handled separately below.
  attachments: [],
  tickets: ["tickets"],
  "org-roles": ["org"],
  "status-updates": ["status-updates"],
  // Page comments are only read through `getPageComments`, which resolves the
  // current user and so is never cached.
  "page-comments": [],
} satisfies Record<ResourceName, CacheEntity[]>;

export function isResource(name: string): name is ResourceName {
  return Object.hasOwn(RESOURCES, name);
}

/** The writable field names for a resource (used in error messages and docs). */
export function writableFields(name: ResourceName): string[] {
  return Object.keys(RESOURCES[name].fields);
}

/**
 * Apply a whitelisted patch. Returns false when the row doesn't exist in this
 * workspace, so callers can answer 404 rather than silently succeeding.
 */
export async function apiUpdateRecord(
  name: ResourceName,
  workspaceId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const resource: Resource = RESOURCES[name];
  const values: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(patch ?? {})) {
    const coerce = resource.fields[key];
    if (!coerce) continue; // ignore unknown keys rather than failing the write
    try {
      values[key] = coerce(raw);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Invalid value.";
      throw new Error(`\`${key}\`: ${reason}`);
    }
  }

  if (Object.keys(values).length === 0)
    throw new Error(
      `No writable fields in the patch. Writable: ${writableFields(name).join(", ")}.`,
    );
  if (resource.touch) values.updatedAt = new Date();

  const t = resource.table as unknown as {
    workspaceId: never;
    id: never;
  };
  const res = await db
    .update(resource.table)
    .set(values)
    .where(and(eq(t.workspaceId, workspaceId), eq(t.id, id)))
    .returning({ id: t.id });
  if (res.length > 0) await invalidateRecord(name, workspaceId, id);
  return res.length > 0;
}

export async function apiDeleteRecord(
  name: ResourceName,
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const resource: Resource = RESOURCES[name];
  const t = resource.table as unknown as { workspaceId: never; id: never };
  // Read the owning issue before the row disappears — attachments are cached
  // under their issue, not the workspace.
  const attachmentIssueId =
    name === "attachments" ? await ownerIssueId(workspaceId, id) : null;
  const res = await db
    .delete(resource.table)
    .where(and(eq(t.workspaceId, workspaceId), eq(t.id, id)))
    .returning({ id: t.id });
  if (res.length > 0) {
    if (attachmentIssueId) apiInvalidateAttachments(attachmentIssueId);
    else await invalidateRecord(name, workspaceId, id);
  }
  return res.length > 0;
}

async function ownerIssueId(
  workspaceId: string,
  attachmentId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ issueId: attachments.issueId })
    .from(attachments)
    .where(
      and(eq(attachments.workspaceId, workspaceId), eq(attachments.id, attachmentId)),
    )
    .limit(1);
  return row?.issueId ?? null;
}

/** Expire the cached reads a write to `name` invalidates. */
async function invalidateRecord(
  name: ResourceName,
  workspaceId: string,
  id: string,
): Promise<void> {
  if (name === "attachments") {
    const issueId = await ownerIssueId(workspaceId, id);
    if (issueId) apiInvalidateAttachments(issueId);
    return;
  }
  apiInvalidate(workspaceId, ...RESOURCE_ENTITIES[name]);
}
