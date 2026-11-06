"use server";

import crypto from "node:crypto";
import { Actions, Button, Card, CardText } from "chat";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { projects, slackChannelRules } from "@/db/schema";
import { getCurrentUser, getMyRole, getWorkspace } from "@/lib/data";
import { STAGES } from "@/lib/prospects/schema";
import { getReadyBot } from "./bot";
import { ACTION_LINK_CONFIRM, escapeMrkdwn, slackLink } from "./cards";
import { appUrl } from "./config";
import { SLACK_EVENT_TYPES, slackEventLabel, type SlackEventType } from "./events";
import { linkKey, type PendingLink } from "./handlers/notifications-actions";
import { clearSlackLink, resolveSlackUserId, setSlackLink } from "./users";

/**
 * Settings › Slack writes. Channel rules are admin-only; linking is each
 * person's own. Rules aren't cached anywhere (notify.ts reads them per event),
 * so there is no tag to expire — the page refreshes itself after each call.
 */

async function adminWorkspace() {
  const ws = await getWorkspace();
  if ((await getMyRole(ws.id)) !== "admin") throw new Error("Only admins can change where Slack notifications go.");
  return ws;
}

async function readyBot() {
  const bot = await getReadyBot();
  if (!bot) throw new Error("Slack isn't connected yet — see the setup steps on this page.");
  return bot;
}

const ruleSchema = z.object({
  id: z.uuid().optional(),
  channelId: z.string().regex(/^[CG][A-Z0-9]{6,}$/, "Pick a channel."),
  projectId: z.uuid().nullable(),
  events: z.array(z.enum(SLACK_EVENT_TYPES as [SlackEventType, ...SlackEventType[]])).min(1, "Pick at least one event."),
  minProspectStage: z
    .string()
    .nullable()
    .refine((s) => s === null || (STAGES as readonly string[]).includes(s), "Unknown prospect stage."),
});

export type SlackRuleInput = z.input<typeof ruleSchema>;

/** Create or edit a rule. The channel's name is read from Slack, so the bot must be able to see it. */
export async function saveSlackRule(input: SlackRuleInput): Promise<{ id: string; botInChannel: boolean }> {
  const ws = await adminWorkspace();
  const v = ruleSchema.parse(input);
  if (v.projectId) {
    const [p] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, ws.id), eq(projects.id, v.projectId)))
      .limit(1);
    if (!p) throw new Error("That project isn't in this workspace.");
  }
  const bot = await readyBot();
  const info = await bot
    .getAdapter("slack")
    .webClient.conversations.info({ channel: v.channelId })
    .catch(() => null);
  const channel = info?.channel;
  if (!channel?.name) throw new Error("Internal can't see that channel. Invite @Internal to it, then try again.");

  const filters = v.events.includes("prospect.stage_changed") && v.minProspectStage ? { minProspectStage: v.minProspectStage } : {};
  const values = {
    slackChannelId: v.channelId,
    slackChannelName: channel.name,
    projectId: v.projectId,
    events: [...new Set(v.events)],
    filters,
  };
  let id = v.id;
  if (id) {
    const res = await db
      .update(slackChannelRules)
      .set(values)
      .where(and(eq(slackChannelRules.id, id), eq(slackChannelRules.workspaceId, ws.id)))
      .returning({ id: slackChannelRules.id });
    if (res.length === 0) throw new Error("That rule no longer exists.");
  } else {
    const me = await getCurrentUser(ws.id);
    const [made] = await db
      .insert(slackChannelRules)
      .values({ ...values, workspaceId: ws.id, createdBy: me.id })
      .returning({ id: slackChannelRules.id });
    id = made.id;
  }
  return { id, botInChannel: Boolean(channel.is_member) };
}

export async function deleteSlackRule(id: string): Promise<void> {
  const ws = await adminWorkspace();
  await db
    .delete(slackChannelRules)
    .where(and(eq(slackChannelRules.id, z.uuid().parse(id)), eq(slackChannelRules.workspaceId, ws.id)));
}

/** Post a sample message to a rule's channel, to check the bot can post there. */
export async function sendSlackRuleTest(id: string): Promise<void> {
  const ws = await adminWorkspace();
  const [rule] = await db
    .select()
    .from(slackChannelRules)
    .where(and(eq(slackChannelRules.id, z.uuid().parse(id)), eq(slackChannelRules.workspaceId, ws.id)))
    .limit(1);
  if (!rule) throw new Error("That rule no longer exists.");
  const bot = await readyBot();
  const events = rule.events.map(slackEventLabel).join(", ");
  try {
    await bot.channel(`slack:${rule.slackChannelId}`).post({
      raw: `:wave: Test from *${escapeMrkdwn(ws.name)}* — this channel will hear about: ${escapeMrkdwn(events)}. ${slackLink(`${appUrl()}/settings/slack`, "Change in Settings › Slack")}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    throw new Error(
      /not_in_channel|channel_not_found/.test(msg)
        ? `Internal isn't in #${rule.slackChannelName}. Type /invite @Internal there, then try again.`
        : "Slack didn't take the message. Check the bot token and try again.",
    );
  }
}

export type LinkResult = { status: "linked" } | { status: "confirm-sent" } | { status: "not-found" };

/**
 * Link the signed-in person to their Slack account. With no input, by their
 * app email — the same match Slack interactions make on their own. With a
 * Slack email or member id, by a confirmation DM'd to that Slack account, so
 * nobody can link themselves to someone else's.
 */
export async function linkMySlack(input?: string): Promise<LinkResult> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const bot = await readyBot();
  const target = input?.trim() || me.email;
  const slackUserId = await resolveSlackUserId(bot, target);
  if (!slackUserId) return { status: "not-found" };

  if (!input?.trim()) {
    await clearSlackLink(me.id);
    if (!(await setSlackLink(me.id, slackUserId)))
      throw new Error("That Slack account is already linked to someone else in Internal.");
    return { status: "linked" };
  }

  const nonce = crypto.randomUUID();
  const pending: PendingLink = { userId: me.id, name: me.name, slackUserId };
  await bot.getState().set(linkKey(nonce), pending, 15 * 60_000);
  const dm = await bot.openDM(slackUserId);
  await dm.post({
    card: Card({
      children: [
        CardText(
          `*${escapeMrkdwn(me.name)}* (${escapeMrkdwn(me.email)}) asked to link this Slack account to their Internal account, so buttons in Slack act as them. Was that you?`,
        ),
        Actions([Button({ id: ACTION_LINK_CONFIRM, label: "Yes, link my account", style: "primary", value: nonce })]),
      ],
    }),
    fallbackText: "Confirm linking your Slack account to Internal",
  });
  return { status: "confirm-sent" };
}

export async function unlinkMySlack(): Promise<void> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  await clearSlackLink(me.id);
}
