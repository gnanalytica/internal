"use server";

import { and, eq } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { supportAnswers, ticketComments, tickets } from "@/db/schema";
import { insertCustomerRequest, saveOnboardingStep, type requestSchema } from "@/lib/api/customer-ops";
import { wsTags, type CacheEntity } from "@/lib/cache-tags";
import { REQUEST_STATES, type Onboarding, type RequestState } from "@/lib/customer-success";
import { getCurrentUser, getWorkspace } from "@/lib/data";

/**
 * Customer Success writes: onboarding ticks on a customer's deal, requests
 * (tickets tied to that deal) and the saved answers they're replied with.
 * Check-ins are not here — they are touches on the prospect, logged through
 * the prospects actions so they land in the sheet like every other touch.
 * Onboarding ticks and new requests are the same writes the API makes for the
 * phone app (src/lib/api/customer-ops.ts).
 */

function invalidate(workspaceId: string, ...entities: CacheEntity[]): void {
  for (const tag of wsTags(workspaceId, ...entities)) updateTag(tag);
  refresh();
}

/* ---------- onboarding ---------- */

/** Tick or untick one onboarding step. Returns the customer's steps as saved. */
export async function setOnboardingStep(ref: string, step: string, done: boolean): Promise<Onboarding> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const saved = await saveOnboardingStep(ws.id, me.id, ref, step, done);
  invalidate(ws.id, "crm");
  return saved;
}

/* ---------- requests ---------- */

/** A new request from a customer, waiting on us. */
export async function createRequest(input: z.input<typeof requestSchema>): Promise<{ id: string }> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const created = await insertCustomerRequest(ws.id, me.id, input);
  invalidate(ws.id, "tickets", "projects", "crm");
  return created;
}

const stateSchema = z.enum(REQUEST_STATES.map((s) => s.id) as [RequestState, ...RequestState[]]);

/** Move a request to waiting on us, waiting on them, or answered. */
export async function setRequestState(ticketId: string, state: RequestState): Promise<void> {
  const ws = await getWorkspace();
  const status = REQUEST_STATES.find((s) => s.id === stateSchema.parse(state))!.status;
  await db
    .update(tickets)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(tickets.id, z.uuid().parse(ticketId)), eq(tickets.workspaceId, ws.id)));
  invalidate(ws.id, "tickets", "projects");
}

/**
 * Record the reply sent to a request (as a comment on its thread) and mark it
 * waiting on them. The reply itself goes out on WhatsApp, a call or email —
 * this is the note of what was said.
 */
export async function replyToRequest(ticketId: string, body: string): Promise<void> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const id = z.uuid().parse(ticketId);
  const text = z.string().trim().min(1, "Write the reply first.").max(10_000).parse(body);
  const [ticket] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.workspaceId, ws.id)))
    .limit(1);
  if (!ticket) throw new Error("That request is gone.");
  await db.insert(ticketComments).values({ workspaceId: ws.id, ticketId: id, authorId: me.id, body: text });
  await db
    .update(tickets)
    .set({ status: "pending", updatedAt: new Date() })
    .where(and(eq(tickets.id, id), eq(tickets.workspaceId, ws.id)));
  invalidate(ws.id, "tickets", "projects");
}

/* ---------- saved answers ---------- */

const answerSchema = z.object({
  question: z.string().trim().min(1, "Write the question.").max(500),
  answer: z.string().trim().min(1, "Write the answer.").max(10_000),
});

export async function createAnswer(projectId: string, input: z.input<typeof answerSchema>): Promise<{ id: string }> {
  const ws = await getWorkspace();
  const v = answerSchema.parse(input);
  const [created] = await db
    .insert(supportAnswers)
    .values({ workspaceId: ws.id, projectId: z.uuid().parse(projectId), question: v.question, answer: v.answer })
    .returning({ id: supportAnswers.id });
  invalidate(ws.id, "tickets");
  return created;
}

export async function updateAnswer(id: string, input: z.input<typeof answerSchema>): Promise<void> {
  const ws = await getWorkspace();
  const v = answerSchema.parse(input);
  await db
    .update(supportAnswers)
    .set({ question: v.question, answer: v.answer, updatedAt: new Date() })
    .where(and(eq(supportAnswers.id, z.uuid().parse(id)), eq(supportAnswers.workspaceId, ws.id)));
  invalidate(ws.id, "tickets");
}

export async function deleteAnswer(id: string): Promise<void> {
  const ws = await getWorkspace();
  await db.delete(supportAnswers).where(and(eq(supportAnswers.id, z.uuid().parse(id)), eq(supportAnswers.workspaceId, ws.id)));
  invalidate(ws.id, "tickets");
}
