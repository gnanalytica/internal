import { describe, expect, it } from "vitest";

import { buildInsightCharts, outcomeClass } from "./insights";
import type { ActivityEntry } from "./parse";
import { buildOverview, type Period, type ProspectRow } from "./stats";

const TODAY = "2026-11-18";

const row = (id: string, over: Partial<ProspectRow> = {}): ProspectRow => ({
  kind: "valuer",
  id,
  name: id,
  city: "Pune",
  state: "Karnataka",
  stage: 1,
  band: "C",
  score: 40,
  assigned: "Parv",
  nextStep: "",
  nextStepDate: null,
  lastContacted: null,
  lenders: 0,
  cases: null,
  software: "",
  hasPhone: true,
  hasEmail: false,
  researchStatus: "",
  pitchAngle: "",
  objections: "",
  facts: 3,
  doNotContact: false,
  ...over,
});

let n = 0;
const touch = (id: string, date: string, channel: string, outcome: string, by = "Parv"): ActivityEntry => ({
  id: `A-${++n}`,
  loggedAt: `${date} 10:00`,
  date,
  recordType: "Registered Valuer",
  registrationNo: id,
  name: id,
  by,
  channel,
  direction: outcome === "Replied" ? "Inbound" : "Outbound",
  outcome,
  durationMin: null,
  statusAfter: "Contacted",
  summary: "",
});

const rows = [
  row("V1", { nextStepDate: "2026-11-10", lastContacted: "2026-11-17" }), // overdue, 1 day
  row("V2", { nextStepDate: TODAY, lastContacted: "2026-11-05", assigned: "Tasleem" }), // today, 13 days
  row("V3", { nextStepDate: "2026-11-21", lastContacted: "2026-10-20" }), // next 7 days, 29 days
  row("V4", { nextStepDate: "2026-12-30", lastContacted: "2026-08-01" }), // later, 60+
  row("V5", { nextStepDate: null, lastContacted: null }), // no date, never contacted
  row("V6", { stage: 0, nextStepDate: "2026-11-01" }), // not contacted: left out of the "now" charts
  row("V7", { stage: 6, nextStepDate: "2026-11-01", lastContacted: "2026-11-01" }), // lost: closed
];
const activity = [
  touch("V1", TODAY, "Call", "Connected"),
  touch("V1", TODAY, "Email", "Sent"),
  touch("V2", "2026-11-17", "WhatsApp", "Replied", "Tasleem"),
  touch("V3", "2026-11-12", "Call", "No answer"),
  touch("V3", "2026-11-01", "Call", "Not interested"), // 17 days ago: in 30 days, not in 7
  touch("V4", "2026-11-15", "Other", "Sent"),
  touch("ELSEWHERE", TODAY, "Call", "Connected"), // a row out of scope
];

describe("buildInsightCharts", () => {
  it("adds up to the Touches figure for the same filters", () => {
    const periods: Period[] = ["week", "month", { from: "2026-11-01", to: "2026-11-15" }, { from: "2026-08-01", to: TODAY }];
    for (const period of periods)
      for (const person of [null, "Parv"]) {
        const charts = buildInsightCharts({ rows, activity, today: TODAY, period, person });
        const kpi = buildOverview({ rows, activity, today: TODAY, period, person, team: [] }).kpis.touches;
        expect(charts.touches!.buckets.reduce((s, b) => s + b.total, 0), JSON.stringify({ period, person })).toBe(kpi);
      }
  });

  it("buckets by day up to a month and by week beyond, and draws nothing for Today", () => {
    const week = buildInsightCharts({ rows, activity, today: TODAY, period: "week" }).touches!;
    expect(week.unit).toBe("day");
    expect(week.buckets.map((b) => b.from)).toEqual(["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(week.buckets.at(-1)!.byChannel).toEqual({ Call: 1, WhatsApp: 0, Email: 1, LinkedIn: 0, Meeting: 0 });
    const long = buildInsightCharts({ rows, activity, today: TODAY, period: { from: "2026-08-01", to: TODAY } }).touches!;
    expect(long.unit).toBe("week");
    expect(long.buckets.at(-1)!.to).toBe(TODAY);
    expect(buildInsightCharts({ rows, activity, today: TODAY, period: "today" }).touches).toBeNull();
  });

  it("splits each channel's touches by how they went, leaving out channels with none", () => {
    const { outcomes } = buildInsightCharts({ rows, activity, today: TODAY, period: "month" });
    expect(outcomes.map((o) => o.channel)).toEqual(["WhatsApp", "Email", "Call", "Other"]);
    expect(outcomes[2]).toEqual({ channel: "Call", total: 3, byClass: { Engaged: 1, Waiting: 0, "No answer": 1, Closed: 1 } });
  });

  it("shows contacted, open prospects now, whatever the period", () => {
    const a = buildInsightCharts({ rows, activity, today: TODAY, period: "today" });
    const b = buildInsightCharts({ rows, activity, today: TODAY, period: "month" });
    expect(a.followUp).toEqual(b.followUp);
    expect(a.followUp).toEqual([
      { part: "Overdue", count: 1 },
      { part: "Due today", count: 1 },
      { part: "Next 7 days", count: 1 },
      { part: "Later", count: 1 },
      { part: "No date", count: 1 },
    ]);
    expect(a.staleness).toEqual([
      { label: "0–7", count: 1 },
      { label: "8–14", count: 1 },
      { label: "15–30", count: 1 },
      { label: "31–60", count: 0 },
      { label: "60+", count: 1 },
    ]);
  });

  it("narrows to one person for Me", () => {
    const mine = buildInsightCharts({ rows, activity, today: TODAY, period: "month", person: "Tasleem" });
    expect(mine.followUp.find((p) => p.part === "Due today")!.count).toBe(1);
    expect(mine.followUp.reduce((s, p) => s + p.count, 0)).toBe(1);
    expect(mine.outcomes.map((o) => o.channel)).toEqual(["WhatsApp"]);
  });
});

describe("outcomeClass", () => {
  it("groups outcomes the way the log offers them", () => {
    expect(["Replied", "Connected", "Demo booked", "Meeting held"].map(outcomeClass)).toEqual(["Engaged", "Engaged", "Engaged", "Engaged"]);
    expect(["No answer", "Busy — call back"].map(outcomeClass)).toEqual(["No answer", "No answer"]);
    expect(["Not interested", "Wrong number"].map(outcomeClass)).toEqual(["Closed", "Closed"]);
    expect(outcomeClass("Sent")).toBe("Waiting");
  });
});
