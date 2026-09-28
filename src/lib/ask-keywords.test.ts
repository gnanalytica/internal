import { describe, expect, it } from "vitest";

import { askKeywords } from "./ask-keywords";

describe("askKeywords", () => {
  it("keeps the words that carry meaning", () => {
    expect(askKeywords("What are we shipping this cycle?")).toEqual(["shipping", "cycle"]);
  });
  it("dedupes, lowercases and splits on punctuation", () => {
    expect(askKeywords("Auth: AUTH decisions, auth-flow")).toEqual(["auth", "decisions", "flow"]);
  });
  it("caps at eight keywords", () => {
    expect(askKeywords("alpha bravo charlie delta echo foxtrot golf hotel india juliet")).toHaveLength(8);
  });
  it("returns nothing for a question of only short or common words", () => {
    expect(askKeywords("how is it?")).toEqual([]);
  });
});
