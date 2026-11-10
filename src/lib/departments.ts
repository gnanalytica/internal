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
  | "customer-success"
  | "finance"
  | "strategy";

// Canonical product-org functions, in lifecycle order. Finance appears at two
// scopes, like the other functions: this per-product department is one product's
// pricing, unit costs, margin and its own scoped invoices/expenses ("is this
// product a good business?"); it rolls up into the company-level Finance
// Operations project (payroll, runway, consolidated books). Founder-only
// (see CONFIDENTIAL). The per-product pricing model lives in `projects.pricingModel`.
export const DEPARTMENTS = [
  {
    slug: "product",
    label: "Product",
    icon: "🧭",
    color: "#8b5cf6",
    // The PM surface: roadmap, specs and (later) discovery/feedback.
    tool: "Roadmap & specs",
    defaultOn: true,
  },
  {
    slug: "engineering",
    label: "Engineering",
    icon: "⚙️",
    color: "#3b82f6",
    // Engineering reuses the existing Linear-style issues module.
    tool: "Linear",
    defaultOn: true,
  },
  {
    slug: "analytics",
    label: "Analytics",
    icon: "📊",
    color: "#14b8a6",
    tool: "Product metrics & KPIs",
    defaultOn: false,
  },
  {
    slug: "marketing",
    label: "Marketing",
    icon: "📣",
    color: "#f43f5e",
    tool: "HubSpot",
    defaultOn: false,
  },
  {
    slug: "sales",
    label: "Sales",
    icon: "📈",
    color: "#0ea5e9",
    tool: "Apollo / HubSpot",
    defaultOn: false,
  },
  {
    slug: "customer-success",
    label: "Customer Success",
    icon: "🎧",
    color: "#f97316",
    tool: "Zendesk / Intercom-style tickets",
    defaultOn: false,
  },
  {
    slug: "finance",
    label: "Finance",
    icon: "💰",
    color: "#22c55e",
    // Product-level finance: unit economics + this product's scoped invoices/expenses.
    tool: "Unit economics & P&L",
    defaultOn: false,
  },
  {
    slug: "strategy", label: "Strategy", icon: "🎯", color: "#7c3aed",
    tool: "Vision · FDV · economics", defaultOn: true,
  },
] as const;

/**
 * Departments restricted to admins (founders) — revenue-sensitive. Finance is
 * a company-level Operation (also confidential); HR lives in the People & HR
 * Operation (confidential via the project flag).
 */
export const CONFIDENTIAL_DEPARTMENTS: DepartmentSlug[] = ["finance"];
export const isConfidentialDepartment = (slug: string): boolean =>
  CONFIDENTIAL_DEPARTMENTS.includes(slug as DepartmentSlug);

/**
 * Confidential departments a project's *owner* may see for their own product,
 * even without the admin role. A product lead owns their product's finances
 * (pricing, margin, its P&L).
 */
export const OWNER_VISIBLE_DEPARTMENTS: DepartmentSlug[] = ["finance"];
const isOwnerVisibleDepartment = (slug: string): boolean =>
  OWNER_VISIBLE_DEPARTMENTS.includes(slug as DepartmentSlug);

/** Admins (founders) see confidential areas; members do not. */
export const canSeeConfidential = (role: string): boolean => role === "admin";

/**
 * Whether a user may see a confidential department on a given project. Admins
 * see everything; a project's owner additionally sees that project's
 * owner-visible confidential departments (Finance, not Sales).
 */
export function canSeeConfidentialDept(
  slug: string,
  role: string,
  isOwner: boolean,
): boolean {
  return canSeeConfidential(role) || (isOwner && isOwnerVisibleDepartment(slug));
}

/**
 * Departments visible to a user for one project. Non-confidential ones always
 * show; confidential ones show for admins, and Finance also shows for the
 * project's owner (`isOwner`).
 */
export function visibleDepartments(
  enabled: string[] | null | undefined,
  role: string,
  isOwner = false,
): (typeof DEPARTMENTS)[number][] {
  return enabledDepartments(enabled).filter((d) => canSeeDepartment(d.slug, role, isOwner));
}

/**
 * THE access rule for a department: the tab strip, each department's page,
 * the scorecard, the API and the Slack bot all ask this, so a tab can never
 * show for someone its page then refuses. Non-confidential departments are
 * open to every member; confidential ones follow `canSeeConfidentialDept`.
 */
export function canSeeDepartment(slug: string, role: string, isOwner = false): boolean {
  return !isConfidentialDepartment(slug) || canSeeConfidentialDept(slug, role, isOwner);
}

