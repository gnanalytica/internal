import { describe, expect, it } from "vitest";
import { VALYTICA_PRICING, contributionMargin } from "@/lib/valytica-pricing";

describe("valytica pricing", () => {
  it("has the four canonical tiers in order", () => {
    expect(VALYTICA_PRICING.tiers.map((t) => t.id)).toEqual([
      "trial", "payg", "firm", "byoc",
    ]);
  });

  it("trial is free with a 5-report allowance", () => {
    const trial = VALYTICA_PRICING.tiers.find((t) => t.id === "trial")!;
    expect(trial.monthly).toBe(0);
    expect(trial.perReport).toBe(0);
    expect(trial.allowance).toBe(5);
  });

  it("BYOC is custom (null price)", () => {
    const byoc = VALYTICA_PRICING.tiers.find((t) => t.id === "byoc")!;
    expect(byoc.monthly).toBeNull();
    expect(byoc.perReport).toBeNull();
  });

  it("computes contribution margin per report against the ₹20 unit cost", () => {
    expect(contributionMargin(175)).toBe(155);
  });
});
