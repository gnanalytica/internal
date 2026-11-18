/**
 * The weekly scorecard as the API sends it: what `loadScorecard` returns, with
 * the reads the web's ScorecardSection does in the browser done once here, so
 * the phone doesn't keep its own copy of the status rule. Pure.
 */
import type { ScorecardData } from "@/lib/scorecard-data";
import {
  AUTO_SOURCES,
  SCORECARD_AREAS,
  scoreStatus,
  summarize,
  targetLabel,
  type ScorecardArea,
  type ScorecardRow,
  type ScoreStatus,
} from "@/lib/scorecard";

export type ScorecardRowView = ScorecardRow & {
  /** This week's number (the last of `values`). */
  now: number | null;
  status: ScoreStatus;
  /** "60", "≤ 30", "—". */
  targetLabel: string;
  /** Typed in on the scorecard (source "manual"); the rest the app counts. */
  editable: boolean;
  /** For a counted row, how the app counts it. */
  how: string | null;
};

export type ScorecardView = {
  /** False when the project has Analytics off: the web shows no scorecard then. */
  enabled: boolean;
  /** The last five weeks by their Monday (yyyy-mm-dd), oldest first; the last is this week. */
  weeks: string[];
  thisWeek: string;
  /** The groups that have rows, in scorecard order. `from` is the web's group caption. */
  areas: { id: ScorecardArea; label: string; from: string }[];
  /** In scorecard order: grouped by area, each group in the metrics' own order. */
  rows: ScorecardRowView[];
  summary: { on: number; behind: number; waiting: number; total: number };
  notes: string[];
};

export function scorecardView(data: ScorecardData, enabled = true): ScorecardView {
  const rows = data.rows.map((r): ScorecardRowView => {
    const now = r.values[r.values.length - 1] ?? null;
    const counted = r.source !== "manual";
    return {
      ...r,
      now,
      status: scoreStatus(now, r.target, r.targetDirection),
      targetLabel: targetLabel(r.target, r.targetDirection),
      editable: !counted,
      how: counted ? AUTO_SOURCES[r.source as keyof typeof AUTO_SOURCES].how : null,
    };
  });
  const areas = SCORECARD_AREAS.filter((a) => rows.some((r) => r.area === a.id)).map((a) => ({ id: a.id, label: a.label, from: a.from }));
  const ordered = areas.flatMap((a) => rows.filter((r) => r.area === a.id));
  return {
    enabled,
    weeks: data.weeks,
    thisWeek: data.weeks[data.weeks.length - 1] ?? "",
    areas,
    rows: ordered,
    summary: summarize(ordered),
    notes: data.notes,
  };
}
