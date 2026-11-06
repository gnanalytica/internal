import "server-only";

import { randomUUID } from "node:crypto";

import { invalidateProspects } from "@/lib/api/prospects";
import { recordsOf, type ProspectRecord } from "@/lib/prospects/parse";
import { loadWorkbook } from "@/lib/prospects/read";
import { PROSPECT_KINDS, STAGES, type ProspectKind } from "@/lib/prospects/schema";
import { logProspectTouch, readProspectDetail } from "@/lib/prospects/service";
import { dueBucket, isAssignedTo, isOpen, myTasks, toRow } from "@/lib/prospects/stats";
import { touchSchema } from "@/lib/prospects/touch";
import { escapeMrkdwn, recordMessage } from "../cards";
import { loadSnapshot } from "../records";
import { CONFIRM_TTL_MS, pendingKey, touchSummary, type PendingAction, type TouchPlan } from "./confirm";
import { prospectBrief, prospectDetail, prospectMatches, stageName } from "./format";
import { fail, ok, type RequestCtx } from "./request";
import type { ToolInput } from "./tools";
import type { ToolResult } from "./loop";

/**
 * The prospect tools, over the prospects Google Sheet through the same
 * service the web and the mobile API use. Admin-only (permissions.ts), as
 * the Sales tab is. Touches are logged as the confirming admin, through
 * logProspectTouch — which also moves the prospect's deal and tells Slack
 * when the stage changes.
 */

const allRecords = (wb: Awaited<ReturnType<typeof loadWorkbook>>) => PROSPECT_KINDS.flatMap((k) => recordsOf(wb, k));

/** The sheet's name for the caller, as `assigned` and Activity's `by` write people. */
const personFor = (ctx: RequestCtx, query: string) => (/^(me|myself|i)$/i.test(query.trim()) ? (ctx.caller.name ?? "") : query.trim());

export async function searchProspects(ctx: RequestCtx, input: ToolInput<"search_prospects">): Promise<ToolResult> {
  const wb = await loadWorkbook();
  const person = input.assigned ? personFor(ctx, input.assigned) : null;
  const hits = (input.kind ? recordsOf(wb, input.kind) : allRecords(wb)).filter((r) => {
    if (input.text && !prospectMatches(r, input.text)) return false;
    if (input.stage && stageName(r.stage) !== input.stage) return false;
    if (person && !isAssignedTo(r.assigned, person)) return false;
    if (input.due) {
      if (!isOpen(r)) return false;
      const d = dueBucket(r.nextStepDate, ctx.today);
      if (input.due === "overdue" && d !== "overdue") return false;
      if (input.due === "today" && d !== "today") return false;
      if (input.due === "week" && !["overdue", "today", "soon"].includes(d)) return false;
    }
    return true;
  });
  // Soonest follow-up first, then the strongest prospects.
  hits.sort(
    (a, b) =>
      (a.nextStepDate ?? "9999").localeCompare(b.nextStepDate ?? "9999") || (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0),
  );
  const limit = input.limit ?? 10;
  return ok({
    prospects: hits.slice(0, limit).map((r) => prospectBrief(r, ctx.appUrl, ctx.today)),
    total: hits.length,
    ...(wb.warnings.length ? { sheet_warnings: wb.warnings.slice(0, 3) } : {}),
  });
}

/** One record by ID, or by exact name when the ID doesn't match; two of the same name are an ambiguity. */
async function findProspect(ref: string, kind?: ProspectKind): Promise<{ ok: true; value: ProspectRecord } | { ok: false; error: string }> {
  const wb = await loadWorkbook();
  const pool = kind ? recordsOf(wb, kind) : allRecords(wb);
  const q = ref.trim().toLowerCase();
  const byId = pool.filter((r) => r.id.toLowerCase() === q);
  const hits = byId.length ? byId : pool.filter((r) => r.name.trim().toLowerCase() === q);
  if (hits.length === 1) return { ok: true, value: hits[0] };
  if (hits.length > 1)
    return { ok: false, error: `Several prospects match "${ref}": ${hits.slice(0, 5).map((r) => `${r.name} (${r.kind} ${r.id})`).join(", ")}. Give the ID.` };
  return { ok: false, error: `No prospect "${ref}". Search for it first to get its ID.` };
}

