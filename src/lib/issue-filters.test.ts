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
    assignee: null,
    labels: [],
    ...partial,
  } as IssueWithRelations;
}

function withFilters(p: Partial<IssueFilters>): IssueFilters {
  return { ...emptyFilters(), ...p };
}

/** Only the id and name are read when grouping, so the rest of the cycle is noise. */
function cycleRef(id: string, name: string): IssueWithRelations["cycle"] {
  return { id, name } as IssueWithRelations["cycle"];
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

  it("orders cycle groups by the passed list, not by first appearance", () => {
    const issues = [
      makeIssue({ id: "a", cycleId: "c2", cycle: cycleRef("c2", "Cycle 2") }),
      makeIssue({ id: "b", cycleId: "c1", cycle: cycleRef("c1", "Cycle 1") }),
      makeIssue({ id: "c", cycleId: null }),
    ] as IssueWithRelations[];
    const g = groupIssues(issues, "cycle", {
      members,
      projects,
      cycles: [
        { id: "c1", name: "Cycle 1" },
        { id: "c2", name: "Cycle 2" },
      ],
    });
    expect(g.map((x) => x.label)).toEqual(["Cycle 1", "Cycle 2", "No cycle"]);
  });

  it("derives milestone groups from the tasks when no list is passed", () => {
    const issues = [
      makeIssue({ id: "a", milestoneId: "m1", milestone: { id: "m1", name: "v1.0" } }),
      makeIssue({ id: "b", milestoneId: "m1", milestone: { id: "m1", name: "v1.0" } }),
      makeIssue({ id: "c", milestoneId: null }),
    ] as IssueWithRelations[];
    const g = groupIssues(issues, "milestone", { members, projects });
    expect(g.map((x) => x.label)).toEqual(["v1.0", "No milestone"]);
    expect(g[0].items).toHaveLength(2);
  });
});

describe("cycle and milestone filters", () => {
  it("matches a cycle, with 'none' for tasks in no cycle", () => {
    const inCycle = makeIssue({ cycleId: "c1" });
    const loose = makeIssue({ cycleId: null });
    expect(matchesFilters(inCycle, withFilters({ cycle: new Set(["c1"]) }))).toBe(true);
    expect(matchesFilters(loose, withFilters({ cycle: new Set(["c1"]) }))).toBe(false);
    expect(matchesFilters(loose, withFilters({ cycle: new Set(["none"]) }))).toBe(true);
  });

  it("matches a milestone, with 'none' for tasks clearing no gate", () => {
    const gated = makeIssue({ milestoneId: "m1" });
    const loose = makeIssue({ milestoneId: null });
    expect(matchesFilters(gated, withFilters({ milestone: new Set(["m1"]) }))).toBe(true);
    expect(matchesFilters(loose, withFilters({ milestone: new Set(["m1"]) }))).toBe(false);
    expect(matchesFilters(loose, withFilters({ milestone: new Set(["none"]) }))).toBe(true);
  });

  it("splits blocked from unblocked on the stamped blockedBy count", () => {
    const blocked = makeIssue({ blockedBy: 2 });
    const free = makeIssue({ blockedBy: 0 });
    expect(matchesFilters(blocked, withFilters({ blocked: new Set(["blocked"]) }))).toBe(true);
    expect(matchesFilters(free, withFilters({ blocked: new Set(["blocked"]) }))).toBe(false);
    expect(matchesFilters(free, withFilters({ blocked: new Set(["unblocked"]) }))).toBe(true);
  });

  it("treats an unstamped issue as unblocked rather than dropping it", () => {
    // Surfaces that never loaded the blocked set leave blockedBy undefined; the
    // task should still show up, just never under the "Blocked" filter.
    const unknown = makeIssue({});
    expect(matchesFilters(unknown, withFilters({ blocked: new Set(["unblocked"]) }))).toBe(true);
    expect(matchesFilters(unknown, withFilters({ blocked: new Set(["blocked"]) }))).toBe(false);
    expect(matchesFilters(unknown, emptyFilters())).toBe(true);
  });

  it("counts the new dimensions as active filters", () => {
    expect(
      activeFilterCount(
        withFilters({ cycle: new Set(["c1"]), milestone: new Set(["m1", "m2"]) }),
      ),
    ).toBe(3);
  });
});

describe("due-date sort", () => {
  it("orders soonest first and pushes undated tasks last", () => {
    const issues = [
      makeIssue({ id: "none", dueDate: null }),
      makeIssue({ id: "late", dueDate: new Date("2026-03-01") }),
      makeIssue({ id: "soon", dueDate: new Date("2026-01-01") }),
    ] as IssueWithRelations[];
    const sorted = issues.slice().sort(issueComparator("due"));
    expect(sorted.map((i) => i.id)).toEqual(["soon", "late", "none"]);
  });
});
