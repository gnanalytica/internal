import { RoadmapView } from "@/components/roadmap-view";
import { getRoadmap, getWorkspace } from "@/lib/data";

export default async function RoadmapPage() {
  const ws = await getWorkspace();
  const projects = await getRoadmap(ws.id);
  return <RoadmapView projects={projects} nowISO={new Date().toISOString()} />;
}
