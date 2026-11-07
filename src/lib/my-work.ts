import { PRIORITY_MAP, type PriorityId } from "@/lib/constants";
import { addDays, istDay } from "@/lib/scorecard";

/**
 * The Home page's "My work" list: every open task assigned to you, placed in
 * the first bucket it qualifies for. Buckets are derived from the due date and
 * status at render time and never stored, so nothing silently moves a task
 * between them — change the date or the status and the task follows.
 *
 * Days are India days (the team plans in IST), so a server in UTC and a laptop
 * in Amsterdam put a task due "today" in the same bucket.
 */
export type MyWorkBucketId =
  | "overdue"
  | "today"
  | "active"
  | "week"
  | "next"
  | "backlog"
  | "done";

export const MY_WORK_BUCKETS: {
  id: MyWorkBucketId;
  label: string;
  /** One line under the heading on the empty Home, and the header tooltip. */
  hint: string;
  /** Folded on first view: there to find, not to read every morning. */
  folded?: boolean;
}[] = [
  { id: "overdue", label: "Overdue", hint: "Past their due date and still open." },
  { id: "today", label: "Due today", hint: "Due before the end of today." },
  { id: "active", label: "In progress", hint: "Started or in review, not due today." },
  { id: "week", label: "Next 7 days", hint: "Due in the coming week." },
  { id: "next", label: "Up next", hint: "To do, due later or with no date." },
  { id: "backlog", label: "Backlog", hint: "Parked: not planned yet.", folded: true },
  { id: "done", label: "Done this week", hint: "Closed in the last seven days.", folded: true },
];

type Bucketable = {
  status: string;
  priority: string;
  dueDate: Date | string | null;
  updatedAt: Date | string;
  number: number;
};

const OPEN_ACTIVE = new Set(["in_progress", "in_review"]);
const CLOSED = new Set(["done", "canceled"]);

/** Which bucket a task belongs in, or null when it no longer belongs on Home. */
export function bucketOf(issue: Bucketable, now: Date | string | number): MyWorkBucketId | null {
  const today = istDay(now);
  if (CLOSED.has(issue.status)) {
    if (issue.status !== "done") return null;
    // Done this week: closed (last touched) within the last seven India days.
    return istDay(issue.updatedAt) >= addDays(today, -6) ? "done" : null;
  }
  const due = issue.dueDate ? istDay(issue.dueDate) : null;
  if (due && due < today) return "overdue";
  if (due && due === today) return "today";
  if (OPEN_ACTIVE.has(issue.status)) return "active";
  if (due && due <= addDays(today, 7)) return "week";
  if (issue.status === "backlog") return "backlog";
  return "next";
}

const rank = (p: string) => PRIORITY_MAP[p as PriorityId]?.rank ?? 9;
const dueMs = (d: Date | string | null) => (d ? new Date(d).getTime() : Number.POSITIVE_INFINITY);

/** Urgent first; started before not-started; then the earliest due; then newest number. */
export function compareMyWork(a: Bucketable, b: Bucketable): number {
  return (
    rank(a.priority) - rank(b.priority) ||
    Number(OPEN_ACTIVE.has(b.status)) - Number(OPEN_ACTIVE.has(a.status)) ||
    dueMs(a.dueDate) - dueMs(b.dueDate) ||
    b.number - a.number
  );
}

/** Done reads newest-first: what you just closed is what you look for. */
function compareDone(a: Bucketable, b: Bucketable): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function groupMyWork<T extends Bucketable>(
  issues: T[],
  now: Date | string | number,
): { id: MyWorkBucketId; items: T[] }[] {
  const by = new Map<MyWorkBucketId, T[]>(MY_WORK_BUCKETS.map((b) => [b.id, []]));
  for (const i of issues) {
    const b = bucketOf(i, now);
    if (b) by.get(b)!.push(i);
  }
  return MY_WORK_BUCKETS.map((b) => ({
    id: b.id,
    items: by.get(b.id)!.sort(b.id === "done" ? compareDone : compareMyWork),
  }));
}

const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
const DAY_MONTH = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export type DueTone = "overdue" | "today" | "soon" | "later";

/**
 * A due date as people say it: "Today", "Tomorrow", "Yesterday", a weekday
 * within the coming week, else "18 Nov". Always India time and a fixed locale,
 * so the server's render and the browser's agree.
 */
export function dueLabel(
  due: Date | string,
  now: Date | string | number,
  status = "todo",
): { text: string; tone: DueTone } {
  const today = istDay(now);
  const day = istDay(due);
  const closed = CLOSED.has(status);
  const tone: DueTone = closed
    ? "later"
    : day < today
      ? "overdue"
      : day === today
        ? "today"
        : day <= addDays(today, 6)
          ? "soon"
          : "later";
  let text: string;
  if (day === today) text = "Today";
  else if (day === addDays(today, 1)) text = "Tomorrow";
  else if (day === addDays(today, -1)) text = "Yesterday";
  else if (day > today && day <= addDays(today, 6)) text = WEEKDAY.format(new Date(due));
  else text = DAY_MONTH.format(new Date(due));
  return { text, tone };
}

/** "Friday, 6 November" for the Home header, India time. */
export function longDate(now: Date | string | number): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date(now));
}
