import { describe, expect, it } from "vitest";

import type { ActivityEntry } from "./parse";
import { addDays, buildOverview, dueBucket, inFocus, inPeriod, isAssignedTo, myTasks, SAVED_VIEWS, todayIST, type ProspectRow } from "./stats";

const TODAY = "2026-09-28";

function row(p: Partial<ProspectRow> & { id: string }): ProspectRow {
  return {
    kind: "valuer", name: p.id, city: "", state: "Telangana", stage: 0, band: "", score: null, assigned: "", nextStep: "", nextStepDate: null,
    lastContacted: null, lenders: 0, cases: null, software: "", hasPhone: false, hasEmail: true, researchStatus: "", pitchAngle: "", objections: "", facts: 1, doNotContact: false,
    ...p,
  };
}

function act(p: Partial<ActivityEntry> & { registrationNo: string }): ActivityEntry {
  return { id: "", loggedAt: "", date: TODAY, recordType: "Valuer", name: "", by: "Sandeep", channel: "Call", direction: "Outbound", outcome: "Connected", durationMin: null, statusAfter: "", summary: "", ...p };
}

describe("dates and people", () => {
  it("computes today in India", () => {
    expect(todayIST(Date.parse("2026-09-27T19:00:00Z"))).toBe("2026-09-28");
    expect(todayIST(Date.parse("2026-09-27T18:00:00Z"))).toBe("2026-09-27");
  });
  it("buckets next-step dates", () => {
    expect(dueBucket(null, TODAY)).toBe("none");
    expect(dueBucket("2026-09-27", TODAY)).toBe("overdue");
    expect(dueBucket(TODAY, TODAY)).toBe("today");
    expect(dueBucket(addDays(TODAY, 7), TODAY)).toBe("soon");
    expect(dueBucket(addDays(TODAY, 8), TODAY)).toBe("later");
  });
  it("matches assigned names the way the team types them", () => {
    expect(isAssignedTo("Sandeep", "Sandeep Kumar")).toBe(true);
    expect(isAssignedTo("sandeep kumar", "Sandeep")).toBe(true);
    expect(isAssignedTo("Priya", "Sandeep")).toBe(false);
    expect(isAssignedTo("", "Sandeep")).toBe(false);
  });
  it("limits periods to the last 7 or 30 days", () => {
    expect(inPeriod("2026-09-22", "week", TODAY)).toBe(true);
    expect(inPeriod("2026-09-21", "week", TODAY)).toBe(false);
    expect(inPeriod("2026-09-21", "month", TODAY)).toBe(true);
    expect(inPeriod(null, "all", TODAY)).toBe(true);
  });
  it("keeps firms and RVOs in focus whatever their state", () => {
    expect(inFocus({ kind: "valuer", state: "Tamil Nadu" })).toBe(false);
    expect(inFocus({ kind: "valuer", state: "Karnataka" })).toBe(true);
    expect(inFocus({ kind: "firm", state: "" })).toBe(true);
  });
});

