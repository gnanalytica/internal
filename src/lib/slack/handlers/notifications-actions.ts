import "server-only";

import type { ActionEvent } from "chat";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { activity, issues, users } from "@/db/schema";
import { apiUpdateIssue } from "@/lib/api/ops";
import { STATUS_MAP } from "@/lib/constants";
import { audienceFor, notify, subscribe } from "@/lib/notify";
import { ACTION_ASSIGN_ME, ACTION_LINK_CONFIRM, ACTION_OPEN, ACTION_SET_STATUS, decodeStatusValue, slackLink } from "../cards";
import { appUrl } from "../config";
import type { SlackBot } from "../types";
import { appUserForSlack, type AppUser } from "../users";

/**
 * The buttons on notification cards (notify.ts) and on the account-link DM
 * (settings-actions.ts). Each acts as the app user the Slack user is linked
 * to, through the same session-less writes the API uses (`apiUpdateIssue`
 * invalidates the cache tags the web's `updateIssue` does), plus the activity
 * row and inbox notifications the web writes. The card refreshes itself: the
 * write goes through `dispatchWebhook`, which announces the change back into
 * the card's thread.
 */

/** Only the clicker sees it; nothing at all when the card isn't in a thread (App Home). */
async function tell(event: ActionEvent, text: string): Promise<void> {
  await event.thread?.postEphemeral(event.user, { raw: text }, { fallbackToDM: false }).catch(() => null);
}

const settingsLink = () => slackLink(`${appUrl()}/settings/slack`, "Settings › Slack");

/** The issue a card is about, and who is acting on it — or a reason to stop, already told. */
async function actingOn(
  bot: SlackBot,
  event: ActionEvent,
  issueId: string | undefined,
): Promise<{ issue: typeof issues.$inferSelect; me: AppUser } | null> {
  if (!issueId) return null;
  const [issue] = await db.select().from(issues).where(eq(issues.id, issueId)).limit(1);
  if (!issue) {
    await tell(event, "That task no longer exists.");
    return null;
  }
  const me = await appUserForSlack(bot, issue.workspaceId, event.user.userId);
  if (!me) {
    await tell(
      event,
      `I don't know who you are in Internal yet — your Slack email doesn't match a member. Link your account in ${settingsLink()}, then try again.`,
    );
    return null;
  }
  return { issue, me };
}

export function register(bot: SlackBot): void {
  bot.onAction(ACTION_ASSIGN_ME, async (event) => {
    const ctx = await actingOn(bot, event, event.value);
    if (!ctx) return;
    const { issue, me } = ctx;
    if (issue.assigneeId === me.id) {
      await tell(event, "It's already yours.");
      return;
    }
    // Logged before the write: the announcement reads it to say who did it.
    await db.insert(activity).values({
      workspaceId: issue.workspaceId,
      issueId: issue.id,
      actorId: me.id,
      type: "assignee",
      data: { from: issue.assigneeId, to: me.id },
    });
    await apiUpdateIssue(issue.workspaceId, issue.id, { assigneeId: me.id });
    await subscribe(issue.workspaceId, me.id, "issue", issue.id);
  });

  bot.onAction(ACTION_SET_STATUS, async (event) => {
    const want = decodeStatusValue(event.value);
    if (!want) return;
    const ctx = await actingOn(bot, event, want.issueId);
    if (!ctx) return;
    const { issue, me } = ctx;
    if (issue.status === want.status) return;
    await db.insert(activity).values({
      workspaceId: issue.workspaceId,
      issueId: issue.id,
      actorId: me.id,
      type: "status",
      data: { from: issue.status, to: want.status },
    });
    await apiUpdateIssue(issue.workspaceId, issue.id, { status: want.status });
    // Watchers hear about it in the app as they would from the web.
    const target = { kind: "issue" as const, id: issue.id };
    await notify({
      workspaceId: issue.workspaceId,
      actorId: me.id,
      type: "status",
      target,
      userIds: await audienceFor(issue.workspaceId, target, me.id),
      title: `${me.name} moved ${issue.title} to ${STATUS_MAP[want.status].label}`,
    });
  });

  // Slack reports link-button clicks too; the browser has already opened the
  // link, so there is nothing to do but acknowledge.
  bot.onAction(ACTION_OPEN, async () => {});

  bot.onAction(ACTION_LINK_CONFIRM, async (event) => {
    const state = bot.getState();
    const key = linkKey(event.value ?? "");
    const pending = event.value ? await state.get<PendingLink>(key) : null;
    const done = (text: string) => event.adapter.editMessage(event.threadId, event.messageId, { raw: text }).catch(() => {});
    if (!pending) {
      await done("That link request has expired. Start again from Settings › Slack in Internal.");
      return;
    }
    if (pending.slackUserId !== event.user.userId) {
      await tell(event, "This confirmation was meant for someone else.");
      return;
    }
    await state.delete(key);
    try {
      await db
        .update(users)
        .set({ slackUserId: pending.slackUserId })
        .where(eq(users.id, pending.userId));
    } catch {
      // The unique index: this Slack account is linked to someone else.
      await done("This Slack account is already linked to another Internal account.");
      return;
    }
    await done(`:white_check_mark: Linked. You act as *${pending.name}* in Internal from Slack now.`);
  });
}

/** A link request waiting for its Slack-side confirmation (settings-actions.ts). */
export type PendingLink = { userId: string; name: string; slackUserId: string };

export const linkKey = (nonce: string) => `link:${nonce}`;
