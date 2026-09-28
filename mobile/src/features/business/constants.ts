// Mirrors the option lists in the web app's src/lib/departments.ts and the
// static rates in src/lib/currency.ts. Keep them in step.

export type Option = { value: string; label: string; color?: string; subtitle?: string };

const opts = (rows: readonly { id: string; label: string; color?: string }[]): Option[] => rows.map((r) => ({ value: r.id, label: r.label, color: r.color }));

export const DEAL_STAGES = opts([
  { id: "lead", label: "Lead", color: "#94a3b8" },
  { id: "qualified", label: "Qualified", color: "#6366f1" },
  { id: "proposal", label: "Proposal", color: "#a855f7" },
  { id: "negotiation", label: "Negotiation", color: "#f59e0b" },
  { id: "won", label: "Won", color: "#10b981" },
  { id: "lost", label: "Lost", color: "#ef4444" },
]);
export const OPEN_DEAL_STAGES = ["lead", "qualified", "proposal", "negotiation"];

export const ACCOUNT_TYPES = opts([
  { id: "prospect", label: "Prospect", color: "#6366f1" },
  { id: "customer", label: "Customer", color: "#10b981" },
  { id: "partner", label: "Partner", color: "#a855f7" },
  { id: "churned", label: "Churned", color: "#ef4444" },
]);

export const LIFECYCLE_STAGES = opts([
  { id: "lead", label: "Lead", color: "#94a3b8" },
  { id: "qualified", label: "Qualified", color: "#6366f1" },
  { id: "customer", label: "Customer", color: "#10b981" },
]);

/** What can be logged against a deal from the phone. */
export const ACTIVITY_TYPES = [
  { value: "call", label: "Call", icon: "phone" },
  { value: "email", label: "Email", icon: "mail" },
  { value: "meeting", label: "Meeting", icon: "calendar" },
  { value: "note", label: "Note", icon: "edit-3" },
] as const;
export const ACTIVITY_ICON: Record<string, "phone" | "mail" | "calendar" | "edit-3" | "check-square"> = { call: "phone", email: "mail", meeting: "calendar", note: "edit-3", task: "check-square" };

export const CAMPAIGN_CHANNELS = opts([
  { id: "email", label: "Email", color: "#6366f1" },
  { id: "whatsapp", label: "WhatsApp", color: "#22c55e" },
  { id: "linkedin", label: "LinkedIn", color: "#0ea5e9" },
  { id: "events", label: "Events", color: "#a855f7" },
  { id: "content", label: "Content", color: "#10b981" },
  { id: "paid", label: "Paid", color: "#f59e0b" },
  { id: "referral", label: "Referral", color: "#ec4899" },
]);

export const CAMPAIGN_STATUSES = opts([
  { id: "planned", label: "Planned", color: "#94a3b8" },
  { id: "active", label: "Active", color: "#10b981" },
  { id: "done", label: "Done", color: "#6366f1" },
]);

export const CONTENT_STATUSES = opts([
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "draft", label: "Draft", color: "#f59e0b" },
  { id: "scheduled", label: "Scheduled", color: "#6366f1" },
  { id: "published", label: "Published", color: "#10b981" },
]);

export const INVOICE_STATUSES = opts([
  { id: "draft", label: "Draft", color: "#94a3b8" },
  { id: "sent", label: "Sent", color: "#6366f1" },
  { id: "paid", label: "Paid", color: "#10b981" },
  { id: "overdue", label: "Overdue", color: "#ef4444" },
]);

export const EXPENSE_STATUSES = opts([
  { id: "planned", label: "Planned", color: "#94a3b8" },
  { id: "paid", label: "Paid", color: "#10b981" },
]);

export const EXPENSE_CATEGORIES = opts([
  { id: "tooling", label: "Tooling / SaaS", color: "#6366f1" },
  { id: "contractors", label: "Contractors", color: "#a855f7" },
  { id: "marketing", label: "Marketing", color: "#f43f5e" },
  { id: "infra", label: "Infrastructure", color: "#0ea5e9" },
  { id: "other", label: "Other", color: "#94a3b8" },
]);

export const TICKET_STATUSES = opts([
  { id: "open", label: "Open", color: "#ef4444" },
  { id: "pending", label: "Pending", color: "#f59e0b" },
  { id: "solved", label: "Solved", color: "#10b981" },
  { id: "closed", label: "Closed", color: "#94a3b8" },
]);

export const TICKET_PRIORITIES = opts([
  { id: "urgent", label: "Urgent", color: "#ef4444" },
  { id: "high", label: "High", color: "#f59e0b" },
  { id: "normal", label: "Normal", color: "#6366f1" },
  { id: "low", label: "Low", color: "#94a3b8" },
]);

export const ENTITIES: Option[] = [
  { value: "India", label: "India", subtitle: "Amounts in ₹ INR" },
  { value: "Netherlands", label: "Netherlands", subtitle: "Amounts in € EUR" },
  { value: "Global", label: "Global", subtitle: "Amounts in $ USD" },
];

/** Look up an option's label and colour, falling back to the raw id. */
export function optionOf(list: Option[], value: string | null | undefined): Option {
  return list.find((o) => o.value === value) ?? { value: value ?? "", label: value ?? "—" };
}

/** The labels that put a task on a department's surface (web: DEPARTMENT_LABELS). */
export const DEPARTMENT_LABELS = {
  sales: ["sales"],
  "customer-success": ["account-mgmt", "maintenance"],
  marketing: ["content", "social", "marketing-analytics", "market-research"],
} as const;
export type BusinessDepartment = keyof typeof DEPARTMENT_LABELS;

// ---- Money: every row is stored in its entity's currency ----

const INR_PER_UNIT: Record<string, number> = { INR: 1, USD: 83, EUR: 90 };
const ENTITY_CURRENCY: Record<string, string> = { India: "INR", Netherlands: "EUR", Global: "USD" };

export const entityCurrency = (entity: string | null | undefined): string => ENTITY_CURRENCY[entity ?? ""] ?? "INR";

/** Convert between currencies at the web's static rates. */
export function convert(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  return (amount * (INR_PER_UNIT[from] ?? 1)) / (INR_PER_UNIT[to] ?? 1);
}

/** Sum rows stored in different entity currencies, in one currency. */
export function sumIn<T extends { entity: string }>(rows: readonly T[], amountOf: (r: T) => number | null | undefined, to = "INR"): number {
  return Math.round(rows.reduce((s, r) => s + convert(amountOf(r) ?? 0, entityCurrency(r.entity), to), 0));
}

// ---- Reaching a contact ----

/** The digits wa.me wants for an Indian mobile number, or null when it isn't one. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}

export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
