import { queryOptions } from "@tanstack/react-query";

import { api, type ItemResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

/** The web's ScoreStatus: on track, behind, no number yet, or no target (trend only). */
export type ScoreStatus = "on" | "behind" | "empty" | "untargeted";
export type ScorecardArea = "sales" | "marketing" | "product" | "reliability";

export type ScorecardRow = {
  id: string;
  name: string;
  unit: string | null;
  area: ScorecardArea;
  /** "manual" when typed in, else the auto source the app counts it from. */
  source: string;
  target: number | null;
  targetDirection: "above" | "below";
  /** One per week, oldest first; the last is this week. */
  values: (number | null)[];
  now: number | null;
  status: ScoreStatus;
  targetLabel: string;
  editable: boolean;
  /** For a counted row, how the app counts it. */
  how: string | null;
};

export type Scorecard = {
  enabled: boolean;
  weeks: string[];
  thisWeek: string;
  areas: { id: ScorecardArea; label: string; from: string }[];
  rows: ScorecardRow[];
  summary: { on: number; behind: number; waiting: number; total: number };
  notes: string[];
};

/**
 * Under the project's metrics key, so anything that refreshes the metrics
 * (adding one, changing a target, pull-to-refresh) refreshes the scorecard too.
 */
export const scorecardQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["metrics", projectId, "scorecard"],
    queryFn: async () => (await api.get<ItemResponse<Scorecard>>(`/projects/${projectId}/scorecard`)).data,
  });

/**
 * Type a week's number into a typed-in row (null clears it). Shows at once,
 * then re-reads the scorecard so the status and summary follow; a failed save
 * puts the old number back.
 */
export async function setScorecardValue(projectId: string, row: ScorecardRow, weekStart: string, value: number | null): Promise<void> {
  const key = scorecardQuery(projectId).queryKey;
  const before = queryClient.getQueryData<Scorecard>(key);
  queryClient.setQueryData<Scorecard>(key, (old) =>
    old ? { ...old, rows: old.rows.map((r) => (r.id === row.id ? { ...r, now: value, values: [...r.values.slice(0, -1), value] } : r)) } : old,
  );
  try {
    await api.post(`/projects/${projectId}/scorecard`, { metricId: row.id, weekStart, value });
  } catch (e) {
    if (before) queryClient.setQueryData(key, before);
    throw e;
  } finally {
    await queryClient.invalidateQueries({ queryKey: key });
  }
}

/** A typed cell → a number, null for blank, or undefined when it isn't a number (web: parseCell). */
export function parseCell(text: string): number | null | undefined {
  const s = text.replace(/[,\s₹%]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** A scorecard number: whole numbers grouped the Indian way, fractions to two places (web: formatValue). */
export function formatScore(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** "9 Nov" — a week by its Monday (web: weekLabel). */
export function weekLabel(monday: string): string {
  return new Date(`${monday}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
