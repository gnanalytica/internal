import { describe, expect, it } from "vitest";

import { segmentUnitMargin, segmentUnitMarginHeavy, type PricingSegment } from "@/lib/pricing";

const usage: PricingSegment = {
  id: "solo", label: "Independent", model: "usage",
  costPerUnit: 20, params: { pricePerUnit: 200 },
  creditSources: ["free", "referral", "payg", "bundle"],
};

const license: PricingSegment = {
  id: "bank", label: "Bank / BYOC", model: "license",
  params: { setupFee: 500000, license: 1200000 },
};

describe("segmentUnitMargin", () => {
  it("computes contribution and margin% for a usage segment", () => {
    expect(segmentUnitMargin(usage)).toEqual({
      price: 200, cost: 20, contribution: 180, marginPct: 90,
    });
  });

  it("treats a missing costPerUnit as zero cost", () => {
    const m = segmentUnitMargin({ ...usage, costPerUnit: undefined });
    expect(m).toEqual({ price: 200, cost: 0, contribution: 200, marginPct: 100 });
  });

  it("returns null when there is no per-unit price (license)", () => {
    expect(segmentUnitMargin(license)).toBeNull();
  });
});

describe("segmentUnitMarginHeavy", () => {
  it("uses costPerUnitHeavy when present", () => {
    const m = segmentUnitMarginHeavy({ ...usage, costPerUnitHeavy: 70 });
    expect(m).toEqual({ price: 200, cost: 70, contribution: 130, marginPct: 65 });
  });
  it("falls back to costPerUnit when no heavy cost is set", () => {
    expect(segmentUnitMarginHeavy(usage)).toEqual(segmentUnitMargin(usage));
  });
  it("returns null without a per-unit price", () => {
    expect(segmentUnitMarginHeavy(license)).toBeNull();
  });
});
