import { describe, expect, it } from "vitest";

import { canSeeFinance, canSeeProject, canSeeSales, UNRESTRICTED, type ApiScope } from "./scope-rules";

const member: ApiScope = { restricted: true, hiddenProjectIds: new Set(["fin-op", "hr-op"]), ownedProjectIds: new Set(["valytica", "hr-op"]) };

describe("API visibility for a member signed in on their phone", () => {
  it("hides confidential projects and what is inside them", () => {
    expect(canSeeProject(member, "fin-op")).toBe(false);
    expect(canSeeProject(member, "valytica")).toBe(true);
    expect(canSeeProject(member, "other")).toBe(true);
    // Workspace-level records (no project) stay visible, as on the web.
    expect(canSeeProject(member, null)).toBe(true);
  });
  it("keeps Sales for admins", () => {
    expect(canSeeSales(member)).toBe(false);
  });
  it("shows Finance only for a visible project the member owns", () => {
    expect(canSeeFinance(member, "valytica")).toBe(true);
    expect(canSeeFinance(member, "other")).toBe(false);
    expect(canSeeFinance(member, null)).toBe(false);
    // Owning a confidential project does not unhide it.
    expect(canSeeFinance(member, "hr-op")).toBe(false);
  });
  it("leaves admins and integration keys unrestricted", () => {
    expect(canSeeProject(UNRESTRICTED, "fin-op")).toBe(true);
    expect(canSeeSales(UNRESTRICTED)).toBe(true);
    expect(canSeeFinance(UNRESTRICTED, null)).toBe(true);
  });
});
