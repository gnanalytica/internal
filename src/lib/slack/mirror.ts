import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { comments, slackComments, users } from "@/db/schema";
import { getReadyBot } from "./bot";
import { isSlackConfigured } from "./config";
import { commentFromWebhook, mirrorTargets, mirrorText, viaSlackLabel } from "./sync-rules";
import { issueThreads } from "./threads";

/**
 * App → Slack half of thread sync: a new task comment, from anywhere (the web,
 * the API, a Slack thread, `/internal`), is posted as "Name: text" into every
 * Slack thread linked to the task — except the thread it came from. Channel
 * rules don't post comments into a thread that exists (notify.ts leaves those
 * to this), so each thread hears a comment once.
 *
 * Fire-and-forget in `after()`, like everything outbound.
 */
export function emitCommentMirror(workspaceId: string, event: string, data: unknown): void {
  if (!isSlackConfigured()) return;
  const c = commentFromWebhook(event, data);
  if (!c) return;
  try {
    after(() =>
      mirror(workspaceId, c.issueId, c.commentId).catch((err) => {
        console.error(`[slack] comment on ${c.issueId} wasn't mirrored:`, err);
      }),
    );
  } catch {
    // Not in a request scope (seeds, scripts).
  }
}

async function mirror(workspaceId: string, issueId: string, commentId: string | null): Promise<void> {
  const threads = await issueThreads(issueId);
  if (threads.length === 0) return;

  // The web's older payloads carried no comment id; the newest comment is the one just written.
  const [c] = await db
    .select({
      body: comments.body,
      createdAt: comments.createdAt,
      authorName: users.name,
      originChannel: slackComments.slackChannelId,
      originThreadTs: slackComments.slackThreadTs,
      slackName: slackComments.authorName,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .leftJoin(slackComments, eq(slackComments.commentId, comments.id))
    .where(
      commentId
        ? and(eq(comments.workspaceId, workspaceId), eq(comments.id, commentId))
        : and(eq(comments.workspaceId, workspaceId), eq(comments.issueId, issueId)),
    )
    .orderBy(desc(comments.createdAt))
    .limit(1);
  if (!c) return;

  const origin = c.originChannel && c.originThreadTs ? { channel: c.originChannel, threadTs: c.originThreadTs } : null;
  const targets = mirrorTargets(threads, origin, c.createdAt);
  if (targets.length === 0) return;

  const bot = await getReadyBot();
  if (!bot) return;
  const slack = bot.getAdapter("slack");
  const author = c.authorName ?? (origin ? viaSlackLabel(c.slackName) : null);
  const text = mirrorText(author, c.body);
  await Promise.all(
    targets.map((t) =>
      bot
        .thread(slack.encodeThreadId({ channel: t.channel, threadTs: t.ts }))
        .post({ raw: text })
        .catch((err) => console.warn(`[slack] couldn't mirror a comment into ${t.channel}:`, err)),
    ),
  );
}
