import type { ActivityEntry } from "@/lib/prospects/parse";
import { stageIndex } from "@/lib/prospects/parse";
import { daysBetween, todayIST } from "@/lib/prospects/stats";
import type { Tone } from "@/lib/tones";

/**
 * Customer Success, customer first. A prospect at "Pilot running" or "Won" in
 * the prospects sheet is a customer; its deal (opened automatically from Demo
 * done on — see src/lib/prospects/deals.ts) carries the onboarding checklist,
 * requests hang off the deal, and check-ins are touches logged on the prospect,
 * so they land in the sheet's Activity tab like every other touch. Pure — the
 * reads are in customer-success-data.ts.
 */

/** Indexes into STAGES that make a prospect a customer: Pilot running, Won. */
export const CUSTOMER_STAGES: readonly number[] = [4, 5];
export const isCustomerStage = (stage: number): boolean => CUSTOMER_STAGES.includes(stage);

/* ---------- onboarding ---------- */

export const ONBOARDING_STEPS = [
  { id: "kickoff", title: "Kickoff call", hint: "Walk them through the workflow and how they work today" },
  { id: "setup", title: "Account and branding set up", hint: "Letterhead, signature, the banks they report to" },
  { id: "first-report", title: "First real report made", hint: "On a live case, not a sample" },
  { id: "accepted", title: "Report accepted by the bank", hint: "Ask on the next check-in" },
  { id: "check-ins", title: "Four weekly check-ins", hint: "Ticks itself after four check-ins" },
  { id: "asked-to-pay", title: "Asked to pay", hint: "Once the pilot has proved itself" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

/** The check-ins that tick "Four weekly check-ins" on their own. */
export const CHECK_INS_NEEDED = 4;

/** deals.onboarding: step id → ISO yyyy-mm-dd it was ticked. */
export type Onboarding = Record<string, string>;

export type StepState = {
  id: OnboardingStepId;
  title: string;
  hint: string;
  done: boolean;
  /** ISO date ticked by hand, if it was. */
  doneOn: string | null;
  /** Ticked because enough check-ins were logged, not by hand. */
  auto: boolean;
};

/**
 * Where a customer is in onboarding. Every step is ticked by hand, except
 * "Four weekly check-ins", which also ticks itself once CHECK_INS_NEEDED
 * touches have been logged since they became a customer. We can tell when that
 * was (see customerSince), so the count is automatic; ticking it by hand is
 * still allowed for check-ins that happened but were never logged.
 */
export function onboardingSteps(onboarding: Onboarding | null | undefined, checkInCount: number): StepState[] {
  const map = onboarding ?? {};
  return ONBOARDING_STEPS.map((s) => {
    const doneOn = map[s.id] ?? null;
    const auto = s.id === "check-ins" && checkInCount >= CHECK_INS_NEEDED;
    return { id: s.id, title: s.title, hint: s.hint, done: Boolean(doneOn) || auto, doneOn, auto };
  });
}

/** Steps done, and the step the customer is on (1-based; past the last when all are done). */
export function onboardingProgress(steps: StepState[]): { done: number; total: number; current: number } {
  const done = steps.filter((s) => s.done).length;
  const firstOpen = steps.findIndex((s) => !s.done);
  return { done, total: steps.length, current: firstOpen < 0 ? steps.length : firstOpen + 1 };
}

/** The new onboarding map after ticking or unticking a step. */
export function toggleStep(onboarding: Onboarding | null | undefined, step: OnboardingStepId, done: boolean, today: string): Onboarding {
  const next = { ...(onboarding ?? {}) };
  if (done) next[step] = next[step] ?? today;
  else delete next[step];
  return next;
}

/* ---------- when they became a customer, and their check-ins ---------- */

export type CustomerSince = {
  /** ISO yyyy-mm-dd. */
  date: string;
  /** The logged touch that made them a customer, when one did; it isn't a check-in. */
  activityId: string | null;
};

/**
 * When a prospect became a customer: the touch that moved them into Pilot
 * running or Won and kept them there (a prospect who went Pilot → Lost → Pilot
 * again counts from the second time). Touches with no status after are
 * skipped. When no logged touch shows it — the status was changed straight in
 * the sheet or on the record — fall back to the day their deal was opened.
 */
export function customerSince(activity: ActivityEntry[], dealCreatedAt: string | Date | null | undefined): CustomerSince | null {
  const ordered = activity.filter((a) => a.date && a.statusAfter.trim()).sort((a, b) => a.date!.localeCompare(b.date!) || a.loggedAt.localeCompare(b.loggedAt) || a.id.localeCompare(b.id));
  let since: CustomerSince | null = null;
  for (const a of ordered) {
    const customer = isCustomerStage(stageIndex(a.statusAfter));
    if (customer && !since) since = { date: a.date!, activityId: a.id || null };
    else if (!customer) since = null;
  }
  if (since) return since;
  if (!dealCreatedAt) return null;
  const ms = typeof dealCreatedAt === "string" ? Date.parse(dealCreatedAt) : dealCreatedAt.getTime();
  return Number.isFinite(ms) ? { date: todayIST(ms), activityId: null } : null;
}

/** Touches since they became a customer, newest first — the touch that made them one included. */
export function touchesSince(activity: ActivityEntry[], since: CustomerSince | null): ActivityEntry[] {
  const list = since ? activity.filter((a) => a.date && a.date >= since.date) : [];
  return list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.loggedAt.localeCompare(a.loggedAt) || b.id.localeCompare(a.id));
}

/** Check-ins: touches since they became a customer, not counting the touch that made them one. */
export function checkInCount(activity: ActivityEntry[], since: CustomerSince | null): number {
  return touchesSince(activity, since).filter((a) => !since?.activityId || a.id !== since.activityId).length;
}

/* ---------- requests ---------- */

export const REQUEST_VIA = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "call", label: "Call" },
  { id: "email", label: "Email" },
  { id: "visit", label: "Visit" },
] as const;
export type RequestVia = (typeof REQUEST_VIA)[number]["id"];
export const viaLabel = (v: string | null | undefined): string => REQUEST_VIA.find((x) => x.id === v)?.label ?? "";

