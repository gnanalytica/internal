import { describe, expect, it } from "vitest";

import {
  SLACK_EVENT_GROUPS,
  SLACK_EVENT_TYPES,
  SLACK_RULE_PRESETS,
  channelsFor,
  isNewsworthyChange,
  isSlackEventType,
  recordTypeOf,
  ruleMatches,
  slackEventLabel,
  slackEventsFromWebhook,
  type SlackRule,
} from "./events";

const rule = (over: Partial<SlackRule> = {}): SlackRule => ({
  id: "r1",
  slackChannelId: "C1",
  projectId: null,
  events: ["issue.created"],
  filters: {},
  ...over,
});

describe("event catalogue", () => {
  it("lists every event once, grouped by department", () => {
    expect(new Set(SLACK_EVENT_TYPES).size).toBe(SLACK_EVENT_TYPES.length);
    expect(SLACK_EVENT_GROUPS.map((g) => g.label)).toEqual([
      "Engineering",
      "Sales",
      "Customer Success",
      "Product",
      "Marketing",
    ]);
    expect(SLACK_EVENT_TYPES).toContain("prospect.stage_changed");
  });

  it("knows its own ids and labels", () => {
    expect(isSlackEventType("deal.won")).toBe(true);
    expect(isSlackEventType("deal.lost")).toBe(false);
    expect(slackEventLabel("ticket.created")).toBe("New customer request");
    expect(slackEventLabel("something.else")).toBe("something.else");
  });

  it("maps events to the record type threads are keyed on", () => {
    expect(recordTypeOf("issue.status_changed")).toBe("issue");
    expect(recordTypeOf("prospect.stage_changed")).toBe("prospect");
    expect(recordTypeOf("content.published")).toBe("content");
  });

  it("presets only use known events", () => {
    for (const p of SLACK_RULE_PRESETS) for (const e of p.events) expect(isSlackEventType(e)).toBe(true);
  });
});

describe("ruleMatches", () => {
  it("needs the event ticked", () => {
    expect(ruleMatches(rule(), { type: "issue.created", projectId: "p1" })).toBe(true);
    expect(ruleMatches(rule(), { type: "issue.commented", projectId: "p1" })).toBe(false);
  });

  it("scopes to a project, and a project rule ignores records without one", () => {
    const r = rule({ projectId: "p1" });
    expect(ruleMatches(r, { type: "issue.created", projectId: "p1" })).toBe(true);
    expect(ruleMatches(r, { type: "issue.created", projectId: "p2" })).toBe(false);
    expect(ruleMatches(r, { type: "issue.created", projectId: null })).toBe(false);
    expect(ruleMatches(rule(), { type: "issue.created", projectId: null })).toBe(true);
  });

  it("applies the minimum prospect stage, case-insensitively", () => {
    const r = rule({ events: ["prospect.stage_changed"], filters: { minProspectStage: "Demo done" } });
    const at = (prospectStage: string | null) =>
      ruleMatches(r, { type: "prospect.stage_changed", projectId: null, prospectStage });
    expect(at("Contacted")).toBe(false);
    expect(at("Demo done")).toBe(true);
    expect(at("pilot running")).toBe(true);
    expect(at("Won")).toBe(true);
    expect(at("Lost")).toBe(true);
    expect(at(null)).toBe(false);
    expect(at("Something odd")).toBe(false);
  });

  it("ignores the stage filter for other events", () => {
    const r = rule({ events: ["deal.won"], filters: { minProspectStage: "Won" } });
    expect(ruleMatches(r, { type: "deal.won", projectId: null })).toBe(true);
  });
});

describe("channelsFor", () => {
  it("dedupes channels across overlapping rules, in rule order", () => {
    const rules = [
      rule({ id: "a", slackChannelId: "C2", projectId: "p1" }),
      rule({ id: "b", slackChannelId: "C1" }),
      rule({ id: "c", slackChannelId: "C2" }),
      rule({ id: "d", slackChannelId: "C3", events: ["deal.won"] }),
    ];
    expect(channelsFor(rules, { type: "issue.created", projectId: "p1" })).toEqual(["C2", "C1"]);
    expect(channelsFor(rules, { type: "ticket.created", projectId: "p1" })).toEqual([]);
  });
});

describe("slackEventsFromWebhook", () => {
  it("reads task creates and comments", () => {
    expect(slackEventsFromWebhook("issue.created", { id: "i1", title: "x" })).toEqual([
      { type: "issue.created", recordId: "i1" },
    ]);
    expect(slackEventsFromWebhook("issue.commented", { issueId: "i1", body: "hi" })).toEqual([
      { type: "issue.commented", recordId: "i1", body: "hi" },
    ]);
  });

  it("splits an update into a status change and an assignment", () => {
    expect(slackEventsFromWebhook("issue.updated", { id: "i1", status: "done", assigneeId: "u1" })).toEqual([
      { type: "issue.status_changed", recordId: "i1" },
      { type: "issue.assigned", recordId: "i1" },
    ]);
    expect(slackEventsFromWebhook("issue.updated", { id: "i1", assigneeIds: ["u2", "u3"] })).toEqual([
      { type: "issue.assigned", recordId: "i1" },
    ]);
  });

  it("says nothing for edits Slack doesn't care about", () => {
    expect(slackEventsFromWebhook("issue.updated", { id: "i1", title: "renamed" })).toEqual([]);
    expect(slackEventsFromWebhook("issue.updated", { id: "i1", assigneeId: null })).toEqual([]);
    expect(slackEventsFromWebhook("page.created", { id: "p1" })).toEqual([]);
    expect(slackEventsFromWebhook("issue.created", null)).toEqual([]);
  });
});

describe("isNewsworthyChange", () => {
  it("never repeats the value last announced", () => {
    expect(isNewsworthyChange("done", "done", true)).toBe(false);
    expect(isNewsworthyChange("done", "done", false)).toBe(false);
  });

  it("announces a known change, logged or not", () => {
    expect(isNewsworthyChange("done", "todo", false)).toBe(true);
    expect(isNewsworthyChange("done", "todo", true)).toBe(true);
  });

  it("with nothing announced yet, trusts only a logged change", () => {
    // A board drag re-sends the status of every card it touched.
    expect(isNewsworthyChange("todo", null, false)).toBe(false);
    expect(isNewsworthyChange("todo", null, true)).toBe(true);
  });
});
