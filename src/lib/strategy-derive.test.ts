import { describe, expect, it } from "vitest";

import {
  applyAuto,
  collectAutoKeys,
  resolveAuto,
  type DeriveCtx,
} from "@/lib/strategy-derive";
import type { StrategyModel } from "@/lib/strategy";

const ctx: DeriveCtx = {
  pricingModel: {
    segments: [
      { id: "solo", label: "Solo", model: "usage", costPerUnit: 20, params: { pricePerUnit: 200 } },
      { id: "bank", label: "Bank", model: "license", params: { license: 1200000 } },
    ],
  },
  milestones: [
    { id: "m1", name: "MVP", total: 4, closed: 4 },
    { id: "m2", name: "Edge cases", total: 10, closed: 6 },
    { id: "m0", name: "Empty", total: 0, closed: 0 },
  ],
  dealsWonThisQuarter: 2,
};

describe("resolveAuto", () => {
  it("pricing.margin.<seg> → marginPct, ok at ≥50", () => {
    expect(resolveAuto("pricing.margin.solo", ctx)).toEqual({ value: 90, ok: true });
  });
  it("pricing.margin for a license segment (no per-unit price) → null", () => {
    expect(resolveAuto("pricing.margin.bank", ctx)).toEqual({ value: null });
  });
  it("pricing.margin for an unknown segment → null", () => {
    expect(resolveAuto("pricing.margin.nope", ctx)).toEqual({ value: null });
  });
  it("milestone.progress.<id> → pct, ok only at 100", () => {
    expect(resolveAuto("milestone.progress.m1", ctx)).toEqual({ value: 100, ok: true });
    expect(resolveAuto("milestone.progress.m2", ctx)).toEqual({ value: 60, ok: false });
    expect(resolveAuto("milestone.progress.m0", ctx)).toEqual({ value: null });
  });
  it("deals.trialWon → count, ok when > 0", () => {
    expect(resolveAuto("deals.trialWon", ctx)).toEqual({ value: 2, ok: true });
    expect(resolveAuto("deals.trialWon", { ...ctx, dealsWonThisQuarter: 0 })).toEqual({
      value: 0,
      ok: false,
    });
  });
  it("analytics.northStar and unknown keys → null (not wired)", () => {
    expect(resolveAuto("analytics.northStar", ctx)).toEqual({ value: null });
    expect(resolveAuto("bogus.key", ctx)).toEqual({ value: null });
  });
});

const model: StrategyModel = {
  stages: [
    {
      id: "p1",
      label: "Stage 1",
      status: "active",
      kpis: [
        { name: "margin", autoKey: "pricing.margin.solo" },
        { name: "manual", current: 5, target: 10 },
      ],
    },
  ],
  signals: [
    { id: "a", pillar: "viability", claim: "margin ok", ok: false, autoKey: "pricing.margin.solo" },
    { id: "b", pillar: "desirability", claim: "manual", ok: true },
  ],
  initiatives: [],
  northStar: { label: "reports/mo", target: 100, autoKey: "analytics.northStar" },
  proofMetrics: [{ label: "won", autoKey: "deals.trialWon" }],
};

describe("collectAutoKeys", () => {
  it("collects and dedupes keys from signals, kpis, northStar, proofMetrics", () => {
    expect(collectAutoKeys(model).sort()).toEqual([
      "analytics.northStar",
      "deals.trialWon",
      "pricing.margin.solo",
    ]);
  });
});

describe("applyAuto", () => {
  const auto = {
    "pricing.margin.solo": { value: 90, ok: true },
    "deals.trialWon": { value: 2, ok: true },
    "analytics.northStar": { value: null },
  };
  it("overrides auto signal ok, leaves manual signals untouched", () => {
    const out = applyAuto(model, auto);
    expect(out.signals.find((s) => s.id === "a")!.ok).toBe(true);
    expect(out.signals.find((s) => s.id === "b")!.ok).toBe(true);
  });
  it("fills kpi and proof-metric currents; null resolutions leave fields alone", () => {
    const out = applyAuto(model, auto);
    expect(out.stages[0].kpis[0].current).toBe(90);
    expect(out.stages[0].kpis[1].current).toBe(5);
    expect(out.proofMetrics![0].current).toBe(2);
    expect(out.northStar!.current).toBeUndefined();
  });
});
