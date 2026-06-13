import { ProjectsView } from "@/components/projects-view";
import { getProjectsWithCounts, getWorkspace } from "@/lib/data";

export default async function ProjectsPage() {
  const ws = await getWorkspace();
  const projects = await getProjectsWithCounts(ws.id);
  return <ProjectsView projects={projects} />;
}
