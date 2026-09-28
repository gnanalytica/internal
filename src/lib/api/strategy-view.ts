/**
 * The strategy surface as the API serves it: the saved model with its `auto`
 * values resolved (exactly as the web page renders it), plus the scores and
 * states the web derives while rendering — so a client shows the same numbers
 * without re-implementing the rules.
 *
 * Pure: the route assembles `DeriveCtx`, this only derives.
 */
import { segmentUnitMargin, segmentUnitMarginHeavy, type PricingModel } from "@/lib/pricing";
import {
  kpiState,
  PILLARS,
  pillarScore,
  routeProgress,
  signalIsStale,
  stageProgress,
  type KpiState,
  type StrategyModel,
} from "@/lib/strategy";
import { applyAuto, collectAutoKeys, resolveAuto, type AutoValue, type DeriveCtx } from "@/lib/strategy-derive";

export type StrategyView = {
  model: StrategyModel;
  routeProgress: number;
  pillars: { id: string; label: string; question: string; score: number | null; ok: number; total: number; history: number[] }[];
  stages: { id: string; progress: number; kpiStates: KpiState[] }[];
  staleSignalIds: string[];
  autoKeys: string[];
  northStarPct: number | null;
  unitEconomics: {
    currency: string | null;
    unitLabel: string | null;
    segments: { id: string; label: string; model: string; price: number | null; cost: number | null; marginPct: number | null; heavyMarginPct: number | null }[];
  };
};

export function buildStrategyView(saved: StrategyModel, ctx: DeriveCtx, now: Date = new Date()): StrategyView {
  const autoKeys = collectAutoKeys(saved);
  const auto: Record<string, AutoValue> = Object.fromEntries(autoKeys.map((k) => [k, resolveAuto(k, ctx)]));
  const model = applyAuto(saved, auto);
  const ns = model.northStar;
  return {
    model,
    routeProgress: routeProgress(model.stages),
    pillars: PILLARS.map((p) => ({
      ...p,
      ...pillarScore(model.signals, p.id),
      history: (model.scoreHistory ?? []).map((h) => (p.id === "desirability" ? h.d : p.id === "feasibility" ? h.f : h.v)),
    })),
    stages: model.stages.map((s) => ({ id: s.id, progress: stageProgress(s), kpiStates: s.kpis.map(kpiState) })),
    staleSignalIds: model.signals.filter((s) => signalIsStale(s, now)).map((s) => s.id),
    autoKeys,
    northStarPct:
      ns && typeof ns.current === "number" && typeof ns.target === "number" && ns.target > 0
        ? Math.min(100, Math.round((ns.current / ns.target) * 100))
        : null,
    unitEconomics: unitEconomics(ctx.pricingModel),
  };
}

export function unitEconomics(pricing: PricingModel | null): StrategyView["unitEconomics"] {
  return {
    currency: pricing?.currency ?? null,
    unitLabel: pricing?.unitLabel ?? null,
    segments: (pricing?.segments ?? []).map((seg) => {
      const base = segmentUnitMargin(seg);
      const heavy = segmentUnitMarginHeavy(seg);
      return {
        id: seg.id,
        label: seg.label,
        model: seg.model,
        price: base?.price ?? null,
        cost: base?.cost ?? null,
        marginPct: base?.marginPct ?? null,
        heavyMarginPct: heavy?.marginPct ?? null,
      };
    }),
  };
}
