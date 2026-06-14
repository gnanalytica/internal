import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TYPES,
  DEAL_STAGES,
  DEPARTMENTS,
  OPEN_DEAL_STAGES,
  OPEN_TICKET_STATUSES,
  isDealStage,
  isTicketStatus,
  optionMeta,
} from "@/lib/departments";

describe("DEPARTMENTS", () => {
  it("includes the five department modules", () => {
    expect(DEPARTMENTS.map((d) => d.slug)).toEqual([
      "engineering",
      "sales",
      "marketing",
      "finance",
      "support",
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

describe("optionMeta", () => {
  it("returns the matching option", () => {
    expect(optionMeta(ACCOUNT_TYPES, "customer").label).toBe("Customer");
  });

  it("falls back to the raw id when unknown", () => {
    expect(optionMeta(ACCOUNT_TYPES, "mystery")).toEqual({ label: "mystery" });
  });
});
