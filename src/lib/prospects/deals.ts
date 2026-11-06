import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { deals, projects } from "@/db/schema";
import { apiInvalidate } from "@/lib/api/invalidate";
import { emitDealsWon, emitProspectStage } from "@/lib/slack/notify";
import { dealStageForChange, planDealStep, prospectDealName, prospectRef } from "./deal-plan";
import { PROSPECTS_PRODUCT_KEY, type ProspectKind } from "./schema";

/** Whose workspace a prospect's deal goes in, and who opened it. */
export type DealContext = { workspaceId: string; userId: string | null };

export type ProspectStatusChange = {
  kind: ProspectKind;
  id: string;
  /** The row as it read just before the write, by header name. */
  before: Record<string, string>;
  /** The status just written. */
  status: string;
};

/**
 * Make sure a prospect that has reached "Demo done" or later has a deal on the
 * product's Sales board, at the stage its status implies (see deal-plan.ts).
 *
 * Runs after the sheet write has succeeded, and never throws: the sheet is
 * where the pipeline lives, so a deal that fails to write is logged and left
 * for the next status change rather than failing the save. Every step is a
 * single statement, safe to repeat — the Neon HTTP driver has no
 * transactions — and the unique (workspace, prospect_ref) index means two
 * saves racing can't open two deals.
 */
export async function syncProspectDeal(ctx: DealContext | null, change: ProspectStatusChange): Promise<void> {
  if (!ctx) return;
  // Every stage move is news to Slack, deal or no deal (see src/lib/slack).
  emitProspectStage(ctx, change);
  const target = dealStageForChange(change.before.status ?? null, change.status);
  if (!target) return;
  const ref = prospectRef(change.kind, change.id);
  try {
    const [deal] = await db
      .select({ id: deals.id, stage: deals.stage })
      .from(deals)
      .where(and(eq(deals.workspaceId, ctx.workspaceId), eq(deals.prospectRef, ref)))
      .limit(1);
    const step = planDealStep(target, deal ?? null);
    if (step.action === "none") return;

    if (step.action === "move") {
      await db
        .update(deals)
        .set({ stage: step.stage, updatedAt: new Date() })
        .where(and(eq(deals.id, deal!.id), eq(deals.workspaceId, ctx.workspaceId)));
      if (step.stage === "won") emitDealsWon(ctx.workspaceId, [deal!.id], ctx.userId);
    } else {
      const [product] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.workspaceId, ctx.workspaceId), eq(projects.key, PROSPECTS_PRODUCT_KEY)))
        .limit(1);
      if (!product) {
        console.warn(`[prospects] no ${PROSPECTS_PRODUCT_KEY} project in workspace ${ctx.workspaceId}; no deal opened for ${ref}.`);
        return;
      }
      const [made] = await db
        .insert(deals)
        .values({
          workspaceId: ctx.workspaceId,
          projectId: product.id,
          name: prospectDealName(change.before, change.id),
          stage: step.stage,
          value: 0,
          // Prospects are Indian valuers, firms and banks, sold to from the India entity.
          entity: "India",
          ownerId: ctx.userId,
          sortKey: `z${Date.now()}`,
          prospectRef: ref,
        })
        .onConflictDoNothing({ target: [deals.workspaceId, deals.prospectRef] })
        .returning({ id: deals.id });
      if (made && step.stage === "won") emitDealsWon(ctx.workspaceId, [made.id], ctx.userId);
    }
    apiInvalidate(ctx.workspaceId, "crm");
  } catch (err) {
    console.error(`[prospects] the sheet saved, but the deal for ${ref} didn't:`, err);
  }
}
