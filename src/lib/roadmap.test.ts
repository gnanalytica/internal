import { describe, expect, it } from "vitest";

import {
  barMetrics,
  computeRange,
  quarterLabel,
  quartersForRange,
  todayOffset,
} from "@/lib/roadmap";

const today = new Date("2024-03-15T00:00:00Z");

describe("computeRange", () => {
  it("falls back to a min-month window when no dates exist", () => {
    const r = computeRange([], today, 4);
    expect(r.months).toHaveLength(4);
    expect(r.start.toISOString().slice(0, 7)).toBe("2024-03");
  });

  it("spans from the earliest start to the latest target month", () => {
    const r = computeRange(
      [
        { startDate: "2024-02-10", targetDate: "2024-03-20" },
        { startDate: "2024-04-01", targetDate: "2024-05-15" },
      ],
      today,
      1,
    );
    expect(r.start.toISOString().slice(0, 7)).toBe("2024-02");
    // end is exclusive, first day of the month after the latest target (May)
    expect(r.end.toISOString().slice(0, 7)).toBe("2024-06");
    expect(r.months.map((m) => m.toISOString().slice(0, 7))).toEqual([
      "2024-02",
      "2024-03",
      "2024-04",
      "2024-05",
    ]);
  });

  it("enforces the minimum number of months", () => {
    const r = computeRange([{ startDate: "2024-03-01", targetDate: "2024-03-10" }], today, 4);
    expect(r.months.length).toBeGreaterThanOrEqual(4);
  });
});

describe("barMetrics", () => {
  it("returns null when neither date is set", () => {
    const r = computeRange([{ startDate: "2024-02-01", targetDate: "2024-05-01" }], today, 1);
    expect(barMetrics({}, r)).toBeNull();
  });

  it("positions a bar inside the range", () => {
    const r = computeRange([{ startDate: "2024-02-01", targetDate: "2024-06-01" }], today, 1);
    const bar = barMetrics({ startDate: "2024-03-01", targetDate: "2024-04-01" }, r)!;
    expect(bar.leftPct).toBeGreaterThan(0);
    expect(bar.leftPct).toBeLessThan(100);
    expect(bar.widthPct).toBeGreaterThan(0);
  });

  it("keeps a minimum visible width", () => {
    const r = computeRange([{ startDate: "2024-01-01", targetDate: "2024-12-31" }], today, 1);
    const bar = barMetrics({ startDate: "2024-06-01", targetDate: "2024-06-01" }, r)!;
    expect(bar.widthPct).toBeGreaterThan(0);
  });
});

describe("todayOffset", () => {
  it("returns a fraction when today is inside the range", () => {
    const r = computeRange([{ startDate: "2024-01-01", targetDate: "2024-06-01" }], today, 1);
    const off = todayOffset(r, today);
    expect(off).not.toBeNull();
    expect(off!).toBeGreaterThan(0);
    expect(off!).toBeLessThan(1);
  });

  it("returns null when today is outside the range", () => {
    const r = computeRange([{ startDate: "2024-01-01", targetDate: "2024-02-01" }], today, 1);
    expect(todayOffset(r, new Date("2025-01-01T00:00:00Z"))).toBeNull();
  });
});

describe("quarterLabel", () => {
  it("labels quarters by month", () => {
    expect(quarterLabel(new Date(Date.UTC(2026, 0, 1)))).toBe("Q1 '26"); // Jan
    expect(quarterLabel(new Date(Date.UTC(2026, 6, 1)))).toBe("Q3 '26"); // Jul
    expect(quarterLabel(new Date(Date.UTC(2026, 11, 1)))).toBe("Q4 '26"); // Dec
  });
});

describe("quartersForRange", () => {
  it("buckets the range's months into positioned quarters", () => {
    // Range Jul 2026 .. (exclusive) Jan 2027 = Q3'26 + Q4'26.
    const range = computeRange(
      [{ startDate: new Date(Date.UTC(2026, 6, 1)), targetDate: new Date(Date.UTC(2026, 11, 20)) }],
      new Date(Date.UTC(2026, 6, 15)),
    );
    const qs = quartersForRange(range);
    expect(qs.map((q) => q.label)).toEqual(["Q3 '26", "Q4 '26"]);
    expect(qs[0].leftPct).toBeCloseTo(0, 5);
    const last = qs[qs.length - 1];
    expect(last.leftPct + last.widthPct).toBeCloseTo(100, 0);
  });
});
