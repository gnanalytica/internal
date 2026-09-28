import { describe, expect, it } from "vitest";

// The phone app keeps its own copy of the prospects rules (it is a separate
// project and cannot import the web's modules). These tests fail the moment
// the two copies disagree, instead of letting the app write a column the sheet
// refuses or show a queue the web would not.
import * as mobile from "../../../mobile/src/features/prospects/model";
import * as mobilePlaybook from "../../../mobile/src/features/prospects/playbook";
import * as webPlaybook from "@/components/prospects-dashboard/playbook-content";
import type { ActivityEntry, ProspectRecord } from "./parse";
import { isDoNotContact, parseNoteLines } from "./parse";
import * as schema from "./schema";
import * as stats from "./stats";
import type { MyWorkItem } from "./views";

const TODAY = "2026-09-28";

function row(p: Partial<stats.ProspectRow> & { id: string }): stats.ProspectRow {
  return {
    kind: "valuer", name: p.id, city: "", state: "Telangana", stage: 0, band: "", score: null, assigned: "", nextStep: "", nextStepDate: null,
    lastContacted: null, lenders: 0, cases: null, software: "", hasPhone: false, hasEmail: true, researchStatus: "", pitchAngle: "", objections: "", facts: 1, doNotContact: false,
    ...p,
  };
}

const ROWS: stats.ProspectRow[] = [
  row({ id: "a", band: "A", assigned: "Sandeep", nextStepDate: "2026-09-20", stage: 1 }),
  row({ id: "b", band: "A", stage: 0 }),
  row({ id: "c", band: "B", assigned: "Priya", nextStepDate: TODAY, researchStatus: "Scored — needs review", facts: 6 }),
  row({ id: "d", band: "A", doNotContact: true }),
  row({ id: "e", stage: 5, nextStepDate: "2026-09-01" }),
  row({ id: "f", nextStepDate: "2026-10-03", assigned: "sandeep kumar", facts: 7 }),
];

describe("the mobile copy of the prospects rules", () => {
  it("has the same vocabularies as the sheet schema", () => {
    expect(mobile.PROSPECT_KINDS).toEqual(schema.PROSPECT_KINDS);
    expect(mobile.KIND_LABEL).toEqual(schema.KIND_LABEL);
    expect([...mobile.UNSCORED_KINDS]).toEqual([...schema.UNSCORED_KINDS]);
    expect(mobile.STAGES).toEqual(schema.STAGES);
    expect(mobile.PITCH_ANGLES).toEqual(schema.PITCH_ANGLES);
    expect(mobile.OBJECTIONS).toEqual(schema.OBJECTIONS);
    expect(mobile.CHANNELS).toEqual(schema.CHANNELS);
    expect(mobile.DIRECTIONS).toEqual(schema.DIRECTIONS);
    expect(mobile.OUTCOMES).toEqual(schema.OUTCOMES);
    expect(mobile.DISQUALIFY_REASONS).toEqual(schema.DISQUALIFY_REASONS);
    expect(mobile.SCORE_COLUMNS).toEqual(schema.SCORE_COLUMNS);
    expect(mobile.FACT_COUNT).toBe(stats.FACT_COUNT);
  });

  it("offers exactly the writable columns the server accepts", () => {
    for (const k of schema.PROSPECT_KINDS) expect([...mobile.WRITABLE[k]].sort()).toEqual([...schema.WRITABLE[k]].sort());
  });

  it("builds the same saved views, due buckets and name matching", () => {
    expect(mobile.SAVED_VIEWS.map((v) => [v.id, v.label, v.chips])).toEqual(stats.SAVED_VIEWS.map((v) => [v.id, v.label, v.chips]));
    for (const person of ["Sandeep", "Sandeep Kumar", "Priya"]) {
      const ctx = { person, today: TODAY };
      for (const v of stats.SAVED_VIEWS) {
        const m = mobile.SAVED_VIEWS.find((x) => x.id === v.id)!;
        expect(ROWS.filter((r) => m.test(r, ctx)).map((r) => r.id)).toEqual(ROWS.filter((r) => v.test(r, ctx)).map((r) => r.id));
      }
    }
    for (const r of ROWS) expect(mobile.dueBucket(r.nextStepDate, TODAY)).toBe(stats.dueBucket(r.nextStepDate, TODAY));
    expect(mobile.isAssignedTo("sandeep", "Sandeep Kumar")).toBe(stats.isAssignedTo("sandeep", "Sandeep Kumar"));
    expect(mobile.addDays(TODAY, 3)).toBe(stats.addDays(TODAY, 3));
    expect(mobile.todayIST(Date.parse("2026-09-27T19:00:00Z"))).toBe(stats.todayIST(Date.parse("2026-09-27T19:00:00Z")));
  });

  it("reads research notes and the do-not-contact flag the same way", () => {
    const notes = "DO NOT CONTACT — asked\nPractice: 4 banks\n- a bullet\nhttps://x.in\nplain line";
    expect(mobile.parseNoteLines(notes)).toEqual(parseNoteLines(notes));
    expect(mobile.isDoNotContact(notes)).toBe(isDoNotContact(notes));
    expect(mobile.isDoNotContact("Practice: fine")).toBe(false);
  });

  it("carries the same playbook and stage coaching", () => {
    expect(mobilePlaybook.ANCHOR_QUESTION).toBe(webPlaybook.ANCHOR_QUESTION);
    expect(mobilePlaybook.PLAYBOOK).toEqual(webPlaybook.PLAYBOOK);
    expect(mobilePlaybook.STAGE_COACHING).toEqual(webPlaybook.STAGE_COACHING);
  });

  it("types the API bodies as the server builds them", () => {
    // Compile-time checks: a server shape the app's type cannot hold fails tsc.
    const accept = <T>(v: T) => v;
    accept<mobile.ProspectRow>(ROWS[0]);
    accept<mobile.ProspectRecord>({} as ProspectRecord);
    accept<mobile.ActivityEntry>({} as ActivityEntry);
    accept<mobile.Overview>({} as stats.Overview);
    accept<mobile.MyWorkItem>({} as MyWorkItem);
    expect(true).toBe(true);
  });
});

