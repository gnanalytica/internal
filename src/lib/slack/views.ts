import {
  Actions,
  Button,
  Card,
  CardText,
  DateInput,
  Divider,
  Field,
  Fields,
  LinkButton,
  Modal,
  RadioSelect,
  Select,
  SelectOption,
  TextInput,
  type CardChild,
  type CardElement,
  type ModalChild,
  type ModalElement,
} from "chat";

import { PRIORITIES, STATUSES, STATUS_MAP, type StatusId } from "@/lib/constants";
import { displayDate } from "@/lib/prospects/parse";
import { CHANNELS, DIRECTIONS, KIND_LABEL, OUTCOMES, STAGES, type ProspectKind } from "@/lib/prospects/schema";
import {
  ACTION_ASSIGN_ME,
  ACTION_OPEN,
  escapeMrkdwn,
  issueIdentifier,
  recordCard,
  slackLink,
  type IssueRow,
  type RecordSnapshot,
} from "./cards";

/**
 * What `/internal`, its modals and the "Create task" shortcut show. Pure: the
 * handlers (handlers/commands.ts) read the rows and post these. Every string
 * from a person goes through `escapeMrkdwn`/`slackLink` (cards.ts).
 */

/* ---------- ids ---------- */

/** Buttons handled in handlers/commands.ts (Assign to me, status and Open are cards.ts's). */
export const ACTION_COMMENT = "internal_issue_comment";
export const ACTION_LOG_TOUCH = "internal_prospect_log_touch";

/** Modal callback ids. `create_task_from_message` is the shortcut's own id, from slack/manifest.json. */
export const SHORTCUT_CREATE_TASK = "create_task_from_message";
export const MODAL_NEW_TASK = "internal_new_task";
export const MODAL_TASK_FROM_MESSAGE = "internal_task_from_message";
export const MODAL_COMMENT = "internal_comment";
export const MODAL_LOG_TOUCH = "internal_log_touch";

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Slack caps option labels at 75 characters and a static select at 100 options. */
const opt = (label: string, value: string) => SelectOption({ label: clip(label, 75) || "—", value });
const MAX_OPTIONS = 100;

/* ---------- help and account linking ---------- */

export function helpText(): string {
  return [
    "*`/internal`* — tasks and prospects from Internal, without leaving Slack.",
    "• `/internal new [title]` — create a task",
    "• `/internal search <text>` (or just `/internal <text>`) — find tasks",
    "• `/internal mine` — your open tasks",
    "• `/internal VAL-123` — open a task: change its status, take it, comment",
    "• `/internal prospect <name>` — a Valytica prospect, and log a touch",
    "On any message: *More actions › Create task* turns it into a task and keeps the thread in sync.",
  ].join("\n");
}

export function linkAccountText(settingsUrl: string): string {
  return `I don't know who you are in Internal yet — your Slack email doesn't match a member. Link your account in ${slackLink(settingsUrl, "Settings › Slack")}, then try again.`;
}

/* ---------- tasks ---------- */

export type TaskRow = IssueRow;

const statusLabel = (s: string): string => STATUS_MAP[s as StatusId]?.label ?? s;

export const taskUrl = (appUrl: string, id: string): string => `${appUrl.replace(/\/+$/, "")}/issues/${id}`;

function taskLine(t: TaskRow, appUrl: string): string {
  const title = `${issueIdentifier(t)} · ${clip(t.title, 120)}`;
  const who = t.assigneeName ? escapeMrkdwn(t.assigneeName) : "Unassigned";
  return `*${slackLink(taskUrl(appUrl, t.id), title)}*\n${statusLabel(t.status)} · ${who}`;
}

