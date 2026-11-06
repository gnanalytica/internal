import "server-only";

import type { Message, Thread } from "chat";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { activity, issues } from "@/db/schema";
import { apiUpdateIssue } from "@/lib/api/ops";
import { audienceFor, notify } from "@/lib/notify";
import { actorIn } from "../actor";
import { mentionedSlackUsers, slackToMarkdown } from "../parse";
import { aiConversationKey, inboundVerdict, isAiParticipant, isDoneReaction } from "../sync-rules";
import { alreadySynced, commentFromSlack, issuesForThread } from "../threads";
import type { SlackBot } from "../types";
import { appUserForSlack } from "../users";

/**
 * Two-way thread sync for tasks. `slack_threads` links a task to a Slack
 * thread per channel — the card a channel rule posted (notify.ts), a thread
 * turned into a task with the "Create task" shortcut, or a card posted from
 * `/internal new`.
 *
 * - Slack → app (here): a person's reply in a linked thread becomes a task
 *   comment, authored by their linked app user, or by nobody with their Slack
 *   name kept as "Name via Slack" (`slack_comments`) — no stand-in users.
 * - App → Slack (mirror.ts): a new comment is posted into every linked thread
 *   as "Name: text", except the thread it came from.
 * - ✅ on a task thread's root card marks the task Done, as the reacter.
 *
 * Loop guard (sync-rules.ts): the bot's own posts — everything mirror.ts and
 * notify.ts write — are never read back, and a Slack-made comment is marked
 * before it is announced so it isn't echoed into its own thread.
 *
 * Not synced: edits and deletes (a Slack edit doesn't change the comment, nor
 * the reverse), files, and anything said to the AI bot — a reply that
 * @-mentions it, or a follow-up from someone already in its conversation in
 * that thread (`ai:conv:<threadId>`, see ai/conversation.ts). Replies are seen when the thread routes to `onNewMessage` or
 * `onSubscribedMessage`; one the SDK drops because another handler holds the
 * thread's lock (a long AI reply in progress) is missed.
 */

type SlackRawMessage = { ts?: string; thread_ts?: string; bot_id?: string; subtype?: string };

async function syncReply(bot: SlackBot, thread: Thread, message: Message): Promise<void> {
  const raw = (message.raw ?? {}) as SlackRawMessage;
  const slack = bot.getAdapter("slack");
  const { channel, threadTs } = slack.decodeThreadId(thread.id);
  const ts = raw.ts ?? message.id;
  const base = {
    isMe: message.author.isMe === true,
    isBot: message.author.isBot === true || Boolean(raw.bot_id),
    isMention: message.isMention === true,
    text: message.text,
    ts,
    threadTs: raw.thread_ts ?? threadTs,
  };
  // Cheap checks first: most channel messages are roots and stop here.
  if (inboundVerdict(base) !== "sync") return;
  // A follow-up from someone talking to the AI bot here is an instruction to it, not a task comment.
  const conv = await bot.getState().get(aiConversationKey(thread.id)).catch(() => null);
  if (inboundVerdict({ ...base, inAiConversation: isAiParticipant(conv, message.author.userId) }) !== "sync") return;

  const linked = await issuesForThread(channel, raw.thread_ts ?? threadTs);
  if (linked.length === 0) return;

  // Slack's markup, with mentions turned into names where Slack knows them.
  const rawText = (message.raw as { text?: string } | undefined)?.text ?? message.text;
  const mentions = mentionedSlackUsers(rawText).slice(0, 5);
  const names = new Map(
    (await Promise.all(mentions.map(async (id) => [id, (await bot.getUser(id).catch(() => null))?.fullName ?? ""] as const))).filter(
      ([, n]) => n,
    ),
  );
  const body = slackToMarkdown(rawText, names).trim();
  if (!body) return;

  for (const { issueId, workspaceId } of linked) {
    if (await alreadySynced(channel, ts, issueId)) continue;
    const [issue] = await db.select({ title: issues.title }).from(issues).where(eq(issues.id, issueId)).limit(1);
    if (!issue) continue;
    const author = await appUserForSlack(bot, workspaceId, message.author.userId);
    await commentFromSlack({
      workspaceId,
      issueId,
      issueTitle: issue.title,
      author,
      body,
      origin: {
        channel,
        threadTs: raw.thread_ts ?? threadTs,
        ts,
        slackUserId: message.author.userId,
        authorName: message.author.fullName || message.author.userName || null,
      },
    });
  }
}

export function register(bot: SlackBot): void {
  const onReply = (thread: Thread, message: Message) =>
    syncReply(bot, thread, message).catch((err) => console.error("[slack] thread reply wasn't synced:", err));

  // Unsubscribed threads (most task threads) and subscribed ones (where the AI
  // is talking) route to different handlers; a reply in either may be a comment.
  bot.onNewMessage(onReply);
  bot.onSubscribedMessage(onReply);

  bot.onReaction(async (event) => {
    if (!event.added || !isDoneReaction(event.rawEmoji)) return;
    const { channel, threadTs } = bot.getAdapter("slack").decodeThreadId(event.threadId);
    // Only the thread's root — the task's card, or the message it was made from.
    if (event.messageId !== threadTs) return;
    const linked = await issuesForThread(channel, threadTs);
    for (const { issueId, workspaceId } of linked) {
      const [issue] = await db
        .select({ title: issues.title, status: issues.status })
        .from(issues)
        .where(and(eq(issues.id, issueId), eq(issues.workspaceId, workspaceId)))
        .limit(1);
      if (!issue || issue.status === "done") continue;
      const me = await actorIn(bot, workspaceId, event.user.userId);
      if (!me) continue;
      await db.insert(activity).values({
        workspaceId,
        issueId,
        actorId: me.id,
        type: "status",
        data: { from: issue.status, to: "done" },
      });
      await apiUpdateIssue(workspaceId, issueId, { status: "done" });
      const target = { kind: "issue" as const, id: issueId };
      await notify({
        workspaceId,
        actorId: me.id,
        type: "status",
        target,
        userIds: await audienceFor(workspaceId, target, me.id),
        title: `${me.name} moved ${issue.title} to Done`,
      });
    }
  });
}
