import { describe, expect, it } from "vitest";

import { byDueDay, monthGrid, shiftMonth } from "./task-calendar";

describe("monthGrid", () => {
  it("covers the month in whole Monday-first weeks", () => {
    const g = monthGrid("2026-11");
    expect(g[0][0]).toBe("2026-10-26"); // 1 Nov 2026 is a Sunday
    expect(g[0][6]).toBe("2026-11-01");
    expect(g.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it("starts on the 1st when the month starts on a Monday", () => {
    expect(monthGrid("2026-06")[0][0]).toBe("2026-06-01");
  });
});

describe("shiftMonth", () => {
  it("crosses years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("byDueDay", () => {
  it("buckets by India-time day, and keeps the undated apart", () => {
    const { days, undated } = byDueDay([
      { id: "a", dueDate: new Date("2026-11-27T00:00:00Z") },
      { id: "b", dueDate: "2026-11-26T20:00:00Z" }, // 01:30 on the 27th in India
      { id: "c", dueDate: null },
    ]);
    expect(days.get("2026-11-27")!.map((i) => i.id)).toEqual(["a", "b"]);
    expect(undated.map((i) => i.id)).toEqual(["c"]);
  });
});
