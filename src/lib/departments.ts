/**
 * The Project × Department matrix.
 *
 * Departments are a fixed set driven from here: because the sidebar and routes
 * are generated from `DEPARTMENTS`, every project automatically gets all of
 * these sections the moment it is created — no per-project setup rows. Each
 * department record (deal/campaign/issue) carries a `projectId`, which is the
 * link between the project lens (`/projects/[id]/sales`) and the company-wide
 * department lens (`/sales`).
 */

export type DepartmentSlug =
  | "product"
  | "engineering"
  | "analytics"
  | "marketing"
  | "sales"
  | "customer-success";

// Canonical product-org functions, in lifecycle order. Finance lives at the
// company level (an Operations project), not per-project. Analytics is a
// planned addition (product metrics) once its module is built.
export const DEPARTMENTS = [
  {
    slug: "product",
    label: "Product",
    icon: "🧭",
    color: "#8b5cf6",
    // The PM surface: roadmap, specs and (later) discovery/feedback.
    tool: "Roadmap & specs",
  },
  {
    slug: "engineering",
    label: "Engineering",
    icon: "⚙️",
    color: "#3b82f6",
    // Engineering reuses the existing Linear-style issues module.
    tool: "Linear",
  },
  {
    slug: "analytics",
    label: "Analytics",
    icon: "📊",
    color: "#14b8a6",
    tool: "Product metrics & KPIs",
  },
  {
    slug: "marketing",
    label: "Marketing",
    icon: "📣",
    color: "#f43f5e",
    tool: "HubSpot",
  },
  {
    slug: "sales",
    label: "Sales",
    icon: "📈",
    color: "#0ea5e9",
    tool: "Apollo / HubSpot",
  },
  {
    slug: "customer-success",
    label: "Customer Success",
    icon: "🎧",
    color: "#f97316",
    tool: "Zendesk / Intercom-style tickets",
  },
] as const;

export const DEPARTMENT_MAP = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.slug, d]),
) as Record<DepartmentSlug, (typeof DEPARTMENTS)[number]>;

export const ALL_DEPARTMENT_SLUGS = DEPARTMENTS.map((d) => d.slug);

/**
 * Departments restricted to admins (founders) — revenue-sensitive. Finance is
 * a company-level Operation (also confidential); HR lives in the People & HR
 * Operation (confidential via the project flag).
 */
export const CONFIDENTIAL_DEPARTMENTS: DepartmentSlug[] = ["sales"];
export const isConfidentialDepartment = (slug: string): boolean =>
  CONFIDENTIAL_DEPARTMENTS.includes(slug as DepartmentSlug);

/** Admins (founders) see confidential areas; members do not. */
export const canSeeConfidential = (role: string): boolean => role === "admin";

/** Departments visible to a given role (drops confidential ones for members). */
export function visibleDepartments(
  enabled: string[] | null | undefined,
  role: string,
): (typeof DEPARTMENTS)[number][] {
  const list = enabledDepartments(enabled);
  return canSeeConfidential(role) ? list : list.filter((d) => !isConfidentialDepartment(d.slug));
}

/**
 * The departments enabled for a project. `null`/`undefined` means all are on
 * (the auto-spawn default); an explicit array restricts to those slugs while
 * preserving the canonical order.
 */
export function enabledDepartments(
  enabled: string[] | null | undefined,
): (typeof DEPARTMENTS)[number][] {
  if (enabled == null) return [...DEPARTMENTS];
  return DEPARTMENTS.filter((d) => enabled.includes(d.slug));
}

export function isDepartmentEnabled(
  enabled: string[] | null | undefined,
  slug: DepartmentSlug,
): boolean {
  return enabled == null || enabled.includes(slug);
}

// ---- Sales: pipeline stages (order = board columns) ----
export const DEAL_STAGES = [
  { id: "lead", label: "Lead", color: "#94a3b8" },
  { id: "qualified", label: "Qualified", color: "#6366f1" },
  { id: "proposal", label: "Proposal", color: "#a855f7" },
  { id: "negotiation", label: "Negotiation", color: "#f59e0b" },
  { id: "won", label: "Won", color: "#10b981" },
  { id: "lost", label: "Lost", color: "#ef4444" },
] as const;

export type DealStageId = (typeof DEAL_STAGES)[number]["id"];
export const DEAL_STAGE_MAP = Object.fromEntries(
  DEAL_STAGES.map((s) => [s.id, s]),
) as Record<DealStageId, (typeof DEAL_STAGES)[number]>;
export const isDealStage = (v: string): v is DealStageId =>
  DEAL_STAGES.some((s) => s.id === v);
/** Stages that count as open (still in pipeline). */
export const OPEN_DEAL_STAGES: DealStageId[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
];

// ---- CRM ----
export const ACCOUNT_TYPES = [
  { id: "prospect", label: "Prospect", color: "#6366f1" },
  { id: "customer", label: "Customer", color: "#10b981" },
  { id: "partner", label: "Partner", color: "#a855f7" },
  { id: "churned", label: "Churned", color: "#ef4444" },
] as const;

export const LIFECYCLE_STAGES = [
  { id: "lead", label: "Lead", color: "#94a3b8" },
  { id: "qualified", label: "Qualified", color: "#6366f1" },
  { id: "customer", label: "Customer", color: "#10b981" },
] as const;

export const ACTIVITY_TYPES = [
  { id: "note", label: "Note", icon: "📝" },
  { id: "call", label: "Call", icon: "📞" },
  { id: "email", label: "Email", icon: "✉️" },
  { id: "task", label: "Task", icon: "✅" },
  { id: "meeting", label: "Meeting", icon: "📅" },
] as const;

