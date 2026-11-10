import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { deals, tickets } from "@/db/schema";
import { apiInvalidate } from "@/lib/api/invalidate";
import { isCustomerStage, ONBOARDING_STEPS, REQUEST_VIA, type Onboarding } from "@/lib/customer-success";
import { loadCustomerSuccess } from "@/lib/customer-success-data";
import { prospectRef } from "@/lib/prospects/deal-plan";
import { syncProspectDeal } from "@/lib/prospects/deals";
import { recordsOf } from "@/lib/prospects/parse";
import { loadWorkbook } from "@/lib/prospects/read";
import { PROSPECT_KINDS, PROSPECTS_PRODUCT_KEY, type ProspectKind } from "@/lib/prospects/schema";
import { todayIST } from "@/lib/prospects/stats";
import { emitSlackEvent } from "@/lib/slack/notify";

import type { ApiAuth } from "./auth";
import { departmentOn, loadProjectMeta, type ProjectMeta } from "./business-ops";
import { customerViews, type CustomerView } from "./customers-view";
import { ApiInputError } from "./errors";
import { kindOr404, parseInput, recordId } from "./prospects";
import { assertProjectVisible, assertSales } from "./scope";

/**
 * Customer Success writes that the web's server actions
 * (customer-success-actions.ts) and the REST API share, keyed on a workspace
 * and user rather than the session: tick an onboarding step, add a request.
 * Neither expires caches; each caller does, the way its runtime allows.
 * Check-ins are touches on the prospect (`POST /prospects/{kind}/{id}/touch`).
 */

export const customerRefSchema = z
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
async function customerDeal(workspaceId: string, userId: string | null, ref: string): Promise<{ id: string; onboarding: Onboarding }> {
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
  if (!record || !isCustomerStage(record.stage)) throw new ApiInputError("This prospect isn't at Pilot running or Won, so it isn't a customer yet.", 422);
  await syncProspectDeal({ workspaceId, userId }, { kind, id, before: { name: record.name }, status: record.status });
  const [made] = await find();
  if (!made) throw new ApiInputError("Couldn't open a deal for this customer. Is there a Valytica project?", 422);
  return made;
}

const stepSchema = z.enum(ONBOARDING_STEPS.map((s) => s.id) as [string, ...string[]], { error: "Not an onboarding step." });

/** Tick or untick one onboarding step. Returns the customer's steps as saved. */
export async function saveOnboardingStep(workspaceId: string, userId: string | null, ref: string, step: string, done: boolean): Promise<Onboarding> {
  const r = parseInput(customerRefSchema, ref);
  const s = parseInput(stepSchema, step);
  const deal = await customerDeal(workspaceId, userId, r);
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
    .where(and(eq(deals.id, deal.id), eq(deals.workspaceId, workspaceId)))
    .returning({ onboarding: deals.onboarding });
  return saved?.onboarding ?? {};
}

export const requestSchema = z.object({
  projectId: z.uuid(),
  ref: customerRefSchema.nullable(),
  subject: z.string().trim().min(1, "Say what they asked for.").max(300),
  body: z.string().trim().max(5000),
  via: z.enum(REQUEST_VIA.map((v) => v.id) as [string, ...string[]], { error: "`via` must be whatsapp, call, email or visit." }),
});

/** A new request from a customer, waiting on us. */
export async function insertCustomerRequest(workspaceId: string, userId: string | null, input: z.input<typeof requestSchema>): Promise<{ id: string }> {
  const v = parseInput(requestSchema, input);
  const deal = v.ref ? await customerDeal(workspaceId, userId, v.ref) : null;
  const [created] = await db
    .insert(tickets)
    .values({
      workspaceId,
      projectId: v.projectId,
      dealId: deal?.id ?? null,
      subject: v.subject,
      body: v.body || null,
      via: v.via,
      status: "open",
      priority: "normal",
      assigneeId: userId,
      // Valytica's customers are Indian valuers, firms and banks.
      entity: "India",
      sortKey: `z${Date.now()}`,
    })
    .returning({ id: tickets.id });
  emitSlackEvent(workspaceId, { type: "ticket.created", recordId: created.id, actorId: userId });
  return created;
}

/* ---------- the API ---------- */

/**
 * Who may use a project's customers through the API — the web's Sales page
 * gate, then its Customers tab: the project is visible, has Sales on, the
 * caller may open Sales, and it is the prospects product with Customer
 * Success on.
 */
export async function assertCustomersAccess(auth: ApiAuth, projectId: string): Promise<ProjectMeta> {
  assertProjectVisible(auth, projectId, "Project");
  const project = await loadProjectMeta(auth.workspaceId, projectId);
  if (!departmentOn(project, "sales")) throw new ApiInputError("Sales isn't on for this project.", 404);
  assertSales(auth);
  if (project.key !== PROSPECTS_PRODUCT_KEY || !departmentOn(project, "customer-success"))
    throw new ApiInputError("This project has no customers list.", 404);
  return project;
}

export type CustomerPayload = { customer: CustomerView; today: string; warnings: string[]; sheetUrl: string };

/** One customer's record, as the web's Customers tab shows it. */
export async function apiGetCustomer(auth: ApiAuth, projectId: string, kind: string, id: string): Promise<CustomerPayload> {
  const ref = prospectRef(kindOr404(kind), recordId(id));
  await assertCustomersAccess(auth, projectId);
  const data = await loadCustomerSuccess({ workspaceId: auth.workspaceId, projectId });
  const customer = customerViews(data).find((c) => c.ref === ref);
  if (!customer) throw new ApiInputError("Customer not found. A prospect is a customer at Pilot running or Won.", 404);
  return { customer, today: data.today, warnings: data.warnings, sheetUrl: data.sheetUrl };
}

export async function apiSetOnboardingStep(auth: ApiAuth, projectId: string, kind: string, id: string, body: { step?: unknown; done?: unknown }): Promise<Onboarding> {
  const ref = prospectRef(kindOr404(kind), recordId(id));
  await assertCustomersAccess(auth, projectId);
  if (typeof body.done !== "boolean") throw new ApiInputError("`done` must be true or false.");
  if (typeof body.step !== "string") throw new ApiInputError("`step` is required.");
  const saved = await saveOnboardingStep(auth.workspaceId, auth.userId, ref, body.step, body.done);
  apiInvalidate(auth.workspaceId, "crm");
  return saved;
}

export async function apiCreateCustomerRequest(
  auth: ApiAuth,
  projectId: string,
  kind: string,
  id: string,
  body: { subject?: unknown; body?: unknown; via?: unknown },
): Promise<{ id: string }> {
  const ref = prospectRef(kindOr404(kind), recordId(id));
  await assertCustomersAccess(auth, projectId);
  const created = await insertCustomerRequest(auth.workspaceId, auth.userId, {
    projectId,
    ref,
    subject: body.subject as string,
    body: (body.body ?? "") as string,
    via: (body.via ?? "whatsapp") as string,
  });
  apiInvalidate(auth.workspaceId, "tickets", "projects", "crm");
  return created;
}
