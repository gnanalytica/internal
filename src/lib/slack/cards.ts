import { Actions, Button, Card, CardText, Field, Fields, LinkButton, Select, type CardChild, type CardElement } from "chat";

import { PRIORITY_MAP, STATUSES, STATUS_MAP, type PriorityId, type StatusId } from "@/lib/constants";
import { formatCurrency, entityCurrency } from "@/lib/currency";
import { DEAL_STAGES } from "@/lib/departments";
import { KIND_LABEL, PROSPECT_KINDS, type ProspectKind } from "@/lib/prospects/schema";
import { viaLabel } from "@/lib/customer-success";
import type { SlackEventInput, SlackRecordType } from "./events";

/**
 * How an app record looks in Slack. Pure: records.ts reads the rows, this turns
 * them into a card, and notify.ts posts it. Every string that came from a
 * person goes through `escapeMrkdwn`, so a title can't ping @channel or forge
 * a link.
 */

/**
 * Slack's three control characters, plus a word joiner after "@" so the
 * adapter's bare-mention linking can't turn "@priya" in a title into a ping.
 */
export function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/@/g, "@⁠");
}

/** `<url|label>`, with the label escaped (and `|` dropped — it would end the label). */
export function slackLink(url: string, label: string): string {
  return `<${url}|${escapeMrkdwn(label).replace(/\|/g, "/")}>`;
}

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export type CardField = { label: string; value: string };

/** Everything a card needs, read fresh when the event is delivered. */
export type RecordSnapshot = {
  type: SlackRecordType;
  id: string;
  workspaceId: string;
  projectId: string | null;
  /** e.g. "VAL-12 · Fix the login loop". */
  title: string;
  /** App path, e.g. "/issues/…". */
  path: string;
  fields: CardField[];
  /** Issues only: the current status, for the status select. */
  status?: string;
};

/* ---------- per-record fields ---------- */

export type IssueRow = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  projectKey: string | null;
  projectName: string | null;
  assigneeName: string | null;
};

export const issueIdentifier = (r: Pick<IssueRow, "projectKey" | "number">): string =>
  r.projectKey ? `${r.projectKey}-${r.number}` : `#${r.number}`;

export function issueFields(r: IssueRow): CardField[] {
  const out: CardField[] = [];
  if (r.projectName) out.push({ label: "Project", value: escapeMrkdwn(r.projectName) });
  out.push({ label: "Status", value: STATUS_MAP[r.status as StatusId]?.label ?? escapeMrkdwn(r.status) });
  out.push({ label: "Assignee", value: r.assigneeName ? escapeMrkdwn(r.assigneeName) : "Unassigned" });
  if (r.priority && r.priority !== "none")
    out.push({ label: "Priority", value: PRIORITY_MAP[r.priority as PriorityId]?.label ?? escapeMrkdwn(r.priority) });
  return out;
}

export type DealRow = {
  name: string;
  stage: string;
  value: number;
  entity: string;
  projectName: string | null;
  ownerName: string | null;
};

export const dealStageLabel = (stage: string): string =>
  DEAL_STAGES.find((s) => s.id === stage)?.label ?? stage;

export function dealFields(r: DealRow): CardField[] {
  const out: CardField[] = [];
  if (r.projectName) out.push({ label: "Project", value: escapeMrkdwn(r.projectName) });
  out.push({ label: "Stage", value: escapeMrkdwn(dealStageLabel(r.stage)) });
  if (r.value > 0) out.push({ label: "Value", value: formatCurrency(r.value, entityCurrency(r.entity)) });
  if (r.ownerName) out.push({ label: "Owner", value: escapeMrkdwn(r.ownerName) });
  return out;
}

export function prospectKindLabel(ref: string): string | null {
  const kind = ref.slice(0, ref.indexOf(":"));
  return (PROSPECT_KINDS as readonly string[]).includes(kind) ? KIND_LABEL[kind as ProspectKind].one : null;
}

