import { SlackSettings } from "@/components/slack-settings";
import { getCurrentUser, getMyRole, getProjects, getWorkspace } from "@/lib/data";
import { isSlackConnected } from "@/lib/slack";
import { appUrl } from "@/lib/slack/config";
import { mySlackUserId, slackChannels, slackConnection, slackRules } from "@/lib/slack/settings-data";

export default async function SlackSettingsPage() {
  const ws = await getWorkspace();
  const [role, legacyConnected, me, projects, connection] = await Promise.all([
    getMyRole(ws.id),
    isSlackConnected(ws.id),
    getCurrentUser(ws.id),
    getProjects(ws.id),
    slackConnection(),
  ]);
  const isAdmin = role === "admin";
  const live = connection.configured && connection.ok;
  const [rules, channels, slackUserId] = await Promise.all([
    slackRules(ws.id),
    // Only an admin edits rules, so only an admin needs the channel picker.
    isAdmin && live ? slackChannels() : Promise.resolve([]),
    mySlackUserId(me.id),
  ]);
  return (
    <SlackSettings
      connection={connection}
      rules={rules}
      channels={channels}
      projects={projects.map((p) => ({ id: p.id, name: p.name, key: p.key }))}
      slackUserId={slackUserId}
      myEmail={me.email}
      isAdmin={isAdmin}
      legacyConnected={legacyConnected}
      webhookUrl={`${appUrl()}/api/slack/webhook`}
    />
  );
}
