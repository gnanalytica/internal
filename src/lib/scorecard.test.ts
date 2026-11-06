import { describe, expect, it } from "vitest";

import {
  autoValues,
  buildRows,
  formatValue,
  isMetricSource,
  isMonday,
  istDay,
  mondayOf,
  parseCell,
  prospectSignals,
  scoreStatus,
  scorecardWeeks,
  stageOf,
  SUGGESTED_METRICS,
  summarize,
  targetLabel,
  weekBounds,
  weekLabel,
  weekOf,
  weekPeriodDate,
  type ProspectSignals,
  type ScorecardSignals,
} from "@/lib/scorecard";

const none: ScorecardSignals = { dealsWon: [], published: [], defects: null };
// Friday 6 Nov 2026, midday in India: the week of Monday 2 Nov.
const NOW = Date.parse("2026-11-06T06:30:00Z");
const WEEKS = scorecardWeeks(NOW);

describe("week maths", () => {
  it("names a week by its Monday", () => {
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(mondayOf("2026-11-06")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // Sunday closes the week
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28"); // across a year end
  });

  it("buckets instants by India time, not UTC", () => {
    // 23:59 on Sunday in India is still last week…
    expect(weekOf("2026-11-08T18:29:00Z")).toBe("2026-11-02");
    // …and 00:00 Monday in India is 18:30 UTC on Sunday.
    expect(weekOf("2026-11-08T18:30:00Z")).toBe("2026-11-09");
    expect(istDay("2026-11-08T18:30:00Z")).toBe("2026-11-09");
  });

  it("lists the last five weeks, oldest first, ending this week", () => {
    expect(WEEKS).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
    expect(scorecardWeeks(NOW, 2)).toEqual(["2026-10-26", "2026-11-02"]);
  });

  it("bounds a week from Monday 00:00 India time", () => {
    const { from, to } = weekBounds("2026-11-02");
    expect(from.toISOString()).toBe("2026-11-01T18:30:00.000Z");
    expect(to.toISOString()).toBe("2026-11-08T18:30:00.000Z");
    // The stored instant for a typed-in week sits inside it.
    const at = weekPeriodDate("2026-11-02");
    expect(at >= from && at < to).toBe(true);
    expect(weekOf(at)).toBe("2026-11-02");
  });

  it("checks for a Monday", () => {
    expect(isMonday("2026-11-02")).toBe(true);
    expect(isMonday("2026-11-03")).toBe(false);
    expect(isMonday("2026-13-02")).toBe(false);
    expect(isMonday("next monday")).toBe(false);
  });

  it("labels a week column", () => {
    expect(weekLabel("2026-11-09")).toBe("9 Nov");
  });
});

describe("sources", () => {
  it("knows manual and the auto keys, nothing else", () => {
    expect(isMetricSource("manual")).toBe(true);
    expect(isMetricSource("sales.touches")).toBe(true);
    expect(isMetricSource("sales.nope")).toBe(false);
    expect(isMetricSource("toString")).toBe(false);
  });

  it("reads a sheet status as a stage, blank as unknown", () => {
    expect(stageOf("Demo done")).toBe(3);
    expect(stageOf(" demo DONE ")).toBe(3);
    expect(stageOf("")).toBeNull();
    expect(stageOf("Thinking about it")).toBeNull();
  });
});

describe("sales sources", () => {
  const p: ProspectSignals = {
    touches: [
      { key: "valuer:A", date: "2026-10-13", stageAfter: 1 },
      { key: "valuer:A", date: "2026-10-20", stageAfter: 3 }, // A's demo
      { key: "valuer:A", date: "2026-10-28", stageAfter: 3 }, // still Demo done: not a second demo
      { key: "valuer:B", date: "2026-10-27", stageAfter: 4 }, // straight to a pilot counts as a demo
      { key: "valuer:C", date: "2026-11-03", stageAfter: 6 }, // Lost is not a demo
      { key: "valuer:D", date: "2026-11-04", stageAfter: null }, // blank status_after
      { key: "firm:A", date: "2026-11-05", stageAfter: 3 }, // a different prospect from valuer:A
    ],
    stages: [3, 4, 5, 6, 0],
  };

  it("counts touches logged each week", () => {
    expect(autoValues("sales.touches", WEEKS, none, p)).toEqual([0, 1, 1, 2, 3]);
  });

  it("counts a demo once, in the week a touch first moved the prospect there", () => {
    expect(autoValues("sales.demos", WEEKS, none, p)).toEqual([0, 0, 1, 1, 1]);
  });

  it("counts launch-ready leads from the sheet this week and from touch history before", () => {
    // B reached Pilot running in the week of 26 Oct; this week reads the sheet (one Pilot, one Won).
    expect(autoValues("sales.launchReady", WEEKS, none, p)).toEqual([0, 0, 0, 1, 2]);
  });

  it("leaves sales blank without a prospects sheet", () => {
    expect(autoValues("sales.touches", WEEKS, none, null)).toEqual([null, null, null, null, null]);
    expect(prospectSignals([], [])).toBeNull();
  });

  it("builds signals from the workbook, skipping touches with no date", () => {
    const s = prospectSignals(
      [
        { date: "2026-11-03", recordType: "Valuer", registrationNo: "R1", statusAfter: "Demo done" },
        { date: null, recordType: "Valuer", registrationNo: "R2", statusAfter: "" },
      ],
      [{ stage: 2 }],
    );
    expect(s).toEqual({ touches: [{ key: "Valuer:R1", date: "2026-11-03", stageAfter: 3 }], stages: [2] });
  });

  it("keeps deals won as a running total", () => {
    const s: ScorecardSignals = { ...none, dealsWon: [{ wonAt: "2026-10-14T10:00:00Z" }, { wonAt: "2026-11-05T10:00:00Z" }] };
    expect(autoValues("sales.dealsWon", WEEKS, s, null)).toEqual([0, 1, 1, 1, 2]);
  });
});

describe("marketing and reliability sources", () => {
  it("counts pieces published each week", () => {
    const s: ScorecardSignals = { ...none, published: [{ publishDate: "2026-10-26T12:00:00Z" }, { publishDate: "2026-11-01T19:00:00Z" }, { publishDate: "2026-11-06T04:00:00Z" }] };
    // 19:00 UTC on Sunday 1 Nov is Monday morning in India.
    expect(autoValues("marketing.posted", WEEKS, s, null)).toEqual([0, 0, 0, 1, 2]);
  });

  it("counts defects open as each week closed", () => {
    const s: ScorecardSignals = {
      ...none,
      defects: [
        { createdAt: "2026-10-06T10:00:00Z", closedAt: "2026-10-21T10:00:00Z" },
        { createdAt: "2026-10-13T10:00:00Z", closedAt: null },
        { createdAt: "2026-11-03T10:00:00Z", closedAt: "2026-11-04T10:00:00Z" },
      ],
    };
    expect(autoValues("reliability.openDefects", WEEKS, s, null)).toEqual([1, 2, 1, 1, 1]);
  });

  it("leaves defects blank when nothing is labelled as one", () => {
    expect(autoValues("reliability.openDefects", WEEKS, none, null)).toEqual([null, null, null, null, null]);
    expect(autoValues("reliability.openDefects", WEEKS, { ...none, defects: [] }, null)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("rows and status", () => {
  it("reads on track against the target's direction", () => {
    expect(scoreStatus(41, 60, "above")).toBe("behind");
    expect(scoreStatus(60, 60, "above")).toBe("on");
    expect(scoreStatus(25, 30, "below")).toBe("on");
    expect(scoreStatus(0, 0, "below")).toBe("on");
    expect(scoreStatus(1, 0, "below")).toBe("behind");
    expect(scoreStatus(null, 60, "above")).toBe("empty");
    expect(scoreStatus(3, null, "above")).toBe("untargeted");
  });

  it("puts typed-in points in their week, latest first, and auto values from signals", () => {
    const rows = buildRows(
      [
        {
          id: "m1",
          name: "Uptime",
          unit: "%",
          area: "reliability",
          source: "manual",
          target: 99.5,
          targetDirection: "above",
          points: [
            { periodDate: "2026-10-12T00:00:00Z", value: 99.9 },
            { periodDate: "2026-11-02T00:00:00Z", value: 99 },
            { periodDate: "2026-11-04T00:00:00Z", value: 100 }, // a weekday point in the same week wins
          ],
        },
        { id: "m2", name: "Pieces", unit: null, area: "elsewhere", source: "marketing.posted", target: 8, targetDirection: "sideways", points: [] },
        { id: "m3", name: "Old", unit: null, area: "product", source: "gone.away", target: null, targetDirection: "above", points: [] },
      ],
      WEEKS,
      { ...none, published: [{ publishDate: "2026-11-03T06:00:00Z" }] },
      null,
    );
    expect(rows[0].values).toEqual([null, 99.9, null, null, 100]);
    expect(rows[1]).toMatchObject({ area: "product", source: "marketing.posted", targetDirection: "above", values: [0, 0, 0, 0, 1] });
    expect(rows[2].source).toBe("manual");
  });

  it("summarizes the strip", () => {
    expect(summarize([{ status: "on" }, { status: "behind" }, { status: "empty" }, { status: "empty" }, { status: "untargeted" }])).toEqual({ on: 1, behind: 1, waiting: 2, total: 5 });
  });
});

describe("formatting and input", () => {
  it("writes values and targets the way the scorecard shows them", () => {
    expect(formatValue(null)).toBe("—");
    expect(formatValue(1234567)).toBe("12,34,567");
    expect(formatValue(99.456)).toBe("99.46");
    expect(targetLabel(60, "above")).toBe("60");
    expect(targetLabel(30, "below")).toBe("≤ 30");
    expect(targetLabel(0, "below")).toBe("0");
    expect(targetLabel(null, "above")).toBe("—");
  });

  it("parses a typed cell", () => {
    expect(parseCell("")).toBeNull();
    expect(parseCell("  ")).toBeNull();
    expect(parseCell("1,200")).toBe(1200);
    expect(parseCell("99.5%")).toBe(99.5);
    expect(parseCell("₹ 38")).toBe(38);
    expect(parseCell("abc")).toBeUndefined();
  });
});

describe("suggested metrics", () => {
  it("are thirteen, with unique names and valid sources", () => {
    expect(SUGGESTED_METRICS).toHaveLength(13);
    expect(new Set(SUGGESTED_METRICS.map((m) => m.name)).size).toBe(13);
    for (const m of SUGGESTED_METRICS) expect(isMetricSource(m.source)).toBe(true);
  });
});
