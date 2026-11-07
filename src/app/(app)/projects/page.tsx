import { todayISO } from "@/lib/roadmap";
import { ProjectsView, type ProjectTableRow, type ProjectsTab } from "@/components/projects-view";
import { canSeeConfidential } from "@/lib/departments";
import {
  getCycles,
  getMembers,
  getMyRole,
  getPortfolio,
  getProjectSummaries,
  getProjects,
  getProjectsWithCounts,
  getRoadmap,
  getWorkspace,
} from "@/lib/data";

const TABS: ProjectsTab[] = ["list", "timeline", "week"];

/**
 * The one place for every project: the portfolio (company focus, health,
 * progress, lead and milestone for each product and back-office area), the
 * timeline, and this week's cycles. It replaces the old Pulse home.
 */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab } = await searchParams;
  const initialTab = TABS.find((t) => t === tab) ?? "list";
  const ws = await getWorkspace();
  const [summaries, withCounts, portfolio, roadmapProjects, allProjects, cycles, members, role] =
    await Promise.all([
      getProjectSummaries(ws.id),
      getProjectsWithCounts(ws.id),
      getPortfolio(ws.id),
      getRoadmap(ws.id),
      getProjects(ws.id),
      getCycles(ws.id),
      getMembers(ws.id),
      getMyRole(ws.id),
    ]);

  const rows: ProjectTableRow[] = allProjects.map((p) => {
    const port = portfolio.find((r) => r.id === p.id);
    const summary = summaries.find((s) => s.id === p.id);
    const counts = withCounts.find((c) => c.id === p.id);
    const lead = members.find((m) => m.id === p.ownerId);
    const total = port?.totalIssues ?? counts?.issueCount ?? 0;
    const done = port?.doneIssues ?? counts?.doneCount ?? 0;
    return {
      id: p.id,
      name: p.name,
      key: p.key,
      color: p.color,
      kind: p.kind,
      description: p.tagline ?? p.description,
      confidential: p.confidential,
      enabledDepartments: p.enabledDepartments,
      health: port?.health ?? "none",
      lead: lead ? { name: lead.name, avatarColor: lead.avatarColor } : null,
      milestone: port?.milestoneName
        ? { name: port.milestoneName, target: port.milestoneTarget ? new Date(port.milestoneTarget).toISOString() : null }
        : null,
      done,
      total,
      open: summary?.openIssues ?? Math.max(total - done, 0),
    };
  });

  return (
    <ProjectsView
      rows={rows}
      bets={ws.bets ?? []}
      isAdmin={canSeeConfidential(role)}
      roadmapProjects={roadmapProjects}
      weeklyProjects={allProjects.filter((p) => p.kind === "project")}
      cycles={cycles}
      nowISO={todayISO()}
      initialTab={initialTab}
    />
  );
}
