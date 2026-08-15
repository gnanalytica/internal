import { describe, expect, it } from "vitest";

import {
  cycleCode,
  cycleRange,
  cycleSubtitle,
  cycleTiming,
} from "@/lib/cycle-format";

const cycle = (start: string, end: string) => ({ startDate: start, endDate: end });

describe("cycleRange", () => {
  it("collapses the month when both dates share one", () => {
    expect(cycleRange(cycle("2026-09-04T00:00:00Z", "2026-09-10T00:00:00Z"))).toBe("Sep 4 – 10");
  });

  it("names both months when the range crosses one", () => {
    expect(cycleRange(cycle("2026-09-25T00:00:00Z", "2026-10-01T00:00:00Z"))).toBe(
      "Sep 25 – Oct 1",
    );
  });

  it("adds years only when the range crosses one, and then to both ends", () => {
    // A range that always repeats the current year is noise; one that spans
    // new year is confusing without it.
    expect(cycleRange(cycle("2026-12-30T00:00:00Z", "2027-01-05T00:00:00Z"))).toBe(
      "Dec 30, 2026 – Jan 5, 2027",
    );
  });

  it("returns nothing rather than 'Invalid Date' for unusable input", () => {
    expect(cycleRange(cycle("nonsense", "2026-01-01T00:00:00Z"))).toBe("");
  });
});

describe("cycleTiming", () => {
  const c = cycle("2026-09-25T00:00:00Z", "2026-10-01T00:00:00Z");

  it("counts down while the cycle is running", () => {
    expect(cycleTiming(c, new Date("2026-09-28T00:00:00Z"))).toBe("3 days left");
    expect(cycleTiming(c, new Date("2026-09-30T00:00:00Z"))).toBe("1 day left");
  });

  it("says so on the last day", () => {
    expect(cycleTiming(c, new Date("2026-10-01T00:00:00Z"))).toBe("ends today");
  });

  it("reports how long ago a recent cycle ended", () => {
    expect(cycleTiming(c, new Date("2026-10-02T00:00:00Z"))).toBe("ended yesterday");
    expect(cycleTiming(c, new Date("2026-10-11T00:00:00Z"))).toBe("ended 10 days ago");
  });

  it("counts down to a cycle starting soon", () => {
    expect(cycleTiming(c, new Date("2026-09-20T00:00:00Z"))).toBe("starts in 5 days");
    expect(cycleTiming(c, new Date("2026-09-24T00:00:00Z"))).toBe("starts tomorrow");
  });

  it("stays quiet when the dates already say enough", () => {
    // Far future and long past need no relative gloss.
    expect(cycleTiming(c, new Date("2026-01-01T00:00:00Z"))).toBeNull();
    expect(cycleTiming(c, new Date("2027-06-01T00:00:00Z"))).toBeNull();
  });
});

describe("cycleSubtitle", () => {
  it("joins the range and the timing when both are worth showing", () => {
    expect(
      cycleSubtitle(cycle("2026-09-25T00:00:00Z", "2026-10-01T00:00:00Z"), new Date("2026-09-28T00:00:00Z")),
    ).toBe("Sep 25 – Oct 1 · 3 days left");
  });

  it("falls back to the range alone", () => {
    expect(
      cycleSubtitle(cycle("2026-09-25T00:00:00Z", "2026-10-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z")),
    ).toBe("Sep 25 – Oct 1");
  });
});

describe("cycleCode", () => {
  it("takes the short code before the em dash", () => {
    expect(cycleCode("S1 — Launch defects")).toBe("S1");
    expect(cycleCode("W6 — Prod & launch")).toBe("W6");
  });

  it("returns the whole name when there is no code to split off", () => {
    expect(cycleCode("Cycle 14")).toBe("Cycle 14");
  });
});
