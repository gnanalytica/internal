import { describe, expect, it } from "vitest";

import { isOverdue } from "@/lib/issue-dates";

const now = new Date("2024-03-10T12:00:00Z");

describe("isOverdue", () => {
  it("is false when there is no due date", () => {
    expect(isOverdue(null, "todo", now)).toBe(false);
    expect(isOverdue(undefined, "todo", now)).toBe(false);
  });

  it("is true for a past due date on an open issue", () => {
    expect(isOverdue("2024-03-01", "in_progress", now)).toBe(true);
  });

  it("is false for a future due date", () => {
    expect(isOverdue("2024-03-20", "todo", now)).toBe(false);
  });

  it("is never overdue once done or canceled", () => {
    expect(isOverdue("2024-03-01", "done", now)).toBe(false);
    expect(isOverdue("2024-03-01", "canceled", now)).toBe(false);
  });
});
