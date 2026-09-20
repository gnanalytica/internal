import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { crmAccounts, crmContacts } from "@/db/schema";
import { notifySlack } from "@/lib/slack";
import { advanceOutreachStatus, impliedOutreachStatus, isInteractionChannel, type InteractionDirection } from "./outreach";
import { SHEET_SOURCE } from "./projection";
import { mirrorInternalColumns } from "./sync";

/** Shared by the manual log and the ingesters: advance status + last-contacted, mirror to the sheet. */
export async function applyInteractionToStatus(
  workspaceId: string,
  scope: { contactId: string | null; accountId: string | null },
  channel: string,
  direction: InteractionDirection,
  occurredAt: Date,
  actorId: string | null,
  held?: boolean,
): Promise<string | null> {
  if (!isInteractionChannel(channel)) return null;
  const implied = impliedOutreachStatus(channel, direction, { held });
  const touches = channel !== "note" && channel !== "task" && channel !== "sheet_change";
  let newStatus: string | null = null;
  if (scope.contactId) {
    const [c] = await db
      .select({ status: crmContacts.outreachStatus, last: crmContacts.lastContactedAt, externalSource: crmContacts.externalSource, externalId: crmContacts.externalId })
      .from(crmContacts)
      .where(and(eq(crmContacts.id, scope.contactId), eq(crmContacts.workspaceId, workspaceId)))
      .limit(1);
    if (c) {
      newStatus = advanceOutreachStatus(c.status, implied);
      const last = touches && (!c.last || c.last < occurredAt) ? occurredAt : undefined;
      if (newStatus || last) {
        await db
          .update(crmContacts)
          .set({ ...(newStatus ? { outreachStatus: newStatus } : {}), ...(last ? { lastContactedAt: last, lastChannel: channel } : {}) })
          .where(eq(crmContacts.id, scope.contactId));
        if (c.externalSource === SHEET_SOURCE && c.externalId)
          await mirrorInternalColumns(workspaceId, { tab: "people", rowKey: c.externalId }, { ...(newStatus ? { outreachStatus: newStatus } : {}), ...(last ? { lastContactedAt: last } : {}) }, actorId);
        if (newStatus === "replied" || newStatus === "meeting_booked" || newStatus === "met") {
          const [who] = await db.select({ name: crmContacts.name }).from(crmContacts).where(eq(crmContacts.id, scope.contactId)).limit(1);
          void notifySlack(workspaceId, `Valytica: ${who?.name ?? "a prospect"} → ${newStatus.replace("_", " ")} (${channel}).`);
        }
      }
    }
  } else if (scope.accountId) {
    const [a] = await db
      .select({ status: crmAccounts.outreachStatus, last: crmAccounts.lastContactedAt, externalSource: crmAccounts.externalSource, externalId: crmAccounts.externalId })
      .from(crmAccounts)
      .where(and(eq(crmAccounts.id, scope.accountId), eq(crmAccounts.workspaceId, workspaceId)))
      .limit(1);
    if (a) {
      newStatus = advanceOutreachStatus(a.status, implied);
      const last = touches && (!a.last || a.last < occurredAt) ? occurredAt : undefined;
      if (newStatus || last) {
        await db
          .update(crmAccounts)
          .set({ ...(newStatus ? { outreachStatus: newStatus } : {}), ...(last ? { lastContactedAt: last } : {}) })
          .where(eq(crmAccounts.id, scope.accountId));
        if (a.externalSource === SHEET_SOURCE && a.externalId)
          await mirrorInternalColumns(workspaceId, { tab: "companies", rowKey: a.externalId }, { ...(newStatus ? { outreachStatus: newStatus } : {}), ...(last ? { lastContactedAt: last } : {}) }, actorId);
      }
    }
  }
  return newStatus;
}

