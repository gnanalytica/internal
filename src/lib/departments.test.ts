import { describe, expect, it } from "vitest";

import {
  DEAL_STAGES,
  DEPARTMENTS,
  INVOICE_STATUSES,
  OPEN_DEAL_STAGES,
  canSeeConfidentialDept,
  enabledDepartments,
  isConfidentialDepartment,
  isDepartmentEnabled,
  optionMeta,
  visibleDepartments,
} from "@/lib/departments";

describe("DEPARTMENTS", () => {
  it("lists every department that has a surface behind it", () => {
    expect(DEPARTMENTS.map((d) => d.slug)).toEqual([
      "product", "engineering", "analytics", "marketing",
      "sales", "customer-success", "finance", "strategy",
    ]);
  });

  // `roadmap` and `growth` were offerable departments whose pages rendered
  // "Roadmap for <project> will live here". Nothing ever enabled them, so
  // nobody saw the placeholder — but a department a project CAN turn on and
  // find empty is a trap, so the slug goes when the surface does.
  it("offers no department without a surface", () => {
    expect(DEPARTMENTS.map((d) => d.slug)).not.toContain("roadmap");
    expect(DEPARTMENTS.map((d) => d.slug)).not.toContain("growth");
  });

  it("defaults (null) to the baseline — everything else is opt-in", () => {
    expect(enabledDepartments(null).map((d) => d.slug)).toEqual([
      "product", "engineering", "strategy",
    ]);
  });
});

describe("deal stages", () => {
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

describe("per-project department config", () => {
  it("treats null as the baseline (Product + Engineering + Strategy)", () => {
    expect(enabledDepartments(null).map((d) => d.slug)).toEqual([
      "product",
      "engineering",
      "strategy",
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
    expect(isDepartmentEnabled(null, "strategy")).toBe(true);
    expect(isDepartmentEnabled(null, "analytics")).toBe(false);
  });

  it("isDepartmentEnabled honors an explicit enabled array", () => {
    expect(isDepartmentEnabled(["strategy"], "strategy")).toBe(true);
    expect(isDepartmentEnabled(["strategy"], "product")).toBe(false);
  });
});

describe("confidential department visibility", () => {
  const slugs = (role: string, isOwner: boolean) =>
    visibleDepartments(DEPARTMENTS.map((d) => d.slug), role, isOwner).map((d) => d.slug);

  it("hides Finance from plain members, but not Sales", () => {
    const s = slugs("member", false);
    expect(s).not.toContain("finance");
    // Sales is the working surface for whoever runs the pipeline, who is not
    // necessarily an admin — only Finance stays founders-only.
    expect(s).toContain("sales");
  });

  it("shows everything to admins", () => {
    const s = slugs("admin", false);
    expect(s).toContain("sales");
    expect(s).toContain("finance");
  });

  it("shows Finance to a member who owns the project", () => {
    const s = slugs("member", true);
    expect(s).toContain("finance");
  });

  it("canSeeConfidentialDept: owner gets Finance; Sales is not confidential", () => {
    expect(canSeeConfidentialDept("finance", "member", true)).toBe(true);
    expect(canSeeConfidentialDept("finance", "member", false)).toBe(false);
    expect(isConfidentialDepartment("sales")).toBe(false);
    expect(isConfidentialDepartment("finance")).toBe(true);
  });
});

describe("optionMeta", () => {
  it("returns the matching option", () => {
    expect(optionMeta(INVOICE_STATUSES, "paid").label).toBe("Paid");
  });

  it("falls back to the raw id when unknown", () => {
    expect(optionMeta(INVOICE_STATUSES, "mystery")).toEqual({ label: "mystery" });
  });
});