export async function getProspect(ctx: RequestCtx, input: ToolInput<"get_prospect">): Promise<ToolResult> {
  const found = await findProspect(input.prospect, input.kind);
  if (!found.ok) return fail(found.error);
  const detail = await readProspectDetail(found.value.kind, found.value.id);
  if (!detail) return fail("That prospect is no longer in the sheet.");
  return ok(prospectDetail(detail.record, detail.activity, ctx.appUrl, ctx.today));
}

/** The caller's prospect follow-ups due today or overdue (admins only; get_my_work calls it). */
export async function dueFollowUps(ctx: RequestCtx) {
  const wb = await loadWorkbook();
  const rows = allRecords(wb).map(toRow);
  const byKey = new Map(allRecords(wb).map((r) => [`${r.kind}:${r.id}`, r]));
  return myTasks(rows, ctx.caller.name ?? "", ctx.today)
    .filter((t) => t.reason !== "new")
    .slice(0, 15)
    .map((t) => prospectBrief(byKey.get(`${t.row.kind}:${t.row.id}`)!, ctx.appUrl, ctx.today));
}

/* ---------- log_touch: planned now, logged on Confirm ---------- */

export async function planTouch(
  ctx: RequestCtx,
  input: ToolInput<"log_touch">,
  store: { set(key: string, value: unknown, ttlMs?: number): Promise<void> },
): Promise<ToolResult> {
  const found = await findProspect(input.prospect, input.kind);
  if (!found.ok) return fail(found.error);
  const r = found.value;
  const stageBefore = stageName(r.stage);
  const parsed = touchSchema.safeParse({
    kind: r.kind,
    id: r.id,
    name: r.name,
    channel: input.channel,
    direction: input.direction ?? "Outbound",
    outcome: input.outcome,
    durationMin: input.duration_min ?? null,
    summary: input.what_they_said,
    statusAfter: input.stage_after ?? (STAGES as readonly string[])[r.stage] ?? STAGES[0],
    nextStep: input.next_step ?? null,
    nextStepDate: input.next_step_date ?? null,
    fields: {},
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That touch isn't valid.");
  const touch = parsed.data;
  const plan: TouchPlan = { touch, stageBefore };
  const nonce = randomUUID();
  const pending: PendingAction = {
    kind: "log_touch",
    workspaceId: ctx.workspaceId,
    slackUserId: ctx.slackUserId,
    appUserId: ctx.caller.userId!,
    threadId: ctx.threadId,
    summary: touchSummary({
      name: r.name,
      channel: touch.channel,
      direction: touch.direction,
      outcome: touch.outcome,
      summary: touch.summary,
      stageBefore,
      stageAfter: touch.statusAfter,
      nextStep: touch.nextStep,
      nextStepDate: touch.nextStepDate,
    }),
    createdAt: Date.now(),
    plan,
  };
  await store.set(pendingKey(nonce), pending, CONFIRM_TTL_MS);
  ctx.outbox.confirmations.push({ nonce, summary: pending.summary });
  return ok({ prospect: prospectBrief(r, ctx.appUrl, ctx.today), status: "awaiting confirmation" });
}

/** Log a confirmed touch as the admin who confirmed it, and return the prospect's card. */
export async function applyTouch(plan: TouchPlan, workspaceId: string, me: { id: string; name: string }, appUrl: string) {
  const res = await logProspectTouch(plan.touch, me.name, invalidateProspects, { workspaceId, userId: me.id });
  if (!res.ok) return { ok: false as const, error: res.message };
  const t = touchSchema.parse(plan.touch);
  const snap = await loadSnapshot(workspaceId, "prospect", `${t.kind}:${t.id}`, {
    name: t.name,
    from: plan.stageBefore === t.statusAfter ? null : plan.stageBefore,
    to: t.statusAfter,
  });
  const card = snap ? recordMessage(snap, `*${escapeMrkdwn(me.name)}* logged a ${t.channel.toLowerCase()}: ${t.outcome}`, appUrl) : null;
  return { ok: true as const, card };
}
