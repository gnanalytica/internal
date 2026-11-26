import { describe, expect, it } from "vitest";

import { cyclesInScope } from "./cycle-scope";

const now = new Date("2026-11-27T12:00:00Z");
const c = (id: string, projectId: string, start: string, end: string) => ({ id, projectId, startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${end}T00:00:00Z`) });
const cycles = [
  c("a1", "A", "2026-11-01", "2026-11-14"),
  c("a2", "A", "2026-11-15", "2026-11-29"),
  c("a3", "A", "2026-11-30", "2026-12-13"),
  c("a4", "A", "2026-12-14", "2026-12-27"),
  c("b1", "B", "2026-10-01", "2026-10-31"),
  c("b0", "B", "2026-09-01", "2026-09-30"),
];

describe("cyclesInScope", () => {
  it("current: every cycle running today", () => {
    expect([...cyclesInScope("current", cycles, now)]).toEqual(["a2"]);
  });
  it("next: each project's soonest upcoming cycle", () => {
    expect([...cyclesInScope("next", cycles, now)]).toEqual(["a3"]);
  });
  it("previous: each project's latest finished cycle", () => {
    expect([...cyclesInScope("previous", cycles, now)].sort()).toEqual(["a1", "b1"]);
  });
});