export function prospectFields(p: {
  ref: string;
  from: string | null;
  to: string;
  projectName: string | null;
  dealValue: number | null;
}): CardField[] {
  const out: CardField[] = [];
  if (p.projectName) out.push({ label: "Project", value: escapeMrkdwn(p.projectName) });
  out.push({
    label: "Stage",
    value: p.from ? `${escapeMrkdwn(p.from)} → *${escapeMrkdwn(p.to)}*` : `*${escapeMrkdwn(p.to)}*`,
  });
  const kind = prospectKindLabel(p.ref);
  if (kind) out.push({ label: "Type", value: kind });
  // Prospects are sold from the India entity, so their deals are in rupees.
  if (p.dealValue && p.dealValue > 0) out.push({ label: "Deal value", value: formatCurrency(p.dealValue, "INR") });
  return out;
}

export type TicketRow = {
  subject: string;
  status: string;
  priority: string;
  via: string | null;
  customer: string | null;
  projectName: string | null;
  assigneeName: string | null;
};

export function ticketFields(r: TicketRow): CardField[] {
  const out: CardField[] = [];
  if (r.projectName) out.push({ label: "Project", value: escapeMrkdwn(r.projectName) });
  if (r.customer) out.push({ label: "Customer", value: escapeMrkdwn(r.customer) });
  const via = viaLabel(r.via);
  if (via) out.push({ label: "Via", value: via });
  if (r.priority && r.priority !== "normal") out.push({ label: "Priority", value: escapeMrkdwn(cap(r.priority)) });
  out.push({ label: "Owner", value: r.assigneeName ? escapeMrkdwn(r.assigneeName) : "Unassigned" });
  return out;
}

export type FeedbackRow = {
  title: string;
  source: string;
  contact: string | null;
  theme: string | null;
  projectName: string | null;
};

export function feedbackFields(r: FeedbackRow): CardField[] {
  const out: CardField[] = [];
  if (r.projectName) out.push({ label: "Project", value: escapeMrkdwn(r.projectName) });
  out.push({ label: "Source", value: escapeMrkdwn(cap(r.source)) });
  if (r.contact) out.push({ label: "From", value: escapeMrkdwn(r.contact) });
  if (r.theme) out.push({ label: "Theme", value: escapeMrkdwn(r.theme) });
  return out;
}

export type ContentRow = {
  title: string;
  channel: string | null;
  url: string | null;
  projectName: string | null;
  ownerName: string | null;
};

