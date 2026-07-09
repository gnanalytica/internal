/**
 * autoKey → value derivations. A signal/KPI carrying an `autoKey` renders an
 * `auto` badge and cannot be hand-set; its value comes from hub data via this
 * registry. Pure: the server page assembles DeriveCtx, this module only maps.
 */
import { segmentUnitMargin, type PricingModel } from "@/lib/pricing";
import type { StrategyModel } from "@/lib/strategy";

export interface DeriveCtx {
  pricingModel: PricingModel | null;
  milestones: { id: string; name: string; total: number; closed: number }[];
  dealsWonThisQuarter: number;
}

export interface AutoValue {
  value: number | null;
  ok?: boolean; // drives signal ✓/✕ when defined
}

export function resolveAuto(key: string, ctx: DeriveCtx): AutoValue {
  if (key.startsWith("pricing.margin.")) {
    const segId = key.slice("pricing.margin.".length);
    const seg = ctx.pricingModel?.segments.find((s) => s.id === segId);
    const m = seg ? segmentUnitMargin(seg) : null;
    return m ? { value: m.marginPct, ok: m.marginPct >= 50 } : { value: null };
  }
  if (key.startsWith("milestone.progress.")) {
    const id = key.slice("milestone.progress.".length);
    const ms = ctx.milestones.find((x) => x.id === id);
    if (!ms || ms.total === 0) return { value: null };
    const pct = Math.round((ms.closed / ms.total) * 100);
    return { value: pct, ok: pct >= 100 };
  }
  if (key === "deals.trialWon") {
    return { value: ctx.dealsWonThisQuarter, ok: ctx.dealsWonThisQuarter > 0 };
  }
  // analytics.northStar: stub until Analytics wiring exists (spec §8).
  return { value: null };
}

export function collectAutoKeys(model: StrategyModel): string[] {
  const keys = new Set<string>();
  for (const s of model.signals) if (s.autoKey) keys.add(s.autoKey);
  for (const st of model.stages) for (const k of st.kpis) if (k.autoKey) keys.add(k.autoKey);
  if (model.northStar?.autoKey) keys.add(model.northStar.autoKey);
  for (const p of model.proofMetrics ?? []) if (p.autoKey) keys.add(p.autoKey);
  return [...keys];
}

/** Merge resolved auto values into a copy of the model. */
export function applyAuto(
  model: StrategyModel,
  auto: Record<string, AutoValue>,
): StrategyModel {
  const get = (k?: string) => (k ? auto[k] : undefined);
  return {
    ...model,
    signals: model.signals.map((s) => {
      const a = get(s.autoKey);
      return a && a.ok !== undefined ? { ...s, ok: a.ok } : s;
    }),
    stages: model.stages.map((st) => ({
      ...st,
      kpis: st.kpis.map((k) => {
        const a = get(k.autoKey);
        return a && a.value !== null ? { ...k, current: a.value } : k;
      }),
    })),
    northStar: (() => {
      const a = get(model.northStar?.autoKey);
      return a && a.value !== null && model.northStar
        ? { ...model.northStar, current: a.value }
        : model.northStar;
    })(),
    proofMetrics: model.proofMetrics?.map((p) => {
      const a = get(p.autoKey);
      return a && a.value !== null ? { ...p, current: a.value } : p;
    }),
  };
}
