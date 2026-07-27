import { describe, expect, it } from "vitest";

import { nestGroup, subIssueProgress } from "./issue-tree";

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
