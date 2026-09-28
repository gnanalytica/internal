import { describe, expect, it } from "vitest";

import type { PortfolioRow } from "@/lib/types";

import { ApiInputError } from "./errors";
import { cleanBets, portfolioForScope } from "./overview-rules";
import { UNRESTRICTED, type ApiScope } from "./scope-rules";

const row = (id: string, done: number, total: number, target: Date | null = null): PortfolioRow => ({
  id,
  name: id,
  key: id.toUpperCase(),
  color: "#000",
  kind: "project",
  tagline: null,
  url: null,
  ownerName: null,
  health: "none",
  milestoneName: null,
  milestoneTarget: target,
  doneIssues: done,
  totalIssues: total,
});

describe("company bets", () => {
  it("trims, drops blanks and keeps at most five", () => {
    expect(cleanBets([" Ship v2 ", "", "  ", "Hire", "a", "b", "c", "d"])).toEqual(["Ship v2", "Hire", "a", "b", "c"]);
  });
  it("accepts an empty list (clearing the bets)", () => {
    expect(cleanBets([])).toEqual([]);
  });
  it("refuses anything that is not a list of strings", () => {
    expect(() => cleanBets("Ship v2")).toThrow(ApiInputError);
    expect(() => cleanBets([1, 2])).toThrow(ApiInputError);
    expect(() => cleanBets(undefined)).toThrow(ApiInputError);
  });
});

describe("portfolio", () => {
  const rows = [row("eng", 3, 4, new Date("2026-10-01T00:00:00Z")), row("hr-op", 0, 0)];
  it("hides confidential projects from a member", () => {
    const member: ApiScope = { restricted: true, hiddenProjectIds: new Set(["hr-op"]), ownedProjectIds: new Set() };
    expect(portfolioForScope(rows, member).map((r) => r.id)).toEqual(["eng"]);
  });
  it("serialises the milestone date and computes progress", () => {
    const [eng, hr] = portfolioForScope(rows, UNRESTRICTED);
    expect(eng.milestoneTarget).toBe("2026-10-01T00:00:00.000Z");
    expect(eng.progress).toBe(75);
    expect(hr.progress).toBe(0);
    expect(hr.milestoneTarget).toBeNull();
  });
});
