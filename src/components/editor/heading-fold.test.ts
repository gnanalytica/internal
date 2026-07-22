import { describe, expect, it } from "vitest";

import { foldHiddenRanges, type FoldBlock } from "./heading-fold";

const h = (level: number, folded: boolean, from: number, to: number): FoldBlock => ({
  heading: true,
  level,
  folded,
  from,
  to,
});
const p = (from: number, to: number): FoldBlock => ({
  heading: false,
  level: 0,
  folded: false,
  from,
  to,
});

describe("foldHiddenRanges", () => {
  it("hides blocks after a folded heading until the next same-level heading", () => {
    const blocks = [h(2, true, 0, 10), p(10, 20), h(3, false, 20, 30), p(30, 40), h(2, false, 40, 50), p(50, 60)];
    expect(foldHiddenRanges(blocks)).toEqual([
      { from: 10, to: 20 },
      { from: 20, to: 30 },
      { from: 30, to: 40 },
    ]);
  });

  it("stops at a higher-level heading", () => {
    const blocks = [h(2, true, 0, 10), p(10, 20), h(1, false, 20, 30), p(30, 40)];
    expect(foldHiddenRanges(blocks)).toEqual([{ from: 10, to: 20 }]);
  });

  it("returns nothing when no heading is folded", () => {
    const blocks = [h(2, false, 0, 10), p(10, 20), h(3, false, 20, 30)];
    expect(foldHiddenRanges(blocks)).toEqual([]);
  });

  it("hides to the end of the document for a trailing folded heading", () => {
    const blocks = [p(0, 10), h(1, true, 10, 20), p(20, 30), p(30, 40)];
    expect(foldHiddenRanges(blocks)).toEqual([
      { from: 20, to: 30 },
      { from: 30, to: 40 },
    ]);
  });

  it("ignores a folded heading nested inside an already-hidden region", () => {
    const blocks = [h(1, true, 0, 10), h(2, true, 10, 20), p(20, 30), h(1, false, 30, 40), p(40, 50)];
    expect(foldHiddenRanges(blocks)).toEqual([
      { from: 10, to: 20 },
      { from: 20, to: 30 },
    ]);
  });
});
