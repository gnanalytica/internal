import { describe, expect, it } from "vitest";

import * as web from "@/lib/marketing";
// The phone app keeps its own copy of the Marketing rules (it is a separate
// project and cannot import the web's modules). These tests fail the moment
// the two copies disagree, instead of letting the phone call a piece Ready the
// web calls Drafting, or put it on a different India day.
import * as mobile from "../../mobile/src/features/business/marketing/model";

const TODAY = "2026-11-10";

describe("marketing: phone and web agree", () => {
  it("has the same statuses, formats and channels", () => {
    expect(mobile.PIECE_STATUSES).toEqual(web.PIECE_STATUSES);
    expect(mobile.CONTENT_FORMATS).toEqual(web.CONTENT_FORMATS);
    for (const f of web.CONTENT_FORMATS) {
      const { label, plural, asks } = web.FORMATS[f];
      expect(mobile.FORMATS[f]).toEqual({ label, plural, asks });
    }
    expect(mobile.CHANNELS).toEqual(web.CHANNELS.map(({ id, label, note, tone }) => ({ id, label, note, tone })));
    expect(mobile.CHANNEL_FORMAT).toEqual(web.CHANNEL_FORMAT);
  });

  it("has a colour for every tone the web uses", () => {
    const tones = new Set<string>([...web.PIECE_STATUSES.map((s) => s.tone), ...web.CHANNELS.map((c) => c.tone), "orange"]);
    for (const t of tones) expect(mobile.TONE_HEX[t as mobile.Tone], t).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("reads formats and labels the same way", () => {
    const samples = [
      { format: "reel", channel: "instagram" },
      { format: null, channel: "blog" },
      { format: "bogus", channel: "whatsapp" },
      { format: null, channel: null },
      { format: null, channel: "tiktok" },
    ];
    for (const s of samples) {
      expect(mobile.formatOf(s)).toBe(web.formatOf(s));
      expect(mobile.asFormat(s.format)).toBe(web.asFormat(s.format));
    }
    for (const id of ["idea", "draft", "scheduled", "published", "nonsense", null]) expect(mobile.statusOf(id)).toEqual(web.statusOf(id));
  });

  it("puts pieces on the same India day and week", () => {
    const stamps = ["2026-11-09T18:29:00Z", "2026-11-09T18:31:00Z", "2026-11-15T20:00:00Z", "2026-12-31T19:00:00Z", null, "not a date"];
    for (const s of stamps) {
      expect(mobile.dayOf(s)).toBe(web.dayOf(s));
      expect(mobile.timeOf(s)).toBe(web.timeOf(s));
    }
    for (const d of ["2026-11-10", "2026-11-15", "2026-11-16", "2026-11-30", "2027-01-01"]) {
      expect(mobile.weekStart(d)).toBe(web.weekStart(d));
      expect(mobile.weekDays(d)).toEqual(web.weekDays(d));
      expect(mobile.dayLabel(d)).toBe(web.dayLabel(d));
      expect(mobile.weekLabel(mobile.weekStart(d))).toBe(web.weekLabel(web.weekStart(d)));
      expect(mobile.atDay(d, "2026-11-01T04:00:00Z")).toBe(web.atDay(d, "2026-11-01T04:00:00Z"));
      expect(mobile.atDay(d)).toBe(web.atDay(d));
    }
    for (const v of ["2026-11-10", "2026-11-10T09:30", "", null]) expect(mobile.fromIstInput(v)).toBe(web.fromIstInput(v));
    expect(mobile.todayIST(Date.parse("2026-11-10T19:00:00Z"))).toBe(web.todayIST(Date.parse("2026-11-10T19:00:00Z")));
  });

  it("counts pace, overdue and posting the same way", () => {
    const items = [
      { id: "a", channel: "linkedin", status: "published", publishDate: "2026-11-10T04:30:00Z" },
      { id: "b", channel: "linkedin", status: "scheduled", publishDate: "2026-11-12T04:30:00Z" },
      { id: "c", channel: null, status: "draft", publishDate: "2026-11-03T04:30:00Z" },
      { id: "d", channel: "blog", status: "idea", publishDate: null },
      { id: "e", channel: "email", status: "draft", publishDate: "2026-09-01T04:30:00Z" },
      { id: "f", channel: "instagram", status: "published", publishDate: "2026-10-20T04:30:00Z" },
    ];
    const start = web.weekStart(TODAY);
    expect(mobile.weekPace(items, start)).toEqual(web.weekPace(items, start));
    expect(mobile.overdue(items, TODAY).map((p) => p.id)).toEqual(web.overdue(items, TODAY).map((p) => p.id));
    for (const p of items) {
      expect(mobile.isOverdue(p, TODAY)).toBe(web.isOverdue(p, TODAY));
      expect(mobile.rowOf(p)).toBe(web.rowOf(p));
      if (p.publishDate) expect(mobile.lateLabel(p.publishDate, TODAY)).toBe(web.lateLabel(p.publishDate, TODAY));
    }
    expect([...mobile.weeklyPosted(items, start)]).toEqual([...web.weeklyPosted(items, start)]);
  });
});
