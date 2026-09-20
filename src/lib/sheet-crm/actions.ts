"use server";

import { and, eq } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";

import { db } from "@/db";
import { crmAccounts, crmContacts, interactions } from "@/db/schema";
import { wsTags } from "@/lib/cache-tags";
import { dispatchWebhook } from "@/lib/api/webhooks";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { isSheetSyncConfigured } from "./google-auth";
import { isTabId, type TabId } from "./mapping";
import { isInteractionChannel, isOutreachStatus, type InteractionDirection } from "./outreach";
import { SHEET_SOURCE } from "./projection";
import { applyInteractionToStatus } from "./status";
import { mirrorOutreachState, pullSheet, writeSheetCells, type CellWriteResult } from "./sync";

function invalidate(workspaceId: string) {
  for (const tag of wsTags(workspaceId, "sheet", "crm", "interactions")) updateTag(tag);
  refresh();
}

/** "Sync now" — a full pull, synchronous so the caller sees the summary. */
export async function syncSheetNow(): Promise<{ ok: boolean; message: string }> {
  const ws = await getWorkspace();
  if (!isSheetSyncConfigured()) return { ok: false, message: "Sheet sync is not configured (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY / VALYTICA_CRM_SHEET_ID)." };
  try {
    const { summary } = await pullSheet(ws.id, "manual");
    invalidate(ws.id);
    const tabs = Object.values(summary.tabs);
    const changed = tabs.reduce((n, t) => n + t.changed + t.added, 0);
    return { ok: true, message: `Synced ${tabs.length} tabs, ${changed} rows changed, ${summary.contactsUpserted} people and ${summary.accountsUpserted} companies projected.` };
  } catch (err) {
    invalidate(ws.id);
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "Sync failed." };
  }
}

/**
 * Write-through: edit cells of one sheet row from Internal. Each column is
 * judged on its own by the sync engine (read-only, formula, absent, landed).
 */
export async function updateSheetCells(input: {
  tab: string;
  rowKey: string;
  updates: Record<string, string | number | null>;
}): Promise<CellWriteResult[]> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  if (!isTabId(input.tab)) throw new Error("Unknown tab.");
  const results = await writeSheetCells({ workspaceId: ws.id, tab: input.tab as TabId, rowKey: input.rowKey, updates: input.updates, actorId: me.id });
  await dispatchWebhook(ws.id, "person.updated", { tab: input.tab, rowKey: input.rowKey, sheetWrites: results });
  invalidate(ws.id);
  return results;
}

/** Set a person's or company's outreach status by hand and mirror it to the sheet. */
export async function setOutreachStatus(input: { contactId?: string; accountId?: string; status: string; nextActionAt?: string | null }) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  if (!isOutreachStatus(input.status)) throw new Error("Unknown outreach status.");
  if (input.contactId) {
    const [c] = await db
      .update(crmContacts)
      .set({ outreachStatus: input.status, ...(input.nextActionAt !== undefined ? { nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null } : {}) })
      .where(and(eq(crmContacts.id, input.contactId), eq(crmContacts.workspaceId, ws.id)))
      .returning({ externalSource: crmContacts.externalSource, externalId: crmContacts.externalId });
    if (c?.externalSource === SHEET_SOURCE && c.externalId) await mirrorOutreachState(ws.id, { tab: "people", rowKey: c.externalId }, { outreachStatus: input.status }, me.id);
  } else if (input.accountId) {
    const [a] = await db
      .update(crmAccounts)
      .set({ outreachStatus: input.status })
      .where(and(eq(crmAccounts.id, input.accountId), eq(crmAccounts.workspaceId, ws.id)))
      .returning({ externalSource: crmAccounts.externalSource, externalId: crmAccounts.externalId });
    if (a?.externalSource === SHEET_SOURCE && a.externalId) await mirrorOutreachState(ws.id, { tab: "companies", rowKey: a.externalId }, { outreachStatus: input.status }, me.id);
  }
  await dispatchWebhook(ws.id, "person.updated", { id: input.contactId ?? input.accountId, outreachStatus: input.status });
  invalidate(ws.id);
}

/**
 * Log an interaction by hand (a WhatsApp exchange, a call, a LinkedIn
 * message, a note). Advances the outreach status forward when the channel
 * implies one, stamps last-contacted, and mirrors both to the sheet.
 */
export async function logInteraction(input: {
  contactId?: string | null;
  accountId?: string | null;
  channel: string;
  direction?: InteractionDirection;
  occurredAt?: string | null;
  subject?: string | null;
  body?: string | null;
  campaignId?: string | null;
  held?: boolean;
}): Promise<{ id: string; newStatus: string | null }> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  if (!isInteractionChannel(input.channel)) throw new Error("Unknown channel.");
  if (!input.contactId && !input.accountId) throw new Error("An interaction needs a person or a company.");
  const direction: InteractionDirection = input.direction ?? "none";
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const [row] = await db
    .insert(interactions)
    .values({
      workspaceId: ws.id,
      contactId: input.contactId ?? null,
      accountId: input.accountId ?? null,
      campaignId: input.campaignId ?? null,
      channel: input.channel,
      direction,
      occurredAt,
      subject: input.subject?.trim() || null,
      body: input.body?.trim() || null,
      source: "manual",
      actorId: me.id,
    })
    .returning({ id: interactions.id });

  const newStatus = await applyInteractionToStatus(ws.id, { contactId: input.contactId ?? null, accountId: input.accountId ?? null }, input.channel, direction, occurredAt, me.id, input.held);
  await dispatchWebhook(ws.id, "interaction.created", { id: row.id, contactId: input.contactId ?? null, accountId: input.accountId ?? null, channel: input.channel, direction, source: "manual", newStatus });
  invalidate(ws.id);
  return { id: row.id, newStatus };
}

export async function deleteInteraction(id: string) {
  const ws = await getWorkspace();
  await db.delete(interactions).where(and(eq(interactions.id, id), eq(interactions.workspaceId, ws.id), eq(interactions.source, "manual")));
  invalidate(ws.id);
}

// ---- reads exposed as actions, so search terms never enter a URL ----

export async function searchProspects(filter: import("./queries").PeopleFilter) {
  const ws = await getWorkspace();
  const { getProspects } = await import("./queries");
  return getProspects(ws.id, filter);
}
