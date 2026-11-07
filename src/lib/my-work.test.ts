import { describe, expect, it } from "vitest";

import { bucketOf, compareMyWork, dueLabel, groupMyWork, longDate } from "@/lib/my-work";

// Friday 6 Nov 2026, 15:00 IST.
const now = new Date("2026-11-06T09:30:00Z");
const base = { status: "todo", priority: "medium", dueDate: null, updatedAt: now, number: 1 };

describe("bucketOf", () => {
  it("puts past-due open work in Overdue, whatever its status", () => {
    expect(bucketOf({ ...base, dueDate: "2026-11-05T12:00:00Z" }, now)).toBe("overdue");
    expect(bucketOf({ ...base, status: "in_progress", dueDate: "2026-11-01T12:00:00Z" }, now)).toBe("overdue");
  });

  it("reads days in India time, not the server's", () => {
    // 20:00 UTC on the 6th is 01:30 on the 7th in India: tomorrow, not today.
    expect(bucketOf({ ...base, dueDate: "2026-11-06T20:00:00Z" }, now)).toBe("week");
    // 19:00 UTC on the 5th is 00:30 on the 6th in India: today.
    expect(bucketOf({ ...base, dueDate: "2026-11-05T19:00:00Z" }, now)).toBe("today");
  });

  it("keeps started work together unless a date makes it more urgent", () => {
    expect(bucketOf({ ...base, status: "in_progress" }, now)).toBe("active");
    expect(bucketOf({ ...base, status: "in_review", dueDate: "2026-11-09T12:00:00Z" }, now)).toBe("active");
  });

  it("splits the rest into the coming week, up next and backlog", () => {
    expect(bucketOf({ ...base, dueDate: "2026-11-12T12:00:00Z" }, now)).toBe("week");
    expect(bucketOf({ ...base, dueDate: "2026-11-30T12:00:00Z" }, now)).toBe("next");
    expect(bucketOf(base, now)).toBe("next");
    expect(bucketOf({ ...base, status: "backlog" }, now)).toBe("backlog");
    // A dated backlog task due this week is planned work after all.
    expect(bucketOf({ ...base, status: "backlog", dueDate: "2026-11-08T12:00:00Z" }, now)).toBe("week");
  });

  it("shows only this week's done work and never canceled work", () => {
    expect(bucketOf({ ...base, status: "done", updatedAt: "2026-11-02T10:00:00Z" }, now)).toBe("done");
    expect(bucketOf({ ...base, status: "done", updatedAt: "2026-10-20T10:00:00Z" }, now)).toBeNull();
    expect(bucketOf({ ...base, status: "canceled" }, now)).toBeNull();
  });
});

describe("groupMyWork", () => {
  it("returns every bucket in order, each sorted urgent and started first", () => {
    const groups = groupMyWork(
      [
        { ...base, number: 1, priority: "low" },
        { ...base, number: 2, priority: "urgent" },
        { ...base, number: 3, priority: "low", status: "in_progress", dueDate: "2026-11-20T00:00:00Z" },
      ],
      now,
    );
    expect(groups.map((g) => g.id)).toEqual(["overdue", "today", "active", "week", "next", "backlog", "done"]);
    expect(groups.find((g) => g.id === "next")!.items.map((i) => i.number)).toEqual([2, 1]);
    expect(groups.find((g) => g.id === "active")!.items.map((i) => i.number)).toEqual([3]);
  });

  it("orders by priority, then started, then the earliest due", () => {
    const a = { ...base, number: 1, dueDate: "2026-11-10T00:00:00Z" };
    const b = { ...base, number: 2, dueDate: "2026-11-08T00:00:00Z" };
    expect([a, b].sort(compareMyWork).map((i) => i.number)).toEqual([2, 1]);
  });
});

describe("dueLabel", () => {
  it("says the day the way people do", () => {
    expect(dueLabel("2026-11-06T12:00:00Z", now)).toEqual({ text: "Today", tone: "today" });
    expect(dueLabel("2026-11-07T06:00:00Z", now)).toEqual({ text: "Tomorrow", tone: "soon" });
    expect(dueLabel("2026-11-05T06:00:00Z", now)).toEqual({ text: "Yesterday", tone: "overdue" });
    expect(dueLabel("2026-11-10T06:00:00Z", now).text).toBe("Tue");
    expect(dueLabel("2026-11-18T06:00:00Z", now)).toEqual({ text: "18 Nov", tone: "later" });
  });

  it("never reads as overdue once the task is closed", () => {
    expect(dueLabel("2026-11-01T06:00:00Z", now, "done").tone).toBe("later");
  });
});

it("formats the Home date in India time", () => {
  expect(longDate(now)).toBe("Friday, 6 November");
});
