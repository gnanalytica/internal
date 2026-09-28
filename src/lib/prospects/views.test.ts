import { describe, expect, it } from "vitest";

import { parseWorkbook } from "./parse";
import { TAB } from "./schema";
import { firstName, nowIST, patchSchema, touchPatch, touchSchema } from "./touch";
import { everyRow, kindCounts, myWork, parseKind, parseScope, scopedRows } from "./views";

const TODAY = "2026-09-28";

const VALUERS = [
  ["registration_no", "name", "state", "city", "phone", "email", "assigned", "status", "next_step", "next_step_date", "score_band", "opportunity_score", "draft_whatsapp", "draft_email", "research_notes", "lenders_empanelled_with", "current_software"],
  ["IBBI/RV/01/1", "Overdue One", "Telangana", "Hyderabad", "98480 12345", "a@x.in", "Sandeep", "Contacted", "Call back", "25-09-2026", "A", "80", "Hi A", "Subject: Hello\n\nBody", "", "SBI; HDFC", "Word + Excel"],
  ["IBBI/RV/01/2", "Fresh A", "Karnataka", "Bangalore", "", "", "Sandeep Kumar", "", "", "", "A", "90", "Hi B", "", "", "", ""],
  ["IBBI/RV/01/3", "Do Not Call", "Karnataka", "Bangalore", "", "", "Sandeep", "", "", "", "A", "95", "", "", "DO NOT CONTACT — asked us not to", "", ""],
  ["IBBI/RV/01/4", "Elsewhere", "Maharashtra", "Pune", "", "", "Sandeep", "Contacted", "Follow up", "28-09-2026", "B", "60", "", "", "", "", ""],
  ["IBBI/RV/01/5", "Someone else's", "Telangana", "Hyderabad", "", "", "Priya", "Contacted", "Follow up", "20-09-2026", "A", "70", "", "", "", "", ""],
];

const BANKS = [
  ["contact_id", "institution", "contact_person", "city", "assigned", "status", "next_step", "next_step_date", "phone"],
  ["BC-001", "SBI", "Mr. R", "Mumbai", "Sandeep", "Contacted", "Send deck", "28-09-2026", "022 1234 5678"],
];

function workbook() {
  return parseWorkbook(new Map([[TAB.valuer, VALUERS], [TAB.bank, BANKS]]), "2026-09-28T06:00:00Z");
}

describe("request parsing", () => {
  it("accepts only real kinds and defaults the scope to the focus states", () => {
    expect(parseKind("firm")).toBe("firm");
    expect(parseKind("person")).toBeNull();
    expect(parseKind(null)).toBeNull();
    expect(parseScope("all")).toBe("all");
    expect(parseScope("ALL")).toBe("focus");
    expect(parseScope(undefined)).toBe("focus");
  });
});

describe("scoped rows", () => {
  it("keeps valuers in KA, AP and TS unless the scope is all India", () => {
    const wb = workbook();
    expect(scopedRows(wb, "valuer", "focus").map((r) => r.id)).toEqual(["IBBI/RV/01/1", "IBBI/RV/01/2", "IBBI/RV/01/3", "IBBI/RV/01/5"]);
    expect(scopedRows(wb, "valuer", "all")).toHaveLength(5);
    // Other kinds are never narrowed by state.
    expect(scopedRows(wb, "bank", "focus")).toHaveLength(1);
  });

  it("sends the slim row, not the record — no drafts, notes or phone number", () => {
    const [r] = scopedRows(workbook(), "valuer", "focus");
    expect(r).toMatchObject({ id: "IBBI/RV/01/1", hasPhone: true, hasEmail: true, lenders: 2, software: "Word + Excel", band: "A", score: 80 });
    expect(r).not.toHaveProperty("drafts");
    expect(r).not.toHaveProperty("phone");
    expect(r).not.toHaveProperty("notes");
  });

  it("counts each kind in scope and in total", () => {
    const { counts, totals } = kindCounts(workbook(), "focus");
    expect(counts).toEqual({ valuer: 4, firm: 0, rvo: 0, panel: 0, bank: 1 });
    expect(totals.valuer).toBe(5);
    expect(kindCounts(workbook(), "all").counts.valuer).toBe(5);
    expect(everyRow(workbook(), "focus")).toHaveLength(5);
  });
});

