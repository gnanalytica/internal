import "server-only";

import { getMetrics, getScorecardSignals } from "@/lib/data";
import { canSeeDepartment } from "@/lib/departments";
import { loadProspectSnapshot } from "@/lib/prospects/read";
import { PROSPECT_KINDS, PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { buildRows, prospectSignals, scorecardWeeks, type ScorecardRow } from "@/lib/scorecard";

export type ScorecardData = { weeks: string[]; rows: ScorecardRow[]; notes: string[] };

/**
 * The sales facts the scorecard counts, from the prospects sheet (Valytica
 * only). A sheet that can't be read leaves the sales rows blank rather than
 * taking the whole scorecard down.
 */
async function loadProspectSignals() {
  try {
    const snap = await loadProspectSnapshot();
    return prospectSignals(snap.activity, PROSPECT_KINDS.flatMap((k) => snap.rows[k]));
  } catch (err) {
    console.error("scorecard: prospects sheet unreadable", err);
    return null;
  }
}

/**
 * A project's weekly scorecard. Auto numbers are counted here, at read time,
 * from the prospects sheet, deals, the content calendar and tasks; typed-in
 * numbers come from metric points. Sales rows show to whoever may see the
 * Sales page they count from.
 */
export async function loadScorecard(
  workspaceId: string,
  project: { id: string; key: string },
  role: string,
): Promise<ScorecardData> {
  const canSeeSales = canSeeDepartment("sales", role);
  const [metrics, signals, prospects] = await Promise.all([
    getMetrics(workspaceId, project.id),
    getScorecardSignals(workspaceId, project.id),
    canSeeSales && project.key === PROSPECTS_PRODUCT_KEY ? loadProspectSignals() : Promise.resolve(null),
  ]);
  const weeks = scorecardWeeks(new Date());
  const rows = buildRows(metrics, weeks, signals, prospects).filter((r) => canSeeSales || r.area !== "sales");

  const notes: string[] = [];
  if (!prospects && rows.some((r) => r.source.startsWith("sales.") && r.source !== "sales.dealsWon"))
    notes.push(
      project.key === PROSPECTS_PRODUCT_KEY
        ? "The Prospects sheet couldn't be read, so touches, demos and launch-ready leads are blank."
        : "Touches, demos and launch-ready leads are counted from Valytica's Prospects sheet, so they stay blank here.",
    );
  if (!signals.defects && rows.some((r) => r.source === "reliability.openDefects"))
    notes.push("No urgent or high task in this project is labelled bug or defect yet, so open defects stays blank. Label defects “bug” to count them.");

  return { weeks, rows, notes };
}
