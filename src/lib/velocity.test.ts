import { describe, expect, it } from "vitest";

import { computeVelocity, type VelocityCycle } from "@/lib/velocity";

const NOW = new Date("2026-10-10T00:00:00Z");

function cycle(
  id: string,
  endsISO: string,
  issues: { status: string; estimate: number | null }[],
): VelocityCycle {
  return { id, name: id.toUpperCase(), endDate: new Date(endsISO), issues };
}

const DONE_3 = { status: "done", estimate: 3 };
const DONE_2 = { status: "done", estimate: 2 };
const OPEN_5 = { status: "todo", estimate: 5 };

describe("computeVelocity", () => {
  it("averages completed points over finished cycles", () => {
    const v = computeVelocity({
      cycles: [
        cycle("s1", "2026-09-20T00:00:00Z", [DONE_3, DONE_2]), // 5
        cycle("s2", "2026-09-27T00:00:00Z", [DONE_3, DONE_3, OPEN_5]), // 6
      ],
      now: NOW,
    });
    expect(v.cycles.map((c) => c.donePoints)).toEqual([5, 6]);
    expect(v.averagePoints).toBe(5.5);
  });

  it("ignores a cycle that hasn't ended, so partial work doesn't drag the average", () => {
    const v = computeVelocity({
      cycles: [
        cycle("s1", "2026-09-20T00:00:00Z", [DONE_3, DONE_3]), // 6, finished
        cycle("s2", "2026-12-01T00:00:00Z", [DONE_2]), // still running
      ],
      now: NOW,
    });
    expect(v.cycles.map((c) => c.id)).toEqual(["s1"]);
    expect(v.averagePoints).toBe(6);
  });

  it("orders finished cycles oldest first regardless of input order", () => {
    const v = computeVelocity({
      cycles: [
        cycle("s2", "2026-09-27T00:00:00Z", [DONE_2]),
        cycle("s1", "2026-09-20T00:00:00Z", [DONE_3]),
      ],
      now: NOW,
    });
    expect(v.cycles.map((c) => c.id)).toEqual(["s1", "s2"]);
  });

  it("weights unestimated tasks as one point", () => {
    const v = computeVelocity({
      cycles: [
        cycle("s1", "2026-09-20T00:00:00Z", [
          { status: "done", estimate: null },
          { status: "done", estimate: null },
        ]),
      ],
      now: NOW,
    });
    expect(v.averagePoints).toBe(2);
  });

  it("excludes canceled work from both completed and committed", () => {
    const v = computeVelocity({
      cycles: [
        cycle("s1", "2026-09-20T00:00:00Z", [DONE_3, { status: "canceled", estimate: 100 }]),
      ],
      now: NOW,
    });
    expect(v.cycles[0].donePoints).toBe(3);
    // 3 of 3 committed — the canceled 100 must not make this look like 3%.
    expect(v.cycles[0].completionPct).toBe(100);
  });

  it("projects how many cycles the outstanding work needs", () => {
    const v = computeVelocity({
      cycles: [
        cycle("s1", "2026-09-20T00:00:00Z", [DONE_3, DONE_2]), // 5
        cycle("s2", "2026-09-27T00:00:00Z", [DONE_3, DONE_2]), // 5
      ],
      outstandingPoints: 22,
      now: NOW,
    });
    expect(v.averagePoints).toBe(5);
    expect(v.cyclesToClear).toBe(5); // ceil(22 / 5)
  });

  it("projects nothing without history or without outstanding work", () => {
    expect(computeVelocity({ cycles: [], outstandingPoints: 10, now: NOW }).cyclesToClear).toBeNull();
    expect(
      computeVelocity({
        cycles: [cycle("s1", "2026-09-20T00:00:00Z", [DONE_3])],
        outstandingPoints: 0,
        now: NOW,
      }).cyclesToClear,
    ).toBeNull();
  });

  it("averages only the recent window but still reports full history", () => {
    const cycles = Array.from({ length: 8 }, (_, i) =>
      // Eight weekly cycles; the first two completed far more than the rest.
      cycle(`s${i + 1}`, `2026-08-0${i + 1}T00:00:00Z`, [
        { status: "done", estimate: i < 2 ? 50 : 5 },
      ]),
    );
    const v = computeVelocity({ cycles, now: NOW, window: 6 });
    expect(v.cycles).toHaveLength(8);
    expect(v.averagePoints).toBe(5); // the two 50-point outliers fall outside the window
  });
});
