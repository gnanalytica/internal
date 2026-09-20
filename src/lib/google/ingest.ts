import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { db } from "@/db";
import { crmContacts, interactions, workspaceMembers, googleGrants } from "@/db/schema";
import { wsTags } from "@/lib/cache-tags";
import { applyInteractionToStatus } from "@/lib/sheet-crm/status";
import { addressesIn, calendarEvents, gmailMessagesWith } from "./api";
import { accessTokenFor, type GoogleGrant } from "./grants";

/**
 * Pull a user's Gmail threads and Calendar events that involve a prospect
 * into `interactions`. Bounded on purpose: only contacts that are in the
 * funnel (or researched) are looked for, only the last few days of mail,
 * only a snippet is stored. Idempotent on (source, external_ref).
 */

const MAIL_DAYS = 3;

export type IngestSummary = { workspaceId: string; contacts: number; mail: number; events: number; error?: string };

export async function ingestGrant(grant: GoogleGrant): Promise<IngestSummary[]> {
  const memberships = await db.select({ workspaceId: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, grant.userId));
  const out: IngestSummary[] = [];
  for (const { workspaceId } of memberships) {
    const s: IngestSummary = { workspaceId, contacts: 0, mail: 0, events: 0 };
    try {
      const token = await accessTokenFor(grant);
      const contacts = await db
        .select({ id: crmContacts.id, email: crmContacts.email })
        .from(crmContacts)
        .where(and(eq(crmContacts.workspaceId, workspaceId), sql`${crmContacts.email} is not null and ${crmContacts.email} <> ''`, sql`(${crmContacts.outreachStatus} <> 'not_planned' or ${crmContacts.priority} is not null)`));
      const byAddress = new Map<string, string>();
      for (const c of contacts) for (const a of addressesIn(c.email ?? "")) byAddress.set(a, c.id);
      s.contacts = byAddress.size;
      if (!byAddress.size) {
        out.push(s);
        continue;
      }
      const me = grant.email.toLowerCase();
      const now = new Date();

      // ---- mail ----
      const msgs = await gmailMessagesWith(token, [...byAddress.keys()], MAIL_DAYS);
      const refs = msgs.map((m) => `gmail:${m.id}`);
      const existing = refs.length
        ? new Set((await db.select({ ref: interactions.externalRef }).from(interactions).where(and(eq(interactions.workspaceId, workspaceId), eq(interactions.source, "gmail"), inArray(interactions.externalRef, refs)))).map((r) => r.ref))
        : new Set<string>();
      for (const m of msgs) {
        const ref = `gmail:${m.id}`;
        if (existing.has(ref)) continue;
        const fromAddr = addressesIn(m.from)[0] ?? "";
        const direction = fromAddr === me ? "out" : "in";
        const counterpart = direction === "out" ? m.to.find((a) => byAddress.has(a)) : fromAddr;
        const contactId = counterpart ? byAddress.get(counterpart) : undefined;
        if (!contactId) continue;
        const occurredAt = new Date(m.internalDate);
        const inserted = await db
          .insert(interactions)
          .values({
            workspaceId,
            contactId,
            channel: "email",
            direction,
            occurredAt,
            subject: m.subject || null,
            summary: m.snippet || null,
            source: "gmail",
            externalRef: ref,
            externalUrl: `https://mail.google.com/mail/u/0/#all/${m.threadId}`,
            meta: { threadId: m.threadId, from: m.from, to: m.to.slice(0, 10) },
            actorId: grant.userId,
          })
          .onConflictDoNothing()
          .returning({ id: interactions.id });
        if (inserted.length) {
          s.mail++;
          await applyInteractionToStatus(workspaceId, { contactId, accountId: null }, "email", direction, occurredAt, grant.userId);
        }
      }

      // ---- calendar ----
      const events = await calendarEvents(token, new Date(now.getTime() - 7 * 864e5), new Date(now.getTime() + 14 * 864e5));
      for (const e of events) {
        if (e.status === "cancelled") continue;
        const hit = e.attendees.find((a) => byAddress.has(a.email));
        if (!hit) continue;
        const contactId = byAddress.get(hit.email)!;
        const start = new Date(e.start);
        const end = new Date(e.end);
        const held = end < now;
        const ref = `gcal:${e.id}`;
        const inserted = await db
          .insert(interactions)
          .values({
            workspaceId,
            contactId,
            channel: "meeting",
            direction: "none",
            occurredAt: start,
            subject: e.summary,
            summary: held ? "Meeting held" : "Meeting scheduled",
            source: "gcal",
            externalRef: ref,
            externalUrl: e.hangoutLink ?? e.htmlLink,
            meta: { start: e.start, end: e.end, meet: e.hangoutLink ?? null, attendees: e.attendees.map((a) => a.email).slice(0, 10) },
            actorId: grant.userId,
          })
          .onConflictDoUpdate({ target: [interactions.workspaceId, interactions.source, interactions.externalRef], set: { summary: held ? "Meeting held" : "Meeting scheduled", occurredAt: start, subject: e.summary } })
          .returning({ id: interactions.id });
        if (inserted.length) s.events++;
        // Forward-only, so calling this on every poll is idempotent: booked → met once the end time passes.
        await applyInteractionToStatus(workspaceId, { contactId, accountId: null }, "meeting", "none", start, grant.userId, held);
      }

      await db.update(googleGrants).set({ gmailSyncedAt: now, calendarSyncedAt: now }).where(eq(googleGrants.userId, grant.userId));
    } catch (err) {
      s.error = err instanceof Error ? err.message.slice(0, 300) : String(err);
      console.error("[google-ingest]", workspaceId, s.error);
    }
    try {
      for (const tag of wsTags(workspaceId, "interactions", "crm")) revalidateTag(tag, { expire: 0 });
    } catch {
      /* not in a request */
    }
    out.push(s);
  }
  return out;
}
