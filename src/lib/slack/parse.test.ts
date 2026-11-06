import { describe, expect, it } from "vitest";

import { formatIssueKey, mentionedSlackUsers, parseCommand, parseIssueKey, rankByName, slackToMarkdown, titleFromText } from "./parse";

describe("parseIssueKey", () => {
  it("reads a project key and number, case-insensitively", () => {
    expect(parseIssueKey("VAL-123")).toEqual({ projectKey: "VAL", number: 123 });
    expect(parseIssueKey(" val-7 ")).toEqual({ projectKey: "VAL", number: 7 });
    expect(parseIssueKey("ENG2-4")).toEqual({ projectKey: "ENG2", number: 4 });
  });

  it("rejects anything else", () => {
    for (const s of ["VAL", "VAL-", "-12", "VAL-0", "12-VAL", "VAL 12", "VAL-12x", "2VAL-1"]) expect(parseIssueKey(s)).toBeNull();
  });

  it("round-trips", () => {
    expect(formatIssueKey(parseIssueKey("val-9")!)).toBe("VAL-9");
  });
});

describe("parseCommand", () => {
  it("defaults to help", () => {
    expect(parseCommand("")).toEqual({ kind: "help" });
    expect(parseCommand("   ")).toEqual({ kind: "help" });
    expect(parseCommand("help")).toEqual({ kind: "help" });
    expect(parseCommand("HELP")).toEqual({ kind: "help" });
  });

  it("reads new with an optional title", () => {
    expect(parseCommand("new")).toEqual({ kind: "new", title: "" });
    expect(parseCommand("new  Fix   the login loop ")).toEqual({ kind: "new", title: "Fix the login loop" });
  });

  it("reads search, and treats unknown words as a search", () => {
    expect(parseCommand("search login")).toEqual({ kind: "search", query: "login" });
    expect(parseCommand("login loop")).toEqual({ kind: "search", query: "login loop" });
    expect(parseCommand("search")).toEqual({ kind: "help" });
  });

  it("reads mine, a task key and prospect", () => {
    expect(parseCommand("mine")).toEqual({ kind: "mine" });
    expect(parseCommand("VAL-12")).toEqual({ kind: "issue", key: { projectKey: "VAL", number: 12 } });
    expect(parseCommand("prospect Sharma & Co")).toEqual({ kind: "prospect", query: "Sharma & Co" });
    expect(parseCommand("prospect")).toEqual({ kind: "help" });
  });

  it("searches for a key followed by more words", () => {
    expect(parseCommand("VAL-12 login")).toEqual({ kind: "search", query: "VAL-12 login" });
  });
});

describe("slackToMarkdown", () => {
  it("turns Slack's link and mention markup into Markdown", () => {
    const names = new Map([["U1", "Priya"]]);
    expect(slackToMarkdown("ping <@U1> and <@U2> in <#C1|eng>", names)).toBe("ping @Priya and @someone in #eng");
    expect(slackToMarkdown("see <https://x.com|the doc> or <https://y.com>")).toBe("see [the doc](https://x.com) or https://y.com");
    expect(slackToMarkdown("<!here> heads up")).toBe("@here heads up");
    expect(slackToMarkdown("a &lt;b&gt; &amp; c")).toBe("a <b> & c");
  });

  it("lists the mentioned users once", () => {
    expect(mentionedSlackUsers("<@U1> <@U2|bob> <@U1>")).toEqual(["U1", "U2"]);
  });
});

describe("titleFromText", () => {
  it("takes the first non-empty line, without markup", () => {
    expect(titleFromText("\n\n> *Login* breaks on [Safari](https://x)\nmore")).toBe("Login breaks on Safari");
  });

  it("clips long lines", () => {
    const t = titleFromText("x".repeat(300), 50);
    expect(t.length).toBe(50);
    expect(t.endsWith("…")).toBe(true);
  });
});

describe("rankByName", () => {
  const rows = [
    { id: "1", name: "Ravi Valuers" },
    { id: "2", name: "Sharma & Co" },
    { id: "3", name: "Anand Sharma" },
    { id: "IBBI/RV/1", name: "Sharma" },
  ];

  it("puts exact names first, then prefixes, then word starts", () => {
    expect(rankByName(rows, "sharma").map((r) => r.id)).toEqual(["IBBI/RV/1", "2", "3"]);
  });

  it("matches an id exactly and ignores empty queries", () => {
    expect(rankByName(rows, "ibbi/rv/1").map((r) => r.id)).toEqual(["IBBI/RV/1"]);
    expect(rankByName(rows, "  ")).toEqual([]);
  });
});
