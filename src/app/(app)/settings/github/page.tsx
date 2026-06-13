import { GithubSettings } from "@/components/github-settings";
import { getMyRole, getWorkspace } from "@/lib/data";
import { isGithubConnected } from "@/lib/github";

export const dynamic = "force-dynamic";

export default async function GithubSettingsPage() {
  const ws = await getWorkspace();
  const [role, connected] = await Promise.all([
    getMyRole(ws.id),
    isGithubConnected(ws.id),
  ]);
  return (
    <GithubSettings
      connected={connected}
      repo={ws.githubRepo}
      isAdmin={role === "admin"}
    />
  );
}
