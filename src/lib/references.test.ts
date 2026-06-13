import { describe, expect, it } from "vitest";

import { entityHref, extractReferences, isRefKind } from "@/lib/references";

const doc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "See " },
        { type: "entityRef", attrs: { kind: "issue", id: "i1", label: "ENG-1" } },
        { type: "text", text: " and " },
        { type: "entityRef", attrs: { kind: "page", id: "p1", label: "Spec" } },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "entityRef", attrs: { kind: "project", id: "pr1", label: "Web" } },
                // duplicate of the first issue ref
                { type: "entityRef", attrs: { kind: "issue", id: "i1", label: "ENG-1" } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("extractReferences", () => {
  it("collects distinct references across nested content", () => {
    const refs = extractReferences(doc);
    expect(refs).toEqual([
      { targetType: "issue", targetId: "i1" },
      { targetType: "page", targetId: "p1" },
      { targetType: "project", targetId: "pr1" },
    ]);
  });

  it("returns [] for null/empty docs", () => {
    expect(extractReferences(null)).toEqual([]);
    expect(extractReferences({ type: "doc" })).toEqual([]);
  });

  it("ignores malformed entityRef nodes", () => {
    const bad = {
      type: "doc",
      content: [
        { type: "entityRef", attrs: { kind: "bogus", id: "x" } },
        { type: "entityRef", attrs: { kind: "issue" } },
      ],
    };
    expect(extractReferences(bad)).toEqual([]);
  });
});

describe("entityHref", () => {
  it("routes per kind", () => {
    expect(entityHref("issue", "a")).toBe("/issues/a");
    expect(entityHref("page", "a")).toBe("/pages/a");
    expect(entityHref("project", "a")).toBe("/projects/a");
  });
});

describe("isRefKind", () => {
  it("validates kinds", () => {
    expect(isRefKind("issue")).toBe(true);
    expect(isRefKind("widget")).toBe(false);
    expect(isRefKind(3)).toBe(false);
  });
});
