import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, workspaceMembers } from "@/db/schema";
import { loadScope, type ApiScope } from "@/lib/api/scope";
import { canSeeConfidential } from "@/lib/departments";
import type { SlackBot } from "./types";
import { appUserForSlack, type AppUser } from "./users";

/**
 * Who a Slack user is when nothing in the request names a workspace — a slash
 * command, a shortcut, a pasted link. The app is one workspace in practice, but
 * a person's membership decides: their linked account's first workspace, or
 * (on first contact) the workspace their Slack email is a member of, which
 * links them via `appUserForSlack`.
 */

export type SlackActor = AppUser & { workspaceId: string; isAdmin: boolean };

async function roleIn(workspaceId: string, userId: string): Promise<string | null> {
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return m?.role ?? null;
}

/** The actor in a known workspace (a record's), or null if they aren't linked and can't be matched. */
export async function actorIn(bot: SlackBot, workspaceId: string, slackUserId: string): Promise<SlackActor | null> {
  const me = await appUserForSlack(bot, workspaceId, slackUserId);
  if (!me) return null;
  const role = await roleIn(workspaceId, me.id);
  return { ...me, workspaceId, isAdmin: canSeeConfidential(role ?? "member") };
}

/** The actor and their workspace, from the Slack user alone. */
export async function actorForSlack(bot: SlackBot, slackUserId: string): Promise<SlackActor | null> {
  const [linked] = await db
    .select({ id: users.id, name: users.name, email: users.email, workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .where(eq(users.slackUserId, slackUserId))
    .orderBy(asc(workspaceMembers.workspaceId))
    .limit(1);
  if (linked) {
    const { role, ...rest } = linked;
    return { ...rest, isAdmin: canSeeConfidential(role) };
  }

  const profile = await bot.getUser(slackUserId).catch(() => null);
  const email = profile?.email?.trim().toLowerCase();
  if (!email || profile?.isBot) return null;
  const [m] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .where(sql`lower(${users.email}) = ${email}`)
    .orderBy(asc(workspaceMembers.workspaceId))
    .limit(1);
  return m ? actorIn(bot, m.workspaceId, slackUserId) : null;
}

/** What the actor may see — the same rules the API applies to a member's key. */
export function scopeOf(actor: SlackActor): Promise<ApiScope> {
  return loadScope(actor.workspaceId, actor.id, actor.isAdmin);
}
