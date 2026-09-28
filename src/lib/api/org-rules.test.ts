import { describe, expect, it } from "vitest";

import { wouldCreateLoop } from "./org-rules";

// ceo ← cto ← eng-lead ← engineer;  ceo ← coo
const parentOf = new Map<string, string | null>([
  ["ceo", null],
  ["cto", "ceo"],
  ["coo", "ceo"],
  ["eng-lead", "cto"],
  ["engineer", "eng-lead"],
]);

describe("org chart reporting loops", () => {
  it("allows moving a role under a sibling branch or to the top", () => {
    expect(wouldCreateLoop(parentOf, "eng-lead", "coo")).toBe(false);
    expect(wouldCreateLoop(parentOf, "eng-lead", null)).toBe(false);
  });
  it("refuses a role reporting to itself", () => {
    expect(wouldCreateLoop(parentOf, "cto", "cto")).toBe(true);
  });
  it("refuses a role reporting to anyone below it", () => {
    expect(wouldCreateLoop(parentOf, "cto", "engineer")).toBe(true);
    expect(wouldCreateLoop(parentOf, "ceo", "eng-lead")).toBe(true);
  });
  it("terminates on data that already loops", () => {
    const broken = new Map<string, string | null>([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(wouldCreateLoop(broken, "c", "a")).toBe(true);
  });
});
