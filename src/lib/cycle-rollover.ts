import "server-only";

import { and, asc, eq, gt, gte, inArray, max, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { activity, cycles, issues, projects } from "@/db/schema";
import { ceremonyTasksFor, isCadenceEmpty } from "@/lib/cycle-cadence";
import { cycleStatus, type Cycle } from "@/lib/types";

/**
 * Cycle rollover, shared by the "Move unfinished to next cycle" action and the
 * daily job that does it on its own. Kept out of `actions.ts` because anything
 * exported from a "use server" file is callable from the browser, and these
 * take a workspace id rather than reading it from the session.
 */

/** Terminal statuses — work that a closing cycle leaves behind rather than carries. */
export const FINISHED = ["done", "canceled"];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Stamp a project's cadence ceremonies into one cycle.
 *
 * Idempotent by task title, so it is safe on every cycle creation and safe to
 * re-run by hand after the cadence changes — an existing ceremony is left
 * alone and only genuinely new ones are added. Returns how many it created.
 */
export async function stampCadence(
  workspaceId: string,
  creatorId: string | null,
  cycle: { id: string; projectId: string; startDate: Date; endDate: Date },
): Promise<number> {
  const [project] = await db
    .select({ cadence: projects.cycleCadence })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, cycle.projectId)))
    .limit(1);
  if (!project || isCadenceEmpty(project.cadence)) return 0;

  const existing = await db
    .select({ title: issues.title })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.cycleId, cycle.id)));

  const tasks = ceremonyTasksFor(
    project.cadence,
    cycle,
    existing.map((e) => e.title),
  );
  if (tasks.length === 0) return 0;

  // Numbering restarts per project, matching createIssue.
  const [{ value: maxNumber }] = await db
    .select({ value: max(issues.number) })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.projectId, cycle.projectId)));

  await db.insert(issues).values(
    tasks.map((t, i) => ({
      workspaceId,
      projectId: cycle.projectId,
      cycleId: cycle.id,
      number: (maxNumber ?? 0) + 1 + i,
      title: t.title,
      type: t.type,
      priority: t.priority,
      status: "todo",
      estimate: t.estimate,
      dueDate: t.dueDate,
      creatorId,
      sortKey: `a${Date.now() + i}`,
    })),
  );

  return tasks.length;
}


/** Insert a cycle numbered after the project's last one. */
async function insertCycle(workspaceId: string, projectId: string, startDate: Date, endDate: Date): Promise<Cycle> {
  const [{ value: maxNumber }] = await db
    .select({ value: max(cycles.number) })
    .from(cycles)
    .where(and(eq(cycles.workspaceId, workspaceId), eq(cycles.projectId, projectId)));
  const number = (maxNumber ?? 0) + 1;
  const [created] = await db
    .insert(cycles)
    .values({ workspaceId, projectId, name: `Cycle ${number}`, number, startDate, endDate })
    .returning();
  return created;
}

/**
 * Move a cycle's unfinished work into the next one, creating it (same length,
 * starting where this one ends) when the project has no cycle still open after
 * it. Each moved task gets a `cycle` activity entry ({ from, to }), so the
 * cycle it left still knows what carried over.
 *
 * The target is the soonest cycle starting after this one that hasn't ended:
 * an earlier-created cycle that has also finished is no place to carry work.
 */
