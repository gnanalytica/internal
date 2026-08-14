import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { notifications, subscriptions } from "@/db/schema";
import { notifySlack } from "@/lib/slack";

/** What a subscription can point at. Mirrors `favorites`. */
export const SUBSCRIBABLE = new Set(["issue", "page", "project"]);

export type NotificationType = "assigned" | "commented" | "mentioned" | "status";

export type NotifyTarget = { kind: "issue" | "page" | "project"; id: string };

/**
 * Follow something, if not already following. Safe to call on every event that
 * implies interest — commenting, being assigned, being mentioned — because the
 * unique index makes a repeat a no-op rather than a duplicate.
 */
export async function subscribe(
  workspaceId: string,
  userId: string,
  kind: string,
  targetId: string,
): Promise<void> {
  if (!SUBSCRIBABLE.has(kind)) return;
  await db
    .insert(subscriptions)
    .values({ workspaceId, userId, kind, targetId })
    .onConflictDoNothing();
}

/** Subscribe several people at once (e.g. everyone just added as an assignee). */
export async function subscribeMany(
  workspaceId: string,
  userIds: string[],
  kind: string,
  targetId: string,
): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0 || !SUBSCRIBABLE.has(kind)) return;
  await db
    .insert(subscriptions)
    .values(ids.map((userId) => ({ workspaceId, userId, kind, targetId })))
    .onConflictDoNothing();
}

/** Everyone following a thing, excluding one user (normally the actor). */
export async function subscriberIds(
  workspaceId: string,
  kind: string,
  targetId: string,
  exceptUserId?: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.kind, kind),
        eq(subscriptions.targetId, targetId),
        exceptUserId ? ne(subscriptions.userId, exceptUserId) : undefined,
      ),
    );
  return rows.map((r) => r.userId);
}

export async function unsubscribe(
  workspaceId: string,
  userId: string,
  kind: string,
  targetId: string,
): Promise<void> {
  await db
    .delete(subscriptions)
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.userId, userId),
        eq(subscriptions.kind, kind),
        eq(subscriptions.targetId, targetId),
      ),
    );
}

type NotifyInput = {
  workspaceId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  target?: NotifyTarget;
  /** Explicit recipients (e.g. the people @-mentioned). */
  userIds: string[];
};

/**
 * Create notifications and mirror them to Slack.
 *
 * Every notification in the app goes through here, so there is one place that
 * decides what "being notified" means. Slack delivery is best-effort and never
 * blocks the write — a broken webhook must not fail the comment that triggered
 * it.
 */
export async function notify(input: NotifyInput): Promise<number> {
  const recipients = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId);
  if (recipients.length === 0) return 0;

  await db.insert(notifications).values(
    recipients.map((userId) => ({
      workspaceId: input.workspaceId,
      userId,
      actorId: input.actorId,
      type: input.type,
      issueId: input.target?.kind === "issue" ? input.target.id : null,
      pageId: input.target?.kind === "page" ? input.target.id : null,
      projectId: input.target?.kind === "project" ? input.target.id : null,
      title: input.title,
      body: input.body ?? null,
    })),
  );

  // One Slack post per event, not per recipient — the channel doesn't need the
  // same line five times because five people are watching.
  void notifySlack(input.workspaceId, slackLine(input));

  return recipients.length;
}

function slackLine(input: NotifyInput): string {
  const body = input.body?.trim();
  return body ? `${input.title}\n> ${body}` : input.title;
}

/**
 * The recipients for an event on a target: everyone following it, plus anyone
 * explicitly named (a mention subscribes you whether or not you were before).
 */
export async function audienceFor(
  workspaceId: string,
  target: NotifyTarget,
  actorId: string,
  alsoNotify: string[] = [],
): Promise<string[]> {
  const following = await subscriberIds(workspaceId, target.kind, target.id, actorId);
  return [...new Set([...following, ...alsoNotify])].filter((id) => id && id !== actorId);
}

/** Whether these users are already following a target (for bulk UI checks). */
export async function subscribedSet(
  workspaceId: string,
  userIds: string[],
  kind: string,
  targetId: string,
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.kind, kind),
        eq(subscriptions.targetId, targetId),
        inArray(subscriptions.userId, userIds),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}
