// Mirrors the web's src/lib/departments.ts and src/lib/types.ts option lists
// this section shows. Keep the two in step.
import type { IconName } from "@/components/ui";

export const HEALTH = [
  { id: "on_track", label: "On track", color: "#5e9b51" },
  { id: "at_risk", label: "At risk", color: "#f2c94c" },
  { id: "off_track", label: "Off track", color: "#eb5757" },
] as const;
export const HEALTH_MAP = Object.fromEntries(HEALTH.map((h) => [h.id, h])) as Record<string, (typeof HEALTH)[number]>;

export const FEATURE_STATUSES = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "planned", label: "Planned", color: "#6366f1" },
  { id: "building", label: "Building", color: "#f59e0b" },
  { id: "shipped", label: "Shipped", color: "#10b981" },
  { id: "archived", label: "Archived", color: "#64748b" },
] as const;
export const FEATURE_STATUS_MAP = Object.fromEntries(FEATURE_STATUSES.map((s) => [s.id, s])) as Record<string, (typeof FEATURE_STATUSES)[number]>;

export const FEEDBACK_SOURCES = [
  { id: "customer", label: "Customer", color: "#10b981" },
  { id: "sales", label: "Sales", color: "#0ea5e9" },
  { id: "support", label: "Support", color: "#f97316" },
  { id: "interview", label: "Interview", color: "#a855f7" },
  { id: "internal", label: "Internal", color: "#6366f1" },
  { id: "other", label: "Other", color: "#94a3b8" },
] as const;
export const FEEDBACK_SOURCE_MAP = Object.fromEntries(FEEDBACK_SOURCES.map((s) => [s.id, s])) as Record<string, (typeof FEEDBACK_SOURCES)[number]>;

export const FEEDBACK_STATUSES = [
  { id: "new", label: "New", color: "#94a3b8" },
  { id: "reviewing", label: "Reviewing", color: "#f59e0b" },
  { id: "planned", label: "Planned", color: "#6366f1" },
  { id: "shipped", label: "Shipped", color: "#10b981" },
  { id: "declined", label: "Declined", color: "#ef4444" },
] as const;
export const FEEDBACK_STATUS_MAP = Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s.id, s])) as Record<string, (typeof FEEDBACK_STATUSES)[number]>;

export const METRIC_CADENCES = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
] as const;

export const PROJECT_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6"];

/** Where each department lives on the phone, and the icon it wears. */
export const DEPARTMENT_ICON: Record<string, IconName> = {
  product: "compass",
  engineering: "code",
  analytics: "bar-chart-2",
  marketing: "volume-2",
  sales: "trending-up",
  "customer-success": "life-buoy",
  finance: "dollar-sign",
  strategy: "target",
};

/** "≥ 90%" / "≤ 30 sec" — the web's formatTarget. */
export function formatTarget(target: number | null | undefined, direction: "above" | "below" = "above", unit?: string | null): string | null {
  if (target == null) return null;
  const op = direction === "below" ? "≤" : "≥";
  const n = target.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (!unit) return `${op} ${n}`;
  return unit === "%" || unit.startsWith("/") ? `${op} ${n}${unit}` : `${op} ${n} ${unit}`;
}

/** Whether the latest value meets its target — the web's readTarget, reduced to what a card shows. */
export function onTarget(latest: number | null, target: number | null, direction: "above" | "below"): boolean | null {
  if (latest == null || target == null) return null;
  return direction === "below" ? latest <= target : latest >= target;
}

export function formatValue(v: number | null | undefined, unit?: string | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const n = v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (!unit) return n;
  return unit === "%" || unit.startsWith("/") ? `${n}${unit}` : `${n} ${unit}`;
}
