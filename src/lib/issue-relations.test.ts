import { describe, expect, it } from "vitest";

import { isRelationType, relationLabel } from "@/lib/issue-relations";

describe("relationLabel", () => {
  it("distinguishes blocks direction", () => {
    expect(relationLabel("blocks", "outgoing")).toBe("Blocking");
    expect(relationLabel("blocks", "incoming")).toBe("Blocked by");
  });

  it("distinguishes duplicate direction", () => {
    expect(relationLabel("duplicate", "outgoing")).toBe("Duplicate of");
    expect(relationLabel("duplicate", "incoming")).toBe("Duplicated by");
  });

  it("treats related as symmetric", () => {
    expect(relationLabel("related", "outgoing")).toBe("Related");
    expect(relationLabel("related", "incoming")).toBe("Related");
  });
});

describe("isRelationType", () => {
  it("accepts known types", () => {
    expect(isRelationType("blocks")).toBe(true);
    expect(isRelationType("related")).toBe(true);
    expect(isRelationType("duplicate")).toBe(true);
  });

  it("rejects others", () => {
    expect(isRelationType("subtask")).toBe(false);
  });
});