describe("my work", () => {
  it("queues the caller's overdue, then today's, then fresh A-band — each with drafts and contact details", () => {
    const items = myWork(workbook(), "Sandeep Kumar", TODAY, "focus");
    expect(items.map((t) => [t.row.id, t.reason])).toEqual([
      ["IBBI/RV/01/1", "overdue"],
      ["BC-001", "today"],
      ["IBBI/RV/01/2", "new"],
    ]);
    expect(items[0]).toMatchObject({ phone: "98480 12345", email: "a@x.in", lenders: 2, software: "Word + Excel" });
    expect(items[0].drafts).toMatchObject({ whatsapp: "Hi A", email: "Subject: Hello\n\nBody" });
    expect(items[1]).toMatchObject({ phone: "022 1234 5678", drafts: { whatsapp: "", email: "", call: "", meeting: "" } });
  });

  it("never suggests a do-not-contact record, another person's row, or one outside the scope", () => {
    const ids = myWork(workbook(), "Sandeep", TODAY, "focus").map((t) => t.row.id);
    expect(ids).not.toContain("IBBI/RV/01/3");
    expect(ids).not.toContain("IBBI/RV/01/5");
    expect(ids).not.toContain("IBBI/RV/01/4");
    expect(myWork(workbook(), "Sandeep", TODAY, "all").map((t) => t.row.id)).toContain("IBBI/RV/01/4");
  });
});

describe("logging a touch", () => {
  const base = { kind: "valuer" as const, id: "IBBI/RV/01/1", name: "Overdue One", channel: "Call" as const, direction: "Outbound" as const, outcome: "Connected" as const, durationMin: 12, summary: "4 banks", statusAfter: "Discovery done" as const, nextStep: "Send demo link", nextStepDate: "2026-10-01" };

  it("writes status, dates, what was learnt and a signed note line", () => {
    const t = touchSchema.parse({ ...base, fields: { current_software: "Word templates", lb_cases_per_month: 40, objections: "" } });
    expect(touchPatch(t, "Sandeep Kumar", TODAY)).toEqual({
      status: "Discovery done",
      last_contacted: TODAY,
      next_step_date: "2026-10-01",
      next_step: "Send demo link",
      current_software: "Word templates",
      lb_cases_per_month: 40,
      prependNote: "28-09-2026 — Call (12 min): Connected. 4 banks — Sandeep",
    });
  });

  it("leaves the next step alone when none is given, and drops fields the tab has no column for", () => {
    const t = touchSchema.parse({ ...base, kind: "bank", durationMin: null, summary: "", nextStep: null, nextStepDate: null, fields: { current_software: "Own software", pitch_angle: "Faster reports" } });
    const p = touchPatch(t, "Priya", TODAY);
    expect(p).toEqual({ status: "Discovery done", last_contacted: TODAY, prependNote: "28-09-2026 — Call: Connected — Priya" });
  });

  it("rejects what the sheet would not accept", () => {
    expect(touchSchema.safeParse({ ...base, outcome: "Maybe" }).success).toBe(false);
    expect(touchSchema.safeParse({ ...base, nextStepDate: "01-10-2026" }).success).toBe(false);
    expect(touchSchema.safeParse({ ...base, kind: "lead" }).success).toBe(false);
    expect(patchSchema.safeParse({ status: { nested: true } }).success).toBe(false);
    expect(patchSchema.safeParse({ status: "Won", lb_cases_per_month: 3, notes: null }).success).toBe(true);
  });

  it("stamps India time and signs with a first name", () => {
    expect(nowIST(Date.parse("2026-09-27T20:05:00Z"))).toBe("28-09-2026 01:35");
    expect(firstName("  Sandeep Kumar ")).toBe("Sandeep");
  });
});
