import { ProjectsView } from "@/components/projects-view";
import { getProductSummaries, getProjectsWithCounts, getWorkspace } from "@/lib/data";

export default async function ProjectsPage() {
  const ws = await getWorkspace();
  const [products, all] = await Promise.all([
    getProductSummaries(ws.id),
    getProjectsWithCounts(ws.id),
  ]);
  const ops = all.filter((p) => p.kind === "ops");
  return <ProjectsView products={products} ops={ops} />;
}
