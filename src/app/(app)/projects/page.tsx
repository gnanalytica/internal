import { todayISO } from "@/lib/roadmap";
import { ProjectsView, type ProjectsTab } from "@/components/projects-view";
import {
  getCycles,
  getProjectSummaries,
  getProjects,
  getProjectsWithCounts,
  getRoadmap,
  getWorkspace,
} from "@/lib/data";

const TABS: ProjectsTab[] = ["list", "timeline", "week"];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab } = await searchParams;
  const initialTab = TABS.find((t) => t === tab) ?? "list";
  const ws = await getWorkspace();
  const [projects, all, roadmapProjects, allProjects, cycles] = await Promise.all([
    getProjectSummaries(ws.id),
    getProjectsWithCounts(ws.id),
    getRoadmap(ws.id),
    getProjects(ws.id),
    getCycles(ws.id),
  ]);
  const ops = all.filter((p) => p.kind === "operation");
  return (
    <ProjectsView
      projects={projects}
      ops={ops}
      roadmapProjects={roadmapProjects}
      weeklyProjects={allProjects.filter((p) => p.kind === "project")}
      cycles={cycles}
      nowISO={todayISO()}
      initialTab={initialTab}
    />
  );
}
