import { describe, expect, it } from "vitest";

import { isReactionEmoji, summarizeReactions } from "./comment-reactions";

describe("summarizeReactions", () => {
  it("counts per emoji per comment and marks the caller's own", () => {
    const out = summarizeReactions(
      [
        { commentId: "c1", userId: "u1", emoji: "👍" },
        { commentId: "c1", userId: "u2", emoji: "👍" },
        { commentId: "c1", userId: "u2", emoji: "🎉" },
        { commentId: "c2", userId: "u2", emoji: "👀" },
      ],
      "u1",
    );
    expect(out.get("c1")).toEqual([
      { emoji: "👍", count: 2, mine: true },
      { emoji: "🎉", count: 1, mine: false },
    ]);
    expect(out.get("c2")).toEqual([{ emoji: "👀", count: 1, mine: false }]);
    expect(out.get("c3")).toBeUndefined();
  });

  it("marks nothing as mine for a key with no member", () => {
    expect(summarizeReactions([{ commentId: "c", userId: "u", emoji: "👍" }], null).get("c")?.[0].mine).toBe(false);
  });
});

describe("isReactionEmoji", () => {
  it("only allows the web's set", () => {
    expect(isReactionEmoji("🚀")).toBe(true);
    expect(isReactionEmoji("💩")).toBe(false);
    expect(isReactionEmoji(undefined)).toBe(false);
  });
});
