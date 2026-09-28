import { describe, expect, it } from "vitest";

import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps same-site paths, including the phone sign-in's authorize page", () => {
    expect(safeNextPath("/oauth/authorize?client_id=internal-mobile&code_challenge=x")).toBe("/oauth/authorize?client_id=internal-mobile&code_challenge=x");
    expect(safeNextPath("/projects/abc")).toBe("/projects/abc");
  });
  it("refuses anything that could leave the site", () => {
    expect(safeNextPath("https://evil.test")).toBe("/issues");
    expect(safeNextPath("//evil.test")).toBe("/issues");
    expect(safeNextPath("/\\evil.test")).toBe("/issues");
    expect(safeNextPath("javascript:alert(1)")).toBe("/issues");
  });
  it("falls back when empty or pointing back into auth", () => {
    expect(safeNextPath(null)).toBe("/issues");
    expect(safeNextPath("/auth/sign-in")).toBe("/issues");
  });
});
