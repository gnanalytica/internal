"use server";

import { and, eq } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";

import { db } from "@/db";
import { crmContacts, interactions } from "@/db/schema";
import { wsTags } from "@/lib/cache-tags";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { applyInteractionToStatus } from "@/lib/sheet-crm/status";
import { calendarCreateEvent, gmailCreateDraft } from "./api";
import { accessTokenFor, deleteGrant, getGrant } from "./grants";
import { ingestGrant } from "./ingest";
import { isGoogleOAuthConfigured } from "./oauth";

function invalidate(workspaceId: string) {
  for (const tag of wsTags(workspaceId, "interactions", "crm")) updateTag(tag);
  refresh();
}

export async function googleStatus(): Promise<{ configured: boolean; connected: boolean; email: string | null; syncedAt: Date | null }> {
  const me = await getCurrentUser();
  const g = isGoogleOAuthConfigured() ? await getGrant(me.id) : null;
  return { configured: isGoogleOAuthConfigured(), connected: Boolean(g), email: g?.email ?? null, syncedAt: g?.gmailSyncedAt ?? null };
}

export async function disconnectGoogle(): Promise<void> {
  const me = await getCurrentUser();
  await deleteGrant(me.id);
  refresh();
}

export async function ingestGoogleNow(): Promise<{ ok: boolean; message: string }> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const g = await getGrant(me.id);
  if (!g) return { ok: false, message: "Google is not connected for your account." };
  const res = await ingestGrant(g);
  invalidate(ws.id);
  const mine = res.find((r) => r.workspaceId === ws.id);
  return mine?.error ? { ok: false, message: mine.error } : { ok: true, message: `Checked ${mine?.contacts ?? 0} addresses: ${mine?.mail ?? 0} new emails, ${mine?.events ?? 0} calendar events.` };
}

/** Create a Gmail draft to a contact (never sends) and log nothing until it is actually sent. */
export async function draftEmail(input: { contactId: string; subject: string; body: string }): Promise<{ url: string }> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const g = await getGrant(me.id);
  if (!g) throw new Error("Connect Google in Settings first.");
  const [c] = await db.select({ email: crmContacts.email }).from(crmContacts).where(and(eq(crmContacts.id, input.contactId), eq(crmContacts.workspaceId, ws.id))).limit(1);
  const to = c?.email?.split(";")[0].trim();
  if (!to) throw new Error("This person has no email address.");
  const token = await accessTokenFor(g);
  const d = await gmailCreateDraft(token, to, input.subject, input.body);
  return { url: d.url };
}

/** Book a call: a calendar event with a Meet link and the contact as attendee; logged as meeting_booked. */
export async function bookCall(input: { contactId: string; startIso: string; minutes: number; title?: string; description?: string }): Promise<{ url: string }> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const g = await getGrant(me.id);
  if (!g) throw new Error("Connect Google in Settings first.");
  const [c] = await db.select({ name: crmContacts.name, email: crmContacts.email }).from(crmContacts).where(and(eq(crmContacts.id, input.contactId), eq(crmContacts.workspaceId, ws.id))).limit(1);
  if (!c) throw new Error("Person not found.");
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + Math.max(15, input.minutes) * 60_000);
  const token = await accessTokenFor(g);
  const e = await calendarCreateEvent(token, { title: input.title?.trim() || `Valytica × ${c.name}`, start, end, attendeeEmail: c.email?.split(";")[0].trim() || null, description: input.description });
  await db
    .insert(interactions)
    .values({
      workspaceId: ws.id,
      contactId: input.contactId,
      channel: "meeting",
      direction: "none",
      occurredAt: start,
      subject: e.summary,
      summary: "Meeting scheduled",
      source: "gcal",
      externalRef: `gcal:${e.id}`,
      externalUrl: e.hangoutLink ?? e.htmlLink,
      meta: { start: e.start, end: e.end, meet: e.hangoutLink ?? null },
      actorId: me.id,
    })
    .onConflictDoNothing();
  await applyInteractionToStatus(ws.id, { contactId: input.contactId, accountId: null }, "meeting", "none", start, me.id, false);
  invalidate(ws.id);
  return { url: e.htmlLink };
}
