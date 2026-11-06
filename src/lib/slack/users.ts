import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, workspaceMembers } from "@/db/schema";
import type { SlackBot } from "./types";

/**
 * Who a Slack user is in the app. Slack sends a member id (U…); the app knows
 * people by email. The first time someone acts from Slack we look up their
 * Slack profile's email (users:read.email) and, if it matches a member of the
 * workspace, remember the Slack id on `users.slack_user_id`. People whose
 * Slack email differs link by hand in Settings › Slack, confirmed from Slack.
 */

export type AppUser = { id: string; name: string; email: string };

/** A member of the workspace already linked to this Slack id. */
async function linkedMember(workspaceId: string, slackUserId: string): Promise<AppUser | null> {
  const [u] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .where(and(eq(users.slackUserId, slackUserId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);
  return u ?? null;
}

/**
 * Remember a Slack id on a person, unless they're already linked to another
 * one. Returns whether the link now holds. A Slack id already taken by someone
 * else fails on the unique index and comes back false.
 */
export async function setSlackLink(userId: string, slackUserId: string): Promise<boolean> {
  try {
    const res = await db
      .update(users)
      .set({ slackUserId })
      .where(and(eq(users.id, userId), isNull(users.slackUserId)))
      .returning({ id: users.id });
    if (res.length > 0) return true;
    const [u] = await db.select({ slackUserId: users.slackUserId }).from(users).where(eq(users.id, userId)).limit(1);
    return u?.slackUserId === slackUserId;
  } catch {
    return false;
  }
}

export async function clearSlackLink(userId: string): Promise<void> {
  await db.update(users).set({ slackUserId: null }).where(eq(users.id, userId));
}

/**
 * The app user a Slack user acts as in this workspace, linking them by email
 * on first contact. Null when they aren't a member, or their Slack email
 * doesn't match and they haven't linked by hand.
 */
export async function appUserForSlack(bot: SlackBot, workspaceId: string, slackUserId: string): Promise<AppUser | null> {
  const linked = await linkedMember(workspaceId, slackUserId);
  if (linked) return linked;

  const profile = await bot.getUser(slackUserId).catch(() => null);
  const email = profile?.email?.trim().toLowerCase();
  if (!email || profile?.isBot) return null;
  const [u] = await db
    .select({ id: users.id, name: users.name, email: users.email, slackUserId: users.slackUserId })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .where(and(sql`lower(${users.email}) = ${email}`, eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);
  // Someone already linked to a different Slack account keeps that link.
  if (!u || (u.slackUserId && u.slackUserId !== slackUserId)) return null;
  if (!(await setSlackLink(u.id, slackUserId))) return null;
  return { id: u.id, name: u.name, email: u.email };
}

/** A Slack member id from what someone typed: an id (U…/W…) or an email. */
export async function resolveSlackUserId(bot: SlackBot, input: string): Promise<string | null> {
  const v = input.trim();
  const slack = bot.getAdapter("slack").webClient;
  if (/^[UW][A-Z0-9]{6,}$/.test(v)) {
    const res = await slack.users.info({ user: v }).catch(() => null);
    return res?.user && !res.user.deleted && !res.user.is_bot ? v : null;
  }
  if (!v.includes("@")) return null;
  const res = await slack.users.lookupByEmail({ email: v }).catch(() => null);
  return res?.user?.id && !res.user.deleted && !res.user.is_bot ? res.user.id : null;
}
