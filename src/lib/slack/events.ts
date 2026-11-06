import { PROSPECTS_PRODUCT_KEY, STAGES } from "@/lib/prospects/schema";

/**
 * What the app can tell Slack about, and which channel rules hear it. Pure —
 * the delivery is in notify.ts. Event ids are stored in
 * `slack_channel_rules.events`, so rename one only with a data migration.
 */

export const SLACK_EVENT_GROUPS = [
  {
    id: "engineering",
    label: "Engineering",
    events: [
      { id: "issue.created", label: "Task created" },
      { id: "issue.status_changed", label: "Status changed" },
      { id: "issue.assigned", label: "Assigned" },
      { id: "issue.commented", label: "New comment" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    events: [
      { id: "deal.won", label: "Deal won" },
      { id: "prospect.stage_changed", label: "Prospect stage changed" },
    ],
  },
  {
    id: "customer-success",
    label: "Customer Success",
    events: [{ id: "ticket.created", label: "New customer request" }],
  },
  {
    id: "product",
    label: "Product",
    events: [{ id: "feedback.created", label: "New feedback" }],
  },
  {
    id: "marketing",
    label: "Marketing",
    events: [{ id: "content.published", label: "Content posted" }],
  },
] as const;

export type SlackEventType = (typeof SLACK_EVENT_GROUPS)[number]["events"][number]["id"];

const ALL_EVENTS: readonly { id: SlackEventType; label: string }[] = SLACK_EVENT_GROUPS.flatMap(
  (g): readonly { id: SlackEventType; label: string }[] => g.events,
);

export const SLACK_EVENT_TYPES: SlackEventType[] = ALL_EVENTS.map((e) => e.id);

export const isSlackEventType = (v: unknown): v is SlackEventType =>
  typeof v === "string" && (SLACK_EVENT_TYPES as string[]).includes(v);

export const slackEventLabel = (id: string): string => ALL_EVENTS.find((e) => e.id === id)?.label ?? id;

/** The kind of app record an event is about — also `slack_threads.record_type`. */
export type SlackRecordType = "issue" | "prospect" | "deal" | "ticket" | "feedback" | "content";

export function recordTypeOf(event: SlackEventType): SlackRecordType {
  return event.slice(0, event.indexOf(".")) as SlackRecordType;
}

/**
 * One thing that happened, as the caller knows it. Everything the card shows
 * is re-read from the database when it is delivered (records.ts), so callers
 * pass ids, not snapshots — except for prospects, which live in the sheet.
 */
export type SlackEventInput = {
  type: SlackEventType;
  /** The record's id; for prospects, "<kind>:<id>". */
  recordId: string;
  /** Who did it, when known. */
  actorId?: string | null;
  /** Prospects only: the row as it read before the write, and the new status. */
  prospect?: { name: string; from: string | null; to: string };
  /** Comments: the comment text. */
  body?: string;
};

/**
 * The Slack events an outbound-webhook event implies. Task events reach Slack
 * through `dispatchWebhook` (src/lib/api/webhooks.ts), the one place both the
 * web app and the API announce them, so this reads its payloads:
 * `issue.updated` carries the patch, and a patch can carry a status or an
 * assignee (or both, or neither).
 */
export function slackEventsFromWebhook(event: string, data: unknown): SlackEventInput[] {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  switch (event) {
    case "issue.created": {
      const id = str(d.id);
      return id ? [{ type: "issue.created", recordId: id }] : [];
    }
    case "issue.updated": {
      const id = str(d.id);
      if (!id) return [];
      const out: SlackEventInput[] = [];
      if (str(d.status)) out.push({ type: "issue.status_changed", recordId: id });
      const assigned = str(d.assigneeId) ?? (Array.isArray(d.assigneeIds) ? str(d.assigneeIds[0]) : null);
      if (assigned) out.push({ type: "issue.assigned", recordId: id });
      return out;
    }
    case "issue.commented": {
      const id = str(d.issueId);
      return id ? [{ type: "issue.commented", recordId: id, body: str(d.body) ?? undefined }] : [];
    }
    default:
      return [];
  }
}

/**
 * Whether a field change is news. A board drag re-sends every card's status,
 * so "moved to In Progress" is only said when the status differs from the one
 * last announced, and — when nothing has been announced for the record yet —
 * only when the app logged the change itself (`activity`), which it does only
 * for real changes.
 */
export function isNewsworthyChange(current: string, lastAnnounced: string | null, loggedChange: boolean): boolean {
  if (lastAnnounced === current) return false;
  return loggedChange || lastAnnounced !== null;
}

export type SlackRuleFilters = { minProspectStage?: string };

export type SlackRule = {
  id: string;
  slackChannelId: string;
  projectId: string | null;
  events: string[];
  filters: SlackRuleFilters | null;
};

/** What a rule needs to know about an event to decide whether it matches. */
export type SlackEventFacts = {
  type: SlackEventType;
  /** The record's project, when it has one. */
  projectId: string | null;
  /** Prospects only: the stage moved to. */
  prospectStage?: string | null;
};

const stageRank = (stage: string | null | undefined): number =>
  stage ? STAGES.findIndex((s) => s.toLowerCase() === stage.trim().toLowerCase()) : -1;

/**
 * Whether a rule wants this event. A rule scoped to a project only hears that
 * project's records; a record with no project is only heard by "All projects"
 * rules. A prospect rule with a minimum stage ignores moves to earlier stages
 * (and to stages it doesn't recognise).
 */
export function ruleMatches(rule: SlackRule, ev: SlackEventFacts): boolean {
  if (!rule.events.includes(ev.type)) return false;
  if (rule.projectId && rule.projectId !== ev.projectId) return false;
  const min = rule.filters?.minProspectStage;
  if (ev.type === "prospect.stage_changed" && min) {
    const at = stageRank(ev.prospectStage);
    if (at < 0 || at < stageRank(min)) return false;
  }
  return true;
}

/** The distinct channels to post an event to, in rule order. */
export function channelsFor(rules: SlackRule[], ev: SlackEventFacts): string[] {
  const out: string[] = [];
  for (const r of rules) {
    if (ruleMatches(r, ev) && !out.includes(r.slackChannelId)) out.push(r.slackChannelId);
  }
  return out;
}

/** Stages a prospect rule can start from — the dashboard's, in order. */
export const PROSPECT_STAGE_OPTIONS: readonly string[] = STAGES;

/**
 * One-click starting points on the settings page. `projectKey` is resolved to
 * the project's id there; a preset whose project doesn't exist is still offered
 * with "All projects".
 */
export const SLACK_RULE_PRESETS: {
  id: string;
  channelName: string;
  label: string;
  projectKey: string | null;
  events: SlackEventType[];
  filters: SlackRuleFilters;
}[] = [
  {
    id: "engineering",
    channelName: "engineering",
    label: "Engineering task events for Valytica",
    projectKey: PROSPECTS_PRODUCT_KEY,
    events: ["issue.created", "issue.status_changed", "issue.assigned", "issue.commented"],
    filters: {},
  },
  {
    id: "product-and-business",
    channelName: "product-and-business",
    label: "Deals won, prospects from Demo done, customer requests, feedback",
    projectKey: null,
    events: ["deal.won", "prospect.stage_changed", "ticket.created", "feedback.created"],
    filters: { minProspectStage: "Demo done" },
  },
];
