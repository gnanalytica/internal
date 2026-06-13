import { describe, expect, it } from "vitest";

import { snippetAround } from "@/lib/snippet";

describe("snippetAround", () => {
  it("returns null when the query isn't present", () => {
    expect(snippetAround("hello world", "xyz")).toBeNull();
    expect(snippetAround("", "x")).toBeNull();
    expect(snippetAround("text", "")).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(snippetAround("The Roadmap is ready", "roadmap", 4)).toContain("Roadmap");
  });

  it("adds ellipses when truncated on both sides", () => {
    const text = "a".repeat(50) + "needle" + "b".repeat(50);
    const snip = snippetAround(text, "needle", 10);
    expect(snip?.startsWith("…")).toBe(true);
    expect(snip?.endsWith("…")).toBe(true);
    expect(snip).toContain("needle");
  });

  it("omits the leading ellipsis when the match is at the start", () => {
    const snip = snippetAround("needle in the haystack here", "needle", 10);
    expect(snip?.startsWith("…")).toBe(false);
  });
});
