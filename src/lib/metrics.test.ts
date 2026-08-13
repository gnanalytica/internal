import { describe, expect, it } from "vitest";

import { formatTarget, readTarget } from "@/lib/metrics";

describe("readTarget", () => {
  it("returns null when there is nothing to compare", () => {
    expect(readTarget(null, 90)).toBeNull();
    expect(readTarget(80, null)).toBeNull();
    expect(readTarget(Number.NaN, 90)).toBeNull();
  });

  it("reads an `above` target as a floor", () => {
    expect(readTarget(90, 90)).toEqual({ onTrack: true, progress: 100, gap: 0 });
    expect(readTarget(45, 90)).toEqual({ onTrack: false, progress: 50, gap: 45 });
    expect(readTarget(120, 90)?.onTrack).toBe(true);
  });

  it("reads a `below` target as a ceiling", () => {
    // 30-second PDF budget: 30 is met, 45 is half way down from 60, 60+ is 0%.
    expect(readTarget(30, 30, "below")).toEqual({ onTrack: true, progress: 100, gap: 0 });
    expect(readTarget(45, 30, "below")).toEqual({ onTrack: false, progress: 50, gap: 15 });
    expect(readTarget(60, 30, "below")?.progress).toBe(0);
  });

  it("treats a zero target as met-or-not, with no proportional scale", () => {
    expect(readTarget(0, 0, "below")).toEqual({ onTrack: true, progress: 100, gap: 0 });
    expect(readTarget(3, 0, "below")).toEqual({ onTrack: false, progress: 0, gap: 3 });
  });

  it("clamps progress to 0–100", () => {
    expect(readTarget(500, 90)?.progress).toBe(100);
    expect(readTarget(-20, 90)?.progress).toBe(0);
  });

  it("never reports a gap once the target is met", () => {
    expect(readTarget(99.9, 99.5)?.gap).toBe(0);
    expect(readTarget(2, 4, "below")?.gap).toBe(0);
  });
});

describe("formatTarget", () => {
  it("renders the operator, number and unit", () => {
    expect(formatTarget(90, "above", "%")).toBe("≥ 90%");
    expect(formatTarget(30, "below", "sec")).toBe("≤ 30 sec");
    expect(formatTarget(5, "above", "leads")).toBe("≥ 5 leads");
    expect(formatTarget(99.5, "above", "%")).toBe("≥ 99.5%");
  });

  it("omits a missing unit and returns null with no target", () => {
    expect(formatTarget(12, "above", null)).toBe("≥ 12");
    expect(formatTarget(null, "above", "%")).toBeNull();
  });
});