/** A request's state as the customer sees it, from the ticket's status. */
export type RequestState = "waiting-us" | "waiting-them" | "answered";

export const REQUEST_STATES: { id: RequestState; label: string; tone: Tone; status: "open" | "pending" | "solved" }[] = [
  { id: "waiting-us", label: "Waiting on us", tone: "orange", status: "open" },
  { id: "waiting-them", label: "Waiting on them", tone: "gray", status: "pending" },
  { id: "answered", label: "Answered", tone: "blue", status: "solved" },
];

export function requestState(status: string): RequestState {
  if (status === "pending") return "waiting-them";
  if (status === "solved" || status === "closed") return "answered";
  return "waiting-us";
}

export const requestStateMeta = (s: RequestState) => REQUEST_STATES.find((x) => x.id === s)!;

/** A request waiting on us longer than this makes the customer need a call. */
export const REQUEST_WAIT_DAYS = 2;
/** No touch for longer than this and the customer needs a call. */
export const QUIET_DAYS = 7;
/** A customer younger than this, not yet checked in on, has just started. */
export const NEW_CUSTOMER_DAYS = 7;

/** "now", "5h", "2d", "3w" — a request's age at a glance. */
export function ageLabel(from: string | Date, now: number = Date.now()): string {
  const ms = now - (typeof from === "string" ? Date.parse(from) : from.getTime());
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "now";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 14 ? `${d}d` : `${Math.floor(d / 7)}w`;
}

/* ---------- health ---------- */

export type Health = "needs-call" | "fine" | "new";

export const HEALTH: Record<Health, { label: string; tone: Tone; rank: number }> = {
  "needs-call": { label: "Needs a call", tone: "orange", rank: 0 },
  new: { label: "Just started", tone: "gray", rank: 1 },
  fine: { label: "Doing fine", tone: "blue", rank: 2 },
};

/**
 * How a customer is doing, in the order the rules are checked:
 *
 * 1. Needs a call — a request has been waiting on us for more than two days.
 * 2. Just started — a customer for under a week and not checked in on since.
 *    (A brand-new customer isn't flagged just because the last sales touch
 *    was a while ago.)
 * 3. Needs a call — no touch in more than a week, or never touched.
 * 4. Doing fine — everything else.
 *
 * "Waiting since" for a request is when it last changed (a request reopened
 * when they write back starts waiting again then).
 */
export function customerHealth(input: {
  today: string;
  now?: number;
  since: CustomerSince | null;
  /** ISO date of the latest touch on the prospect, or null. */
  lastTouch: string | null;
  checkIns: number;
  requests: { status: string; updatedAt: string | Date }[];
}): Health {
  const now = input.now ?? Date.now();
  const waitingTooLong = input.requests.some((r) => {
    if (requestState(r.status) !== "waiting-us") return false;
    const at = typeof r.updatedAt === "string" ? Date.parse(r.updatedAt) : r.updatedAt.getTime();
    return now - at > REQUEST_WAIT_DAYS * 86_400_000;
  });
  if (waitingTooLong) return "needs-call";
  if (input.since && daysBetween(input.since.date, input.today) < NEW_CUSTOMER_DAYS && input.checkIns === 0) return "new";
  if (!input.lastTouch || daysBetween(input.lastTouch, input.today) > QUIET_DAYS) return "needs-call";
  return "fine";
}

/** "8 days ago", "Yesterday", "Today" — how long since a date, in days. */
export function daysAgo(iso: string | null, today: string): string {
  if (!iso) return "Never";
  const d = daysBetween(iso, today);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}
