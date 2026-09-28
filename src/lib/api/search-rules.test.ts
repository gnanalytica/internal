import { describe, expect, it } from "vitest";

import type { ApiScope } from "./scope-rules";
import { UNRESTRICTED } from "./scope-rules";
import { fields, humanize, isoDay, subtitle, visibleHits, webPath, type SearchHit, type SearchType } from "./search-rules";

const member: ApiScope = { restricted: true, hiddenProjectIds: new Set(["hr-op"]), ownedProjectIds: new Set() };

const hit = (type: SearchType, id: string, projectId: string | null): SearchHit => ({ type, id, title: id, subtitle: null, projectId, fields: [], url: "" });

describe("search visibility", () => {
  const hits = [
    hit("issue", "i1", "eng"),
    hit("issue", "i2", "hr-op"),
    hit("page", "p1", null),
    hit("project", "hr-op", "hr-op"),
    hit("project", "eng", "eng"),
    hit("cycle", "c1", "hr-op"),
    hit("database", "d1", null),
    hit("deal", "deal1", "eng"),
    hit("account", "a1", null),
  ];

  it("hides confidential projects, their contents, and deals from a member", () => {
    expect(visibleHits(hits, member).map((h) => h.id)).toEqual(["i1", "p1", "eng", "d1", "a1"]);
  });

  it("shows admins and integration keys everything, in order", () => {
    expect(visibleHits(hits, UNRESTRICTED)).toEqual(hits);
  });
});

describe("web paths", () => {
  it("opens project-scoped records inside their project", () => {
    expect(webPath("milestone", "m1", "p1")).toBe("/projects/p1/milestones/m1");
    expect(webPath("feature", "f1", "p1")).toBe("/projects/p1/product/f1");
    expect(webPath("cycle", "c1", "p1")).toBe("/projects/p1/cycles");
    expect(webPath("deal", "d1", "p1")).toBe("/projects/p1/sales");
  });
  it("falls back to a flat path without a project", () => {
    expect(webPath("deal", "d1", null)).toBe("/deals/d1");
    expect(webPath("issue", "i1", null)).toBe("/issues/i1");
    expect(webPath("database", "db", null)).toBe("/databases/db");
  });
});

describe("hit shaping helpers", () => {
  it("keeps only facts with a value", () => {
    expect(fields(["Status", "Open"], ["Owner", null], ["Count", 0], ["Blank", "  "])).toEqual([
      { label: "Status", value: "Open" },
      { label: "Count", value: "0" },
    ]);
  });
  it("humanizes enum values", () => {
    expect(humanize("in_progress")).toBe("In progress");
    expect(humanize("off-track")).toBe("Off track");
    expect(humanize(null)).toBeNull();
  });
  it("formats days and subtitles", () => {
    expect(isoDay(new Date("2026-09-28T10:00:00Z"))).toBe("2026-09-28");
    expect(isoDay("not a date")).toBeNull();
    expect(subtitle("ENG-4", null, "", "Todo")).toBe("ENG-4 · Todo");
    expect(subtitle(null)).toBeNull();
  });
});
