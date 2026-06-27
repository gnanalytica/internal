import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TYPES,
  DEAL_STAGES,
  DEPARTMENTS,
  OPEN_DEAL_STAGES,
  OPEN_TICKET_STATUSES,
  enabledDepartments,
  isDealStage,
  isDepartmentEnabled,
  isTicketStatus,
  optionMeta,
} from "@/lib/departments";

describe("DEPARTMENTS", () => {
  it("includes the six department modules", () => {
    expect(DEPARTMENTS.map((d) => d.slug)).toEqual([
      "engineering",
      "sales",
      "marketing",
      "finance",
      "support",
      "features",
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
  it("treats null as all departments enabled (auto-spawn default)", () => {
    expect(enabledDepartments(null).map((d) => d.slug)).toEqual([
      "engineering",
      "sales",
      "marketing",
      "finance",
      "support",
      "features",
    ]);
    expect(isDepartmentEnabled(null, "support")).toBe(true);
  });

  it("restricts to an explicit list, preserving canonical order", () => {
    expect(enabledDepartments(["support", "engineering"]).map((d) => d.slug)).toEqual([
      "engineering",
      "support",
    ]);
    expect(isDepartmentEnabled(["engineering"], "sales")).toBe(false);
    expect(isDepartmentEnabled(["engineering", "sales"], "sales")).toBe(true);
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
