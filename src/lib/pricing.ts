/**
 * Per-segment pricing model — the single source of truth read by the Strategy
 * (Viability) and Growth surfaces. Numbers live in `projects.pricingModel`;
 * this module only derives from them (never hardcodes a price).
 */
export type PricingSegmentModel = "usage" | "subscription+usage" | "license";

export interface PricingSegment {
  id: string;
  label: string;
  model: PricingSegmentModel;
  costPerUnit?: number;
  params: Record<string, number | string>;
  creditSources?: string[];
}

export interface PricingModel {
  currency?: string;
  unitLabel?: string;
  segments: PricingSegment[];
}

/**
 * Per-unit economics for a segment, or null when the segment has no per-unit
 * price (e.g. a `license` model priced by setup + annual fee, not per unit).
 */
export function segmentUnitMargin(
  seg: PricingSegment,
): { price: number; cost: number; contribution: number; marginPct: number } | null {
  const price = typeof seg.params.pricePerUnit === "number" ? seg.params.pricePerUnit : null;
  if (price == null) return null;
  const cost = seg.costPerUnit ?? 0;
  const contribution = price - cost;
  const marginPct = price > 0 ? Math.round((contribution / price) * 100) : 0;
  return { price, cost, contribution, marginPct };
}
