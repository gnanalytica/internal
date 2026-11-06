import { describe, expect, it } from "vitest";

import {
  ACTION_AI_CANCEL,
  ACTION_AI_CONFIRM,
  changeSummary,
  confirmCard,
  confirmDecision,
  CONFIRM_TTL_MS,
  decisionText,
  touchSummary,
  type PendingAction,
} from "./confirm";

const pending: PendingAction = {
  kind: "update_task",
  workspaceId: "w1",
  slackUserId: "U111",
  appUserId: "u1",
  threadId: "slack:C1:1.2",
  summary: "*Change VAL-1 · Fix it?*",
  createdAt: 1_000_000,
  plan: { issueId: "i1", label: "VAL-1 · Fix it", patch: { status: "done" }, before: { status: "todo", assigneeId: null } },
};

describe("confirmDecision", () => {
  it("lets the person who asked confirm while the plan is fresh", () => {
    expect(confirmDecision(pending, "U111", pending.createdAt + 60_000)).toEqual({ ok: true });
  });

  it("refuses anyone else", () => {
    expect(confirmDecision(pending, "U222", pending.createdAt)).toEqual({ ok: false, reason: "not_yours" });
  });

  it("treats a missing or stale plan as expired", () => {
    expect(confirmDecision(null, "U111")).toEqual({ ok: false, reason: "expired" });
    expect(confirmDecision(pending, "U111", pending.createdAt + CONFIRM_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("explains each refusal", () => {
    expect(decisionText({ ok: false, reason: "not_yours" })).toMatch(/person who asked/);
    expect(decisionText({ ok: false, reason: "expired" })).toMatch(/expired/);
  });
});

describe("confirmCard", () => {
  it("carries the nonce on both buttons, under the summary", () => {
    const card = confirmCard("*Change it?*", "n-1");
    const json = JSON.stringify(card);
    expect(json).toContain("*Change it?*");
    expect(json).toContain(ACTION_AI_CONFIRM);
    expect(json).toContain(ACTION_AI_CANCEL);
    expect(json.match(/"n-1"/g)).toHaveLength(2);
  });

  it("uses the internal_ai_confirm_ prefix for its action ids", () => {
    expect(ACTION_AI_CONFIRM.startsWith("internal_ai_confirm_")).toBe(true);
    expect(ACTION_AI_CANCEL.startsWith("internal_ai_confirm_")).toBe(true);
  });
});

describe("summaries", () => {
  it("shows each change as from → to, escaped", () => {
    const s = changeSummary("VAL-1 · <Fix> it", [
      { field: "Status", from: "Todo", to: "Done" },
      { field: "Assignee", from: "Unassigned", to: "Priya @ home" },
    ]);
    expect(s).toContain("*Change VAL-1 · &lt;Fix&gt; it?*");
    expect(s).toContain("• Status: Todo → *Done*");
    expect(s).not.toContain("Priya @ home");
  });

  it("describes a touch, with the stage only when it moves", () => {
    const base = {
      name: "R. Kumar",
      channel: "Call",
      direction: "Outbound",
      outcome: "Connected",
      summary: "Wants pricing",
      stageBefore: "Contacted",
      stageAfter: "Contacted",
      nextStep: "Send pricing",
      nextStepDate: "2026-11-10",
    };
    const same = touchSummary(base);
    expect(same).toContain("Outbound call: *Connected*");
    expect(same).toContain("What they said: Wants pricing");
    expect(same).toContain("Follow-up: Send pricing (2026-11-10)");
    expect(same).not.toContain("Stage:");
    expect(touchSummary({ ...base, stageAfter: "Demo done" })).toContain("Stage: Contacted → *Demo done*");
  });
});
