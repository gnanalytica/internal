import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { apiKeys, users, webhooks, workspaces } from "@/db/schema";

import { apiInvalidate } from "./invalidate";
import { generateApiKey } from "./keys";
import { apiKeyDto, cleanKeyName, integrationsDto, signInMethods, type ApiKeyDto, type IntegrationsDto, type SignInMethod } from "./settings-rules";

/** Every key in the workspace — integration keys and mobile sign-ins — newest first. */
export async function apiListApiKeys(workspaceId: string, currentKeyId: string): Promise<ApiKeyDto[]> {
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      kind: apiKeys.kind,
      createdBy: apiKeys.createdBy,
      createdByName: users.name,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.createdBy, users.id))
    .where(eq(apiKeys.workspaceId, workspaceId))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map((r) => apiKeyDto(r, currentKeyId));
}

/**
 * Mint an integration key, as Settings → API does. The plaintext is returned
 * here once and never stored; only its hash is.
 */
export async function apiCreateApiKey(workspaceId: string, userId: string | null, name: unknown): Promise<{ id: string; key: string; prefix: string; name: string }> {
  const { key, hash, prefix } = generateApiKey();
  const clean = cleanKeyName(name);
  const [created] = await db
    .insert(apiKeys)
    .values({ workspaceId, name: clean, keyHash: hash, keyPrefix: prefix, createdBy: userId })
    .returning({ id: apiKeys.id });
  apiInvalidate(workspaceId, "api");
  return { id: created.id, key, prefix, name: clean };
}

export async function apiRevokeApiKey(workspaceId: string, id: string): Promise<boolean> {
  const res = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.workspaceId, workspaceId), eq(apiKeys.id, id)))
    .returning({ id: apiKeys.id });
  if (res.length) apiInvalidate(workspaceId, "api");
  return res.length > 0;
}

export async function apiSetWebhookActive(workspaceId: string, id: string, active: boolean): Promise<boolean> {
  const res = await db
    .update(webhooks)
    .set({ active })
    .where(and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.id, id)))
    .returning({ id: webhooks.id });
  if (res.length) apiInvalidate(workspaceId, "api");
  return res.length > 0;
}

export async function apiIntegrations(workspaceId: string): Promise<IntegrationsDto> {
  const [ws] = await db
    .select({ githubRepo: workspaces.githubRepo, githubToken: workspaces.githubToken, slackWebhookUrl: workspaces.slackWebhookUrl })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return integrationsDto(ws ?? { githubRepo: null, githubToken: null, slackWebhookUrl: null });
}

/**
 * The sign-in methods linked to a person's account, read from Neon Auth's own
 * tables by email (the app's `users` row is matched to the auth user the same
 * way). Only the provider ids are selected — never a token or password hash.
 * Null when the auth tables can't be read, so the client can say so rather
 * than show a person no way to sign in.
 */
export async function apiSignInMethods(userId: string): Promise<SignInMethod[] | null> {
  const [me] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!me) return null;
  try {
    const res = await db.execute(sql`
      SELECT DISTINCT a."providerId" AS provider
      FROM neon_auth.account a
      JOIN neon_auth."user" u ON u.id = a."userId"
      WHERE lower(u.email) = lower(${me.email})`);
    const providers = (res.rows as { provider: string | null }[]).map((r) => r.provider).filter((p): p is string => !!p);
    return signInMethods(providers);
  } catch (err) {
    console.error("[api] sign-in methods unavailable", err);
    return null;
  }
}
