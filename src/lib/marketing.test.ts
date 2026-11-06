import { describe, expect, it } from "vitest";

import {
  atDay,
  bucketByDay,
  CHANNEL_FORMAT,
  CHANNELS,
  CONTENT_FORMATS,
  dayOf,
  fieldsFor,
  formatOf,
  fromIstInput,
  monthWeeks,
  statusOf,
  toIstInput,
  weekDays,
  weekLabel,
  weeklyPosted,
  weekPace,
  weekStart,
} from "./marketing";

const piece = (channel: string | null, publishDate: string | null, status = "idea") => ({ channel, publishDate, status });

describe("India days", () => {
  it("puts a timestamp on the IST day, not the UTC one", () => {
    // 19:00 UTC on the 9th is 00:30 IST on the 10th.
    expect(dayOf("2026-11-09T19:00:00Z")).toBe("2026-11-10");
    expect(dayOf("2026-11-09T18:00:00Z")).toBe("2026-11-09");
    expect(dayOf(null)).toBeNull();
  });

  it("round-trips a datetime-local value as IST", () => {
    const iso = fromIstInput("2026-11-12T10:00");
    expect(iso).toBe("2026-11-12T04:30:00.000Z");
    expect(toIstInput(iso)).toBe("2026-11-12T10:00");
    expect(fromIstInput("")).toBeNull();
    expect(fromIstInput("nonsense")).toBeNull();
  });

  it("moves a piece to another day and keeps its time", () => {
    expect(atDay("2026-11-13", "2026-11-09T04:00:00Z")).toBe("2026-11-13T04:00:00.000Z"); // 09:30 IST
    expect(atDay("2026-11-13", null)).toBe("2026-11-13T04:30:00.000Z"); // 10:00 IST
  });
});

describe("weeks", () => {
  it("starts on Monday", () => {
    expect(weekStart("2026-11-09")).toBe("2026-11-09"); // Monday
    expect(weekStart("2026-11-12")).toBe("2026-11-09");
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // Sunday belongs to the week before it
    expect(weekDays("2026-11-09")).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  });

  it("labels a week, across a month end too", () => {
    expect(weekLabel("2026-11-09")).toBe("9 – 15 Nov");
    expect(weekLabel("2026-11-30")).toBe("30 Nov – 6 Dec");
  });

  it("covers a month in whole Monday-first weeks", () => {
    const weeks = monthWeeks("2026-11"); // 1 Nov 2026 is a Sunday
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks[0][6]).toBe("2026-11-01");
    expect(weeks.at(-1)![6]).toBe("2026-12-06");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe("bucketByDay", () => {
  const days = weekDays("2026-11-09");

  it("files dated pieces by channel and day, earliest first, and leaves ideas out", () => {
    const late = piece("linkedin", "2026-11-10T09:00:00Z");
    const early = piece("linkedin", "2026-11-10T03:00:00Z");
    const b = bucketByDay([late, early, piece("blog", null), piece("blog", "2026-11-20T04:30:00Z")], days);
    expect(b.get("linkedin")?.get("2026-11-10")).toEqual([early, late]);
    expect(b.has("blog")).toBe(false);
  });

  it("puts pieces with no known channel in the 'other' row", () => {
    const b = bucketByDay([piece(null, "2026-11-11T04:30:00Z"), piece("events", "2026-11-11T04:30:00Z")], days);
    expect(b.get("other")?.get("2026-11-11")).toHaveLength(2);
  });
});

describe("weekPace", () => {
  it("is posted over everything dated in the week, per channel", () => {
    const items = [
      piece("linkedin", "2026-11-09T04:30:00Z", "published"),
      piece("linkedin", "2026-11-11T04:30:00Z", "scheduled"),
      piece("linkedin", "2026-11-13T04:30:00Z", "draft"),
      piece("whatsapp", "2026-11-09T12:00:00Z", "published"),
      piece("linkedin", "2026-11-16T04:30:00Z", "published"), // next week
      piece("blog", null), // an idea
    ];
    expect(weekPace(items, "2026-11-09").map(({ channel, done, plan }) => ({ channel, done, plan }))).toEqual([
      { channel: "linkedin", done: 1, plan: 3 },
      { channel: "whatsapp", done: 1, plan: 1 },
    ]);
  });

  it("is empty for a week with nothing planned", () => {
    expect(weekPace([piece("blog", null)], "2026-11-09")).toEqual([]);
  });
});

describe("weeklyPosted", () => {
  it("counts posted pieces into the last n weeks, oldest first", () => {
    const items = [
      piece("linkedin", "2026-11-10T04:30:00Z", "published"),
      piece("linkedin", "2026-11-03T04:30:00Z", "published"),
      piece("linkedin", "2026-11-04T04:30:00Z", "published"),
      piece("linkedin", "2026-11-11T04:30:00Z", "scheduled"), // not posted
      piece("linkedin", "2026-08-01T04:30:00Z", "published"), // too old
    ];
    const w = weeklyPosted(items, "2026-11-09", 4);
    expect(w.get("linkedin")).toEqual([0, 0, 2, 1]);
  });
});

describe("formats", () => {
  it("every format asks for fields with unique keys", () => {
    for (const f of CONTENT_FORMATS) {
      const keys = fieldsFor(f).map((x) => x.key);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length);
      // cta and shareAs are common to every piece; a format field must not shadow them.
      expect(keys).not.toContain("cta");
      expect(keys).not.toContain("shareAs");
    }
  });

  it("asks a post for its text, image, hashtags and best time", () => {
    expect(fieldsFor("post").map((f) => f.key)).toEqual(["text", "image", "hashtags", "bestTime"]);
    expect(fieldsFor("email").map((f) => f.key)).toEqual(["subject", "preview", "list"]);
  });

  it("asks nothing of a piece with no format", () => {
    expect(fieldsFor(null)).toEqual([]);
    expect(fieldsFor("podcast")).toEqual([]);
  });

  it("falls back to the channel's usual format, matching the backfill", () => {
    expect(formatOf({ format: null, channel: "blog" })).toBe("article");
    expect(formatOf({ format: null, channel: "download" })).toBe("pdf");
    expect(formatOf({ format: "reel", channel: "instagram" })).toBe("reel");
    expect(formatOf({ format: null, channel: null })).toBeNull();
    expect(Object.keys(CHANNEL_FORMAT).sort()).toEqual(CHANNELS.map((c) => c.id).sort());
  });

  it("shows the stored statuses by the names the team uses", () => {
    expect(["idea", "draft", "scheduled", "published"].map((s) => statusOf(s).label)).toEqual(["Idea", "Drafting", "Ready", "Posted"]);
    expect(statusOf("bogus").id).toBe("idea");
  });
});
