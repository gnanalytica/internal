import { ProjectsView } from "@/components/projects-view";
import { getProjectSummaries, getProjectsWithCounts, getWorkspace } from "@/lib/data";

export default async function ProjectsPage() {
  const ws = await getWorkspace();
  const [projects, all] = await Promise.all([
    getProjectSummaries(ws.id),
    getProjectsWithCounts(ws.id),
  ]);
  const ops = all.filter((p) => p.kind === "operation");
  return <ProjectsView projects={projects} ops={ops} />;
}
