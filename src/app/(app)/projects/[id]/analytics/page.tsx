import { notFound } from "next/navigation";

import { AnalyticsView } from "@/components/analytics-view";
import { isDepartmentEnabled } from "@/lib/departments";
import { getMetrics, getProject, getScorecardSignals, getWorkspace } from "@/lib/data";
import { loadWorkbook } from "@/lib/prospects/read";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { buildRows, prospectSignals, scorecardWeeks } from "@/lib/scorecard";

/**
 * The sales facts the scorecard counts, from the prospects sheet (Valytica
 * only). A sheet that can't be read leaves the sales rows blank rather than
 * taking the whole scorecard down.
 */
async function loadProspectSignals() {
  try {
    const wb = await loadWorkbook();
    return prospectSignals(wb.activity, [...wb.valuers, ...wb.firms, ...wb.rvos, ...wb.panels, ...wb.banks]);
  } catch (err) {
    console.error("scorecard: prospects sheet unreadable", err);
    return null;
  }
}

/**
 * The project's weekly scorecard. Auto numbers are counted here, at read
 * time, from the prospects sheet, deals, the content calendar and tasks;
 * typed-in numbers come from metric points.
 */
export default async function ProjectAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "analytics")) notFound();

  const [metrics, signals, prospects] = await Promise.all([
    getMetrics(ws.id, id),
    getScorecardSignals(ws.id, id),
    project.key === PROSPECTS_PRODUCT_KEY ? loadProspectSignals() : Promise.resolve(null),
  ]);
  const weeks = scorecardWeeks(new Date());
  const rows = buildRows(metrics, weeks, signals, prospects);

  const notes: string[] = [];
  if (!prospects && rows.some((r) => r.source.startsWith("sales.") && r.source !== "sales.dealsWon"))
    notes.push(
      project.key === PROSPECTS_PRODUCT_KEY
        ? "The Prospects sheet couldn't be read, so touches, demos and launch-ready leads are blank."
        : "Touches, demos and launch-ready leads are counted from Valytica's Prospects sheet, so they stay blank here.",
    );
  if (!signals.defects && rows.some((r) => r.source === "reliability.openDefects"))
    notes.push("No urgent or high task in this project is labelled bug or defect yet, so open defects stays blank. Label defects “bug” to count them.");

  return <AnalyticsView projectId={id} weeks={weeks} rows={rows} notes={notes} />;
}
