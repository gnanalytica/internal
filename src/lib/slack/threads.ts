import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { issues, slackChannelRules, slackComments, slackThreads } from "@/db/schema";
import { apiCreateComment } from "@/lib/api/ops";
import { audienceFor, notify, subscribe } from "@/lib/notify";
import { channelsFor, type SlackEventType } from "./events";
import type { LinkedThread } from "./sync-rules";
import type { AppUser } from "./users";

/**
 * `slack_threads` for tasks, both ways round, and comments written from Slack.
 * notify.ts opens a record's thread when a channel rule first announces it;
 * the "Create task" shortcut and `/internal new` link the thread they post in.
 */

/**
 * Make (channel, ts) the task's thread in that channel. A row already there —
 * a channel rule announced the task a moment earlier — is repointed, so the
 * thread people are actually talking in is the one that stays in sync.
 */
export async function linkIssueThread(workspaceId: string, issueId: string, channel: string, threadTs: string): Promise<void> {
  await db
    .insert(slackThreads)
    .values({ workspaceId, recordType: "issue", recordId: issueId, slackChannelId: channel, slackThreadTs: threadTs })
    .onConflictDoUpdate({
      target: [slackThreads.recordType, slackThreads.recordId, slackThreads.slackChannelId],
      set: { slackThreadTs: threadTs },
    });
}

/** Every Slack thread linked to a task. */
export async function issueThreads(issueId: string): Promise<LinkedThread[]> {
  const rows = await db
    .select({ channel: slackThreads.slackChannelId, ts: slackThreads.slackThreadTs, createdAt: slackThreads.createdAt })
    .from(slackThreads)
    .where(and(eq(slackThreads.recordType, "issue"), eq(slackThreads.recordId, issueId)));
  return rows;
}

/** The tasks a Slack thread is linked to (usually one), with their workspace. */
export async function issuesForThread(channel: string, threadTs: string): Promise<{ issueId: string; workspaceId: string }[]> {
  return db
    .select({ issueId: issues.id, workspaceId: issues.workspaceId })
    .from(slackThreads)
    .innerJoin(issues, eq(issues.id, slackThreads.recordId))
    .where(
      and(
        eq(slackThreads.slackChannelId, channel),
        eq(slackThreads.slackThreadTs, threadTs),
        eq(slackThreads.recordType, "issue"),
      ),
    );
}

/** Whether a channel rule will itself post this event for the record in that channel. */
export async function ruleWillPost(
  workspaceId: string,
  channel: string,
  type: SlackEventType,
  projectId: string | null,
): Promise<boolean> {
  const rules = await db
    .select({
      id: slackChannelRules.id,
      slackChannelId: slackChannelRules.slackChannelId,
      projectId: slackChannelRules.projectId,
      events: slackChannelRules.events,
      filters: slackChannelRules.filters,
    })
    .from(slackChannelRules)
    .where(and(eq(slackChannelRules.workspaceId, workspaceId), eq(slackChannelRules.slackChannelId, channel)));
  return channelsFor(rules, { type, projectId }).includes(channel);
}

/** Where a comment from a Slack thread came from. */
export type SlackOrigin = {
  channel: string;
  threadTs: string;
  ts: string;
  slackUserId: string;
  /** The Slack name, kept when the author isn't linked (shown as "Name via Slack"). */
  authorName: string | null;
};

/**
 * Comment on a task as someone in Slack: the linked app user, or — when Slack
 * can't place them — no author, with their Slack name kept beside the comment.
 * Watchers are told in the app as they are for a web comment. With `origin`,
 * the comment is marked as Slack's before it is announced, so the announcement
 * isn't echoed back into the thread it came from.
 */
export async function commentFromSlack(input: {
  workspaceId: string;
  issueId: string;
  issueTitle: string;
  author: AppUser | null;
  body: string;
  origin?: SlackOrigin;
}): Promise<string> {
  const { workspaceId, issueId, author, origin } = input;
  const id = await apiCreateComment(workspaceId, author?.id ?? null, issueId, input.body, {
    beforeAnnounce: origin
      ? async (commentId) => {
          await db
            .insert(slackComments)
            .values({
              commentId,
              workspaceId,
              issueId,
              slackChannelId: origin.channel,
              slackThreadTs: origin.threadTs,
              slackTs: origin.ts,
              slackUserId: origin.slackUserId,
              authorName: author ? null : origin.authorName,
            })
            .onConflictDoNothing();
        }
      : undefined,
  });
  if (author) {
    const target = { kind: "issue" as const, id: issueId };
    await subscribe(workspaceId, author.id, "issue", issueId);
    await notify({
      workspaceId,
      actorId: author.id,
      type: "commented",
      target,
      userIds: await audienceFor(workspaceId, target, author.id),
      title: `${author.name} commented on ${input.issueTitle}`,
      body: input.body.slice(0, 140),
    });
  }
  return id;
}

/** Whether this Slack message already became a comment on this task (a redelivery). */
export async function alreadySynced(channel: string, ts: string, issueId: string): Promise<boolean> {
  const [r] = await db
    .select({ id: slackComments.commentId })
    .from(slackComments)
    .where(and(eq(slackComments.slackChannelId, channel), eq(slackComments.slackTs, ts), eq(slackComments.issueId, issueId)))
    .limit(1);
  return Boolean(r);
}