export function contentFields(r: ContentRow): CardField[] {
  const out: CardField[] = [];
  if (r.projectName) out.push({ label: "Project", value: escapeMrkdwn(r.projectName) });
  if (r.channel) out.push({ label: "Channel", value: escapeMrkdwn(cap(r.channel)) });
  if (r.ownerName) out.push({ label: "Owner", value: escapeMrkdwn(r.ownerName) });
  // Only links that are links: a stray "javascript:" in the sheet stays text.
  if (r.url && /^https?:\/\//i.test(r.url)) out.push({ label: "Link", value: slackLink(r.url, clip(r.url, 60)) });
  return out;
}

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ---------- the event line ---------- */

/**
 * One line saying what happened, used as the card's subtitle and as the reply
 * in the record's thread. `actor` is a display name, or null when unknown
 * (an API key, a sheet sync).
 */
export function eventLine(
  ev: Pick<SlackEventInput, "type" | "body" | "prospect">,
  snap: Pick<RecordSnapshot, "fields" | "status">,
  actor: string | null,
  extra: { from?: string | null; to?: string | null } = {},
): string {
  const who = actor ? `*${escapeMrkdwn(actor)}*` : "Someone";
  const field = (label: string) => snap.fields.find((f) => f.label === label)?.value;
  switch (ev.type) {
    case "issue.created":
      return `${who} created a task`;
    case "issue.status_changed": {
      const to = STATUS_MAP[(extra.to ?? snap.status) as StatusId]?.label ?? field("Status") ?? "a new status";
      const from = extra.from ? STATUS_MAP[extra.from as StatusId]?.label : null;
      return from ? `${who} moved this from ${from} to *${to}*` : `${who} moved this to *${to}*`;
    }
    case "issue.assigned": {
      const to = field("Assignee");
      return to && to !== "Unassigned" ? `${who} assigned this to *${to}*` : `${who} unassigned this`;
    }
    case "issue.commented": {
      const body = ev.body ? clip(ev.body.replace(/\s+/g, " ").trim(), 280) : "";
      return body ? `${who} commented: ${escapeMrkdwn(body)}` : `${who} commented`;
    }
    case "deal.won": {
      const value = field("Value");
      return value ? `:tada: ${who} won this deal — *${value}*` : `:tada: ${who} won this deal`;
    }
    case "prospect.stage_changed": {
      const p = ev.prospect;
      if (!p) return `${who} moved this prospect`;
      return p.from
        ? `${who} moved this prospect from ${escapeMrkdwn(p.from)} to *${escapeMrkdwn(p.to)}*`
        : `${who} moved this prospect to *${escapeMrkdwn(p.to)}*`;
    }
    case "ticket.created":
      return `${who} logged a new customer request`;
    case "feedback.created":
      return `${who} added feedback`;
    case "content.published":
      return `${who} posted this`;
  }
}

/* ---------- actions ---------- */

/** Action ids handled in handlers/notifications-actions.ts. */
export const ACTION_ASSIGN_ME = "internal_issue_assign_me";
export const ACTION_SET_STATUS = "internal_issue_status";
export const ACTION_OPEN = "internal_open";
export const ACTION_LINK_CONFIRM = "internal_link_confirm";

/** Status select options, in board order. Each value carries the issue it is for. */
export function statusOptions(issueId: string): { label: string; value: string }[] {
  return STATUSES.map((s) => ({ label: s.label, value: encodeStatusValue(issueId, s.id) }));
}

export function encodeStatusValue(issueId: string, status: string): string {
  return `${issueId}:${status}`;
}

/** The issue and status a select option asks for, or null if it isn't one of ours. */
export function decodeStatusValue(value: string | undefined): { issueId: string; status: StatusId } | null {
  if (!value) return null;
  const i = value.lastIndexOf(":");
  if (i <= 0) return null;
  const issueId = value.slice(0, i);
  const status = value.slice(i + 1);
  if (!STATUSES.some((s) => s.id === status)) return null;
  return { issueId, status: status as StatusId };
}

/* ---------- the card ---------- */

/** The record's full URL in the app. */
export const recordUrl = (appUrl: string, snap: Pick<RecordSnapshot, "path">): string =>
  `${appUrl.replace(/\/+$/, "")}${snap.path}`;

/**
 * The compact card posted as a thread's root: a linked title, what happened,
 * the key fields, and — for tasks — Assign to me, a status select and Open.
 */
export function recordCard(snap: RecordSnapshot, headline: string, appUrl: string): CardElement {
  const url = recordUrl(appUrl, snap);
  const children: CardChild[] = [
    CardText(`*${slackLink(url, clip(snap.title, 200))}*`),
    CardText(headline, { style: "muted" }),
  ];
  if (snap.fields.length) children.push(Fields(snap.fields.map((f) => Field(f))));
  if (snap.type === "issue") {
    children.push(
      Actions([
        Button({ id: ACTION_ASSIGN_ME, label: "Assign to me", value: snap.id }),
        Select({
          id: ACTION_SET_STATUS,
          label: "Status",
          placeholder: "Status",
          options: statusOptions(snap.id),
          initialOption: snap.status ? encodeStatusValue(snap.id, snap.status) : undefined,
        }),
        LinkButton({ id: ACTION_OPEN, url, label: "Open" }),
      ]),
    );
  } else {
    children.push(Actions([LinkButton({ id: ACTION_OPEN, url, label: "Open" })]));
  }
  return Card({ children });
}

/** Plain-text fallback for notifications and clients that can't show blocks. */
export function fallbackText(snap: Pick<RecordSnapshot, "title">, headline: string): string {
  return `${snap.title} — ${headline.replace(/\*/g, "")}`;
}

/** The card plus its notification text, ready for `thread.post` / `channel.post`. */
export function recordMessage(snap: RecordSnapshot, headline: string, appUrl: string) {
  return { card: recordCard(snap, headline, appUrl), fallbackText: fallbackText(snap, headline) };
}
