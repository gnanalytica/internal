import { describe, expect, it } from "vitest";

import { assembleAskContext, NOTHING_FOUND, type AskIssueRow, type AskPageRow } from "./ask-rules";
import { UNRESTRICTED, type ApiScope } from "./scope-rules";

const member: ApiScope = { restricted: true, hiddenProjectIds: new Set(["hr-op"]), ownedProjectIds: new Set() };

const pages: AskPageRow[] = [
  { id: "p1", title: "Auth decisions", contentText: "We use PKCE.", projectId: "eng" },
  { id: "p2", title: "Salaries 2026", contentText: "Confidential pay bands.", projectId: "hr-op" },
  { id: "p3", title: null, contentText: null, projectId: null },
];
const issues: AskIssueRow[] = [
  { id: "i1", title: "Ship login", text: "Details", number: 4, projectKey: "ENG", projectId: "eng" },
  { id: "i2", title: "Review salaries", text: "Pay review", number: 2, projectKey: "HR", projectId: "hr-op" },
  { id: "i3", title: "Loose task", text: "", number: 9, projectKey: null, projectId: null },
];

describe("Ask context", () => {
  it("never lets a member's model read a hidden project's docs or issues", () => {
    const ctx = assembleAskContext(pages, issues, member);
    expect(ctx.sources.map((s) => s.id)).toEqual(["p1", "p3", "i1", "i3"]);
    expect(ctx.blocks.join("\n")).not.toMatch(/salar|pay/i);
  });

  it("gives admins everything, with ids and app paths for each source", () => {
    const ctx = assembleAskContext(pages, issues, UNRESTRICTED);
    expect(ctx.sources).toHaveLength(6);
    expect(ctx.sources[0]).toEqual({ kind: "page", id: "p1", title: "Auth decisions", href: "/pages/p1" });
    expect(ctx.sources.find((s) => s.id === "i1")?.title).toBe("ENG-4 Ship login");
    expect(ctx.sources.find((s) => s.id === "i3")?.title).toBe("#9 Loose task");
    expect(ctx.sources.find((s) => s.id === "p3")?.title).toBe("Untitled");
  });

  it("says so when nothing visible was found", () => {
    const ctx = assembleAskContext([pages[1]], [issues[1]], member);
    expect(ctx).toEqual({ sources: [], blocks: [], note: NOTHING_FOUND });
  });
});
