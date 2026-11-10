import "server-only";

import { and, eq, gte, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { metricPoints, metrics } from "@/db/schema";
import { apiInvalidate } from "@/lib/api/invalidate";
import { loadScorecard } from "@/lib/scorecard-data";
import { isMonday, isScorecardArea, weekBounds, weekOf, weekPeriodDate } from "@/lib/scorecard";

import type { ApiAuth } from "./auth";
import { departmentOn, loadProjectMeta } from "./business-ops";
import { ApiInputError } from "./errors";
import { assertProjectVisible, assertSales } from "./scope";
import { scorecardView, type ScorecardView } from "./scorecard-view";

/**
 * The weekly scorecard for the REST API: the read the web's project page does
 * (`loadScorecard`) and the write its scorecard cells do (`setMetricWeekValue`),
 * keyed on the API caller instead of the session cookie.
 */

/** The role the web would read for this caller: a member signed in on their phone is a member. */
export const callerRole = (auth: Pick<ApiAuth, "scope">): string => (auth.scope.restricted ? "member" : "admin");

export type WeekValueResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Set (or clear, with `value: null`) a typed-in metric's number for one week.
 * The one write the web's scorecard cell (the `setMetricWeekValue` action) and
 * the API share. Counted metrics are refused: the app works those out itself.
 * Doesn't expire caches; each caller does, the way its runtime allows.
 */
export async function writeMetricWeekValue(workspaceId: string, input: { metricId: string; weekStart: string; value: number | null }): Promise<WeekValueResult> {
  if (!isMonday(input.weekStart)) return { ok: false, status: 400, message: "That week doesn't start on a Monday." };
  if (input.value !== null && !Number.isFinite(input.value)) return { ok: false, status: 400, message: "That isn't a number." };
  const owner = await db.query.metrics.findFirst({
    where: and(eq(metrics.id, input.metricId), eq(metrics.workspaceId, workspaceId)),
    columns: { id: true, source: true },
  });
  if (!owner) return { ok: false, status: 404, message: "That metric no longer exists." };
  if (owner.source !== "manual") return { ok: false, status: 422, message: "The app counts this one itself." };

  const { from, to } = weekBounds(input.weekStart);
  const inWeek = await db
    .select({ id: metricPoints.id })
    .from(metricPoints)
    .where(and(eq(metricPoints.metricId, owner.id), gte(metricPoints.periodDate, from), lt(metricPoints.periodDate, to)));
  // Neon's HTTP driver has no transactions: write the new number before
  // removing any extras, so a failure part way never loses the week.
  const [keep, ...extra] = inWeek;
  if (input.value === null) {
    if (inWeek.length) await db.delete(metricPoints).where(inArray(metricPoints.id, inWeek.map((p) => p.id)));
  } else {
    if (keep) {
      await db
        .update(metricPoints)
        .set({ value: input.value, periodDate: weekPeriodDate(input.weekStart) })
        .where(eq(metricPoints.id, keep.id));
    } else {
      await db.insert(metricPoints).values({ metricId: owner.id, periodDate: weekPeriodDate(input.weekStart), value: input.value });
    }
    if (extra.length) await db.delete(metricPoints).where(inArray(metricPoints.id, extra.map((p) => p.id)));
  }
  return { ok: true };
}

/**
 * One project's weekly scorecard, as the web's first tab shows it. Sales rows
 * follow the Sales rule (`loadScorecard` asks `canSeeDepartment("sales", role)`
 * with the caller's role), so a caller who may not open Sales gets none.
 */
export async function apiGetScorecard(auth: ApiAuth, projectId: string): Promise<ScorecardView> {
  assertProjectVisible(auth, projectId, "Project");
  const project = await loadProjectMeta(auth.workspaceId, projectId);
  if (!departmentOn(project, "analytics")) return scorecardView({ weeks: [], rows: [], notes: [] }, false);
  return scorecardView(await loadScorecard(auth.workspaceId, { id: project.id, key: project.key }, callerRole(auth)));
}

export type WeekValueInput = { metricId?: unknown; weekStart?: unknown; value?: unknown };

/**
 * Type this week's number into a manual row (or another week's, by its
 * Monday). `value: null` clears it. The metric must be on this project, and a
 * Sales row needs Sales, as reading it does.
 */
export async function apiSetScorecardValue(
  auth: ApiAuth,
  projectId: string,
  body: WeekValueInput,
): Promise<{ metricId: string; weekStart: string; value: number | null }> {
  assertProjectVisible(auth, projectId, "Project");
  if (typeof body.metricId !== "string" || !body.metricId) throw new ApiInputError("`metricId` is required.");
  if (body.weekStart !== undefined && typeof body.weekStart !== "string") throw new ApiInputError("`weekStart` must be a Monday, yyyy-mm-dd.");
  if (body.value !== null && typeof body.value !== "number") throw new ApiInputError("`value` must be a number, or null to clear the week.");
  const weekStart = (body.weekStart as string | undefined) ?? weekOf(new Date());
  const value = body.value as number | null;

  const [metric] = await db
    .select({ id: metrics.id, projectId: metrics.projectId, area: metrics.area })
    .from(metrics)
    .where(and(eq(metrics.workspaceId, auth.workspaceId), eq(metrics.id, body.metricId)))
    .limit(1);
  if (!metric || metric.projectId !== projectId) throw new ApiInputError("Metric not found.", 404);
  // An unknown area reads as Product on the scorecard, so only a real Sales row needs Sales.
  if (isScorecardArea(metric.area) && metric.area === "sales") assertSales(auth);

  const res = await writeMetricWeekValue(auth.workspaceId, { metricId: metric.id, weekStart, value });
  if (!res.ok) throw new ApiInputError(res.message, res.status);
  apiInvalidate(auth.workspaceId, "metrics", "projects");
  return { metricId: metric.id, weekStart, value };
}
