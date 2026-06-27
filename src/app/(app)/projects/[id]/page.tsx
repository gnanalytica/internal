import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleDot, Compass, LifeBuoy, Megaphone, TrendingUp, Wallet } from "lucide-react";

import { ProjectDetail } from "@/components/project-detail";
import { ProjectModulesConfig } from "@/components/project-modules-config";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getBacklinks,
  getMembers,
  getMyRole,
  getProject,
  getProjectSummaries,
  getStatusUpdates,
  getWorkspace,
  isFavorite,
} from "@/lib/data";
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

  // Operations: the simple detail view (no departments).
  if (project.kind !== "project") {
    const [members, role, favorited, statusUpdates, backlinks] = await Promise.all([
      getMembers(ws.id),
      getMyRole(ws.id),
      isFavorite(ws.id, "project", id),
      getStatusUpdates(ws.id, id),
      getBacklinks(ws.id, "project", id),
    ]);
    return (
      <ProjectDetail
        project={project}
        members={members}
        isAdmin={role === "admin"}
        favorited={favorited}
        statusUpdates={statusUpdates}
        backlinks={backlinks}
      />
    );
  }

  // Projects: the department overview hub.
  const summary = (await getProjectSummaries(ws.id)).find((p) => p.id === id);
  if (!summary) notFound();

  const cards = [
    {
      slug: "features" as const,
      href: `/projects/${id}/features`,
      icon: <Compass className="size-4" />,
      label: "Features",
      stat: `${summary.openFeatures} open features`,
      tool: "Roadmap & specs",
    },
    {
      slug: "engineering" as const,
      href: `/projects/${id}/engineering`,
      icon: <CircleDot className="size-4" />,
      label: "Engineering",
      stat: `${summary.openIssues} open issues`,
      tool: "Linear-style issues",
    },
    {
      slug: "sales" as const,
      href: `/projects/${id}/sales`,
      icon: <TrendingUp className="size-4" />,
      label: "Sales",
      stat: `${formatMoney(summary.pipelineValue)} · ${summary.openDeals} open deals`,
      tool: "Apollo / HubSpot-style pipeline",
    },
    {
      slug: "marketing" as const,
      href: `/projects/${id}/marketing`,
      icon: <Megaphone className="size-4" />,
      label: "Marketing",
      stat: `${summary.activeCampaigns} active campaigns`,
      tool: "Campaigns & content calendar",
    },
    {
      slug: "finance" as const,
      href: `/projects/${id}/finance`,
      icon: <Wallet className="size-4" />,
      label: "Finance",
      stat: `${formatMoney(summary.revenue)} revenue`,
      tool: "Invoices & expenses",
    },
    {
      slug: "support" as const,
      href: `/projects/${id}/support`,
      icon: <LifeBuoy className="size-4" />,
      label: "Support",
      stat: `${summary.openTickets} open tickets`,
      tool: "Zendesk-style ticket queue",
    },
  ].filter((c) => isDepartmentEnabled(summary.enabledDepartments, c.slug));

  return (
    <div className="overflow-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {summary.description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{summary.description}</p>
        ) : (
          <span />
        )}
        <ProjectModulesConfig projectId={id} enabled={summary.enabledDepartments} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border bg-background p-4 shadow-sm transition-colors hover:border-foreground/20"
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
    </div>
  );
}
