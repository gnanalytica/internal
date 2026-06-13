import { SlackSettings } from "@/components/slack-settings";
import { getMyRole, getWorkspace } from "@/lib/data";
import { isSlackConnected } from "@/lib/slack";

export const dynamic = "force-dynamic";

export default async function SlackSettingsPage() {
  const ws = await getWorkspace();
  const [role, connected] = await Promise.all([
    getMyRole(ws.id),
    isSlackConnected(ws.id),
  ]);
  return <SlackSettings connected={connected} isAdmin={role === "admin"} />;
}
