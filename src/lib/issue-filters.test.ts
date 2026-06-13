import { describe, expect, it } from "vitest";

import type { IssueWithRelations, Label } from "@/lib/types";
import {
  activeFilterCount,
  emptyFilters,
  filterIssues,
  groupIssues,
  issueComparator,
  matchesFilters,
  type IssueFilters,
} from "@/lib/issue-filters";

function label(id: string): Label {
  return { id, name: id, color: "#000", workspaceId: "w" } as unknown as Label;
}

function makeIssue(partial: Partial<IssueWithRelations>): IssueWithRelations {
  return {
    id: "i",
    workspaceId: "w",
    projectId: null,
    cycleId: null,
    teamId: null,
    number: 1,
    title: "Issue",
    description: null,
    status: "backlog",
    priority: "none",
    assigneeId: null,
    creatorId: null,
    sortKey: "a0",
    githubUrl: null,
    githubNumber: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    project: null,
    cycle: null,
    team: null,
    assignee: null,
    labels: [],
    ...partial,
  } as IssueWithRelations;
}

function withFilters(p: Partial<IssueFilters>): IssueFilters {
  return { ...emptyFilters(), ...p };
}

describe("matchesFilters", () => {
  it("passes everything when no filters are active", () => {
    const issue = makeIssue({ status: "todo", priority: "high" });
    expect(matchesFilters(issue, emptyFilters())).toBe(true);
  });

  it("filters by status", () => {
    const issue = makeIssue({ status: "in_progress" });
    expect(matchesFilters(issue, withFilters({ status: new Set(["in_progress"]) }))).toBe(true);
    expect(matchesFilters(issue, withFilters({ status: new Set(["done"]) }))).toBe(false);
  });

  it("filters by priority", () => {
    const issue = makeIssue({ priority: "urgent" });
    expect(matchesFilters(issue, withFilters({ priority: new Set(["urgent"]) }))).toBe(true);
    expect(matchesFilters(issue, withFilters({ priority: new Set(["low"]) }))).toBe(false);
  });

  it("treats unassigned issues as the 'none' assignee sentinel", () => {
    const unassigned = makeIssue({ assigneeId: null });
    const assigned = makeIssue({ assigneeId: "user-1" });
    expect(matchesFilters(unassigned, withFilters({ assignee: new Set(["none"]) }))).toBe(true);
    expect(matchesFilters(assigned, withFilters({ assignee: new Set(["none"]) }))).toBe(false);
    expect(matchesFilters(assigned, withFilters({ assignee: new Set(["user-1"]) }))).toBe(true);
  });

  it("matches an issue carrying ANY selected label", () => {
    const issue = makeIssue({ labels: [label("bug"), label("ui")] });
    expect(matchesFilters(issue, withFilters({ label: new Set(["ui"]) }))).toBe(true);
    expect(matchesFilters(issue, withFilters({ label: new Set(["docs"]) }))).toBe(false);
    expect(matchesFilters(issue, withFilters({ label: new Set(["docs", "bug"]) }))).toBe(true);
  });

  it("ANDs across dimensions", () => {
    const issue = makeIssue({ status: "todo", priority: "high" });
    const f = withFilters({
      status: new Set(["todo"]),
      priority: new Set(["low"]),
    });
    expect(matchesFilters(issue, f)).toBe(false);
  });
});

describe("filterIssues", () => {
  it("returns only matching issues", () => {
    const issues = [
      makeIssue({ id: "a", status: "todo" }),
      makeIssue({ id: "b", status: "done" }),
      makeIssue({ id: "c", status: "todo" }),
    ];
    const result = filterIssues(issues, withFilters({ status: new Set(["todo"]) }));
    expect(result.map((i) => i.id)).toEqual(["a", "c"]);
  });
});

describe("activeFilterCount", () => {
  it("sums the selected values across dimensions", () => {
    const f = withFilters({
      status: new Set(["todo", "done"]),
      label: new Set(["ui"]),
    });
    expect(activeFilterCount(f)).toBe(3);
  });
});

describe("issueComparator", () => {
  it("sorts by sortKey for manual", () => {
    const cmp = issueComparator("manual");
    const a = makeIssue({ sortKey: "a1" });
    const b = makeIssue({ sortKey: "a2" });
    expect(cmp(a, b)).toBeLessThan(0);
  });

  it("orders higher priority first", () => {
    const cmp = issueComparator("priority");
    const urgent = makeIssue({ priority: "urgent" });
    const low = makeIssue({ priority: "low" });
    expect(cmp(urgent, low)).toBeLessThan(0);
    expect(cmp(low, urgent)).toBeGreaterThan(0);
  });

  it("orders newest first for created", () => {
    const cmp = issueComparator("created");
    const older = makeIssue({ createdAt: new Date("2024-01-01") });
    const newer = makeIssue({ createdAt: new Date("2024-06-01") });
    expect(cmp(newer, older)).toBeLessThan(0);
  });

  it("sorts alphabetically by title", () => {
    const cmp = issueComparator("title");
    const apple = makeIssue({ title: "Apple" });
    const banana = makeIssue({ title: "Banana" });
    expect(cmp(apple, banana)).toBeLessThan(0);
  });
});

describe("groupIssues", () => {
  const members = [
    { id: "u1", name: "Alex", avatarColor: "#000" },
    { id: "u2", name: "Sam", avatarColor: "#111" },
  ] as unknown as import("@/lib/types").Member[];
  const projects = [
    { id: "p1", name: "Web", color: "#222" },
  ] as unknown as import("@/lib/types").Project[];

  it("groups by status (non-empty, ordered)", () => {
    const issues = [
      makeIssue({ id: "a", status: "todo" }),
      makeIssue({ id: "b", status: "done" }),
    ];
    const g = groupIssues(issues, "status", { members, projects });
    expect(g.map((x) => x.key)).toEqual(["todo", "done"]);
  });

  it("groups by assignee with an Unassigned bucket", () => {
    const issues = [
      makeIssue({ id: "a", assigneeId: "u1" }),
      makeIssue({ id: "b", assigneeId: null }),
    ];
    const g = groupIssues(issues, "assignee", { members, projects });
    expect(g.map((x) => x.label)).toEqual(["Alex", "Unassigned"]);
  });

  it("returns a single group for none", () => {
    const g = groupIssues([makeIssue({ id: "a" })], "none", { members, projects });
    expect(g).toHaveLength(1);
    expect(g[0].key).toBe("all");
  });
});
