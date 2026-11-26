import { describe, expect, it } from "vitest";

import { planRowWrite } from "./plan";
import { missingRequired, requiredForMove, requiredMessage } from "./stage-rules";

describe("requiredForMove", () => {
  it("asks for what each stage left behind found out, once each", () => {
    expect(requiredForMove("valuer", 2, 3)).toEqual(["lb_cases_per_month", "current_software"]);
    expect(requiredForMove("valuer", 3, 4)).toEqual(["pitch_angle", "next_step"]);
    expect(requiredForMove("valuer", 1, 5)).toEqual(["lb_cases_per_month", "current_software", "pitch_angle", "next_step"]);
    expect(requiredForMove("valuer", 0, 2)).toEqual([]);
  });

  it("never blocks moving back or to Lost", () => {
    expect(requiredForMove("valuer", 4, 2)).toEqual([]);
    expect(requiredForMove("valuer", 1, 6)).toEqual([]);
  });

  it("only asks for columns the tab has", () => {
    // Firms and banks don't track a practice's cases or software.
    expect(requiredForMove("firm", 2, 4)).not.toContain("lb_cases_per_month");
  });
});

describe("missingRequired", () => {
  it("counts a value already on the row or in the change, not a blank", () => {
    expect(missingRequired("valuer", { lb_cases_per_month: "40", current_software: "  " }, 2, 3)).toEqual(["current_software"]);
    expect(missingRequired("valuer", { lb_cases_per_month: 0, current_software: "ValuerPro" }, 2, 3)).toEqual([]);
  });

  it("says what's missing in a sentence", () => {
    expect(requiredMessage(3, ["lb_cases_per_month", "current_software"])).toBe("Demo done needs Cases a month and Current software first");
    expect(requiredMessage(4, ["next_step"])).toBe("Pilot running needs Next step first");
  });
});

describe("planRowWrite holds the line", () => {
  const header = ["status", "registration_no", "lb_cases_per_month", "current_software"];
  const base = { kind: "valuer" as const, tab: "Registered Valuers", header, row: 3, formulas: new Set<number>() };

  it("refuses a forward move with a required column blank", () => {
    const p = planRowWrite({ ...base, current: ["Discovery done", "IBBI/RV/1", "40", ""], patch: { status: "Demo done" } });
    expect(p.refused).toEqual(["Demo done needs Current software first"]);
  });

  it("accepts it when the same write fills the gap, or the row already has it", () => {
    expect(planRowWrite({ ...base, current: ["Discovery done", "IBBI/RV/1", "40", ""], patch: { status: "Demo done", current_software: "ValuerPro" } }).refused).toEqual([]);
    expect(planRowWrite({ ...base, current: ["Discovery done", "IBBI/RV/1", "40", "Excel"], patch: { status: "Demo done" } }).refused).toEqual([]);
  });

  it("lets a move back or to Lost through", () => {
    expect(planRowWrite({ ...base, current: ["Discovery done", "IBBI/RV/1", "", ""], patch: { status: "Lost" } }).refused).toEqual([]);
    expect(planRowWrite({ ...base, current: ["Discovery done", "IBBI/RV/1", "", ""], patch: { status: "Contacted" } }).refused).toEqual([]);
  });
});
