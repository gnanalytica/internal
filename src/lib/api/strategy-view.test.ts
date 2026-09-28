import { describe, expect, it } from "vitest";

import type { StrategyModel } from "@/lib/strategy";
import type { DeriveCtx } from "@/lib/strategy-derive";

import { buildStrategyView, unitEconomics } from "./strategy-view";

const ctx = (over: Partial<DeriveCtx> = {}): DeriveCtx => ({ pricingModel: null, milestones: [], dealsWonThisQuarter: 0, ...over });

const model: StrategyModel = {
  vision: "Every valuation in India, signed in an hour",
  stages: [
    { id: "s1", label: "Pilot", status: "done", kpis: [] },
    { id: "s2", label: "Paid", status: "active", kpis: [{ name: "Won", autoKey: "deals.trialWon", target: 4 }, { name: "NPS", current: 30, target: 60 }] },
    { id: "s3", label: "Scale", status: "goal", kpis: [] },
  ],
  signals: [
    { id: "a", pillar: "desirability", claim: "asked for it", ok: true },
    { id: "b", pillar: "desirability", claim: "pays", ok: false, date: "2020-01-01" },
    { id: "c", pillar: "viability", claim: "margin", ok: false, autoKey: "pricing.margin.std" },
  ],
  initiatives: [],
  northStar: { label: "Reports / week", current: 30, target: 120 },
  scoreHistory: [{ date: "2026-07-01", d: 20, f: 40, v: 60 }],
};

describe("buildStrategyView", () => {
  it("resolves auto values the way the web page does", () => {
    const v = buildStrategyView(
      model,
      ctx({
        dealsWonThisQuarter: 2,
        pricingModel: { currency: "INR", segments: [{ id: "std", label: "Standard", model: "usage", costPerUnit: 40, params: { pricePerUnit: 200 } }] },
      }),
    );
    expect(v.model.stages[1].kpis[0].current).toBe(2);
    // 80% margin ≥ 50% flips the auto signal to ✓.
    expect(v.model.signals.find((s) => s.id === "c")?.ok).toBe(true);
    expect(v.autoKeys.sort()).toEqual(["deals.trialWon", "pricing.margin.std"]);
  });

  it("scores pillars as ✓ ÷ signals and leaves an empty pillar unscored", () => {
    const v = buildStrategyView(model, ctx());
    const d = v.pillars.find((p) => p.id === "desirability")!;
    expect(d).toMatchObject({ score: 50, ok: 1, total: 2, history: [20] });
    expect(v.pillars.find((p) => p.id === "feasibility")).toMatchObject({ score: null, total: 0, history: [40] });
    expect(v.pillars.map((p) => p.id)).toEqual(["desirability", "feasibility", "viability"]);
  });

  it("derives stage progress, KPI states and the route position", () => {
    const v = buildStrategyView(model, ctx({ dealsWonThisQuarter: 2 }));
    const paid = v.stages.find((s) => s.id === "s2")!;
    expect(paid.progress).toBeCloseTo(0.5);
    expect(paid.kpiStates).toEqual(["warn", "warn"]);
    // One of three stages done, the active second one half way.
    expect(v.routeProgress).toBeCloseTo(1 / 3 + 0.5 / 3);
  });

  it("flags stale hand-set evidence but never an auto signal", () => {
    const v = buildStrategyView(model, ctx(), new Date("2026-09-28"));
    expect(v.staleSignalIds).toEqual(["b"]);
  });

  it("reports north-star progress as a capped percentage", () => {
    expect(buildStrategyView(model, ctx()).northStarPct).toBe(25);
    expect(buildStrategyView({ ...model, northStar: { label: "x", current: 500, target: 100 } }, ctx()).northStarPct).toBe(100);
    expect(buildStrategyView({ ...model, northStar: undefined }, ctx()).northStarPct).toBeNull();
  });
});

describe("unitEconomics", () => {
  it("gives per-unit and heavy-tail margins, and none for a licence segment", () => {
    const ue = unitEconomics({
      currency: "INR",
      unitLabel: "report",
      segments: [
        { id: "u", label: "Usage", model: "usage", costPerUnit: 50, costPerUnitHeavy: 100, params: { pricePerUnit: 200 } },
        { id: "l", label: "Bank", model: "license", params: { setupFee: 500000 } },
      ],
    });
    expect(ue.unitLabel).toBe("report");
    expect(ue.segments[0]).toMatchObject({ price: 200, cost: 50, marginPct: 75, heavyMarginPct: 50 });
    expect(ue.segments[1]).toMatchObject({ price: null, marginPct: null, heavyMarginPct: null });
  });

  it("is empty without a pricing model", () => {
    expect(unitEconomics(null)).toEqual({ currency: null, unitLabel: null, segments: [] });
  });
});
