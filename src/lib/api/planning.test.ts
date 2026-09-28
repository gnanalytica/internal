import { describe, expect, it } from "vitest";

import {
  activeCycle,
  adminOnlyFieldsIn,
  currentMilestone,
  cyclePoints,
  cycleState,
  departmentsForCaller,
  healthOf,
  isHexColor,
  progressOf,
} from "./planning";
import { UNRESTRICTED, type ApiScope } from "./scope-rules";

const member = (owned: string[] = []): ApiScope => ({ restricted: true, hiddenProjectIds: new Set(["fin-op"]), ownedProjectIds: new Set(owned) });
const project = (over: Partial<{ id: string; kind: string; enabledDepartments: string[] | null; ownerId: string | null }> = {}) => ({
  id: "valytica",
  kind: "project",
  enabledDepartments: ["product", "engineering", "sales", "finance", "analytics"],
  ownerId: null,
  ...over,
});
const slugs = (d: { slug: string }[]) => d.map((x) => x.slug);

describe("departmentsForCaller", () => {
  it("gives admins every enabled department in canonical order", () => {
    expect(slugs(departmentsForCaller(project(), { scope: UNRESTRICTED, userId: "a" }))).toEqual(["product", "engineering", "analytics", "sales", "finance"]);
  });
  it("hides Sales and Finance from a member who does not own the project", () => {
    expect(slugs(departmentsForCaller(project(), { scope: member(), userId: "m" }))).toEqual(["product", "engineering", "analytics"]);
  });
  it("shows Finance, not Sales, to the project's owner", () => {
    const d = departmentsForCaller(project({ ownerId: "m" }), { scope: member(["valytica"]), userId: "m" });
    expect(slugs(d)).toEqual(["product", "engineering", "analytics", "finance"]);
  });
  it("uses the default-on baseline when nothing is configured", () => {
    expect(slugs(departmentsForCaller(project({ enabledDepartments: null }), { scope: member(), userId: "m" }))).toEqual(["product", "engineering", "strategy"]);
  });
  it("gives operations no departments", () => {
    expect(departmentsForCaller(project({ kind: "operation" }), { scope: UNRESTRICTED, userId: "a" })).toEqual([]);
  });
});

describe("currentMilestone", () => {
  const now = new Date("2026-09-28T00:00:00Z");
  it("picks the earliest milestone still ahead", () => {
    const ms = [
      { id: "b", targetDate: new Date("2026-11-01") },
      { id: "past", targetDate: new Date("2026-08-01") },
      { id: "a", targetDate: new Date("2026-10-01") },
      { id: "undated", targetDate: null },
    ];
    expect(currentMilestone(ms, now)?.id).toBe("a");
  });
  it("falls back to the earliest when everything is behind", () => {
    const ms = [
      { id: "late", targetDate: "2026-09-01" },
      { id: "early", targetDate: "2026-06-01" },
    ];
    expect(currentMilestone(ms, now)?.id).toBe("early");
  });
  it("keeps an undated milestone only when nothing is dated", () => {
    expect(currentMilestone([{ id: "x", targetDate: null }], now)?.id).toBe("x");
    expect(currentMilestone([], now)).toBeNull();
  });
});

describe("cycles", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const c = (id: string, start: string, end: string) => ({ id, startDate: new Date(start), endDate: new Date(end) });
  it("reads a cycle's state from its dates", () => {
    expect(cycleState(c("x", "2026-09-25", "2026-10-01"), now)).toBe("active");
    expect(cycleState(c("x", "2026-10-02", "2026-10-08"), now)).toBe("upcoming");
    expect(cycleState(c("x", "2026-09-01", "2026-09-07"), now)).toBe("completed");
  });
  it("prefers the running cycle, the latest to start when two overlap", () => {
    const cycles = [c("old", "2026-09-20", "2026-09-30"), c("new", "2026-09-26", "2026-10-02"), c("next", "2026-10-03", "2026-10-09")];
    expect(activeCycle(cycles, now)?.id).toBe("new");
  });
  it("shows the next cycle between cycles, and nothing when none are ahead", () => {
    expect(activeCycle([c("done", "2026-09-01", "2026-09-07"), c("next", "2026-10-03", "2026-10-09"), c("later", "2026-10-10", "2026-10-16")], now)?.id).toBe("next");
    expect(activeCycle([c("done", "2026-09-01", "2026-09-07")], now)).toBeNull();
  });
  it("weighs points like burndown: no estimate is one, canceled is out", () => {
    expect(
      cyclePoints([
        { status: "done", estimate: 3 },
        { status: "todo", estimate: null },
        { status: "done", estimate: null },
        { status: "canceled", estimate: 8 },
      ]),
    ).toEqual({ total: 5, done: 4 });
  });
});

describe("small rules", () => {
  it("rounds progress and survives an empty total", () => {
    expect(progressOf(1, 3)).toEqual({ done: 1, total: 3, pct: 33 });
    expect(progressOf(0, 0).pct).toBe(0);
  });
  it("only accepts the health values the web shows", () => {
    expect(healthOf("at_risk")).toBe("at_risk");
    expect(healthOf("great")).toBe("none");
    expect(healthOf(undefined)).toBe("none");
  });
  it("accepts hex colours only", () => {
    expect(isHexColor("#6366f1")).toBe(true);
    expect(isHexColor("#abc")).toBe(true);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#6366f1; x")).toBe(false);
  });
  it("names the owner fields a member may not change", () => {
    expect(adminOnlyFieldsIn({ ownerId: "x", name: "y" })).toEqual(["ownerId"]);
    expect(adminOnlyFieldsIn({ strategistId: null })).toEqual(["strategistId"]);
    expect(adminOnlyFieldsIn({ startDate: "2026-01-01" })).toEqual([]);
  });
});
