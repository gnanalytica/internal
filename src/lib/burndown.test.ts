import { describe, expect, it } from "vitest";

import { computeBurndown } from "./burndown";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("computeBurndown", () => {
  const start = d("2026-07-01");
  const end = d("2026-07-03");

  it("returns totalPoints 0 and no points for an empty cycle", () => {
    const r = computeBurndown({ issues: [], doneEvents: [], start, end, now: end });
    expect(r.totalPoints).toBe(0);
    expect(r.points).toEqual([]);
  });

  it("weights by estimate, falling back to 1", () => {
    const r = computeBurndown({
      issues: [
        { id: "a", estimate: 3, createdAt: start },
        { id: "b", estimate: null, createdAt: start },
      ],
      doneEvents: [],
      start,
      end,
      now: end,
    });
    expect(r.totalPoints).toBe(4);
    expect(r.points[0].remaining).toBe(4);
    expect(r.points[r.points.length - 1].remaining).toBe(4);
  });

  it("drops remaining when an issue is completed", () => {
    const r = computeBurndown({
      issues: [
        { id: "a", estimate: 2, createdAt: start },
        { id: "b", estimate: 2, createdAt: start },
      ],
      doneEvents: [{ issueId: "a", at: d("2026-07-02") }],
      start,
      end,
      now: end,
    });
    expect(r.points.map((p) => p.remaining)).toEqual([4, 2, 2]);
  });

  it("adds scope for an issue created mid-cycle", () => {
    const r = computeBurndown({
      issues: [
        { id: "a", estimate: 1, createdAt: start },
        { id: "b", estimate: 1, createdAt: d("2026-07-02") },
      ],
      doneEvents: [],
      start,
      end,
      now: end,
    });
    expect(r.points.map((p) => p.remaining)).toEqual([1, 2, 2]);
  });

  it("ideal line runs from totalPoints to 0 across the span", () => {
    const r = computeBurndown({
      issues: [{ id: "a", estimate: 4, createdAt: start }],
      doneEvents: [],
      start,
      end,
      now: end,
    });
    expect(r.points[0].ideal).toBe(4);
    expect(r.points[r.points.length - 1].ideal).toBe(0);
  });

  it("stops at now when the cycle is mid-flight", () => {
    const r = computeBurndown({
      issues: [{ id: "a", estimate: 1, createdAt: start }],
      doneEvents: [],
      start,
      end,
      now: d("2026-07-02"),
    });
    // days: 07-01, 07-02 (now) — 07-03 not yet reached
    expect(r.points.map((p) => p.date)).toEqual(["2026-07-01", "2026-07-02"]);
  });
});
