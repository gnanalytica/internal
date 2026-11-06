import { describe, expect, it } from "vitest";

import {
  ACTION_ASSIGN_ME,
  ACTION_SET_STATUS,
  contentFields,
  dealFields,
  decodeStatusValue,
  encodeStatusValue,
  escapeMrkdwn,
  eventLine,
  issueFields,
  issueIdentifier,
  prospectFields,
  recordCard,
  recordUrl,
  slackLink,
  statusOptions,
  ticketFields,
  type RecordSnapshot,
} from "./cards";

const issue = {
  id: "11111111-1111-1111-1111-111111111111",
  number: 12,
  title: "Fix the login loop",
  status: "in_progress",
  priority: "high",
  projectKey: "VAL",
  projectName: "Valytica",
  assigneeName: "Priya",
};

describe("escaping", () => {
  it("neutralises Slack's control characters and bare mentions", () => {
    expect(escapeMrkdwn("a <b> & c")).toBe("a &lt;b&gt; &amp; c");
    expect(escapeMrkdwn("<!channel>")).toBe("&lt;!channel&gt;");
    expect(escapeMrkdwn("ping @priya")).toBe("ping @⁠priya");
  });

  it("builds links whose label can't break out", () => {
    expect(slackLink("https://x.test/a", "A | <b>")).toBe("<https://x.test/a|A / &lt;b&gt;>");
  });
});

describe("record fields", () => {
  it("formats a task like Linear: project, status, assignee, priority", () => {
    expect(issueIdentifier(issue)).toBe("VAL-12");
    expect(issueIdentifier({ projectKey: null, number: 3 })).toBe("#3");
    expect(issueFields(issue)).toEqual([
      { label: "Project", value: "Valytica" },
      { label: "Status", value: "In Progress" },
      { label: "Assignee", value: "Priya" },
      { label: "Priority", value: "High" },
    ]);
    expect(issueFields({ ...issue, priority: "none", assigneeName: null, projectName: null })).toEqual([
      { label: "Status", value: "In Progress" },
      { label: "Assignee", value: "Unassigned" },
    ]);
  });

  it("shows deal value in the entity's currency (₹ for India)", () => {
    const fields = dealFields({ name: "Acme", stage: "won", value: 250000, entity: "India", projectName: "Valytica", ownerName: "Sandeep" });
    expect(fields).toContainEqual({ label: "Stage", value: "Won" });
    expect(fields).toContainEqual({ label: "Value", value: "₹2,50,000" });
    expect(dealFields({ name: "x", stage: "lead", value: 0, entity: "India", projectName: null, ownerName: null })).toEqual([
      { label: "Stage", value: "Lead" },
    ]);
  });

  it("shows a prospect's move and kind", () => {
    expect(
      prospectFields({ ref: "valuer:IBBI/RV/1", from: "Contacted", to: "Demo done", projectName: "Valytica", dealValue: 50000 }),
    ).toEqual([
      { label: "Project", value: "Valytica" },
      { label: "Stage", value: "Contacted → *Demo done*" },
      { label: "Type", value: "Registered valuer" },
      { label: "Deal value", value: "₹50,000" },
    ]);
  });

  it("shows a request's customer and channel", () => {
    expect(
      ticketFields({ subject: "s", status: "open", priority: "normal", via: "whatsapp", customer: "Rao & Co", projectName: null, assigneeName: null }),
    ).toEqual([
      { label: "Customer", value: "Rao &amp; Co" },
      { label: "Via", value: "WhatsApp" },
      { label: "Owner", value: "Unassigned" },
    ]);
  });

  it("only links content URLs that are http(s)", () => {
    const base = { title: "t", channel: "linkedin", projectName: null, ownerName: null };
    expect(contentFields({ ...base, url: "https://example.com/post" })).toContainEqual({
      label: "Link",
      value: "<https://example.com/post|https://example.com/post>",
    });
    expect(contentFields({ ...base, url: "javascript:alert(1)" }).some((f) => f.label === "Link")).toBe(false);
  });
});

