/**
 * The pure half of the projects & planning endpoints: which departments a
 * caller may open, which milestone a project is working towards, which cycle is
 * running, and how far work has got. Kept free of the database (and of the
 * clock — `now` is always passed in) so the rules can be unit-tested and so the
 * phone and the web read a project the same way.
 */
import { visibleDepartments } from "@/lib/departments";

import { canSeeFinance, canSeeSales, type ApiScope } from "./scope-rules";

export type Progress = { done: number; total: number; pct: number };

export const progressOf = (done: number, total: number): Progress => ({
  done,
  total,
  pct: total > 0 ? Math.round((done / total) * 100) : 0,
});

type DeptProject = {
  id: string;
  kind: string;
  enabledDepartments: string[] | null;
  ownerId: string | null;
};

export type DepartmentView = { slug: string; label: string; color: string };

/**
 * The department tabs this caller gets on a project — the web's
 * `visibleDepartments`, tightened to what the API will actually serve them:
 * Sales is for admins, Finance for admins and the project's own owner.
 * Operations have no departments.
 */
export function departmentsForCaller(
  project: DeptProject,
  caller: { scope: ApiScope; userId: string | null },
): DepartmentView[] {
  if (project.kind === "operation") return [];
  const isOwner = !!caller.userId && project.ownerId === caller.userId;
  const role = caller.scope.restricted ? "member" : "admin";
  return visibleDepartments(project.enabledDepartments, role, isOwner)
    .filter((d) => d.slug !== "sales" || canSeeSales(caller.scope))
    .filter((d) => d.slug !== "finance" || canSeeFinance(caller.scope, project.id))
    .map((d) => ({ slug: d.slug, label: d.label, color: d.color }));
}

type Dated = { targetDate: Date | string | null };

const time = (v: Date | string | null | undefined): number | null => {
  if (!v) return null;
  const t = (v instanceof Date ? v : new Date(v)).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * The milestone a project is working towards: the earliest one still ahead of
 * `now`, else the last one it had. Mirrors the portfolio on the web's home.
 */
export function currentMilestone<T extends Dated>(milestones: T[], now: Date): T | null {
  const sorted = [...milestones].sort((a, b) => {
    const ta = time(a.targetDate);
    const tb = time(b.targetDate);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
  const n = now.getTime();
  let pick: T | null = null;
  for (const m of sorted) {
    if (!pick) {
      pick = m;
      continue;
    }
    const t = time(m.targetDate);
    const current = time(pick.targetDate);
    if (t !== null && t >= n && (current === null || current < n)) pick = m;
  }
  return pick;
}

type CycleDates = { startDate: Date | string; endDate: Date | string };

export type CycleState = "upcoming" | "active" | "completed";

export function cycleState(c: CycleDates, now: Date): CycleState {
  const t = now.getTime();
  if (t < (time(c.startDate) ?? 0)) return "upcoming";
  if (t > (time(c.endDate) ?? 0)) return "completed";
  return "active";
}

/**
 * The cycle a project is in this week: the running one (the latest to start,
 * if two overlap), else the next to start, else none. A project between
 * cycles shows its next one rather than nothing, so "this week" still says
 * what is coming.
 */
export function activeCycle<T extends CycleDates>(cycles: T[], now: Date): T | null {
  const running = cycles
    .filter((c) => cycleState(c, now) === "active")
    .sort((a, b) => (time(b.startDate) ?? 0) - (time(a.startDate) ?? 0));
  if (running[0]) return running[0];
  const upcoming = cycles
    .filter((c) => cycleState(c, now) === "upcoming")
    .sort((a, b) => (time(a.startDate) ?? 0) - (time(b.startDate) ?? 0));
  return upcoming[0] ?? null;
}

/** Points the way burndown and velocity weigh them: no estimate counts as one. */
export function cyclePoints(issues: { status: string; estimate: number | null }[]): { total: number; done: number } {
  const counted = issues.filter((i) => i.status !== "canceled");
  const w = (i: { estimate: number | null }) => i.estimate ?? 1;
  return {
    total: counted.reduce((s, i) => s + w(i), 0),
    done: counted.filter((i) => i.status === "done").reduce((s, i) => s + w(i), 0),
  };
}

const HEALTH = new Set(["on_track", "at_risk", "off_track"]);

/** A status update's health, or "none" for anything the web would not show. */
export const healthOf = (h: string | null | undefined): "on_track" | "at_risk" | "off_track" | "none" =>
  h && HEALTH.has(h) ? (h as "on_track" | "at_risk" | "off_track") : "none";

/** A project colour the web can render: #rgb or #rrggbb. */
export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

/**
 * Fields that decide who may see a project's Finance (its owner) or steer its
 * strategy. The web only offers the owner picker to admins, and changing the
 * owner changes what Finance a member can open, so the API holds members to it.
 */
export const ADMIN_ONLY_PROJECT_FIELDS = ["ownerId", "strategistId"] as const;

export function adminOnlyFieldsIn(patch: Record<string, unknown>): string[] {
  return ADMIN_ONLY_PROJECT_FIELDS.filter((k) => Object.hasOwn(patch, k));
}
