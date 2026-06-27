import { ProjectsView } from "@/components/projects-view";
import {
  getCycles,
  getProjectSummaries,
  getProjects,
  getProjectsWithCounts,
  getRoadmap,
  getWorkspace,
} from "@/lib/data";

export default async function ProjectsPage() {
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
      nowISO={new Date().toISOString()}
    />
  );
}