/** Up to eight matches, each with Assign to me and Open. */
export function searchResultsCard(query: string, rows: readonly TaskRow[], appUrl: string): CardElement {
  const q = escapeMrkdwn(clip(query, 80));
  if (rows.length === 0) return Card({ children: [CardText(`No tasks match “${q}”.`)] });
  const children: CardChild[] = [CardText(`Tasks matching “${q}”`, { style: "muted" })];
  for (const t of rows.slice(0, 8)) {
    children.push(CardText(taskLine(t, appUrl)));
    children.push(
      Actions([
        Button({ id: ACTION_ASSIGN_ME, label: "Assign to me", value: t.id }),
        LinkButton({ id: ACTION_OPEN, url: taskUrl(appUrl, t.id), label: "Open" }),
      ]),
    );
  }
  return Card({ children });
}

const CLOSED: ReadonlySet<string> = new Set(["done", "canceled"]);
export const isOpenStatus = (s: string): boolean => !CLOSED.has(s);

/** Open tasks grouped by status, in board order, most urgent first within a group. */
export function groupByStatus<T extends { status: string }>(rows: readonly T[]): { status: StatusId; label: string; rows: T[] }[] {
  return STATUSES.filter((s) => isOpenStatus(s.id))
    .map((s) => ({ status: s.id as StatusId, label: s.label as string, rows: rows.filter((r) => r.status === s.id) }))
    .filter((g) => g.rows.length > 0);
}

/** The caller's open tasks by status; long lists are cut with a link to My tasks. */
export function mineCard(rows: readonly TaskRow[], appUrl: string, limit = 30): CardElement {
  const base = appUrl.replace(/\/+$/, "");
  const open = rows.filter((r) => isOpenStatus(r.status));
  if (open.length === 0) return Card({ children: [CardText("You have no open tasks. :tada:")] });
  const children: CardChild[] = [CardText(`Your open tasks (${open.length})`, { style: "muted" })];
  let shown = 0;
  for (const g of groupByStatus(open)) {
    if (shown >= limit) break;
    const take = g.rows.slice(0, limit - shown);
    shown += take.length;
    const lines = take.map((t) => `• ${slackLink(taskUrl(base, t.id), `${issueIdentifier(t)} · ${clip(t.title, 100)}`)}`);
    children.push(CardText(`*${g.label}*\n${lines.join("\n")}`));
  }
  if (open.length > shown) children.push(CardText(`…and ${open.length - shown} more.`, { style: "muted" }));
  children.push(Actions([LinkButton({ id: ACTION_OPEN, url: `${base}/my-issues`, label: "My tasks" })]));
  return Card({ children });
}

/**
 * A task as `/internal VAL-123` shows it: the notification card (Assign to me,
 * status, Open — cards.ts) plus Comment.
 */
export function taskCard(snap: RecordSnapshot, headline: string, appUrl: string): CardElement {
  const card = recordCard(snap, headline, appUrl);
  return withActions(card, [Button({ id: ACTION_COMMENT, label: "Comment", value: snap.id })]);
}

/** The task card's subtitle: who made it and when it last changed. */
export function taskHeadline(creatorName: string | null, updatedAt: Date | null): string {
  const parts: string[] = [];
  if (creatorName) parts.push(`Created by ${escapeMrkdwn(creatorName)}`);
  if (updatedAt) parts.push(`updated ${displayDate(updatedAt.toISOString().slice(0, 10))}`);
  const line = parts.join(" · ");
  return line ? line[0].toUpperCase() + line.slice(1) : "Task";
}

type ActionItem = Extract<CardChild, { type: "actions" }>["children"][number];

/** A copy of the card with buttons added to its last actions row (or a new row). */
export function withActions(card: CardElement, buttons: ActionItem[]): CardElement {
  const children = [...card.children];
  for (let i = children.length - 1; i >= 0; i--) {
    const c = children[i];
    if (c.type === "actions") {
      children[i] = { ...c, children: [...c.children.slice(0, 1), ...buttons, ...c.children.slice(1)] };
      return { ...card, children };
    }
  }
  return { ...card, children: [...children, Actions(buttons)] };
}

/* ---------- the new-task modal ---------- */

export type Choice = { id: string; label: string };

