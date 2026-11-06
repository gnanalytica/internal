import { describe, expect, it } from "vitest";

import {
  ageLabel,
  checkInCount,
  customerHealth,
  customerSince,
  daysAgo,
  isCustomerStage,
  ONBOARDING_STEPS,
  onboardingProgress,
  onboardingSteps,
  requestState,
  toggleStep,
  touchesSince,
} from "./customer-success";
import type { ActivityEntry } from "./prospects/parse";
import { STAGES } from "./prospects/schema";

const touch = (id: string, date: string, statusAfter: string, time = "10:00"): ActivityEntry => ({
  id,
  loggedAt: `${date.slice(8)}-${date.slice(5, 7)}-${date.slice(0, 4)} ${time}`,
  date,
  recordType: "Valuer",
  registrationNo: "IBBI/RV/1",
  name: "N K Rajkumar",
  by: "Sandeep",
  channel: "Call",
  direction: "Outbound",
  outcome: "Connected",
  durationMin: null,
  statusAfter,
  summary: "",
});

describe("who is a customer", () => {
  it("is anyone at Pilot running or Won", () => {
    expect(STAGES.filter((_, i) => isCustomerStage(i))).toEqual(["Pilot running", "Won"]);
  });
});

describe("customerSince", () => {
  it("is the touch that moved them into Pilot running", () => {
    const a = [touch("A1", "2026-10-20", "Demo done"), touch("A2", "2026-11-02", "Pilot running"), touch("A3", "2026-11-04", "Pilot running")];
    expect(customerSince(a, "2026-10-20T08:00:00Z")).toEqual({ date: "2026-11-02", activityId: "A2" });
  });

  it("counts from the latest time they came back after being lost", () => {
    const a = [touch("A1", "2026-09-01", "Pilot running"), touch("A2", "2026-09-10", "Lost"), touch("A3", "2026-10-01", "Won")];
    expect(customerSince(a, null)).toEqual({ date: "2026-10-01", activityId: "A3" });
  });

  it("ignores touches with no status after", () => {
    const a = [touch("A1", "2026-11-01", "Pilot running"), touch("A2", "2026-11-03", "")];
    expect(customerSince(a, null)?.activityId).toBe("A1");
  });

  it("falls back to the day the deal was opened, in India", () => {
    expect(customerSince([touch("A1", "2026-10-01", "Demo done")], "2026-11-01T20:00:00Z")).toEqual({ date: "2026-11-02", activityId: null });
    expect(customerSince([], null)).toBeNull();
  });
});

describe("check-ins", () => {
  const a = [touch("A1", "2026-10-20", "Demo done"), touch("A2", "2026-11-02", "Pilot running"), touch("A3", "2026-11-04", "Pilot running"), touch("A4", "2026-11-05", "Pilot running")];
  const since = customerSince(a, null);

  it("lists touches since they became a customer, newest first", () => {
    expect(touchesSince(a, since).map((t) => t.id)).toEqual(["A4", "A3", "A2"]);
    expect(touchesSince(a, null)).toEqual([]);
  });

  it("doesn't count the touch that made them a customer", () => {
    expect(checkInCount(a, since)).toBe(2);
    expect(checkInCount(a, { date: "2026-11-02", activityId: null })).toBe(3);
  });
});