// ---- Marketing ----
export const CAMPAIGN_CHANNELS = [
  { id: "email", label: "Email", color: "#6366f1" },
  { id: "whatsapp", label: "WhatsApp", color: "#22c55e" },
  { id: "linkedin", label: "LinkedIn", color: "#0ea5e9" },
  { id: "events", label: "Events", color: "#a855f7" },
  { id: "content", label: "Content", color: "#10b981" },
  { id: "paid", label: "Paid", color: "#f59e0b" },
  { id: "referral", label: "Referral", color: "#ec4899" },
] as const;

export const CAMPAIGN_STATUSES = [
  { id: "planned", label: "Planned", color: "#94a3b8" },
  { id: "active", label: "Active", color: "#10b981" },
  { id: "done", label: "Done", color: "#6366f1" },
] as const;

// Content calendar stages (order = board columns).
export const CONTENT_STATUSES = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "draft", label: "Draft", color: "#f59e0b" },
  { id: "scheduled", label: "Scheduled", color: "#6366f1" },
  { id: "published", label: "Published", color: "#10b981" },
] as const;

// ---- Finance ----
export const INVOICE_STATUSES = [
  { id: "draft", label: "Draft", color: "#94a3b8" },
  { id: "sent", label: "Sent", color: "#6366f1" },
  { id: "paid", label: "Paid", color: "#10b981" },
  { id: "overdue", label: "Overdue", color: "#ef4444" },
] as const;

export const EXPENSE_STATUSES = [
  { id: "planned", label: "Planned", color: "#94a3b8" },
  { id: "paid", label: "Paid", color: "#10b981" },
] as const;

export const EXPENSE_CATEGORIES = [
  { id: "tooling", label: "Tooling / SaaS", color: "#6366f1" },
  { id: "contractors", label: "Contractors", color: "#a855f7" },
  { id: "marketing", label: "Marketing", color: "#f43f5e" },
  { id: "infra", label: "Infrastructure", color: "#0ea5e9" },
  { id: "other", label: "Other", color: "#94a3b8" },
] as const;

// ---- Support: ticket queue (order = board columns) ----
export const TICKET_STATUSES = [
  { id: "open", label: "Open", color: "#ef4444" },
  { id: "pending", label: "Pending", color: "#f59e0b" },
  { id: "solved", label: "Solved", color: "#10b981" },
  { id: "closed", label: "Closed", color: "#94a3b8" },
] as const;

export type TicketStatusId = (typeof TICKET_STATUSES)[number]["id"];
export const isTicketStatus = (v: string): v is TicketStatusId =>
  TICKET_STATUSES.some((s) => s.id === v);
export const OPEN_TICKET_STATUSES: TicketStatusId[] = ["open", "pending"];

export const TICKET_PRIORITIES = [
  { id: "urgent", label: "Urgent", color: "#ef4444" },
  { id: "high", label: "High", color: "#f59e0b" },
  { id: "normal", label: "Normal", color: "#6366f1" },
  { id: "low", label: "Low", color: "#94a3b8" },
] as const;

// ---- Features: feature pipeline (order = board columns) ----
export const FEATURE_STATUSES = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "planned", label: "Planned", color: "#6366f1" },
  { id: "building", label: "Building", color: "#f59e0b" },
  { id: "shipped", label: "Shipped", color: "#10b981" },
  { id: "archived", label: "Archived", color: "#64748b" },
] as const;

export type FeatureStatusId = (typeof FEATURE_STATUSES)[number]["id"];
export const isFeatureStatus = (v: string): v is FeatureStatusId =>
  FEATURE_STATUSES.some((s) => s.id === v);
/** Statuses that count as "open" (still on the roadmap). */
export const OPEN_FEATURE_STATUSES: FeatureStatusId[] = ["idea", "planned", "building"];

export const ENTITIES = [
  { id: "India", label: "India 🇮🇳", color: "#f59e0b" },
  { id: "Netherlands", label: "Netherlands 🇳🇱", color: "#f97316" },
  { id: "Global", label: "Global", color: "#94a3b8" },
] as const;

// ---- Analytics: metric cadence ----
export const METRIC_CADENCES = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
] as const;

// ---- Product: feedback sources & pipeline ----
export const FEEDBACK_SOURCES = [
  { id: "customer", label: "Customer", color: "#10b981" },
  { id: "sales", label: "Sales", color: "#0ea5e9" },
  { id: "support", label: "Support", color: "#f97316" },
  { id: "interview", label: "Interview", color: "#a855f7" },
  { id: "internal", label: "Internal", color: "#6366f1" },
  { id: "other", label: "Other", color: "#94a3b8" },
] as const;

// Feedback pipeline (order = board columns).
export const FEEDBACK_STATUSES = [
  { id: "new", label: "New", color: "#94a3b8" },
  { id: "reviewing", label: "Reviewing", color: "#f59e0b" },
  { id: "planned", label: "Planned", color: "#6366f1" },
  { id: "shipped", label: "Shipped", color: "#10b981" },
  { id: "declined", label: "Declined", color: "#ef4444" },
] as const;

export type FeedbackStatusId = (typeof FEEDBACK_STATUSES)[number]["id"];
export const isFeedbackStatus = (v: string): v is FeedbackStatusId =>
  FEEDBACK_STATUSES.some((s) => s.id === v);
/** Statuses that count as open (still in the discovery pipeline). */
export const OPEN_FEEDBACK_STATUSES: FeedbackStatusId[] = ["new", "reviewing", "planned"];

/** Look up the {label,color} for an id in one of the option lists above. */
export function optionMeta(
  list: readonly { id: string; label: string; color?: string }[],
  id: string,
): { label: string; color?: string } {
  return list.find((o) => o.id === id) ?? { label: id };
}
