import { describe, expect, it } from "vitest";

import { buildReminder, escapeMrkdwn, reminderText, shortDate, TOP_ITEMS } from "./reminder";
import type { ProspectRow } from "./stats";

const TODAY = "2026-11-05";
const BASE = "https://internal.example.com/projects/val-id/sales";

function row(p: Partial<ProspectRow> & { id: string }): ProspectRow {
  return {
    kind: "valuer", name: p.id, city: "", state: "Telangana", stage: 1, band: "", score: null, assigned: "", nextStep: "", nextStepDate: null,
    lastContacted: null, lenders: 0, cases: null, software: "", hasPhone: false, hasEmail: true, researchStatus: "", pitchAngle: "", objections: "", facts: 1, doNotContact: false,
    ...p,
  };
}

describe("buildReminder", () => {
  it("counts overdue and due-today follow-ups per person, oldest first", () => {
    const r = buildReminder({
      today: TODAY,
      people: ["Sandeep Kumar", "Priya"],
      rows: [
        row({ id: "a", assigned: "Sandeep", nextStepDate: "2026-11-05", nextStep: "Send demo link" }),
        row({ id: "b", assigned: "sandeep", nextStepDate: "2026-11-01", nextStep: "Call back" }),
        row({ id: "c", assigned: "Sandeep", nextStepDate: "2026-11-06" }), // tomorrow: not yet
        row({ id: "d", assigned: "Sandeep", nextStepDate: "2026-10-30", stage: 5 }), // won: closed
        row({ id: "e", assigned: "Priya", nextStepDate: "2026-11-05" }),
      ],
    });
    expect(r.people.map((p) => [p.person, p.overdue, p.today])).toEqual([
      ["Sandeep Kumar", 1, 1],
      ["Priya", 0, 1],
    ]);
    expect(r.people[0].top.map((i) => [i.name, i.overdue])).toEqual([
      ["b", true],
      ["a", false],
    ]);
    expect(r.unassigned).toEqual({ overdue: 0, today: 0 });
  });

  it("skips people with nothing due and leaves out new, undated records", () => {
    const r = buildReminder({
      today: TODAY,
      people: ["Sandeep", "Priya"],
      rows: [row({ id: "a", assigned: "Priya", band: "A", stage: 0 }), row({ id: "b", assigned: "Sandeep", nextStepDate: "2026-11-04" })],
    });
    expect(r.people.map((p) => p.person)).toEqual(["Sandeep"]);
  });

  it("gives sheet names with no workspace account their own block, merged with members by first name", () => {
    const r = buildReminder({
      today: TODAY,
      people: ["Sandeep Kumar"],
      rows: [
        row({ id: "a", assigned: "Ravi", nextStepDate: "2026-11-02" }),
        row({ id: "b", assigned: "sandeep", nextStepDate: "2026-11-05" }),
      ],
    });
    expect(r.people.map((p) => p.person)).toEqual(["Ravi", "Sandeep Kumar"]);
  });

  it("puts each follow-up in one block even when two names share a first name", () => {
    const r = buildReminder({
      today: TODAY,
      people: ["Sandeep Kumar", "Sandeep Rao"],
      rows: [row({ id: "a", assigned: "Sandeep", nextStepDate: "2026-11-05" })],
    });
    expect(r.people.reduce((n, p) => n + p.today, 0)).toBe(1);
  });

  it("counts due follow-ups nobody is assigned to", () => {
    const r = buildReminder({
      today: TODAY,
      people: [],
      rows: [
        row({ id: "a", nextStepDate: "2026-11-01" }),
        row({ id: "b", assigned: "  ", nextStepDate: "2026-11-05" }),
        row({ id: "c", nextStepDate: "2026-11-01", stage: 6 }), // lost: closed
      ],
    });
    expect(r.people).toEqual([]);
    expect(r.unassigned).toEqual({ overdue: 1, today: 1 });
  });

  it("caps the named items and sorts the furthest-behind person first", () => {
    const rows = Array.from({ length: TOP_ITEMS + 2 }, (_, i) => row({ id: `p${i}`, assigned: "Priya", nextStepDate: "2026-11-01" }));
    const r = buildReminder({ today: TODAY, people: ["Sandeep", "Priya"], rows: [...rows, row({ id: "s", assigned: "Sandeep", nextStepDate: TODAY })] });
    expect(r.people[0].person).toBe("Priya");
    expect(r.people[0].overdue).toBe(TOP_ITEMS + 2);
    expect(r.people[0].top).toHaveLength(TOP_ITEMS);
  });

  it("notes when a counted follow-up sits outside the focus states", () => {
    const inside = buildReminder({ today: TODAY, people: ["Priya"], rows: [row({ id: "a", assigned: "Priya", nextStepDate: TODAY })] });
    const outside = buildReminder({ today: TODAY, people: ["Priya"], rows: [row({ id: "a", assigned: "Priya", nextStepDate: TODAY, state: "Kerala" })] });
    expect(inside.outsideFocus).toBe(false);
    expect(outside.outsideFocus).toBe(true);
  });
});

describe("reminderText", () => {
  it("returns null when nobody has anything due", () => {
    const r = buildReminder({ today: TODAY, people: ["Sandeep"], rows: [row({ id: "a", assigned: "Sandeep", nextStepDate: "2026-11-09" })] });
    expect(reminderText(r, BASE)).toBeNull();
  });

  it("renders a block per person, the overflow, the unassigned line and the Today link", () => {
    const rows = [
      row({ id: "1", name: "Sharma & Sons Valuers", assigned: "Sandeep", nextStepDate: "2026-11-02", nextStep: "Call back <pricing>" }),
      row({ id: "2", name: "Rao Associates", assigned: "Sandeep", nextStepDate: TODAY }),
      ...Array.from({ length: 5 }, (_, i) => row({ id: `x${i}`, name: `Firm ${i}`, assigned: "Sandeep", nextStepDate: TODAY, nextStep: "Send deck" })),
      row({ id: "u", nextStepDate: "2026-11-01" }),
    ];
    const text = reminderText(buildReminder({ today: TODAY, people: ["Sandeep"], rows }), BASE)!;
    expect(text).toContain("*Prospect follow-ups for Thu 5 Nov*");
    expect(text).toContain("*Sandeep* — 1 overdue, 6 due today");
    expect(text).toContain("• Sharma &amp; Sons Valuers — Call back &lt;pricing&gt; _(3d overdue)_");
    expect(text).toContain("• Rao Associates _(today)_");
    expect(text).toContain("_+2 more_");
    expect(text).toContain("*Unassigned* — 1 overdue, nobody's name on them yet");
    expect(text).toContain(`<${BASE}|Open Today in Prospects →>`);
  });

  it("links to All India when something due is outside the focus states", () => {
    const r = buildReminder({ today: TODAY, people: ["Priya"], rows: [row({ id: "a", assigned: "Priya", nextStepDate: TODAY, state: "Kerala" })] });
    expect(reminderText(r, BASE)).toContain(`<${BASE}?scope=all|`);
  });

  it("uses the mention renderer for each person", () => {
    const r = buildReminder({ today: TODAY, people: ["Priya"], rows: [row({ id: "a", assigned: "Priya", nextStepDate: TODAY })] });
    expect(reminderText(r, BASE, () => "<@U123>")).toContain("<@U123> — 1 due today");
  });
});

describe("helpers", () => {
  it("formats a short date and escapes Slack control characters", () => {
    expect(shortDate("2026-11-05")).toBe("Thu 5 Nov");
    expect(escapeMrkdwn("a & <b>")).toBe("a &amp; &lt;b&gt;");
  });
});
