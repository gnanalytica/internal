import { describe, expect, it } from "vitest";

import { bandKey, displayDate, parseActivity, parseRecords, parseSheetDate, parseSources, parseWorkbook, splitList, stageIndex } from "./parse";
import { activityRow, nextActivityId, planRowWrite } from "./plan";

const VALUER_HEADER = [
  "status", "registration_no", "name", "state", "city", "email", "phone", "lenders_empanelled_with", "lb_cases_per_month",
  "assigned", "last_contacted", "next_step", "next_step_date", "notes", "active_practice", "workflow_pain", "opportunity_score",
  "score_band", "research_sources", "firm_status",
];

describe("dates", () => {
  it("reads every format the workbook produces", () => {
    expect(parseSheetDate("28-09-2026")).toBe("2026-09-28");
    expect(parseSheetDate("2026-09-28")).toBe("2026-09-28");
    // An unformatted date cell in the workbook's en_US locale renders m/d/yyyy.
    expect(parseSheetDate("9/28/2026")).toBe("2026-09-28");
    expect(parseSheetDate("30 Jun, 2018")).toBe("2018-06-30");
    expect(parseSheetDate("28-09-2026 11:40")).toBe("2026-09-28");
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate("soon")).toBeNull();
  });
  it("displays ISO as the sheet's dd-mm-yyyy", () => {
    expect(displayDate("2026-09-28")).toBe("28-09-2026");
    expect(displayDate(null)).toBe("");
  });
});

describe("cell helpers", () => {
  it("maps status text to a stage, blank and unknown to Not contacted", () => {
    expect(stageIndex("Demo done")).toBe(3);
    expect(stageIndex("demo DONE")).toBe(3);
    expect(stageIndex("")).toBe(0);
    expect(stageIndex("In talks")).toBe(0);
  });
  it("reduces score_band to a key", () => {
    expect(bandKey("Incomplete 5/8")).toBe("Incomplete");
    expect(bandKey("A")).toBe("A");
    expect(bandKey("")).toBe("");
  });
  it("splits lenders on semicolons", () => {
    expect(splitList("SBI – Hyderabad circle; LIC HFL – Vizag;")).toEqual(["SBI – Hyderabad circle", "LIC HFL – Vizag"]);
  });
  it("reads research sources as what: url lines", () => {
    expect(parseSources("lenders: https://x.in/panel.pdf\nphone: https://y.in/contact\nhttps://z.in")).toEqual([
      { what: "lenders", url: "https://x.in/panel.pdf" },
      { what: "phone", url: "https://y.in/contact" },
      { what: "", url: "https://z.in" },
    ]);
  });
});

describe("parseRecords", () => {
  it("finds columns by header, skips rows without an ID, and flags duplicates", () => {
    const warnings: string[] = [];
    const rows = parseRecords(
      "valuer",
      [
        VALUER_HEADER,
        ["Demo done", "IBBI/RV/02/2019/1", "Er. A", "Telangana", "Hyderabad", "a@x.in", "", "SBI; HDFC", 40, "Sandeep", "24-09-2026", "Pilot", "28-09-2026", "", 18, 19, 88, "A", "", "Not contacted"],
        ["", "", "No id"],
        ["Contacted", "IBBI/RV/02/2019/1", "Duplicate"],
        ["", "IBBI/RV/05/2020/2", "Smt. B", "Karnataka", "", "", "", "", "", "", "", "", "", "", "", "", "", "Incomplete 2/8"],
      ],
      warnings,
    );
    expect(rows.map((r) => r.id)).toEqual(["IBBI/RV/02/2019/1", "IBBI/RV/05/2020/2"]);
    expect(rows[0]).toMatchObject({ stage: 3, lenders: ["SBI", "HDFC"], casesPerMonth: 40, lastContacted: "2026-09-24", nextStepDate: "2026-09-28", band: "A", opportunityScore: 88 });
    expect(rows[0].scores.slice(0, 2)).toEqual([18, 19]);
    expect(rows[0].scores[2]).toBeNull();
    expect(rows[1]).toMatchObject({ stage: 0, band: "Incomplete", casesPerMonth: null });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("more than one row");
  });

  it("reads a tab whose columns were reordered", () => {
    const warnings: string[] = [];
    const [r] = parseRecords("rvo", [["name", "rvo_recognition_no", "status"], ["IOV RVF", "IBBI/RVO/2017/001", "Contacted"]], warnings);
    expect(r).toMatchObject({ id: "IBBI/RVO/2017/001", name: "IOV RVF", stage: 1 });
  });

  it("refuses a tab without its ID column rather than guessing", () => {
    const warnings: string[] = [];
    expect(parseRecords("firm", [["name"], ["X"]], warnings)).toEqual([]);
    expect(warnings[0]).toContain("no registration_no column");
  });

  it("reports missing tabs instead of showing an empty dashboard silently", () => {
    const wb = parseWorkbook(new Map(), "2026-09-28T00:00:00Z");
    expect(wb.warnings.length).toBe(4);
  });
});

