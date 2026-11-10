import { notFound } from "next/navigation";
import { CircleDot, Compass, LifeBuoy, Megaphone, TrendingUp } from "lucide-react";

import { ScorecardSection } from "@/components/analytics-view";
import { DepartmentStrip, type DepartmentStat } from "@/components/department-strip";
import { FinanceView } from "@/components/finance-view";
import { OwnerPicker } from "@/components/owner-picker";
import { PeopleHRView } from "@/components/people-hr-view";
import { ProjectDetail } from "@/components/project-detail";
import { Restricted } from "@/components/restricted";
import { ProjectSchedule } from "@/components/project-schedule";
import {
  CONFIDENTIAL_DEPARTMENTS,
  canSeeConfidential,
  customerRequestsHref,
  isConfidentialDepartment,
  isDepartmentEnabled,
  issueBelongsToDepartment,
  type DepartmentSlug,
} from "@/lib/departments";
import {
  getBacklinks,
  getCurrentUser,
  getDatabases,
  getExpenses,
  getInvoices,
  getIssues,
  getMembersWithRole,
  getMyRole,
  getOrgRoles,
  getProject,
  getProjects,
  getProjectSummaries,
  getStatusUpdates,
  getWorkspace,
  isFavorite,
} from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";
import { formatCurrency } from "@/lib/currency";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { loadScorecard } from "@/lib/scorecard-data";

