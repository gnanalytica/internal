import { describe, expect, it } from "vitest";

import { FIRST_PAINT_ROWS, GROUP_PAGE, nestGroup, pageGroups, subIssueProgress } from "./issue-tree";

const mk = (id: string, parentId: string | null, status = "todo") =>
  ({ id, parentId, status }) as unknown as {
    id: string;
    parentId: string | null;
    status: string;
  };

describe("nestGroup", () => {
  it("nests a child under its parent when both are in the group", () => {
    const items = [mk("p", null), mk("c", "p")];
    const { rows, suppressed } = nestGroup(items);
    expect(rows.map((r) => r.issue.id)).toEqual(["p"]);
    expect(rows[0].children.map((c) => c.id)).toEqual(["c"]);
    expect(suppressed.has("c")).toBe(true);
  });

  it("keeps a child top-level when its parent is not in the group", () => {
    const items = [mk("c", "p")]; // parent p is in another group
    const { rows, suppressed } = nestGroup(items);
    expect(rows.map((r) => r.issue.id)).toEqual(["c"]);
    expect(suppressed.size).toBe(0);
  });

  it("keeps ordering of top-level items", () => {
    const items = [mk("a", null), mk("p", null), mk("c", "p"), mk("b", null)];
    const { rows } = nestGroup(items);
    expect(rows.map((r) => r.issue.id)).toEqual(["a", "p", "b"]);
  });
});

describe("subIssueProgress", () => {
  const all = [
    mk("p", null),
    mk("c1", "p", "done"),
    mk("c2", "p", "todo"),
    mk("x", null),
  ];
  it("counts done/total children", () => {
    expect(subIssueProgress("p", all)).toEqual({ done: 1, total: 2 });
  });
  it("returns zero total for a leaf", () => {
    expect(subIssueProgress("x", all)).toEqual({ done: 0, total: 0 });
  });
});

describe("pageGroups", () => {
  const rows = (n: number) => Array<number>(n).fill(1);
  const groups = [
    { key: "todo", sizes: rows(70) },
    { key: "doing", sizes: rows(10) },
    { key: "done", sizes: rows(120) },
  ];

  it("shows a page of each group once the list is live", () => {
    expect(pageGroups(groups, {})).toEqual([GROUP_PAGE, 10, GROUP_PAGE]);
  });

  it("shows more of a group after Show more, never more than it has", () => {
    expect(pageGroups(groups, { todo: 100, done: 100 })).toEqual([70, 10, 100]);
  });

  it("stops the first paint at the budget, top to bottom", () => {
    expect(pageGroups(groups, {}, FIRST_PAINT_ROWS)).toEqual([FIRST_PAINT_ROWS, 0, 0]);
    expect(pageGroups([{ key: "a", sizes: rows(5) }, ...groups], {}, 12)).toEqual([5, 7, 0, 0]);
  });

  it("counts a row's sub-tasks against the first paint, keeping them with their parent", () => {
    expect(pageGroups([{ key: "a", sizes: [1, 10, 1, 1] }, { key: "b", sizes: rows(5) }], {}, 12)).toEqual([3, 0]);
  });
});
