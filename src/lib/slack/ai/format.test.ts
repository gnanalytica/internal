import { describe, expect, it } from "vitest";

import type { ProspectRecord } from "@/lib/prospects/parse";
import { byUrgency, projectStatus, prospectBrief, prospectMatches, taskBrief, threadTaskDescription, type TaskRow } from "./format";

const APP = "https://internal.example";
const TODAY = "2026-11-06";

const row = (over: Partial<TaskRow>): TaskRow => ({
  id: "i1",
  number: 1,
  title: "Task",
  status: "todo",
  priority: "none",
  dueDate: null,
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  projectId: "p1",
  projectKey: "VAL",
  projectName: "Valytica",
  assigneeName: null,
  ...over,
});

describe("taskBrief", () => {
  it("gives the key, a link and readable labels", () => {
    expect(taskBrief(row({ number: 12, status: "in_progress", priority: "high", assigneeName: "Priya" }), APP, TODAY)).toEqual({
      key: "VAL-12",
      title: "Task",
      url: `${APP}/issues/i1`,
      status: "In Progress",
      priority: "High",
      assignee: "Priya",
      project: "Valytica",
      due: null,
    });
  });

  it("flags an open task past its due date, not a done one", () => {
    const due = new Date("2026-11-01T00:00:00Z");
    expect(taskBrief(row({ dueDate: due }), APP, TODAY)).toMatchObject({ due: "2026-11-01", overdue: true });
    expect(taskBrief(row({ dueDate: due, status: "done" }), APP, TODAY)).not.toHaveProperty("overdue");
  });
});

describe("byUrgency", () => {
  it("orders by due date, then priority, then most recently touched", () => {
    const rows = [
      row({ id: "none-low", priority: "low" }),
      row({ id: "later", dueDate: new Date("2026-11-20T00:00:00Z") }),
      row({ id: "soon", dueDate: new Date("2026-11-07T00:00:00Z") }),
      row({ id: "none-urgent", priority: "urgent" }),
    ];
    expect(rows.sort(byUrgency).map((r) => r.id)).toEqual(["soon", "later", "none-urgent", "none-low"]);
  });
});

describe("projectStatus", () => {
  it("counts by state and lists overdue, blocked and recently done", () => {
    const rows = [
      row({ id: "a", status: "backlog" }),
      row({ id: "b", status: "in_progress", dueDate: new Date("2026-11-02T00:00:00Z") }),
      row({ id: "c", status: "in_review" }),
      row({ id: "d", status: "done", updatedAt: new Date("2026-11-04T09:00:00Z") }),
      row({ id: "e", status: "done", updatedAt: new Date("2026-10-01T09:00:00Z") }),
      row({ id: "f", status: "canceled" }),
    ];
    const s = projectStatus(rows, new Set(["c", "d"]), APP, TODAY);
    expect(s.counts).toEqual({ open: 3, backlog: 1, todo: 0, in_progress: 1, in_review: 1, blocked: 1, overdue: 1, done_last_7_days: 1 });
    expect(s.overdue.map((t) => t.url)).toEqual([`${APP}/issues/b`]);
    expect(s.blocked.map((t) => t.url)).toEqual([`${APP}/issues/c`]);
    expect(s.recently_done.map((t) => t.url)).toEqual([`${APP}/issues/d`]);
  });
});

describe("threadTaskDescription", () => {
  it("has the gist, the key points and a link back to the thread", () => {
    const d = threadTaskDescription({
      summary: "Safari users loop on login.",
      keyPoints: ["Only Safari 18", " ", "Started after Tuesday's deploy"],
      permalink: "https://slack.com/archives/C1/p123",
      where: "a thread in #engineering",
      by: "Priya",
    });
    expect(d).toBe(
      "Safari users loop on login.\n\n**Key points**\n- Only Safari 18\n- Started after Tuesday's deploy\n\n" +
        "_From [the Slack thread](https://slack.com/archives/C1/p123) in a thread in #engineering, filed by Priya with the Internal bot._",
    );
  });

  it("still says where it came from without a permalink", () => {
    expect(threadTaskDescription({ summary: "", keyPoints: [], permalink: null, where: "#x", by: "P" })).toContain("From a Slack thread");
  });
});

const prospect = (over: Partial<ProspectRecord>): ProspectRecord =>
  ({
    kind: "valuer",
    id: "IBBI/RV/02/2019/1",
    name: "R. Kumar",
    status: "Contacted",
    stage: 1,
    state: "Telangana",
    city: "Hyderabad",
    keyContact: "",
    firmRegNo: "",
    bank: { institution: "", contactPerson: "" },
    assigned: "Priya",
    nextStep: "Call back",
    nextStepDate: "2026-11-05",
    lastContacted: "2026-11-01",
    band: "A",
    ...over,
  }) as ProspectRecord;

describe("prospects", () => {
  it("brief links to the record and flags a due follow-up", () => {
    expect(prospectBrief(prospect({}), APP, TODAY)).toMatchObject({
      url: `${APP}/prospects?rec=${encodeURIComponent("valuer:IBBI/RV/02/2019/1")}`,
      stage: "Contacted",
      city: "Hyderabad, Telangana",
      follow_up: "overdue",
    });
    expect(prospectBrief(prospect({ nextStepDate: "2026-12-01" }), APP, TODAY)).not.toHaveProperty("follow_up");
  });

  it("matches every word of a search against name, place and id", () => {
    const p = prospect({});
    expect(prospectMatches(p, "kumar hyderabad")).toBe(true);
    expect(prospectMatches(p, "rv/02")).toBe(true);
    expect(prospectMatches(p, "kumar bangalore")).toBe(false);
  });
});
