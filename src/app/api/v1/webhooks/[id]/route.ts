import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { notFound, ok, withApiAuth } from "@/lib/api/http";

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
export const DELETE = withApiAuth(async (_req, auth, params: { id: string }) => {
  const { id } = params;
  const deleted = await db
    .delete(webhooks)
    .where(and(eq(webhooks.workspaceId, auth.workspaceId), eq(webhooks.id, id)))
    .returning({ id: webhooks.id });
  if (deleted.length === 0) return notFound("Webhook");
  return ok({ data: { id, deleted: true } });
});
