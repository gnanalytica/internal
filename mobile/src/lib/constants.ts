// Mirrors the web app's src/lib/constants.ts. Keep the two in step.

export const STATUSES = [
  { id: "backlog", label: "Backlog", color: "#bec2c8" },
  { id: "todo", label: "Todo", color: "#b4b9c1" },
  { id: "in_progress", label: "In Progress", color: "#f2c94c" },
  { id: "in_review", label: "In Review", color: "#5e6ad2" },
  { id: "done", label: "Done", color: "#5e9b51" },
  { id: "canceled", label: "Canceled", color: "#95a2b3" },
] as const;
export type StatusId = (typeof STATUSES)[number]["id"];
export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s])) as Record<string, (typeof STATUSES)[number]>;

export const PRIORITIES = [
  { id: "urgent", label: "Urgent", rank: 0 },
  { id: "high", label: "High", rank: 1 },
  { id: "medium", label: "Medium", rank: 2 },
  { id: "low", label: "Low", rank: 3 },
  { id: "none", label: "No priority", rank: 4 },
] as const;
export type PriorityId = (typeof PRIORITIES)[number]["id"];
export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.id, p])) as Record<string, (typeof PRIORITIES)[number]>;

export const ISSUE_TYPES = [
  { id: "engineering", label: "Engineering", color: "#5e6ad2" },
  { id: "product", label: "Product / Design", color: "#8b5cf6" },
  { id: "research", label: "Research", color: "#0ea5e9" },
  { id: "marketing", label: "Marketing", color: "#ec4899" },
  { id: "sales", label: "Sales", color: "#10b981" },
  { id: "ops", label: "Ops", color: "#f59e0b" },
  { id: "legal", label: "Legal", color: "#ef4444" },
  { id: "finance", label: "Finance", color: "#14b8a6" },
  { id: "people", label: "People / HR", color: "#f97316" },
  { id: "admin", label: "Admin", color: "#64748b" },
] as const;
export const ISSUE_TYPE_MAP = Object.fromEntries(ISSUE_TYPES.map((t) => [t.id, t])) as Record<string, (typeof ISSUE_TYPES)[number]>;

export const MILESTONE_STATUSES = [
  { id: "planned", label: "Planned", color: "#bec2c8" },
  { id: "on_track", label: "On track", color: "#5e9b51" },
  { id: "at_risk", label: "At risk", color: "#f2c94c" },
  { id: "off_track", label: "Off track", color: "#eb5757" },
  { id: "achieved", label: "Achieved", color: "#5e6ad2" },
  { id: "missed", label: "Missed", color: "#95a2b3" },
] as const;
export const MILESTONE_STATUS_MAP = Object.fromEntries(MILESTONE_STATUSES.map((s) => [s.id, s])) as Record<string, (typeof MILESTONE_STATUSES)[number]>;

const AVATAR_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6"];
/** Same colour for the same person on every screen, like the web's pickColor. */
export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
