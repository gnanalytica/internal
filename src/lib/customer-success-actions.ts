"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { deals, supportAnswers, ticketComments, tickets } from "@/db/schema";
import { wsTags, type CacheEntity } from "@/lib/cache-tags";
import { isCustomerStage, ONBOARDING_STEPS, REQUEST_STATES, REQUEST_VIA, type Onboarding, type RequestState } from "@/lib/customer-success";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { syncProspectDeal } from "@/lib/prospects/deals";
import { recordsOf } from "@/lib/prospects/parse";
import { loadWorkbook } from "@/lib/prospects/read";
import { PROSPECT_KINDS, type ProspectKind } from "@/lib/prospects/schema";
import { todayIST } from "@/lib/prospects/stats";
import { emitSlackEvent } from "@/lib/slack/notify";

/**
 * Customer Success writes: onboarding ticks on a customer's deal, requests
 * (tickets tied to that deal) and the saved answers they're replied with.
 * Check-ins are not here — they are touches on the prospect, logged through
 * the prospects actions so they land in the sheet like every other touch.
 */

function invalidate(workspaceId: string, ...entities: CacheEntity[]): void {
  for (const tag of wsTags(workspaceId, ...entities)) updateTag(tag);
  refresh();
}

const refSchema = z
  .string()
  .max(200)
  .refine((v) => {
    const i = v.indexOf(":");
    return i > 0 && (PROSPECT_KINDS as readonly string[]).includes(v.slice(0, i)) && v.length > i + 1;
  }, "Not a customer.");

/**
 * The deal behind a customer, opening it if the prospect became a customer
 * before deals were opened automatically. Opened through the same sync the
 * prospects sheet uses, so it lands at the stage the prospect's status implies.
 */
async function customerDeal(workspaceId: string, userId: string, ref: string): Promise<{ id: string; onboarding: Onboarding }> {
  const find = () =>
    db
      .select({ id: deals.id, onboarding: deals.onboarding })
      .from(deals)
      .where(and(eq(deals.workspaceId, workspaceId), eq(deals.prospectRef, ref)))
      .limit(1);
  const [found] = await find();
  if (found) return found;

  const i = ref.indexOf(":");
  const kind = ref.slice(0, i) as ProspectKind;
  const id = ref.slice(i + 1);
  const record = recordsOf(await loadWorkbook(), kind).find((r) => r.id === id);
  if (!record || !isCustomerStage(record.stage)) throw new Error("This prospect isn't at Pilot running or Won, so it isn't a customer yet.");
  await syncProspectDeal({ workspaceId, userId }, { kind, id, before: { name: record.name }, status: record.status });
  const [made] = await find();
  if (!made) throw new Error("Couldn't open a deal for this customer. Is there a Valytica project?");
  return made;
}

/* ---------- onboarding ---------- */

const stepSchema = z.enum(ONBOARDING_STEPS.map((s) => s.id) as [string, ...string[]]);

/** Tick or untick one onboarding step. Returns the customer's steps as saved. */
export async function setOnboardingStep(ref: string, step: string, done: boolean): Promise<Onboarding> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const r = refSchema.parse(ref);
  const s = stepSchema.parse(step);
  const deal = await customerDeal(ws.id, me.id, r);
  // One statement, so two people ticking different steps can't overwrite each
  // other. Ticking keeps the date a step was first ticked on.
  const [saved] = await db
    .update(deals)
    .set({
      onboarding: done
        ? sql`jsonb_build_object(${s}::text, ${todayIST()}::text) || coalesce(${deals.onboarding}, '{}'::jsonb)`
        : sql`coalesce(${deals.onboarding}, '{}'::jsonb) - ${s}::text`,
      updatedAt: new Date(),
    })
    .where(and(eq(deals.id, deal.id), eq(deals.workspaceId, ws.id)))
    .returning({ onboarding: deals.onboarding });
  invalidate(ws.id, "crm");
  return saved?.onboarding ?? {};
}

/* ---------- requests ---------- */

const requestSchema = z.object({
  projectId: z.uuid(),
  ref: refSchema.nullable(),
  subject: z.string().trim().min(1, "Say what they asked for.").max(300),
  body: z.string().trim().max(5000),
  via: z.enum(REQUEST_VIA.map((v) => v.id) as [string, ...string[]]),
});

/** A new request from a customer, waiting on us. */
export async function createRequest(input: z.input<typeof requestSchema>): Promise<{ id: string }> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const v = requestSchema.parse(input);
  const deal = v.ref ? await customerDeal(ws.id, me.id, v.ref) : null;
  const [created] = await db
    .insert(tickets)
    .values({
      workspaceId: ws.id,
      projectId: v.projectId,
      dealId: deal?.id ?? null,
      subject: v.subject,
      body: v.body || null,
      via: v.via,
      status: "open",
      priority: "normal",
      assigneeId: me.id,
      // Valytica's customers are Indian valuers, firms and banks.
      entity: "India",
      sortKey: `z${Date.now()}`,
    })
    .returning({ id: tickets.id });
  emitSlackEvent(ws.id, { type: "ticket.created", recordId: created.id, actorId: me.id });
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
