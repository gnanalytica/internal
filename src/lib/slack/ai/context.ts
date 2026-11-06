import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { slackChannelRules, users, workspaceMembers, workspaces } from "@/db/schema";
import { loadScope, type ApiScope } from "@/lib/api/scope";
import type { SlackBot } from "../types";
import { appUserForSlack } from "../users";
import type { Caller } from "./permissions";

/**
 * Who is asking, and in which workspace. The Slack app is installed in one
 * Slack workspace and the app runs one Internal workspace, so the workspace
 * is the one Slack is set up for (it has channel rules), or failing that the
 * oldest. The person is the member their Slack account is linked to — by
 * email the first time, as for every other Slack action (users.ts).
 */

export async function slackWorkspaceId(): Promise<string | null> {
  const [ruled] = await db
    .select({ id: slackChannelRules.workspaceId })
    .from(slackChannelRules)
    .orderBy(asc(slackChannelRules.createdAt))
    .limit(1);
  if (ruled) return ruled.id;
  const [first] = await db.select({ id: workspaces.id }).from(workspaces).orderBy(asc(workspaces.createdAt)).limit(1);
  return first?.id ?? null;
}

export type Asker = { caller: Caller; scope: ApiScope; email: string | null };

/** The caller as the bot treats them, and the scope their reads run with — re-read on every request, so a demotion holds at once. */
export async function askerFor(bot: SlackBot, workspaceId: string, slackUserId: string): Promise<Asker> {
  const me = await appUserForSlack(bot, workspaceId, slackUserId).catch(() => null);
  let isAdmin = false;
  if (me) {
    const [m] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, me.id)))
      .limit(1);
    isAdmin = m?.role === "admin";
  }
  const scope = await loadScope(workspaceId, me?.id ?? null, isAdmin);
  return { caller: { userId: me?.id ?? null, name: me?.name ?? null, isAdmin }, scope, email: me?.email ?? null };
}

/** Workspace members for name matching (id, name, email), straight from the database. */
export async function memberDirectory(workspaceId: string): Promise<{ id: string; name: string; email: string }[]> {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.name));
}
