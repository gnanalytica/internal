import { and, eq, gte } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { deals, issues, milestones } from "@/db/schema";
import { Topbar } from "@/components/topbar";
import { Backdrop } from "@/components/strategy/backdrop";
import { StrategyEmptyState } from "@/components/strategy/empty-state";
import { FdvScorecard } from "@/components/strategy/fdv-scorecard";
import { InitiativesTraction } from "@/components/strategy/initiatives-traction";
import { PathToScale } from "@/components/strategy/path-to-scale";
import { UnitEconomics } from "@/components/strategy/unit-economics";
import { TipLayer } from "@/components/strategy/ui";
import { isDepartmentEnabled } from "@/lib/departments";
import { getProject, getWorkspace } from "@/lib/data";
import { applyAuto, collectAutoKeys, resolveAuto, type AutoValue, type DeriveCtx } from "@/lib/strategy-derive";
import type { StrategyModel } from "@/lib/strategy";

import "@/components/strategy/strategy.css";

function quarterStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
}

export default async function ProjectStrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "strategy")) notFound();

  const model = (project.strategyModel ?? null) as StrategyModel | null;

  const breadcrumb = [
    { label: project.name, href: `/projects/${id}` },
    { label: "Strategy" },
  ];

  if (!model) {
    return (
      <div className="flex h-full flex-col">
        <Topbar breadcrumb={breadcrumb} />
        <div className="flex-1 overflow-y-auto p-4">
          <StrategyEmptyState projectId={id} />
        </div>
        <TipLayer />
      </div>
    );
  }

  // Derivation context: milestone burn-up + won deals this quarter. Two plain
  // reads (Neon HTTP — no transactions), reduced in JS.
  const msRows = await db
    .select({ id: milestones.id, name: milestones.name })
    .from(milestones)
    .where(eq(milestones.projectId, id));
  const issueRows = await db
    .select({ milestoneId: issues.milestoneId, status: issues.status })
    .from(issues)
    .where(eq(issues.projectId, id));
  const msProgress = msRows.map((m) => {
    const rows = issueRows.filter((i) => i.milestoneId === m.id);
    return {
      id: m.id,
      name: m.name,
      total: rows.length,
      closed: rows.filter((i) => i.status === "done").length,
    };
  });
  const wonRows = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.projectId, id), eq(deals.stage, "won"), gte(deals.updatedAt, quarterStart())));

  const ctx: DeriveCtx = {
    pricingModel: project.pricingModel ?? null,
    milestones: msProgress,
    dealsWonThisQuarter: wonRows.length,
  };
  const auto: Record<string, AutoValue> = Object.fromEntries(
    collectAutoKeys(model).map((k) => [k, resolveAuto(k, ctx)]),
  );
  const resolved = applyAuto(model, auto);

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={breadcrumb} />
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
        <PathToScale model={resolved} projectId={id} />
        <FdvScorecard model={resolved} projectId={id} milestones={msProgress} />
        <InitiativesTraction model={resolved} projectId={id} milestones={msProgress} />
        <UnitEconomics pricingModel={project.pricingModel ?? null} />
        <Backdrop model={resolved} projectId={id} />
      </div>
      <TipLayer />
    </div>
  );
}
