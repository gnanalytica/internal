import { describe, expect, it } from "vitest";

import { cycleStatus, issueIdentifier } from "@/lib/types";

describe("issueIdentifier", () => {
  it("uses the project key when present", () => {
    expect(issueIdentifier({ number: 12, project: { key: "ENG" } })).toBe("ENG-12");
  });

  it("falls back to a #number when there's no project", () => {
    expect(issueIdentifier({ number: 7, project: null })).toBe("#7");
    expect(issueIdentifier({ number: 7 })).toBe("#7");
  });
});

describe("cycleStatus", () => {
  const cycle = { startDate: "2024-03-01", endDate: "2024-03-14" };

  it("is upcoming before the start date", () => {
    expect(cycleStatus(cycle, new Date("2024-02-20"))).toBe("upcoming");
  });

  it("is active within the window", () => {
    expect(cycleStatus(cycle, new Date("2024-03-07"))).toBe("active");
  });

  it("is completed after the end date", () => {
    expect(cycleStatus(cycle, new Date("2024-04-01"))).toBe("completed");
  });
});