describe("parseActivity", () => {
  it("reads entries and their date", () => {
    const [a] = parseActivity(
      [["activity_id", "logged_at", "registration_no", "channel", "outcome", "duration_min"], ["A-000001", "28-09-2026 11:40", "IBBI/RV/1", "Call", "Connected", 14]],
      [],
    );
    expect(a).toMatchObject({ id: "A-000001", date: "2026-09-28", channel: "Call", outcome: "Connected", durationMin: 14 });
  });
});

describe("planRowWrite", () => {
  const header = ["status", "registration_no", "notes", "next_step_date", "lb_cases_per_month", "firm_status", "opportunity_score", "name"];
  const base = { kind: "valuer" as const, tab: "Registered Valuers", header, row: 7, current: ["Contacted", "IBBI/RV/1", "12-09-2026 — intro", "", "", "", "", "Er. A"] };

  it("writes text raw, dates and numbers as entered values, addressed by header", () => {
    const p = planRowWrite({ ...base, formulas: new Set([5, 6]), patch: { status: "Discovery done", next_step_date: "2026-10-01", lb_cases_per_month: "40" } });
    expect(p.refused).toEqual([]);
    expect(p.raw).toEqual([{ range: "'Registered Valuers'!A7", value: "Discovery done" }]);
    expect(p.entered).toEqual([
      { range: "'Registered Valuers'!D7", value: "2026-10-01" },
      { range: "'Registered Valuers'!E7", value: 40 },
    ]);
  });

  it("prepends to notes instead of overwriting the log", () => {
    const p = planRowWrite({ ...base, formulas: new Set(), patch: { prependNote: "28-09-2026 — Call: connected" } });
    expect(p.raw[0].value).toBe("28-09-2026 — Call: connected\n12-09-2026 — intro");
  });

  it("refuses formula, read-only, unknown and malformed columns", () => {
    const p = planRowWrite({
      ...base,
      formulas: new Set([0]),
      patch: { status: "Won", name: "Renamed", opportunity_score: 99, firm_status: "Won", pitch_angle: "Faster reports", next_step_date: "01-10-2026" },
    });
    expect(p.written).toEqual([]);
    expect(p.refused).toEqual([
      "status holds a formula",
      "name is not editable from the dashboard",
      "opportunity_score is not editable from the dashboard",
      "firm_status is not editable from the dashboard",
      "Registered Valuers has no pitch_angle column",
      "next_step_date must be a yyyy-mm-dd date",
    ]);
  });
});

describe("activity ids and rows", () => {
  it("continues past the highest id, ignoring junk", () => {
    expect(nextActivityId([])).toBe("A-000001");
    expect(nextActivityId(["A-000009", "A-000002", "note", ""])).toBe("A-000010");
  });
  it("lays a row out in the tab's own column order", () => {
    const row = activityRow(
      "A-000001",
      { loggedAt: "28-09-2026 11:40", recordType: "Valuer", registrationNo: "IBBI/RV/1", name: "Er. A", by: "Sandeep", channel: "Call", direction: "Outbound", outcome: "Connected", durationMin: 14, statusAfter: "Discovery done", summary: "40 cases" },
      ["registration_no", "activity_id", "extra", "outcome"],
    );
    expect(row).toEqual(["IBBI/RV/1", "A-000001", "", "Connected"]);
  });
});
