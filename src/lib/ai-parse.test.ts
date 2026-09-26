import { describe, expect, it } from "vitest";

import { normalizeProposedIssue } from "@/lib/ai-parse";


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
