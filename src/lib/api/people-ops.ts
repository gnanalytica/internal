import "server-only";

import { and, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { crmContacts, interactions } from "@/db/schema";
import { ApiInputError } from "@/lib/api/errors";
import { dispatchWebhook } from "@/lib/api/webhooks";
import { INTERACTION_SOURCES, isInteractionChannel, isOutreachStatus, type InteractionDirection } from "@/lib/sheet-crm/outreach";
import { SHEET_SOURCE } from "@/lib/sheet-crm/projection";
import type { PersonView, ProspectRow } from "@/lib/sheet-crm/queries";
import { applyInteractionToStatus } from "@/lib/sheet-crm/status";
import { mirrorOutreachState, writeSheetCells, type CellWriteResult } from "@/lib/sheet-crm/sync";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

/** The list shape: identity, where, research standing, outreach state. Never the full sheet row. */
export function personDto(c: ProspectRow | PersonView["contact"]) {
  const excluded = "excluded" in c ? c.excluded : null;
  return {
    id: c.id,
    personId: c.externalSource === SHEET_SOURCE ? c.externalId : null,
    name: c.name,
    email: c.email,
    phone: c.phone,
    phoneE164: c.phoneE164,
    city: c.city,
    state: c.state,
    ibbiRegNo: c.ibbiRegNo,
    rvo: c.rvo,
    priority: c.priority,
    opportunityScore: c.opportunityScore,
    scoreBand: c.scoreBand,
    researchStatus: c.researchStatus,
    bestFirstChannel: c.bestFirstChannel,
    persona: c.persona,
    leadScore: c.leadScore,
    outreachStatus: c.outreachStatus,
    lastContactedAt: c.lastContactedAt,
    lastChannel: c.lastChannel,
    nextActionAt: c.nextActionAt,
    account: c.account ? { id: c.account.id, name: c.account.name, companyId: c.account.externalId } : null,
    excluded: excluded ? { name: excluded.name, action: excluded.action } : null,
    url: BASE ? `${BASE}/people/${c.id}` : `/people/${c.id}`,
  };
}

/** The full view: the DTO plus the person's sheet rows, network and timeline. */
export function personDetailDto(v: PersonView) {
  return {
    ...personDto(v.contact),
    sheet: {
      people: v.people,
      prospectIntelligence: v.prospect?.data ?? null,
      deepDive: v.dossier?.data ?? null,
      researchQueue: v.queue?.data ?? null,
      iov: v.iov,
    },
    referrals: v.referrals,
    lenderContacts: v.lenderContacts,
    company: v.company ? { id: v.company.account.id, name: v.company.account.name, companyId: v.company.account.externalId, sheet: v.company.record } : null,
    colleagues: v.colleagues,
    interactions: v.interactions.map(interactionDto),
    pendingWrites: v.writes.filter((w) => w.status !== "ok").map((w) => ({ tab: w.tab, column: w.column, status: w.status, detail: w.detail, at: w.writtenAt })),
  };
}

export function interactionDto(i: typeof interactions.$inferSelect & { actor?: { id: string; name: string } | null }) {
  return {
    id: i.id,
    contactId: i.contactId,
    accountId: i.accountId,
    campaignId: i.campaignId,
    channel: i.channel,
    direction: i.direction,
    occurredAt: i.occurredAt,
    subject: i.subject,
    summary: i.summary,
    body: i.body,
    source: i.source,
    externalRef: i.externalRef,
    externalUrl: i.externalUrl,
    meta: i.meta ?? null,
    actor: i.actor ? { id: i.actor.id, name: i.actor.name } : null,
    createdAt: i.createdAt,
  };
}

export type PersonPatch = {
  outreachStatus?: string;
  nextActionAt?: string | null;
  /** Sheet cells, keyed by tab id then exact header. Only writable columns land. */
  sheet?: Partial<Record<"people" | "prospect_intelligence" | "deep_dive_dossiers" | "research_queue", Record<string, string | number | null>>>;
};

export async function apiPatchPerson(workspaceId: string, userId: string | null, contactId: string, patch: PersonPatch): Promise<{ writes: CellWriteResult[] }> {
  const [c] = await db
    .select({ id: crmContacts.id, externalSource: crmContacts.externalSource, externalId: crmContacts.externalId, status: crmContacts.outreachStatus })
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contactId), eq(crmContacts.workspaceId, workspaceId)))
    .limit(1);
  if (!c) throw new ApiInputError("Person not found.", 404);
  const changed: Record<string, unknown> = {};
  if (patch.outreachStatus !== undefined) {
    if (!isOutreachStatus(patch.outreachStatus)) throw new ApiInputError(`Unknown outreachStatus "${patch.outreachStatus}".`);
    changed.outreachStatus = patch.outreachStatus;
  }
  if (patch.nextActionAt !== undefined) changed.nextActionAt = patch.nextActionAt ? new Date(patch.nextActionAt) : null;
  if (Object.keys(changed).length) {
    await db.update(crmContacts).set(changed).where(eq(crmContacts.id, contactId));
    if (changed.outreachStatus && c.externalSource === SHEET_SOURCE && c.externalId)
      await mirrorOutreachState(workspaceId, { tab: "people", rowKey: c.externalId }, { outreachStatus: String(changed.outreachStatus) }, userId);
  }
  const writes: CellWriteResult[] = [];
  if (patch.sheet) {
    const pid = c.externalSource === SHEET_SOURCE ? c.externalId : null;
    if (!pid) throw new ApiInputError("This person is not linked to the sheet; there is no row to write.");
    for (const [tab, updates] of Object.entries(patch.sheet)) {
      if (!updates || !Object.keys(updates).length) continue;
      if (!["people", "prospect_intelligence", "deep_dive_dossiers", "research_queue"].includes(tab)) throw new ApiInputError(`Unknown tab "${tab}".`);
      writes.push(...(await writeSheetCells({ workspaceId, tab: tab as "people", rowKey: pid, updates, actorId: userId })));
    }
  }
  await dispatchWebhook(workspaceId, "person.updated", { id: contactId, personId: c.externalId, ...changed, sheetWrites: writes });
  return { writes };
}