export async function rollOverCore(
  workspaceId: string,
  actorId: string | null,
  cycleId: string,
  opts: { createIfMissing: boolean; now: Date },
): Promise<{ movedCount: number; cycle: Cycle | null; created: boolean }> {
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.workspaceId, workspaceId), eq(cycles.id, cycleId)))
    .limit(1);
  if (!cycle) throw new Error("Cycle not found");

  const unfinished = await db
    .select({ id: issues.id, estimate: issues.estimate, pointsDone: issues.pointsDone })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.cycleId, cycleId), notInArray(issues.status, FINISHED)));

  const later = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.workspaceId, workspaceId), eq(cycles.projectId, cycle.projectId), gt(cycles.startDate, cycle.startDate)))
    .orderBy(asc(cycles.startDate));
  const existingNext = later.find((c) => cycleStatus(c, opts.now) !== "completed") ?? null;

  if (!existingNext && !opts.createIfMissing) return { movedCount: 0, cycle: null, created: false };

  // Created without its cadence: the ceremonies are about to arrive from the
  // cycle being rolled over, and stamping first would duplicate every one of
  // them — the title dedupe cannot see tasks that have not moved yet.
  const length = cycle.endDate.getTime() - cycle.startDate.getTime();
  // A new cycle starts where this one ended — or today, if that's already
  // past, so rolling over a long-finished cycle doesn't create one in the past.
  const today = new Date(opts.now);
  today.setUTCHours(0, 0, 0, 0);
  const start = cycle.endDate.getTime() >= today.getTime() ? cycle.endDate : today;
  const target = existingNext ?? (await insertCycle(workspaceId, cycle.projectId, start, new Date(start.getTime() + length)));

  if (unfinished.length > 0) {
    const ids = unfinished.map((i) => i.id);
    // The record goes first: there are no transactions on this driver, and if
    // the move failed after it, a re-run finds the tasks still here and
    // records them again — whereas a move without its record would lose the
    // points done here for good. Each entry keeps the estimate and done points
    // as they stood, which is what the old cycle is credited with.
    await db.insert(activity).values(
      unfinished.map((t) => ({
        workspaceId,
        issueId: t.id,
        actorId,
        type: "cycle",
        data: {
          from: cycle.id,
          to: target.id,
          fromName: cycle.name,
          toName: target.name,
          estimate: t.estimate,
          done: t.estimate == null ? 0 : Math.min(t.pointsDone ?? 0, t.estimate),
        },
      })),
    );
    // Carry only what's left: the estimate drops by the points done here, and
    // the progress starts again in the new cycle. Guarded on the old cycle, so
    // a task someone moved meanwhile is left alone.
    await db
      .update(issues)
      .set({
        cycleId: target.id,
        estimate: sql`case when ${issues.estimate} is null then null else greatest(${issues.estimate} - coalesce(${issues.pointsDone}, 0), 0) end`,
        pointsDone: null,
        updatedAt: new Date(),
      })
      .where(and(eq(issues.workspaceId, workspaceId), inArray(issues.id, ids), eq(issues.cycleId, cycle.id)));
  }

  // Now that the carried-over work is in place, fill whatever the cadence is
  // still missing. Only for a cycle we just created: re-stamping one the team
  // already has would resurrect ceremonies they deliberately deleted.
  if (!existingNext) {
    const [project] = await db.select({ ownerId: projects.ownerId }).from(projects).where(eq(projects.id, cycle.projectId)).limit(1);
    await stampCadence(workspaceId, actorId ?? project?.ownerId ?? null, target);
  }

  return { movedCount: unfinished.length, cycle: target, created: !existingNext };
}

/** What the daily job knows about a cycle when deciding whether to roll it. */
export type RolloverCandidate = {
  id: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  /** Tasks still open in it. */
  unfinished: number;
  /** Latest change to any task in it, or null. */
  lastTouched: Date | null;
};

/**
 * Which ended cycles the daily job rolls over. Pure, so the guard rails are
 * tested:
 *
 * - only cycles that ended in the last week, so the first run doesn't sweep
 *   every old cycle the team chose to leave;
 * - only with unfinished work, so nothing creates an empty next cycle;
 * - into a cycle that's still open when the project has one; otherwise a new
 *   one is created only if the ended cycle actually saw work (a task changed
 *   more than two days after it started — carried-in tasks arrive within a
 *   day of the start). An abandoned project stops after one hop instead of
 *   growing a cycle every week forever.
 */
export function planAutoRollovers(cands: RolloverCandidate[], now: Date): { id: string; create: boolean }[] {
  const out: { id: string; create: boolean }[] = [];
  for (const c of cands) {
    if (cycleStatus(c, now) !== "completed") continue;
    if (now.getTime() - c.endDate.getTime() > 7 * DAY) continue;
    if (c.unfinished === 0) continue;
    const openNext = cands.some((o) => o.projectId === c.projectId && o.startDate > c.startDate && cycleStatus(o, now) !== "completed");
    const worked = c.lastTouched !== null && c.lastTouched.getTime() > c.startDate.getTime() + 2 * DAY;
    if (openNext) out.push({ id: c.id, create: false });
    else if (worked) out.push({ id: c.id, create: true });
  }
  return out;
}

