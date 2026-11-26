import { describe, expect, it } from "vitest";

import { clampPointsDone, taskPoints } from "./points";

describe("taskPoints", () => {
  it("counts partial progress, all of it once Done, and 1 for unestimated", () => {
    expect(taskPoints({ status: "in_progress", estimate: 5, pointsDone: 3 })).toEqual({ total: 5, done: 3, open: 2 });
    expect(taskPoints({ status: "done", estimate: 5, pointsDone: 3 })).toEqual({ total: 5, done: 5, open: 0 });
    expect(taskPoints({ status: "todo", estimate: null })).toEqual({ total: 1, done: 0, open: 1 });
    expect(taskPoints({ status: "todo", estimate: 2, pointsDone: 9 })).toEqual({ total: 2, done: 2, open: 0 });
  });
});

describe("clampPointsDone", () => {
  it("keeps it within the estimate, needs an estimate, and stores 0 as none", () => {
    expect(clampPointsDone(3, 5)).toBe(3);
    expect(clampPointsDone(8, 5)).toBe(5);
    expect(clampPointsDone(3, null)).toBeNull();
    expect(clampPointsDone(0, 5)).toBeNull();
    expect(clampPointsDone(-2, 5)).toBeNull();
    expect(clampPointsDone(null, 5)).toBeNull();
  });
});