export type NewTaskForm = {
  callbackId: typeof MODAL_NEW_TASK | typeof MODAL_TASK_FROM_MESSAGE;
  title: string;
  description: string;
  projects: readonly Choice[];
  members: readonly Choice[];
  labels: readonly Choice[];
  projectId: string | null;
  assigneeId: string | null;
  /** Offer "Also post in this channel" (a slash command from a channel). */
  channelName: string | null;
  privateMetadata: string;
  /** A line under the fields, e.g. that a link back to the message is added. */
  note?: string;
};

const NONE = "none";

export function newTaskModal(f: NewTaskForm): ModalElement {
  const children: ModalChild[] = [
    TextInput({ id: "title", label: "Title", initialValue: clip(f.title, 250) || undefined, maxLength: 250 }),
    TextInput({
      id: "description",
      label: "Description",
      multiline: true,
      optional: true,
      initialValue: clip(f.description, 2900) || undefined,
      maxLength: 3000,
    }),
    Select({
      id: "project",
      label: "Project",
      options: [opt("No project", NONE), ...f.projects.slice(0, MAX_OPTIONS - 1).map((p) => opt(p.label, p.id))],
      initialOption: f.projectId ?? NONE,
    }),
    Select({
      id: "assignee",
      label: "Assignee",
      options: [opt("Unassigned", NONE), ...f.members.slice(0, MAX_OPTIONS - 1).map((m) => opt(m.label, m.id))],
      initialOption: f.assigneeId ?? NONE,
    }),
    Select({
      id: "priority",
      label: "Priority",
      options: PRIORITIES.map((p) => opt(p.label, p.id)),
      initialOption: "none",
    }),
    Select({
      id: "status",
      label: "Status",
      options: STATUSES.map((s) => opt(s.label, s.id)),
      initialOption: "backlog",
    }),
  ];
  if (f.labels.length > 0)
    children.push(
      Select({
        id: "label",
        label: "Label",
        optional: true,
        placeholder: "Add a label",
        options: f.labels.slice(0, MAX_OPTIONS).map((l) => opt(l.label, l.id)),
      }),
    );
  if (f.channelName)
    children.push(
      RadioSelect({
        id: "post",
        label: "Share",
        options: [opt("Just tell me", "no"), opt(`Also post in #${f.channelName}`, "yes")],
        initialOption: "no",
      }),
    );
  if (f.note) children.push(CardText(f.note, { style: "muted" }));
  return Modal({
    callbackId: f.callbackId,
    title: "New task",
    submitLabel: "Create",
    closeLabel: "Cancel",
    privateMetadata: f.privateMetadata,
    children,
  });
}

export type NewTaskValues = {
  title: string;
  description: string;
  projectId: string | null;
  assigneeId: string | null;
  priority: string;
  status: string;
  labelIds: string[];
  post: boolean;
};

/** The modal's values, or the errors to show on it. */
export function readNewTaskValues(
  values: Record<string, string | undefined>,
): { ok: true; value: NewTaskValues } | { ok: false; errors: Record<string, string> } {
  const title = (values.title ?? "").replace(/\s+/g, " ").trim();
  if (!title) return { ok: false, errors: { title: "Give the task a title." } };
  const ref = (v: string | undefined) => (v && v !== NONE ? v : null);
  return {
    ok: true,
    value: {
      title,
      description: (values.description ?? "").trim(),
      projectId: ref(values.project),
      assigneeId: ref(values.assignee),
      priority: values.priority || "none",
      status: values.status || "backlog",
      labelIds: values.label ? [values.label] : [],
      post: values.post === "yes",
    },
  };
}

/* ---------- comment ---------- */

export function commentModal(issueId: string, title: string): ModalElement {
  return Modal({
    callbackId: MODAL_COMMENT,
    title: "Comment",
    submitLabel: "Comment",
    closeLabel: "Cancel",
    privateMetadata: JSON.stringify({ issueId }),
    children: [
      CardText(`*${escapeMrkdwn(clip(title, 200))}*`),
      TextInput({ id: "body", label: "Comment", multiline: true, maxLength: 3000 }),
    ],
  });
}

/* ---------- prospects ---------- */

