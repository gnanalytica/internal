import { describe, expect, it } from "vitest";

import { extractJsonArray, normalizeProposedIssue } from "@/lib/ai-parse";

describe("extractJsonArray", () => {
  it("parses a bare JSON array", () => {
    expect(extractJsonArray('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("extracts an array wrapped in prose and fences", () => {
    const text = 'Sure! Here you go:\n```json\n[{"title":"X"}]\n```\nHope that helps.';
    expect(extractJsonArray(text)).toEqual([{ title: "X" }]);
  });

  it("returns [] on no array or invalid json", () => {
    expect(extractJsonArray("no json here")).toEqual([]);
    expect(extractJsonArray("[not valid]")).toEqual([]);
    expect(extractJsonArray("")).toEqual([]);
  });
});

describe("normalizeProposedIssue", () => {
  it("keeps a valid title and description", () => {
    expect(normalizeProposedIssue({ title: " Build login ", description: "Use OAuth" })).toEqual({
      title: "Build login",
      description: "Use OAuth",
    });
  });

  it("defaults description to empty", () => {
    expect(normalizeProposedIssue({ title: "X" })).toEqual({ title: "X", description: "" });
  });

  it("rejects entries without a title", () => {
    expect(normalizeProposedIssue({ description: "no title" })).toBeNull();
    expect(normalizeProposedIssue(null)).toBeNull();
    expect(normalizeProposedIssue("string")).toBeNull();
  });
});
