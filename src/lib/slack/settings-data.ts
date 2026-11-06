import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { slackChannelRules, users } from "@/db/schema";
import { getReadyBot } from "./bot";
import { isSlackConfigured } from "./config";
import type { SlackRuleFilters } from "./events";

/** What Settings › Slack shows. Read per request: none of it is cached. */

export type SlackConnection =
  | { configured: false }
  | { configured: true; ok: true; botName: string; team: string; teamUrl: string | null }
  | { configured: true; ok: false; error: string };

export type SlackChannelOption = { id: string; name: string; isPrivate: boolean; isMember: boolean };

export type SlackRuleRow = {
  id: string;
  slackChannelId: string;
  slackChannelName: string;
  projectId: string | null;
  events: string[];
  filters: SlackRuleFilters;
};

export async function slackConnection(): Promise<SlackConnection> {
  if (!isSlackConfigured()) return { configured: false };
  try {
    const bot = await getReadyBot();
    const res = await bot!.getAdapter("slack").webClient.auth.test();
    return { configured: true, ok: true, botName: res.user ?? "Internal", team: res.team ?? "", teamUrl: res.url ?? null };
  } catch (err) {
    return { configured: true, ok: false, error: err instanceof Error ? err.message : "Slack didn't answer." };
  }
}

/**
 * Channels the picker offers: every channel the bot can see. Public channels
 * show whether the bot is in them (it can only post where it is); private ones
 * are only visible once it has been invited.
 */
export async function slackChannels(): Promise<SlackChannelOption[]> {
  const bot = await getReadyBot().catch(() => null);
  if (!bot) return [];
  const slack = bot.getAdapter("slack").webClient;
  const out: SlackChannelOption[] = [];
  let cursor: string | undefined;
  try {
    // A few pages at most; a workspace this size has dozens of channels.
    for (let page = 0; page < 5; page++) {
      const res = await slack.conversations.list({
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
        cursor,
      });
      for (const c of res.channels ?? []) {
        if (c.id && c.name) out.push({ id: c.id, name: c.name, isPrivate: Boolean(c.is_private), isMember: Boolean(c.is_member) });
      }
      cursor = res.response_metadata?.next_cursor || undefined;
      if (!cursor) break;
    }
  } catch (err) {
    console.warn("[slack] couldn't list channels:", err);
  }
  return out.sort((a, b) => Number(b.isMember) - Number(a.isMember) || a.name.localeCompare(b.name));
}

export async function slackRules(workspaceId: string): Promise<SlackRuleRow[]> {
  const rows = await db
    .select({
      id: slackChannelRules.id,
      slackChannelId: slackChannelRules.slackChannelId,
      slackChannelName: slackChannelRules.slackChannelName,
      projectId: slackChannelRules.projectId,
      events: slackChannelRules.events,
      filters: slackChannelRules.filters,
    })
    .from(slackChannelRules)
    .where(eq(slackChannelRules.workspaceId, workspaceId))
    .orderBy(asc(slackChannelRules.slackChannelName), asc(slackChannelRules.createdAt));
  return rows.map((r) => ({ ...r, filters: r.filters ?? {} }));
}

/** The signed-in person's Slack link, read fresh (the members cache may lag). */
export async function mySlackUserId(userId: string): Promise<string | null> {
  const [u] = await db.select({ slackUserId: users.slackUserId }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.slackUserId ?? null;
}