/**
 * The daily job: roll over every cycle `planAutoRollovers` picks, across
 * workspaces, with no acting member (activity shows it as the system). One
 * failure is logged and skipped, never stopping the rest. Returns what moved,
 * per workspace, so the caller can expire those workspaces' caches.
 */
export async function autoRollOverEndedCycles(now: Date): Promise<{ workspaceId: string; cycleId: string; moved: number; created: boolean }[]> {
  // Ended in the window, plus anything still open — the possible targets.
  const rows = await db.select().from(cycles).where(gte(cycles.endDate, new Date(now.getTime() - 8 * DAY)));
  if (!rows.length) return [];
  const stats = await db
    .select({
      cycleId: issues.cycleId,
      unfinished: sql<number>`count(*) filter (where ${notInArray(issues.status, FINISHED)})::int`,
      last: max(issues.updatedAt),
    })
    .from(issues)
    .where(inArray(issues.cycleId, rows.map((r) => r.id)))
    .groupBy(issues.cycleId);
  const byCycle = new Map(stats.map((s) => [s.cycleId, s]));
  const plan = planAutoRollovers(
    rows.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      startDate: c.startDate,
      endDate: c.endDate,
      unfinished: byCycle.get(c.id)?.unfinished ?? 0,
      lastTouched: byCycle.get(c.id)?.last ?? null,
    })),
    now,
  );
  const out: { workspaceId: string; cycleId: string; moved: number; created: boolean }[] = [];
  for (const p of plan) {
    const c = rows.find((r) => r.id === p.id)!;
    try {
      const res = await rollOverCore(c.workspaceId, null, c.id, { createIfMissing: p.create, now });
      out.push({ workspaceId: c.workspaceId, cycleId: c.id, moved: res.movedCount, created: res.created });
    } catch (err) {
      console.error("[cycles] auto rollover failed", c.id, err);
    }
  }
  return out;
}

/**
 * Tasks carried into and out of a cycle by rollover, read from the `cycle`
 * activity entries rollover writes. Each task counts once per direction even
 * if it bounced. Points are the task's estimate as it stands now.
 */
export async function getCarried(
  workspaceId: string,
  cycleId: string,
): Promise<{ in: { estimate: number | null; done: number }[]; out: { estimate: number | null; done: number }[]; outTo: string | null; inFrom: string | null }> {
  const rows = await db
    .select({ issueId: activity.issueId, data: activity.data, liveEstimate: issues.estimate })
    .from(activity)
    .innerJoin(issues, eq(issues.id, activity.issueId))
    .where(
      and(
        eq(activity.workspaceId, workspaceId),
        eq(activity.type, "cycle"),
        sql`(${activity.data}->>'from' = ${cycleId} or ${activity.data}->>'to' = ${cycleId})`,
      ),
    );
  const into = new Map<string, { estimate: number | null; done: number }>();
  const outOf = new Map<string, { estimate: number | null; done: number }>();
  let inFrom: string | null = null;
  let outTo: string | null = null;
  for (const r of rows) {
    const d = r.data as { from?: string; to?: string; estimate?: number | null; done?: number } | null;
    // As at rollover when the entry recorded it; older entries only have the live estimate.
    const snap = { estimate: d && "estimate" in d ? (d.estimate ?? null) : r.liveEstimate, done: d?.done ?? 0 };
    if (d?.to === cycleId) {
      // What arrived here is what was left: the estimate minus the part done before.
      into.set(r.issueId, { estimate: snap.estimate == null ? null : snap.estimate - snap.done, done: 0 });
      inFrom = d.from ?? inFrom;
    }
    if (d?.from === cycleId) {
      outOf.set(r.issueId, snap);
      outTo = d.to ?? outTo;
    }
  }
  const ids = [inFrom, outTo].filter((x): x is string => !!x);
  const names = new Map(
    ids.length
      ? (await db.select({ id: cycles.id, name: cycles.name }).from(cycles).where(and(eq(cycles.workspaceId, workspaceId), inArray(cycles.id, ids)))).map((c) => [c.id, c.name])
      : [],
  );
  return { in: [...into.values()], out: [...outOf.values()], inFrom: inFrom ? (names.get(inFrom) ?? null) : null, outTo: outTo ? (names.get(outTo) ?? null) : null };
}
