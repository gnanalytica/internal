import { describe, expect, it } from "vitest";

import { carried, cycleEffort } from "./cycle-effort";

const members = [
  { id: "u1", name: "Parv" },
  { id: "u2", name: "Tasleem" },
];

describe("cycleEffort", () => {
  it("adds points per lead assignee (unestimated = 1, as burndown does), splits done and open, and counts unestimated", () => {
    const { rows, total } = cycleEffort(
      [
        { id: "1", assigneeId: "u1", estimate: 5, status: "done" },
        { id: "2", assigneeId: "u1", estimate: 3, status: "in_progress" },
        { id: "3", assigneeId: "u2", estimate: null, status: "todo" },
        { id: "4", assigneeId: null, estimate: 2, status: "todo" },
        { id: "5", assigneeId: "u2", estimate: 8, status: "canceled" },
      ],
      members,
    );
    expect(rows.map((r) => [r.name, r.tasks, r.points, r.donePoints, r.openPoints, r.unestimated])).toEqual([
      ["Parv", 2, 8, 5, 3, 0],
      ["Tasleem", 1, 1, 0, 1, 1],
      ["Unassigned", 1, 2, 0, 2, 0],
    ]);
    expect(total).toMatchObject({ tasks: 4, points: 11, donePoints: 5, openPoints: 6, unestimated: 1 });
  });

  it("puts a task whose assignee left the workspace under Unassigned", () => {
    expect(cycleEffort([{ id: "1", assigneeId: "gone", estimate: 1, status: "todo" }], members).rows[0].name).toBe("Unassigned");
  });
});

describe("carried", () => {
  it("sums points and counts the unestimated", () => {
    expect(carried([{ estimate: 3 }, { estimate: null }, { estimate: 2 }])).toEqual({ count: 3, points: 6, unestimated: 1 });
  });
});
