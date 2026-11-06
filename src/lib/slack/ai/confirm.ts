import { Actions, Button, Card, CardText, type CardElement } from "chat";

import { escapeMrkdwn } from "../cards";
import type { TouchInput } from "@/lib/prospects/touch";

/**
 * Writes that change an existing record — a task's status or owner, a logged
 * touch on a prospect — don't happen when the model asks for them. The bot
 * posts what it is about to do with Confirm / Cancel, keeps the planned
 * change in the Chat SDK's state, and runs it only when the person who asked
 * clicks Confirm. Pure: the handler stores, loads and executes; this decides.
 */

export const ACTION_AI_CONFIRM = "internal_ai_confirm_ok";
export const ACTION_AI_CANCEL = "internal_ai_confirm_cancel";

/** Long enough to read and click; short enough that a stale plan doesn't run on a changed record. */
export const CONFIRM_TTL_MS = 30 * 60_000;

export const pendingKey = (nonce: string) => `ai:confirm:${nonce}`;
/** Claimed once per nonce, so a double click (or Slack's retry) can't run a change twice. */
export const claimKey = (nonce: string) => `ai:confirm-claimed:${nonce}`;

/** A task change, resolved to ids when it was planned. */
export type TaskChangePlan = {
  issueId: string;
  /** "VAL-12 · Fix the login loop". */
  label: string;
  patch: {
    status?: string;
    assigneeId?: string | null;
    priority?: string;
    title?: string;
    /** yyyy-mm-dd, or null to clear. */
    dueDate?: string | null;
  };
  /** The values the patch replaces, for the activity log. */
  before: { status: string; assigneeId: string | null };
};

export type TouchPlan = {
  /** The service's input, already checked against its schema. */
  touch: TouchInput;
  /** The record's status before, for the card. */
  stageBefore: string;
};

export type PendingAction = {
  workspaceId: string;
  /** Only this Slack user may confirm. */
  slackUserId: string;
  /** The member they were linked to when they asked; re-checked on confirm. */
  appUserId: string;
  threadId: string;
  /** What the confirmation card says, in mrkdwn. */
  summary: string;
  createdAt: number;
} & ({ kind: "update_task"; plan: TaskChangePlan } | { kind: "log_touch"; plan: TouchPlan });

export type ConfirmDecision = { ok: true } | { ok: false; reason: "expired" | "not_yours" };

export function confirmDecision(pending: PendingAction | null, clickerSlackId: string, now = Date.now()): ConfirmDecision {
  if (!pending || now - pending.createdAt > CONFIRM_TTL_MS) return { ok: false, reason: "expired" };
  if (pending.slackUserId !== clickerSlackId) return { ok: false, reason: "not_yours" };
  return { ok: true };
}

export function decisionText(d: Exclude<ConfirmDecision, { ok: true }>): string {
  return d.reason === "expired"
    ? "That request has expired or was already handled. Ask me again if you still want it."
    : "Only the person who asked can confirm this.";
}

/** The Confirm / Cancel card. Both buttons carry the nonce of the stored plan. */
export function confirmCard(summary: string, nonce: string): CardElement {
  return Card({
    children: [
      CardText(summary),
      Actions([
        Button({ id: ACTION_AI_CONFIRM, label: "Confirm", style: "primary", value: nonce }),
        Button({ id: ACTION_AI_CANCEL, label: "Cancel", value: nonce }),
      ]),
    ],
  });
}

export type Change = { field: string; from: string; to: string };

/** "*Change VAL-12 · Fix the login loop*" and one line per field: from → to. */
export function changeSummary(label: string, changes: Change[]): string {
  const lines = changes.map((c) => `• ${c.field}: ${escapeMrkdwn(c.from)} → *${escapeMrkdwn(c.to)}*`);
  return [`*Change ${escapeMrkdwn(label)}?*`, ...lines].join("\n");
}

export function touchSummary(t: {
  name: string;
  channel: string;
  direction: string;
  outcome: string;
  summary: string;
  stageBefore: string;
  stageAfter: string;
  nextStep: string | null;
  nextStepDate: string | null;
}): string {
  const lines = [
    `*Log a touch on ${escapeMrkdwn(t.name)}?*`,
    `• ${t.direction} ${t.channel.toLowerCase()}: *${escapeMrkdwn(t.outcome)}*`,
  ];
  if (t.summary) lines.push(`• What they said: ${escapeMrkdwn(t.summary)}`);
  if (t.stageAfter !== t.stageBefore) lines.push(`• Stage: ${escapeMrkdwn(t.stageBefore)} → *${escapeMrkdwn(t.stageAfter)}*`);
  if (t.nextStep || t.nextStepDate)
    lines.push(`• Follow-up: ${escapeMrkdwn(t.nextStep ?? "—")}${t.nextStepDate ? ` (${t.nextStepDate})` : ""}`);
  return lines.join("\n");
}

/** What the model is told after it plans a confirmable change. */
export const AWAITING_CONFIRMATION =
  "Not done yet: Confirm / Cancel buttons will appear under your reply, and the change runs only if the person who asked confirms. " +
  "Tell them briefly what you've asked them to confirm. Don't say it has been done.";