describe("buildOverview", () => {
  const rows = [
    row({ id: "a", stage: 0, band: "A", score: 80, city: "Hyderabad" }),
    row({ id: "b", stage: 1, assigned: "Sandeep", nextStepDate: "2026-09-26", city: "Hyderabad", objections: "Price" }),
    row({ id: "c", stage: 2, assigned: "Priya", pitchAngle: "Faster reports", state: "Andhra Pradesh" }),
    row({ id: "d", stage: 3, assigned: "Sandeep", pitchAngle: "Faster reports", nextStepDate: TODAY, objections: "Price" }),
    row({ id: "e", stage: 6, assigned: "Priya", pitchAngle: "Faster reports" }),
  ];
  const activity = [
    act({ registrationNo: "b", channel: "WhatsApp", outcome: "Sent" }),
    act({ registrationNo: "b", channel: "WhatsApp", outcome: "Replied", direction: "Inbound" }),
    act({ registrationNo: "d", channel: "Call", outcome: "Connected", durationMin: 14 }),
    act({ registrationNo: "d", channel: "Call", outcome: "No answer", durationMin: 0, by: "Priya", date: "2026-08-01" }),
  ];
  const o = buildOverview({ rows, activity, today: TODAY, period: "week", team: ["Sandeep Kumar", "Priya", "Arjun"] });

  it("counts the funnel and the share that moves on", () => {
    expect(o.funnel.map((f) => f.count)).toEqual([1, 1, 1, 1, 0, 0, 1]);
    // Of the 3 that reached Contacted or beyond (excluding Lost), 2 reached Discovery.
    expect(o.funnel[1].movedOn).toBe(67);
  });
  it("derives reply rates from Activity, inbound replies included", () => {
    const wa = o.channels.find((c) => c.channel === "WhatsApp")!;
    expect(wa).toMatchObject({ outbound: 1, engaged: 1, rate: 100 });
    expect(o.calls).toEqual({ count: 1, avgMinutes: 14 });
    expect(o.kpis).toMatchObject({ touches: 3, dueToday: 1, overdue: 1, pilots: 0 });
  });
  it("measures the pitch that books demos, never counting Lost", () => {
    expect(o.pitch.find((p) => p.angle === "Faster reports")).toMatchObject({ discovered: 2, demoed: 1, rate: 50 });
  });
  it("ranks objections and sprint progress", () => {
    expect(o.objections).toEqual([{ objection: "Price", count: 2 }]);
    expect(o.sprint[0]).toMatchObject({ label: "Hyderabad", inList: 2, contacted: 1, target: 50 });
    expect(o.sprint[2]).toMatchObject({ label: "Andhra Pradesh", inList: 1, contacted: 1 });
  });
  it("builds the team table without double-counting a name typed two ways", () => {
    const people = o.team.map((t) => t.person);
    expect(people).toEqual(["Sandeep Kumar", "Priya"]);
    expect(o.team[0]).toMatchObject({ assigned: 2, touches: 3, overdue: 1, demos: 1 });
  });
  it("lists A-band valuers nobody owns", () => {
    expect(o.unassignedA.map((r) => r.id)).toEqual(["a"]);
  });
  it("narrows to one person for the Me view", () => {
    const me = buildOverview({ rows, activity, today: TODAY, period: "all", person: "Priya", team: [] });
    expect(me.total).toBe(2);
    expect(me.kpis.touches).toBe(1);
  });
});

describe("myTasks and saved views", () => {
  const rows = [
    row({ id: "late", assigned: "Sandeep", stage: 1, nextStepDate: "2026-09-20" }),
    row({ id: "now", assigned: "Sandeep", stage: 2, nextStepDate: TODAY }),
    row({ id: "later", assigned: "Sandeep", stage: 1, nextStepDate: "2026-10-20" }),
    row({ id: "won", assigned: "Sandeep", stage: 5, nextStepDate: "2026-09-01" }),
    row({ id: "fresh", assigned: "Sandeep", band: "A", score: 90 }),
    row({ id: "other", assigned: "Priya", stage: 1, nextStepDate: TODAY }),
  ];
  it("queues overdue first, then today, then new A-band — never closed records", () => {
    expect(myTasks(rows, "Sandeep", TODAY).map((t) => [t.row.id, t.reason])).toEqual([
      ["late", "overdue"],
      ["now", "today"],
      ["fresh", "new"],
    ]);
  });
  it("filters saved views", () => {
    const view = (id: string) => SAVED_VIEWS.find((v) => v.id === id)!;
    const ctx = { person: "Sandeep", today: TODAY };
    expect(rows.filter((r) => view("overdue").test(r, ctx)).map((r) => r.id)).toEqual(["late"]);
    expect(rows.filter((r) => view("due").test(r, ctx)).map((r) => r.id)).toEqual(["late", "now", "other"]);
    expect(rows.filter((r) => view("a-new").test(r, ctx)).map((r) => r.id)).toEqual(["fresh"]);
  });
});

describe("do-not-contact", () => {
  it("never suggests an excluded record, even when it is A-band and theirs", () => {
    const rows = [
      row({ id: "ok", band: "A", score: 70, assigned: "Sandeep" }),
      row({ id: "dnc", band: "A", score: 90, assigned: "Sandeep", doNotContact: true }),
      row({ id: "dnc-free", band: "A", score: 95, doNotContact: true }),
    ];
    expect(myTasks(rows, "Sandeep", TODAY).map((t) => t.row.id)).toEqual(["ok"]);
    expect(buildOverview({ rows, activity: [], today: TODAY, period: "week", person: null, team: [] }).unassignedA.map((r) => r.id)).toEqual([]);
    const aNew = SAVED_VIEWS.find((v) => v.id === "a-new")!;
    expect(rows.filter((r) => aNew.test(r, { person: "Sandeep", today: TODAY })).map((r) => r.id)).toEqual(["ok"]);
  });
});