/**
 * The departments enabled for a project. `null`/`undefined` enables only the
 * default-on baseline (Product + Engineering + Strategy); every other surface is opt-in
 * (`defaultOn: false`) and earned when a product has real data for it. An
 * explicit array restricts to those slugs while preserving the canonical order.
 */
export function enabledDepartments(
  enabled: string[] | null | undefined,
): (typeof DEPARTMENTS)[number][] {
  if (enabled == null) return DEPARTMENTS.filter((d) => d.defaultOn !== false);
  return DEPARTMENTS.filter((d) => enabled.includes(d.slug));
}

export function isDepartmentEnabled(
  enabled: string[] | null | undefined,
  slug: DepartmentSlug,
): boolean {
  return enabledDepartments(enabled).some((d) => d.slug === slug);
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
/** Stages that count as open (still in pipeline). */
export const OPEN_DEAL_STAGES: DealStageId[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
];

// ---- Sales: deal activity ----
export const ACTIVITY_TYPES = [
  { id: "note", label: "Note", icon: "📝" },
  { id: "call", label: "Call", icon: "📞" },
  { id: "email", label: "Email", icon: "✉️" },
  { id: "task", label: "Task", icon: "✅" },
  { id: "meeting", label: "Meeting", icon: "📅" },
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

// ---- Features: feature pipeline (order = board columns) ----
export const FEATURE_STATUSES = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "planned", label: "Planned", color: "#6366f1" },
  { id: "building", label: "Building", color: "#f59e0b" },
  { id: "shipped", label: "Shipped", color: "#10b981" },
  { id: "archived", label: "Archived", color: "#64748b" },
] as const;

export type FeatureStatusId = (typeof FEATURE_STATUSES)[number]["id"];

export const ENTITIES = [
  { id: "India", label: "India 🇮🇳", color: "#f59e0b" },
  { id: "Netherlands", label: "Netherlands 🇳🇱", color: "#f97316" },
  { id: "Global", label: "Global", color: "#94a3b8" },
] as const;

/** Look up the {label,color} for an id in one of the option lists above. */
export function optionMeta(
  list: readonly { id: string; label: string; color?: string }[],
  id: string,
): { label: string; color?: string } {
  return list.find((o) => o.id === id) ?? { label: id };
}

/**
 * Which tracks belong to which department surface.
 *
 * Keyed on labels rather than `issues.type`, because type cannot separate the
 * ops bucket: account management, maintenance and project setup all land in
 * "ops" but answer to three different departments. The labels came 1:1 from
 * the work-breakdown tracks, so they carry that distinction.
 *
 * A task appears in its department AND on the global board — these are lenses
 * on one set of issues, not separate task systems.
 */
export const DEPARTMENT_LABELS: Partial<Record<DepartmentSlug, string[]>> = {
  engineering: ["app", "ai-ml", "platform", "qa"],
  product: ["product", "pm", "setup-pm", "launch", "post-launch", "compliance", "risk"],
  marketing: ["content", "social", "marketing-analytics", "market-research"],
  sales: ["sales"],
  "customer-success": ["account-mgmt", "maintenance"],
};

/** True when an issue's labels put it on this department's surface. */
export function issueBelongsToDepartment(
  labels: { name: string }[],
  slug: DepartmentSlug,
): boolean {
  const wanted = DEPARTMENT_LABELS[slug];
  if (!wanted) return false;
  return labels.some((l) => wanted.includes(l.name));
}

/** One row per (issue, label) pair — the shape the summary query returns. */
export type LabelledIssueRow = {
  id: string;
  projectId: string | null;
  status: string;
  parentId: string | null;
  label: string;
};

/**
 * Open tasks per department for one project, routed by the same labels the
 * department surfaces use. Without this the Engineering card reports every
 * task in the project as its own.
 *
 * Counts top-level tasks only, matching what a surface lists, and counts a
 * task once even when it carries two of that department's labels.
 */
export function countOpenByDepartment(
  rows: LabelledIssueRow[],
  projectId: string,
): Record<string, number> {
  const perDept = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.projectId !== projectId || r.parentId) continue;
    if (r.status === "done" || r.status === "canceled") continue;
    for (const [slug, tracks] of Object.entries(DEPARTMENT_LABELS)) {
      if (!(tracks ?? []).includes(r.label)) continue;
      (perDept.get(slug) ?? perDept.set(slug, new Set()).get(slug)!).add(r.id);
    }
  }
  return Object.fromEntries([...perDept].map(([slug, ids]) => [slug, ids.size]));
}
