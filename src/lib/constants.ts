/** Linear-style issue workflow states. Order matters for board columns. */
export const STATUSES = [
  { id: "backlog", label: "Backlog", color: "#bec2c8" },
  { id: "todo", label: "Todo", color: "#e2e2e2" },
  { id: "in_progress", label: "In Progress", color: "#f2c94c" },
  { id: "in_review", label: "In Review", color: "#5e6ad2" },
  { id: "done", label: "Done", color: "#5e9b51" },
  { id: "canceled", label: "Canceled", color: "#95a2b3" },
] as const;

export type StatusId = (typeof STATUSES)[number]["id"];

export const STATUS_MAP = Object.fromEntries(
  STATUSES.map((s) => [s.id, s]),
) as Record<StatusId, (typeof STATUSES)[number]>;

/** Linear-style priorities. Order from highest urgency to none. */
export const PRIORITIES = [
  { id: "urgent", label: "Urgent", rank: 0 },
  { id: "high", label: "High", rank: 1 },
  { id: "medium", label: "Medium", rank: 2 },
  { id: "low", label: "Low", rank: 3 },
  { id: "none", label: "No priority", rank: 4 },
] as const;

export type PriorityId = (typeof PRIORITIES)[number]["id"];

export const PRIORITY_MAP = Object.fromEntries(
  PRIORITIES.map((p) => [p.id, p]),
) as Record<PriorityId, (typeof PRIORITIES)[number]>;

export const isStatus = (v: string): v is StatusId =>
  STATUSES.some((s) => s.id === v);

export const isPriority = (v: string): v is PriorityId =>
  PRIORITIES.some((p) => p.id === v);
