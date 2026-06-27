import { WeeklyView } from "@/components/weekly-view";
import { getCycles, getProjects, getWorkspace } from "@/lib/data";

export default async function WeeklyPage() {
  const ws = await getWorkspace();
  const [projects, cycles] = await Promise.all([getProjects(ws.id), getCycles(ws.id)]);
  return (
    <WeeklyView
      projects={projects.filter((p) => p.kind === "project")}
      cycles={cycles}
      nowISO={new Date().toISOString()}
    />
  );
}
