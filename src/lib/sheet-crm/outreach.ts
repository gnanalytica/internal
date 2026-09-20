/**
 * Internal-owned outreach vocabulary. Client-safe (no server imports).
 *
 * The sheet has no outreach history, so this state lives in Internal and is
 * mirrored to the masters' `outreach_status` / `last_contacted_at` columns
 * once the owner adds them. Order = funnel order.
 */
export const OUTREACH_STATUSES = [
  { id: "not_planned", label: "Not planned", color: "#94a3b8", rank: 0 },
  { id: "planned", label: "Planned", color: "#6366f1", rank: 1 },
  { id: "contacted", label: "Contacted", color: "#0ea5e9", rank: 2 },
  { id: "replied", label: "Replied", color: "#14b8a6", rank: 3 },
  { id: "meeting_booked", label: "Meeting booked", color: "#a855f7", rank: 4 },
  { id: "met", label: "Met", color: "#8b5cf6", rank: 5 },
  { id: "pilot", label: "Pilot", color: "#f59e0b", rank: 6 },
  { id: "paying", label: "Paying", color: "#10b981", rank: 7 },
  { id: "lost", label: "Lost", color: "#ef4444", rank: 8 },
  { id: "excluded", label: "Excluded", color: "#64748b", rank: 9 },
] as const;

export type OutreachStatusId = (typeof OUTREACH_STATUSES)[number]["id"];

export const OUTREACH_STATUS_MAP = Object.fromEntries(OUTREACH_STATUSES.map((s) => [s.id, s])) as Record<
  OutreachStatusId,
  (typeof OUTREACH_STATUSES)[number]
>;

export const isOutreachStatus = (v: string): v is OutreachStatusId => OUTREACH_STATUSES.some((s) => s.id === v);

/** Statuses that count as "in the funnel" (planned or beyond, not closed). */
export const ACTIVE_OUTREACH_STATUSES: OutreachStatusId[] = [
  "planned", "contacted", "replied", "meeting_booked", "met", "pilot", "paying",
];

export const INTERACTION_CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", color: "#22c55e" },
  { id: "linkedin", label: "LinkedIn", color: "#0ea5e9" },
  { id: "email", label: "Email", color: "#6366f1" },
  { id: "call", label: "Call", color: "#f59e0b" },
  { id: "meeting", label: "Meeting", color: "#a855f7" },
  { id: "sms", label: "SMS", color: "#14b8a6" },
  { id: "note", label: "Note", color: "#94a3b8" },
  { id: "task", label: "Task", color: "#64748b" },
  { id: "sheet_change", label: "Research change", color: "#d97706" },
] as const;

export type InteractionChannelId = (typeof INTERACTION_CHANNELS)[number]["id"];
export const isInteractionChannel = (v: string): v is InteractionChannelId =>
  INTERACTION_CHANNELS.some((c) => c.id === v);

/** Channels a person can log by hand. */
export const LOGGABLE_CHANNELS: InteractionChannelId[] = ["whatsapp", "linkedin", "email", "call", "meeting", "sms", "note"];

export const INTERACTION_DIRECTIONS = ["out", "in", "none"] as const;
export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];

export const INTERACTION_SOURCES = ["manual", "gmail", "gcal", "standup-ai", "slack", "api", "sheet-sync"] as const;
export type InteractionSource = (typeof INTERACTION_SOURCES)[number];

/**
 * The status an interaction implies, or null when it implies nothing. Status
 * only ever moves FORWARD from this rule: a late-logged note never demotes a
 * person who has since had a meeting.
 */
export function impliedOutreachStatus(
  channel: InteractionChannelId,
  direction: InteractionDirection,
  opts: { held?: boolean } = {},
): OutreachStatusId | null {
  if (channel === "meeting") return opts.held ? "met" : "meeting_booked";
  if (channel === "note" || channel === "task" || channel === "sheet_change") return null;
  if (direction === "in") return "replied";
  if (direction === "out") return "contacted";
  return null;
}

export function advanceOutreachStatus(current: string, implied: OutreachStatusId | null): OutreachStatusId | null {
  if (!implied) return null;
  const cur = isOutreachStatus(current) ? OUTREACH_STATUS_MAP[current] : OUTREACH_STATUS_MAP.not_planned;
  // Closed states are sticky; a logged message does not reopen a lost or excluded person.
  if (cur.id === "lost" || cur.id === "excluded" || cur.id === "paying") return null;
  return OUTREACH_STATUS_MAP[implied].rank > cur.rank ? implied : null;
}