export default async function ProjectRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const [project, myRole] = await Promise.all([getProject(ws.id, id), getMyRole(ws.id)]);
  if (!project) notFound();

  // Confidential projects (Finance, People & HR) are founders-only.
  if (project.confidential && !canSeeConfidential(myRole)) {
    return <Restricted label={project.name} />;
  }

  // People & HR is the team home: directory + org chart + management.
  if (project.kind !== "project" && project.key === "PPL") {
    const [members, orgRoles, me, role] = await Promise.all([
      getMembersWithRole(ws.id),
      getOrgRoles(ws.id),
      getCurrentUser(ws.id),
      getMyRole(ws.id),
    ]);
    return (
      <PeopleHRView
        heading={project.name}
        members={members}
        orgRoles={orgRoles}
        currentUserId={me.id}
        isAdmin={role === "admin"}
      />
    );
  }

  // Finance is the company finance home: invoices + expenses across projects
  // (founders-only — guarded by the confidential check above).
  if (project.kind !== "project" && project.key === "FIN") {
    const [projects, invoicesList, expensesList] = await Promise.all([
      getProjects(ws.id),
      getInvoices(ws.id),
      getExpenses(ws.id),
    ]);
    return (
      <FinanceView
        heading={project.name}
        scopeProjectId={null}
        projects={projects.filter((p) => p.kind === "project")}
        initialInvoices={invoicesList}
        initialExpenses={expensesList}
      />
    );
  }

  // Operations: the simple detail view (no departments). IT also surfaces the
  // workspace databases (Tools & Subscriptions), folded in from the old top-level
  // Databases page.
  if (project.kind !== "project") {
    const [ctx, allIssues, role, favorited, statusUpdates, backlinks, databases] =
      await Promise.all([
        getTaskContext(ws.id),
        getIssues(ws.id),
        getMyRole(ws.id),
        isFavorite(ws.id, "project", id),
        getStatusUpdates(ws.id, id),
        getBacklinks(ws.id, "project", id),
        project.key === "IT" ? getDatabases(ws.id) : Promise.resolve([]),
      ]);
    return (
      <ProjectDetail
        project={project}
        issues={allIssues.filter((i) => i.projectId === id)}
        members={ctx.members}
        ctx={ctx}
        isAdmin={role === "admin"}
        favorited={favorited}
        statusUpdates={statusUpdates}
        backlinks={backlinks}
        databases={databases.map((d) => ({ id: d.id, name: d.name, icon: d.icon }))}
      />
    );
  }

  // Projects: the department overview hub, opening with the weekly scorecard
  // when the project has Analytics on (it used to be a tab of its own).
  const isAdmin = canSeeConfidential(myRole);
  const [summaries, allIssues, ctx, scorecard] = await Promise.all([
    getProjectSummaries(ws.id),
    getIssues(ws.id),
    getTaskContext(ws.id),
    isDepartmentEnabled(project.enabledDepartments, "analytics")
      ? loadScorecard(ws.id, { id, key: project.key }, isAdmin)
      : Promise.resolve(null),
  ]);
  const members = ctx.members;
  const summary = summaries.find((p) => p.id === id);
  if (!summary) notFound();
  const owner = members.find((m) => m.id === summary.ownerId) ?? null;

  // One headline number per department, from what that department's page
  // now shows. Counts only: nothing here reads the prospects sheet.
  const n = (v: number) => v.toLocaleString("en-IN");
  const plural = (v: number, one: string, many = `${one}s`) => (v === 1 ? one : many);

  const eng = summary.openIssuesByDepartment.engineering ?? 0;
  const stats: (DepartmentStat & { slug: DepartmentSlug })[] = [
    {
      slug: "product" as const,
      href: `/projects/${id}/product`,
      icon: <Compass className="size-3.5" />,
      label: "Product",
      value: n(summary.featuresNow),
      unit: `${plural(summary.featuresNow, "feature")} in Now`,
      extra: `${n(summary.feedbackCount)} feedback`,
    },
    {
      slug: "engineering" as const,
      href: `/projects/${id}/engineering`,
      icon: <CircleDot className="size-3.5" />,
      label: "Engineering",
      value: n(eng),
      unit: `open ${plural(eng, "ticket")}`,
    },
    {
      slug: "marketing" as const,
      href: `/projects/${id}/marketing`,
      icon: <Megaphone className="size-3.5" />,
      label: "Marketing",
      value: n(summary.piecesThisWeek),
      unit: `${plural(summary.piecesThisWeek, "piece")} this week`,
    },
    {
      slug: "sales" as const,
      href: `/projects/${id}/sales`,
      icon: <TrendingUp className="size-3.5" />,
      label: "Sales",
      value: n(summary.openDeals),
      unit: `open ${plural(summary.openDeals, "deal")}`,
      extra: `${formatCurrency(summary.pipelineValueInr, "INR")} pipeline`,
    },
    // Customer Success lives in Sales → Customers now, which only Valytica's
    // prospects workspace has; elsewhere there is no customer list to open.
    ...(project.key === PROSPECTS_PRODUCT_KEY
      ? [
          {
            slug: "customer-success" as const,
            href: customerRequestsHref(id),
            icon: <LifeBuoy className="size-3.5" />,
            label: "Customers",
            value: n(summary.openTickets),
            unit: `open ${plural(summary.openTickets, "request")}`,
          },
        ]
      : []),
  ]
    .filter((c) => isDepartmentEnabled(summary.enabledDepartments, c.slug))
    .filter((c) => canSeeConfidential(myRole) || !isConfidentialDepartment(c.slug));

  // The schedule spans every department, so it has to honour the same
  // confidentiality rule the cards do — otherwise a member would read a
  // finance task here that the Finance card hides from them.
  const scheduleIssues = allIssues
    .filter((i) => i.projectId === id)
    .filter(
      (i) =>
        canSeeConfidential(myRole) ||
        !CONFIDENTIAL_DEPARTMENTS.some((d) => issueBelongsToDepartment(i.labels, d)),
    );

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {summary.description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{summary.description}</p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {canSeeConfidential(myRole) ? (
              <OwnerPicker projectId={id} ownerId={summary.ownerId} members={members} />
            ) : (
              <span className="text-ui text-muted-foreground">
                Lead <span className="text-foreground">{owner?.name ?? "—"}</span>
              </span>
            )}
          </div>
        </div>
        {scorecard && <ScorecardSection projectId={id} weeks={scorecard.weeks} rows={scorecard.rows} notes={scorecard.notes} />}
        <DepartmentStrip stats={stats} />
        <ProjectSchedule projectId={id} issues={scheduleIssues} ctx={ctx} />
      </div>
    </div>
  );
}
