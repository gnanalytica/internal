import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TYPES,
  ALL_DEPARTMENT_SLUGS,
  DEAL_STAGES,
  DEPARTMENTS,
  OPEN_DEAL_STAGES,
  OPEN_TICKET_STATUSES,
  canSeeConfidentialDept,
  enabledDepartments,
  isDealStage,
  isDepartmentEnabled,
  isTicketStatus,
  optionMeta,
  visibleDepartments,
} from "@/lib/departments";

describe("DEPARTMENTS", () => {
  it("lists the seven legacy departments plus the three opt-in surfaces", () => {
    expect(DEPARTMENTS.map((d) => d.slug)).toEqual([
      "product", "engineering", "analytics", "marketing",
      "sales", "customer-success", "finance",
      "strategy", "roadmap", "growth",
    ]);
  });

  it("defaults (null) to the baseline — everything else is opt-in", () => {
    expect(enabledDepartments(null).map((d) => d.slug)).toEqual([
      "product", "engineering",
    ]);
  });
});

describe("deal stages", () => {
  it("validates stage ids", () => {
    expect(isDealStage("proposal")).toBe(true);
    expect(isDealStage("nonsense")).toBe(false);
  });

  it("treats only pre-close stages as open", () => {
    expect(OPEN_DEAL_STAGES).toContain("negotiation");
    expect(OPEN_DEAL_STAGES).not.toContain("won");
    expect(OPEN_DEAL_STAGES).not.toContain("lost");
  });

  it("covers every stage in the canonical order", () => {
    expect(DEAL_STAGES.map((s) => s.id)).toEqual([
      "lead",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ]);
  });
});

describe("ticket statuses", () => {
  it("validates status ids and open set", () => {
    expect(isTicketStatus("pending")).toBe(true);
    expect(isTicketStatus("archived")).toBe(false);
    expect(OPEN_TICKET_STATUSES).toEqual(["open", "pending"]);
  });
});

describe("per-project department config", () => {
  it("treats null as the baseline (Product + Engineering)", () => {
    expect(enabledDepartments(null).map((d) => d.slug)).toEqual([
      "product",
      "engineering",
    ]);
    expect(isDepartmentEnabled(null, "customer-success")).toBe(false);
  });

  it("restricts to an explicit list, preserving canonical order", () => {
    expect(enabledDepartments(["customer-success", "engineering"]).map((d) => d.slug)).toEqual([
      "engineering",
      "customer-success",
    ]);
    expect(isDepartmentEnabled(["engineering"], "sales")).toBe(false);
    expect(isDepartmentEnabled(["engineering", "sales"], "sales")).toBe(true);
  });

  it("isDepartmentEnabled respects defaultOn for the null default", () => {
    expect(isDepartmentEnabled(null, "product")).toBe(true);
    expect(isDepartmentEnabled(null, "strategy")).toBe(false);
  });

  it("isDepartmentEnabled honors an explicit enabled array", () => {
    expect(isDepartmentEnabled(["strategy"], "strategy")).toBe(true);
    expect(isDepartmentEnabled(["strategy"], "product")).toBe(false);
  });
});

describe("confidential department visibility", () => {
  const slugs = (role: string, isOwner: boolean) =>
    visibleDepartments(ALL_DEPARTMENT_SLUGS, role, isOwner).map((d) => d.slug);

  it("hides Sales and Finance from plain members", () => {
    const s = slugs("member", false);
    expect(s).not.toContain("sales");
    expect(s).not.toContain("finance");
  });

  it("shows everything to admins", () => {
    const s = slugs("admin", false);
    expect(s).toContain("sales");
    expect(s).toContain("finance");
  });

  it("shows Finance (but not Sales) to a member who owns the project", () => {
    const s = slugs("member", true);
    expect(s).toContain("finance");
    expect(s).not.toContain("sales");
  });

  it("canSeeConfidentialDept: owner gets Finance, never Sales", () => {
    expect(canSeeConfidentialDept("finance", "member", true)).toBe(true);
    expect(canSeeConfidentialDept("sales", "member", true)).toBe(false);
    expect(canSeeConfidentialDept("sales", "admin", false)).toBe(true);
    expect(canSeeConfidentialDept("finance", "member", false)).toBe(false);
  });
});

describe("optionMeta", () => {
  it("returns the matching option", () => {
    expect(optionMeta(ACCOUNT_TYPES, "customer").label).toBe("Customer");
  });

  it("falls back to the raw id when unknown", () => {
    expect(optionMeta(ACCOUNT_TYPES, "mystery")).toEqual({ label: "mystery" });
  });
});