export type ProspectView = {
  kind: ProspectKind;
  id: string;
  /** "<kind>:<id>", as links and deals name it. */
  ref: string;
  name: string;
  status: string;
  city: string;
  assigned: string;
  nextStep: string;
  nextStepDate: string | null;
  lastContacted: string | null;
  lastTouch: { date: string | null; channel: string; outcome: string; by: string; summary: string } | null;
};

export const prospectUrl = (appUrl: string, ref: string): string =>
  `${appUrl.replace(/\/+$/, "")}/prospects?rec=${encodeURIComponent(ref)}`;

export function prospectFieldsOf(p: ProspectView): { label: string; value: string }[] {
  const out = [
    { label: "Stage", value: escapeMrkdwn(p.status || "Not contacted") },
    { label: "Owner", value: p.assigned ? escapeMrkdwn(p.assigned) : "Unassigned" },
  ];
  const next = [p.nextStep ? escapeMrkdwn(clip(p.nextStep, 120)) : "", p.nextStepDate ? displayDate(p.nextStepDate) : ""]
    .filter(Boolean)
    .join(" · ");
  out.push({ label: "Next step", value: next || "—" });
  const t = p.lastTouch;
  const last = t
    ? [t.date ? displayDate(t.date) : "", t.channel, t.outcome, t.by ? `by ${t.by}` : ""].filter(Boolean).map(escapeMrkdwn).join(" · ")
    : p.lastContacted
      ? displayDate(p.lastContacted)
      : "Never";
  out.push({ label: "Last touch", value: last });
  return out;
}

/**
 * "Log a touch" carries what its modal needs, so the modal opens at once —
 * Slack allows 3s from the click, and the sheet can take longer than that.
 */
export function encodeTouchButton(p: Pick<ProspectView, "ref" | "name" | "status" | "nextStep">): string {
  return JSON.stringify({ r: p.ref, n: clip(p.name, 200), s: p.status, x: clip(p.nextStep, 300) });
}

export function decodeTouchButton(value: string | undefined): Pick<ProspectView, "ref" | "name" | "status" | "nextStep"> | null {
  if (!value) return null;
  try {
    const v = JSON.parse(value) as Record<string, unknown>;
    const str = (x: unknown) => (typeof x === "string" ? x : "");
    return str(v.r) ? { ref: str(v.r), name: str(v.n), status: str(v.s), nextStep: str(v.x) } : null;
  } catch {
    return null;
  }
}

const prospectActions = (p: ProspectView, appUrl: string) =>
  Actions([
    Button({ id: ACTION_LOG_TOUCH, label: "Log a touch", value: encodeTouchButton(p), style: "primary" }),
    LinkButton({ id: ACTION_OPEN, url: prospectUrl(appUrl, p.ref), label: "Open" }),
  ]);

/** One prospect in full, or up to five matches in brief. */
export function prospectsCard(query: string, matches: readonly ProspectView[], appUrl: string): CardElement {
  if (matches.length === 0)
    return Card({ children: [CardText(`No Valytica prospect matches “${escapeMrkdwn(clip(query, 80))}”.`)] });
  if (matches.length === 1) {
    const p = matches[0];
    const where = [KIND_LABEL[p.kind].one, p.city].filter(Boolean).map(escapeMrkdwn).join(" · ");
    const children: CardChild[] = [CardText(`*${slackLink(prospectUrl(appUrl, p.ref), clip(p.name, 200))}*`)];
    if (where) children.push(CardText(where, { style: "muted" }));
    children.push(Fields(prospectFieldsOf(p).map((f) => Field(f))));
    if (p.lastTouch?.summary) children.push(CardText(`> ${escapeMrkdwn(clip(p.lastTouch.summary.replace(/\s+/g, " "), 280))}`));
    children.push(prospectActions(p, appUrl));
    return Card({ children });
  }
  const children: CardChild[] = [CardText(`Prospects matching “${escapeMrkdwn(clip(query, 80))}”`, { style: "muted" })];
  matches.slice(0, 5).forEach((p, i) => {
    if (i > 0) children.push(Divider());
    const owner = p.assigned ? escapeMrkdwn(p.assigned) : "Unassigned";
    children.push(
      CardText(`*${slackLink(prospectUrl(appUrl, p.ref), clip(p.name, 120))}*\n${escapeMrkdwn(p.status || "Not contacted")} · ${owner}`),
    );
    children.push(prospectActions(p, appUrl));
  });
  return Card({ children });
}

