import { describe, expect, it } from "vitest";

import { describeActivity, summarizeReactions } from "./timeline-text";

const names: Record<string, string> = { u1: "Asha Rao" };
const nameOf = (id: string) => names[id];

describe("describeActivity", () => {
  it("words status and priority changes with their labels", () => {
    expect(describeActivity("status", { to: "in_progress" }, nameOf)).toBe("set status to In Progress");
    expect(describeActivity("priority", { to: "urgent" }, nameOf)).toBe("set priority to Urgent");
  });

  it("names the assignee, or says it was cleared", () => {
    expect(describeActivity("assignee", { to: "u1" }, nameOf)).toBe("assigned Asha Rao");
    expect(describeActivity("assignee", { to: "gone" }, nameOf)).toBe("assigned someone");
    expect(describeActivity("assignee", { from: "u1", to: null }, nameOf)).toBe("removed the assignee");
  });

  it("falls back for unknown kinds", () => {
    expect(describeActivity("created", null, nameOf)).toBe("created the issue");
    expect(describeActivity("weird", null, nameOf)).toBe("updated the issue");
  });
});

describe("summarizeReactions", () => {
  it("counts per emoji in first-seen order and marks the caller's", () => {
    const rows = [
      { emoji: "👍", userId: "a" },
      { emoji: "🎉", userId: "b" },
      { emoji: "👍", userId: "me" },
    ];
    expect(summarizeReactions(rows, "me")).toEqual([
      { emoji: "👍", count: 2, mine: true },
      { emoji: "🎉", count: 1, mine: false },
    ]);
    expect(summarizeReactions(rows, null).every((r) => !r.mine)).toBe(true);
  });
});
