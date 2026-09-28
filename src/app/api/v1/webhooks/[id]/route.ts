import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { notFound, ok, readJson, withAdminApiAuth } from "@/lib/api/http";
import { apiInvalidate } from "@/lib/api/invalidate";
import { apiSetWebhookActive } from "@/lib/api/settings-ops";
import { parseActive } from "@/lib/api/settings-rules";

/**
 * Pause or resume a webhook: `{ active: boolean }`. A paused webhook keeps its
 * URL and secret and receives nothing until it is resumed. Admins only.
 */
export const PATCH = withAdminApiAuth(async (req, auth, params: { id: string }) => {
  const active = parseActive(await readJson<{ active?: unknown }>(req));
  const updated = await apiSetWebhookActive(auth.workspaceId, params.id, active);
  if (!updated) return notFound("Webhook");
  return ok({ data: { id: params.id, active } });
});

/**
 * Remove a webhook.
 *
 * Needed so an integration can clean up after itself when a user disconnects
 * it. Without this, disconnecting leaves an active registration pointing at a
 * system that no longer accepts it: we keep delivering, every attempt fails,
 * and the workspace's webhook list fills with red `lastStatus` values nobody
 * can explain.
 *
 * Scoped to the key's workspace, so a key cannot delete another workspace's
 * webhook by guessing an id.
 */
export const DELETE = withAdminApiAuth(async (_req, auth, params: { id: string }) => {
  const { id } = params;
  const deleted = await db
    .delete(webhooks)
    .where(and(eq(webhooks.workspaceId, auth.workspaceId), eq(webhooks.id, id)))
    .returning({ id: webhooks.id });
  if (deleted.length === 0) return notFound("Webhook");
  apiInvalidate(auth.workspaceId, "api");
  return ok({ data: { id, deleted: true } });
});