/** The web's "Log a touch" form, cut to what's quick to fill in from Slack. */
export function logTouchModal(p: Pick<ProspectView, "ref" | "name" | "status" | "nextStep">): ModalElement {
  const stage = (STAGES as readonly string[]).includes(p.status) ? p.status : STAGES[0];
  return Modal({
    callbackId: MODAL_LOG_TOUCH,
    title: "Log a touch",
    submitLabel: "Log",
    closeLabel: "Cancel",
    privateMetadata: JSON.stringify({ ref: p.ref, name: p.name }),
    children: [
      CardText(`*${escapeMrkdwn(clip(p.name, 200))}*`),
      Select({ id: "channel", label: "How", options: CHANNELS.map((c) => opt(c, c)), initialOption: "Call" }),
      RadioSelect({ id: "direction", label: "Direction", options: DIRECTIONS.map((d) => opt(d, d)), initialOption: "Outbound" }),
      Select({ id: "outcome", label: "Outcome", options: OUTCOMES.map((o) => opt(o, o)) }),
      TextInput({ id: "summary", label: "What they said", multiline: true, optional: true, maxLength: 2000 }),
      Select({ id: "status", label: "Stage after", options: STAGES.map((s) => opt(s, s)), initialOption: stage }),
      TextInput({
        id: "next_step",
        label: "Next step",
        optional: true,
        maxLength: 500,
        initialValue: p.nextStep ? clip(p.nextStep, 500) : undefined,
      }),
      DateInput({ id: "next_step_date", label: "Follow up on", optional: true }),
    ],
  });
}

export type TouchValues = {
  channel: string;
  direction: string;
  outcome: string;
  summary: string;
  statusAfter: string;
  nextStep: string | null;
  nextStepDate: string | null;
};

export function readTouchValues(
  values: Record<string, string | undefined>,
): { ok: true; value: TouchValues } | { ok: false; errors: Record<string, string> } {
  const outcome = values.outcome ?? "";
  if (!(OUTCOMES as readonly string[]).includes(outcome)) return { ok: false, errors: { outcome: "Pick what happened." } };
  const date = values.next_step_date?.trim() || null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, errors: { next_step_date: "Pick a date." } };
  return {
    ok: true,
    value: {
      channel: (CHANNELS as readonly string[]).includes(values.channel ?? "") ? values.channel! : "Other",
      direction: (DIRECTIONS as readonly string[]).includes(values.direction ?? "") ? values.direction! : "Outbound",
      outcome,
      summary: (values.summary ?? "").trim(),
      statusAfter: (STAGES as readonly string[]).includes(values.status ?? "") ? values.status! : STAGES[0],
      nextStep: values.next_step?.trim() || null,
      nextStepDate: date,
    },
  };
}

/* ---------- link previews ---------- */

/** A preview that names the record and nothing more. */
export function titleOnlyCard(url: string, title: string): CardElement {
  return Card({ children: [CardText(`*${slackLink(url, clip(title, 200))}*`)] });
}

/** A compact preview: linked title, a muted line, a few fields and Open. */
export function previewCard(
  url: string,
  title: string,
  subtitle: string,
  fields: readonly { label: string; value: string }[],
): CardElement {
  const children: CardChild[] = [CardText(`*${slackLink(url, clip(title, 200))}*`)];
  if (subtitle) children.push(CardText(subtitle, { style: "muted" }));
  if (fields.length) children.push(Fields(fields.map((f) => Field(f))));
  children.push(Actions([LinkButton({ id: ACTION_OPEN, url, label: "Open" })]));
  return Card({ children });
}

/** A doc page's first words, for its preview. */
export function excerpt(text: string, max = 200): string {
  return escapeMrkdwn(clip(text.replace(/\s+/g, " ").trim(), max));
}
