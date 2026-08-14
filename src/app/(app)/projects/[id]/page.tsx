import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, CircleDot, Compass, LifeBuoy, Megaphone, TrendingUp } from "lucide-react";

import { FinanceView } from "@/components/finance-view";
import { OwnerPicker } from "@/components/owner-picker";
import { PeopleHRView } from "@/components/people-hr-view";
import { ProjectDetail } from "@/components/project-detail";
import { Restricted } from "@/components/restricted";
import { ProjectSchedule } from "@/components/project-schedule";
import {
  CONFIDENTIAL_DEPARTMENTS,
  canSeeConfidential,
  isConfidentialDepartment,
  isDepartmentEnabled,
  issueBelongsToDepartment,
} from "@/lib/departments";
import {
  getAccounts,
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
import { formatMoney } from "@/lib/matrix-format";

export default async function ProjectRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();

  // Confidential projects (Finance, People & HR) are founders-only.
  const myRole = await getMyRole(ws.id);
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
    const [projects, accounts, invoicesList, expensesList] = await Promise.all([
      getProjects(ws.id),
      getAccounts(ws.id),
      getInvoices(ws.id),
      getExpenses(ws.id),
    ]);
    return (
      <FinanceView
        heading={project.name}
        scopeProjectId={null}
        projects={projects.filter((p) => p.kind === "project")}
        accounts={accounts}
        initialInvoices={invoicesList}
        initialExpenses={expensesList}
      />
    );
  }

  // Operations: the simple detail view (no departments). IT also surfaces the
  // workspace databases (Tools & Subscriptions), folded in from the old top-level
  // Databases page.
  if (project.kind !== "project") {
    const [ctx, role, favorited, statusUpdates, backlinks, databases] =
      await Promise.all([
        getTaskContext(ws.id),
        getMyRole(ws.id),
        isFavorite(ws.id, "project", id),
        getStatusUpdates(ws.id, id),
        getBacklinks(ws.id, "project", id),
        project.key === "IT" ? getDatabases(ws.id) : Promise.resolve([]),
      ]);
    return (
      <ProjectDetail
        project={project}
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

  // Projects: the department overview hub.
  const [summaries, allIssues, ctx] = await Promise.all([
    getProjectSummaries(ws.id),
    getIssues(ws.id),
    getTaskContext(ws.id),
  ]);
  const members = ctx.members;
  const summary = summaries.find((p) => p.id === id);
  if (!summary) notFound();
  const owner = members.find((m) => m.id === summary.ownerId) ?? null;

  // Each department's own open task count, routed by the same labels its
  // surface uses. A department is more than its tasks, so the count sits
  // alongside whatever else that department runs on.
  const tasks = (slug: string) => summary.openIssuesByDepartment[slug] ?? 0;
  const withTasks = (slug: string, stat: string) =>
    tasks(slug) > 0 ? `${tasks(slug)} tasks · ${stat}` : stat;

  const cards = [
    {
      slug: "product" as const,
      href: `/projects/${id}/product`,
      icon: <Compass className="size-4" />,
      label: "Product",
      stat: withTasks("product", `${summary.openMilestones} open gates`),
      tool: "Milestones & tasks",
    },
    {
      slug: "engineering" as const,
      href: `/projects/${id}/engineering`,
      icon: <CircleDot className="size-4" />,
      label: "Engineering",
      stat: `${tasks("engineering")} open tasks`,
      tool: "Linear-style tasks",
    },
    {
      slug: "analytics" as const,
      href: `/projects/${id}/analytics`,
      icon: <BarChart3 className="size-4" />,
      label: "Analytics",
      stat: `${summary.metricCount} metrics`,
      tool: "KPIs & north-star",
    },
    {
      slug: "marketing" as const,
      href: `/projects/${id}/marketing`,
      icon: <Megaphone className="size-4" />,
      label: "Marketing",
      stat: withTasks("marketing", `${summary.activeCampaigns} active campaigns`),
      tool: "Campaigns & content calendar",
    },
    {
      slug: "sales" as const,
      href: `/projects/${id}/sales`,
      icon: <TrendingUp className="size-4" />,
      label: "Sales",
      stat: withTasks(
        "sales",
        `${formatMoney(summary.pipelineValue)} · ${summary.openDeals} open deals`,
      ),
      tool: "Apollo / HubSpot-style pipeline",
    },
    {
      slug: "customer-success" as const,
      href: `/projects/${id}/customer-success`,
      icon: <LifeBuoy className="size-4" />,
      label: "Customer Success",
      stat: withTasks("customer-success", `${summary.openTickets} open tickets`),
      tool: "Zendesk-style ticket queue",
    },
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
    <div className="overflow-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {summary.description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{summary.description}</p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {canSeeConfidential(myRole) ? (
            <OwnerPicker projectId={id} ownerId={summary.ownerId} members={members} />
          ) : (
            <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
              Owner {owner?.name ?? "—"}
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="glow hover-lift rounded-xl border bg-background p-4 shadow-sm hover:border-foreground/20"
          >
            <div className="flex items-center gap-2 font-medium">
              {c.icon}
              {c.label}
            </div>
            <div className="mt-2 text-sm">{c.stat}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.tool}</div>
          </Link>
        ))}
      </div>
      <ProjectSchedule projectId={id} issues={scheduleIssues} ctx={ctx} />
    </div>
  );
}