export type InteractionInput = {
  contactId?: string | null;
  personId?: string | null;
  accountId?: string | null;
  channel?: string;
  direction?: InteractionDirection;
  occurredAt?: string | null;
  subject?: string | null;
  summary?: string | null;
  body?: string | null;
  source?: string;
  externalRef?: string | null;
  externalUrl?: string | null;
  meta?: Record<string, unknown> | null;
  held?: boolean;
  campaignId?: string | null;
};

/**
 * Create an interaction from an integration (Standup AI, a script). Idempotent
 * on (source, externalRef): a retried POST returns the existing row with 200.
 * `personId` (P#####) may be given instead of `contactId`.
 */
export async function apiCreateInteraction(workspaceId: string, userId: string | null, input: InteractionInput): Promise<{ id: string; created: boolean; newStatus: string | null }> {
  if (!input.channel || !isInteractionChannel(input.channel)) throw new ApiInputError("`channel` must be one of whatsapp, linkedin, email, call, meeting, sms, note, task.");
  const source = input.source ?? "api";
  if (!(INTERACTION_SOURCES as readonly string[]).includes(source)) throw new ApiInputError(`Unknown source "${source}".`);
  let contactId = input.contactId ?? null;
  if (!contactId && input.personId) {
    const [c] = await db.select({ id: crmContacts.id }).from(crmContacts).where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE), eq(crmContacts.externalId, input.personId.toUpperCase()))).limit(1);
    if (!c) throw new ApiInputError(`No person with personId ${input.personId}.`, 404);
    contactId = c.id;
  }
  if (!contactId && !input.accountId) throw new ApiInputError("`contactId`, `personId` or `accountId` is required.");
  const direction: InteractionDirection = input.direction ?? "none";
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new ApiInputError("`occurredAt` is not a date.");
  const externalRef = input.externalRef?.trim() || null;
  if (externalRef) {
    const [dup] = await db.select({ id: interactions.id }).from(interactions).where(and(eq(interactions.workspaceId, workspaceId), eq(interactions.source, source), eq(interactions.externalRef, externalRef))).limit(1);
    if (dup) return { id: dup.id, created: false, newStatus: null };
  }
  const [row] = await db
    .insert(interactions)
    .values({
      workspaceId,
      contactId,
      accountId: input.accountId ?? null,
      campaignId: input.campaignId ?? null,
      channel: input.channel,
      direction,
      occurredAt,
      subject: input.subject?.slice(0, 500) ?? null,
      summary: input.summary?.slice(0, 4000) ?? null,
      body: input.body?.slice(0, 20000) ?? null,
      source,
      externalRef,
      externalUrl: input.externalUrl ?? null,
      meta: input.meta ?? null,
      actorId: userId,
    })
    .onConflictDoNothing()
    .returning({ id: interactions.id });
  if (!row) {
    const [dup] = await db.select({ id: interactions.id }).from(interactions).where(and(eq(interactions.workspaceId, workspaceId), eq(interactions.source, source), eq(interactions.externalRef, externalRef!))).limit(1);
    return { id: dup.id, created: false, newStatus: null };
  }
  const newStatus = await applyInteractionToStatus(workspaceId, { contactId, accountId: input.accountId ?? null }, input.channel, direction, occurredAt, userId, input.held);
  await dispatchWebhook(workspaceId, "interaction.created", { id: row.id, contactId, accountId: input.accountId ?? null, channel: input.channel, direction, source, newStatus });
  return { id: row.id, created: true, newStatus };
}

export async function apiListInteractions(workspaceId: string, f: { contactId?: string | null; personId?: string | null; accountId?: string | null; since?: string | null; limit?: number }) {
  const where = [eq(interactions.workspaceId, workspaceId)];
  if (f.personId) {
    const [c] = await db.select({ id: crmContacts.id }).from(crmContacts).where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE), eq(crmContacts.externalId, f.personId.toUpperCase()))).limit(1);
    if (!c) return [];
    where.push(eq(interactions.contactId, c.id));
  }
  if (f.contactId) where.push(eq(interactions.contactId, f.contactId));
  if (f.accountId) where.push(eq(interactions.accountId, f.accountId));
  if (f.since) {
    const d = new Date(f.since);
    if (Number.isNaN(d.getTime())) throw new ApiInputError("`since` is not a date.");
    where.push(gte(interactions.occurredAt, d));
  }
  const rows = await db.query.interactions.findMany({ where: and(...where), with: { actor: true }, orderBy: (t, { desc }) => [desc(t.occurredAt)], limit: Math.min(f.limit ?? 100, 500) });
  return rows.map(interactionDto);
}
