import { SlackSettings } from "@/components/slack-settings";
import { getMyRole, getWorkspace } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SlackSettingsPage() {
  const ws = await getWorkspace();
  const role = await getMyRole(ws.id);
  return (
    <SlackSettings
      connected={Boolean(ws.slackWebhookUrl)}
      isAdmin={role === "admin"}
    />
  );
}
