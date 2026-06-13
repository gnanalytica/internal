import { TeamsView } from "@/components/teams-view";
import { getTeams, getWorkspace } from "@/lib/data";

export default async function TeamsPage() {
  const ws = await getWorkspace();
  const teams = await getTeams(ws.id);
  return <TeamsView teams={teams} />;
}
