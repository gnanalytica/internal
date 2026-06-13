import { describe, expect, it } from "vitest";

import { extractHeadings } from "@/lib/toc";

describe("extractHeadings", () => {
  it("collects headings in document order with levels", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Overview" }] },
        { type: "paragraph", content: [{ type: "text", text: "intro" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Details" }] },
      ],
    };
    expect(extractHeadings(doc)).toEqual([
      { level: 1, text: "Overview" },
      { level: 2, text: "Details" },
    ]);
  });

  it("flattens marks and mentions into heading text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            { type: "text", text: "Plan for " },
            { type: "entityRef", attrs: { kind: "project", id: "p", label: "Web" } },
          ],
        },
      ],
    };
    expect(extractHeadings(doc)).toEqual([{ level: 1, text: "Plan for @Web" }]);
  });

  it("ignores empty headings and non-docs", () => {
    expect(extractHeadings({ type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] })).toEqual([]);
    expect(extractHeadings(null)).toEqual([]);
  });
});
