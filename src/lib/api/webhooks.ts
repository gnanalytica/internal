import "server-only";

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { webhooks } from "@/db/schema";

export const WEBHOOK_EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.deleted",
  "issue.commented",
  "project.created",
  "page.created",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function newWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

/**
 * Deliver an event to every active webhook in the workspace that subscribes to
 * it. Signed with HMAC-SHA256 over the body (`X-Internal-Signature`).
 * Best-effort: never throws, bounded by a short timeout.
 */
export async function dispatchWebhook(
  workspaceId: string,
  event: WebhookEvent,
  data: unknown,
): Promise<void> {
  let hooks;
  try {
    hooks = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.active, true)));
  } catch {
    return;
  }
  const targets = hooks.filter((h) => {
    const evs = (h.events as string[]) ?? [];
    return evs.includes("*") || evs.includes(event);
  });
  if (targets.length === 0) return;

  const body = JSON.stringify({
    event,
    workspaceId,
    data,
    timestamp: new Date().toISOString(),
  });

  await Promise.allSettled(
    targets.map(async (h) => {
      const sig = crypto.createHmac("sha256", h.secret).update(body).digest("hex");
      try {
        const res = await fetch(h.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "Internal-Webhooks/1.0",
            "x-internal-event": event,
            "x-internal-signature": `sha256=${sig}`,
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        await db
          .update(webhooks)
          .set({ lastStatus: res.status, lastDeliveryAt: new Date() })
          .where(eq(webhooks.id, h.id));
      } catch {
        await db
          .update(webhooks)
          .set({ lastStatus: 0, lastDeliveryAt: new Date() })
          .where(eq(webhooks.id, h.id));
      }
    }),
  );
}