describe("onboarding", () => {
  it("has the six fixed steps in order", () => {
    expect(ONBOARDING_STEPS.map((s) => s.title)).toEqual([
      "Kickoff call",
      "Account and branding set up",
      "First real report made",
      "Report accepted by the bank",
      "Four weekly check-ins",
      "Asked to pay",
    ]);
  });

  it("ticks the check-ins step itself after four check-ins", () => {
    expect(onboardingSteps({}, 3).find((s) => s.id === "check-ins")).toMatchObject({ done: false, auto: false });
    expect(onboardingSteps({}, 4).find((s) => s.id === "check-ins")).toMatchObject({ done: true, auto: true, doneOn: null });
  });

  it("reads ticked steps and where the customer is", () => {
    const steps = onboardingSteps({ kickoff: "2026-11-02", setup: "2026-11-02", "first-report": "2026-11-03" }, 1);
    expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual(["kickoff", "setup", "first-report"]);
    expect(onboardingProgress(steps)).toEqual({ done: 3, total: 6, current: 4 });
    expect(onboardingProgress(onboardingSteps(Object.fromEntries(ONBOARDING_STEPS.map((s) => [s.id, "2026-11-01"])), 0))).toEqual({ done: 6, total: 6, current: 6 });
  });

  it("ticks with today's date, keeps the first date, and unticks", () => {
    expect(toggleStep(null, "kickoff", true, "2026-11-06")).toEqual({ kickoff: "2026-11-06" });
    expect(toggleStep({ kickoff: "2026-11-01" }, "kickoff", true, "2026-11-06")).toEqual({ kickoff: "2026-11-01" });
    expect(toggleStep({ kickoff: "2026-11-01", setup: "2026-11-02" }, "kickoff", false, "2026-11-06")).toEqual({ setup: "2026-11-02" });
  });
});

describe("requests", () => {
  it("reads the ticket status as the customer sees it", () => {
    expect(requestState("open")).toBe("waiting-us");
    expect(requestState("pending")).toBe("waiting-them");
    expect(requestState("solved")).toBe("answered");
    expect(requestState("closed")).toBe("answered");
  });

  it("writes a short age", () => {
    const now = Date.parse("2026-11-06T12:00:00Z");
    expect(ageLabel("2026-11-06T11:30:00Z", now)).toBe("now");
    expect(ageLabel("2026-11-06T07:00:00Z", now)).toBe("5h");
    expect(ageLabel("2026-11-04T12:00:00Z", now)).toBe("2d");
    expect(ageLabel("2026-10-01T12:00:00Z", now)).toBe("5w");
  });
});

describe("customerHealth", () => {
  const today = "2026-11-06";
  const now = Date.parse("2026-11-06T12:00:00Z");
  const base = { today, now, since: { date: "2026-10-01", activityId: null }, lastTouch: "2026-11-04", checkIns: 3, requests: [] };

  it("is doing fine when touched this week with nothing waiting", () => {
    expect(customerHealth(base)).toBe("fine");
  });

  it("needs a call after more than a week without a touch", () => {
    expect(customerHealth({ ...base, lastTouch: "2026-10-30" })).toBe("fine");
    expect(customerHealth({ ...base, lastTouch: "2026-10-29" })).toBe("needs-call");
    expect(customerHealth({ ...base, lastTouch: null })).toBe("needs-call");
  });

  it("needs a call when a request has waited on us more than two days", () => {
    expect(customerHealth({ ...base, requests: [{ status: "open", updatedAt: "2026-11-03T12:00:00Z" }] })).toBe("needs-call");
    expect(customerHealth({ ...base, requests: [{ status: "open", updatedAt: "2026-11-05T12:00:00Z" }] })).toBe("fine");
    expect(customerHealth({ ...base, requests: [{ status: "pending", updatedAt: "2026-10-01T12:00:00Z" }] })).toBe("fine");
  });

  it("has just started in the first week before any check-in", () => {
    const fresh = { ...base, since: { date: "2026-11-03", activityId: "A1" }, lastTouch: "2026-11-03", checkIns: 0 };
    expect(customerHealth(fresh)).toBe("new");
    expect(customerHealth({ ...fresh, lastTouch: "2026-10-20" })).toBe("new");
    expect(customerHealth({ ...fresh, checkIns: 1, lastTouch: "2026-11-05" })).toBe("fine");
    expect(customerHealth({ ...fresh, requests: [{ status: "open", updatedAt: "2026-11-01T00:00:00Z" }] })).toBe("needs-call");
  });
});

describe("daysAgo", () => {
  it("reads like a person would say it", () => {
    expect(daysAgo(null, "2026-11-06")).toBe("Never");
    expect(daysAgo("2026-11-06", "2026-11-06")).toBe("Today");
    expect(daysAgo("2026-11-05", "2026-11-06")).toBe("Yesterday");
    expect(daysAgo("2026-10-29", "2026-11-06")).toBe("8 days ago");
  });
});
