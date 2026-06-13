import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";

/** Whether Slack is connected — never exposes the webhook URL. */
export async function isSlackConnected(workspaceId: string): Promise<boolean> {
  const [ws] = await db
    .select({ url: workspaces.slackWebhookUrl })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return Boolean(ws?.url);
}

/**
 * Best-effort Slack notification via the workspace's Incoming Webhook URL.
 * Never throws — Slack delivery should not break app actions.
 */
export async function notifySlack(workspaceId: string, text: string): Promise<void> {
  try {
    const [ws] = await db
      .select({ url: workspaces.slackWebhookUrl })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!ws?.url) return;
    await fetch(ws.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // swallow — notifications are non-critical
  }
}
