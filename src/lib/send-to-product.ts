import { isCustomerStage } from "@/lib/customer-success";
import { prospectRef } from "@/lib/prospects/deal-plan";
import type { ActivityEntry } from "@/lib/prospects/parse";
import { STAGES, type ProspectKind } from "@/lib/prospects/schema";

/**
 * "Send to Product": what a prospect or customer said, from a touch or a
 * request, becomes a piece of feedback on the project's Product › Feedback tab
 * without being typed again. Each one carries a source ref naming where it came
 * from, unique per workspace, so the same remark can't be sent twice. Pure —
 * the write is in send-to-product-actions.ts.
 */

/** The sources a remark can be sent as: a prospect talking, a customer talking, a customer's request. */
export const SEND_SOURCES = ["sales", "customer", "support"] as const;
export type SendSource = (typeof SEND_SOURCES)[number];

/** A touch is a customer talking once the prospect is at Pilot running or Won; before that, a prospect. */
export const touchSource = (stage: number): SendSource => (isCustomerStage(stage) ? "customer" : "sales");

/** Who said it, as the Feedback tab shows it: "Mr. Sachin Goel · Pilot running". */
export const touchContact = (name: string, stage: number): string => [name.trim(), STAGES[stage]].filter(Boolean).join(" · ");

/** Whether a touch has anything to send: only what they said goes to Product. */
export const canSendTouch = (a: Pick<ActivityEntry, "summary">): boolean => a.summary.trim().length > 0;

/** A short, stable hash, for touches logged before Activity rows had ids. */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * One touch, as a key that stays put however the Activity tab is sorted: its
 * permanent activity_id, or, for a row without one, when it was logged plus a
 * hash of what was said.
 */
export function touchKey(a: Pick<ActivityEntry, "id" | "date" | "loggedAt" | "summary">): string {
  if (a.id.trim()) return a.id.trim();
  return `${a.date ?? a.loggedAt.trim()}~${shortHash(a.summary.trim())}`;
}

export const touchSourceRef = (kind: ProspectKind, id: string, a: Pick<ActivityEntry, "id" | "date" | "loggedAt" | "summary">): string => `touch:${prospectRef(kind, id)}:${touchKey(a)}`;

export const ticketSourceRef = (ticketId: string): string => `ticket:${ticketId}`;

/** A request's words: what they wrote, or its subject when nothing else was noted. */
export const requestQuote = (t: { subject: string; body: string | null }): string => t.body?.trim() || t.subject.trim();

/** Source ref → the feedback item already sent from it. */
export function sentByRef(items: { id: string; sourceRef: string | null }[]): Record<string, string> {
  const sent: Record<string, string> = {};
  for (const i of items) if (i.sourceRef && !(i.sourceRef in sent)) sent[i.sourceRef] = i.id;
  return sent;
}

/** Where "In Product" links: the project's Feedback tab. */
export const feedbackHref = (projectId: string): string => `/projects/${projectId}/product?tab=feedback`;