describe("eventLine", () => {
  const snap = { fields: issueFields(issue), status: issue.status };

  it("says who did what", () => {
    expect(eventLine({ type: "issue.created" }, snap, "Sandeep")).toBe("*Sandeep* created a task");
    expect(eventLine({ type: "issue.created" }, snap, null)).toBe("Someone created a task");
    expect(eventLine({ type: "issue.assigned" }, snap, "Sandeep")).toBe("*Sandeep* assigned this to *Priya*");
  });

  it("names both ends of a status change when it knows them", () => {
    expect(eventLine({ type: "issue.status_changed" }, snap, "Sandeep", { from: "todo", to: "in_progress" })).toBe(
      "*Sandeep* moved this from Todo to *In Progress*",
    );
    expect(eventLine({ type: "issue.status_changed" }, snap, "Sandeep")).toBe("*Sandeep* moved this to *In Progress*");
  });

  it("quotes comments, flattened, escaped and clipped", () => {
    const line = eventLine({ type: "issue.commented", body: "Looks <good>\n\nship it" }, snap, "Priya");
    expect(line).toBe("*Priya* commented: Looks &lt;good&gt; ship it");
    const long = eventLine({ type: "issue.commented", body: "x".repeat(500) }, snap, "Priya");
    expect(long.length).toBeLessThan(320);
  });

  it("describes prospect moves and wins", () => {
    expect(
      eventLine({ type: "prospect.stage_changed", prospect: { name: "n", from: "Contacted", to: "Demo done" } }, { fields: [] }, "Sandeep"),
    ).toBe("*Sandeep* moved this prospect from Contacted to *Demo done*");
    expect(eventLine({ type: "deal.won" }, { fields: [{ label: "Value", value: "₹1,000" }] }, "Sandeep")).toBe(
      ":tada: *Sandeep* won this deal — *₹1,000*",
    );
  });
});

describe("status select", () => {
  it("offers every status, each carrying its issue", () => {
    const opts = statusOptions("abc");
    expect(opts.map((o) => o.label)).toEqual(["Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled"]);
    expect(opts[4].value).toBe("abc:done");
  });

  it("round-trips, and rejects what isn't ours", () => {
    expect(decodeStatusValue(encodeStatusValue(issue.id, "in_review"))).toEqual({ issueId: issue.id, status: "in_review" });
    expect(decodeStatusValue("abc:shipped")).toBeNull();
    expect(decodeStatusValue(":done")).toBeNull();
    expect(decodeStatusValue(undefined)).toBeNull();
  });
});

describe("recordCard", () => {
  const snap: RecordSnapshot = {
    type: "issue",
    id: issue.id,
    workspaceId: "w",
    projectId: "p",
    title: "VAL-12 · Fix the login loop",
    path: `/issues/${issue.id}`,
    fields: issueFields(issue),
    status: "in_progress",
  };

  it("links the title and gives tasks their actions", () => {
    expect(recordUrl("https://internal.test/", snap)).toBe(`https://internal.test/issues/${issue.id}`);
    const card = recordCard(snap, "*Sandeep* created a task", "https://internal.test");
    const json = JSON.stringify(card);
    expect(json).toContain(`<https://internal.test/issues/${issue.id}|VAL-12 · Fix the login loop>`);
    expect(json).toContain(ACTION_ASSIGN_ME);
    expect(json).toContain(ACTION_SET_STATUS);
    expect(json).toContain(`${issue.id}:in_progress`);
  });

  it("gives other records just Open", () => {
    const json = JSON.stringify(recordCard({ ...snap, type: "deal", status: undefined }, "won", "https://internal.test"));
    expect(json).not.toContain(ACTION_ASSIGN_ME);
    expect(json).toContain("Open");
  });
});
