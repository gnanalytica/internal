import { convert, entityCurrency, type CurrencyId } from "@/lib/currency";
import { OPEN_DEAL_STAGES, type DealStageId } from "@/lib/departments";

/**
 * What the Pipeline shows of a prospect's deal: its value and whether it is
 * still open. Deals link to prospects through `deals.prospectRef` ("kind:id").
 * Pure, so the board and its tests share it.
 */
export type DealState = "open" | "won" | "lost";
export type DealSummary = { value: number; currency: CurrencyId; state: DealState };

type DealLike = { prospectRef: string | null; value: number | null; entity: string | null; stage: string };

export function dealState(stage: string): DealState {
  if (stage === "won") return "won";
  if (stage === "lost") return "lost";
  return "open";
}

const isOpenStage = (stage: string) => OPEN_DEAL_STAGES.includes(stage as DealStageId);

/** Each prospect's deal by its ref. A prospect with two deals shows its open one. */
export function dealsByProspect(deals: readonly DealLike[]): Map<string, DealSummary> {
  const out = new Map<string, DealSummary>();
  for (const d of deals) {
    if (!d.prospectRef) continue;
    const had = out.get(d.prospectRef);
    if (had && (had.state === "open" || !isOpenStage(d.stage))) continue;
    out.set(d.prospectRef, { value: d.value ?? 0, currency: entityCurrency(d.entity), state: dealState(d.stage) });
  }
  return out;
}

/** Every open deal on the product, and their value in rupees. */
export function openDealTotal(deals: readonly DealLike[]): { count: number; inr: number } {
  const open = deals.filter((d) => isOpenStage(d.stage));
  return { count: open.length, inr: open.reduce((s, d) => s + convert(d.value ?? 0, entityCurrency(d.entity), "INR"), 0) };
}
