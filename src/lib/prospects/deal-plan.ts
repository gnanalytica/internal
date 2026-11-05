import { OPEN_DEAL_STAGES, type DealStageId } from "@/lib/departments";
import { stageIndex } from "./parse";
import { STAGES, type ProspectKind, type Stage } from "./schema";

/**
 * When a prospect becomes a deal. The pipeline lives in the Prospects sheet;
 * once a prospect has seen a demo it is real enough to forecast, so it gets a
 * deal on the product's Sales board, and the deal follows the prospect from
 * there. Pure — the database side is in deals.ts.
 */

/** The deal stage a prospect stage implies. Stages before "Demo done" imply no deal. */
export const DEAL_STAGE_FOR: Partial<Record<Stage, DealStageId>> = {
  "Demo done": "qualified",
  "Pilot running": "proposal",
  Won: "won",
  Lost: "lost",
};

/** How a deal remembers its prospect: stable across renames and row moves. */
export const prospectRef = (kind: ProspectKind, id: string): string => `${kind}:${id}`;

/**
 * The deal stage a status change asks for, or null when it asks for nothing:
 * the stage didn't change (a re-save, or a touch logged at the same stage), or
 * the new stage is too early for a deal. Statuses are matched as the sheet
 * reads them, case-insensitively; a blank or unknown one is "Not contacted".
 */
export function dealStageForChange(before: string | null | undefined, after: string): DealStageId | null {
  const to = stageIndex(after);
  if (before !== null && before !== undefined && stageIndex(before) === to) return null;
  return DEAL_STAGE_FOR[STAGES[to]] ?? null;
}

export type DealStep = { action: "none" } | { action: "create"; stage: DealStageId } | { action: "move"; stage: DealStageId };

const openRank = (stage: string): number => OPEN_DEAL_STAGES.indexOf(stage as DealStageId);

/**
 * What to do to the prospect's deal, given the stage asked for and the deal as
 * it stands (null if there is none yet).
 *
 * - No deal: open one, unless the prospect was lost — a lost prospect that
 *   never had a deal stays out of the pipeline.
 * - Won or lost: close the deal that way.
 * - An open stage: only ever move the deal forward. Someone may have dragged
 *   it on to negotiation on the board; a later "Demo done" mustn't pull it
 *   back. A closed deal whose prospect is back in play is reopened.
 */
export function planDealStep(target: DealStageId, deal: { stage: string } | null): DealStep {
  if (!deal) return target === "lost" ? { action: "none" } : { action: "create", stage: target };
  if (deal.stage === target) return { action: "none" };
  if (target === "won" || target === "lost") return { action: "move", stage: target };
  const current = openRank(deal.stage);
  if (current < 0) return { action: "move", stage: target }; // closed (won/lost) or unrecognised
  return openRank(target) > current ? { action: "move", stage: target } : { action: "none" };
}

/** The deal's name: the prospect's, as the dashboard shows it. */
export function prospectDealName(row: Record<string, string>, id: string): string {
  const name = row.name?.trim() || [row.institution, row.contact_person].map((v) => v?.trim()).filter(Boolean).join(" · ");
  return name || id;
}