describe("mobile-only helpers", () => {
  it("links a call, a WhatsApp with the draft, and an email split into subject and body", () => {
    expect(mobile.telHref("+91 98480-12345")).toBe("tel:+919848012345");
    expect(mobile.telHref("12345")).toBeNull();
    expect(mobile.whatsappHref("098480 12345", "Hi & hello")).toBe("https://wa.me/919848012345?text=Hi%20%26%20hello");
    expect(mobile.whatsappHref("9848012345", "")).toBe("https://wa.me/919848012345");
    expect(mobile.mailtoHref("a@x.in", "Subject: Quick one\n\nHello there")).toBe("mailto:a@x.in?subject=Quick%20one&body=Hello%20there");
    expect(mobile.mailtoHref("", "x")).toBeNull();
  });

  it("filters the list by owner, band, status and search", () => {
    const f = (p: Partial<mobile.Filters>) => mobile.applyFilters(ROWS, { ...mobile.NO_FILTERS, ...p }, "Sandeep Kumar").map((r) => r.id);
    expect(f({ owner: "me" })).toEqual(["a", "f"]);
    expect(f({ owner: "none" })).toEqual(["b", "d", "e"]);
    expect(f({ owner: "Priya" })).toEqual(["c"]);
    expect(f({ band: "A", stage: 0 })).toEqual(["b", "d"]);
    expect(f({ q: "  F " })).toEqual(["f"]);
  });

  it("logs a one-tap outcome the way the web's My work does", () => {
    const [sent, noAnswer, demo, notInterested] = mobile.QUICK;
    expect(mobile.quickTouch(sent, { name: "A", stage: 0 }, TODAY)).toEqual({ name: "A", channel: "WhatsApp", direction: "Outbound", outcome: "Sent", durationMin: null, summary: "", statusAfter: "Contacted", nextStep: "Follow up if no reply", nextStepDate: "2026-10-01" });
    expect(mobile.quickTouch(noAnswer, { name: "A", stage: 2 }, TODAY)).toMatchObject({ statusAfter: "Discovery done", nextStepDate: "2026-09-29" });
    expect(mobile.quickTouch(demo, { name: "A", stage: 0 }, TODAY)).toMatchObject({ statusAfter: "Discovery done", nextStep: "Run the demo" });
    expect(mobile.quickTouch(notInterested, { name: "A", stage: 1 }, TODAY)).toMatchObject({ statusAfter: "Lost", nextStep: null, nextStepDate: null });
    expect(mobile.markSentTouch("call", { name: "A", stage: 0, nextStep: "" }, TODAY)).toMatchObject({ channel: "Call", outcome: "Connected", statusAfter: "Contacted", nextStep: "Follow up", nextStepDate: "2026-10-01" });
    expect(mobile.markSentTouch("email", { name: "A", stage: 3, nextStep: "Demo" }, TODAY)).toMatchObject({ channel: "Email", outcome: "Sent", statusAfter: "Demo done", nextStep: "Demo" });
  });

  it("orders the board overdue first, then by score", () => {
    const sorted = [...ROWS].sort(mobile.byUrgency(TODAY)).map((r) => r.id);
    expect(sorted.slice(0, 3)).toEqual(["a", "e", "c"]);
  });
});
