import "server-only";

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { MAX_ATTEMPTS, backoffMs, shouldRetry } from "./webhook-retry";

export const WEBHOOK_EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.deleted",
  "issue.commented",
  "project.created",
  "page.created",
  "page.updated",
  "page.deleted",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function newWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deliver an event to every active webhook in the workspace that subscribes to
 * it. Signed with HMAC-SHA256 over the body (`X-Internal-Signature`).
 * Best-effort: never throws, bounded by a short timeout.
 *
 * Each delivery carries a stable `X-Internal-Delivery` id, reused across
 * retries. Receivers guard against replays, and without a server-issued id they
 * have to synthesise one from the payload — which collides for two genuinely
 * distinct events with the same body in the same millisecond, silently dropping
 * the second as a duplicate.
 *
 * Retries cover transport failures and 5xx only (see `webhook-retry.ts`): a 4xx
 * means the receiver understood and rejected the request, so repeating it just
 * repeats the rejection.
 *
 * Only the FIRST attempt is awaited. `dispatchWebhook` is awaited inside server
 * actions and API handlers, so a serially-retried delivery would add its whole
 * backoff to a user-facing create — three 5s timeouts plus 5s of backoff is a
 * 20s "Create issue" click. Retries are handed to `after()` instead, which runs
 * them once the response has been sent and, on Vercel, keeps the function alive
 * to finish them.
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
      const deliveryId = crypto.randomUUID();

      const send = async (): Promise<number | null> => {
        try {
          const res = await fetch(h.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "user-agent": "Internal-Webhooks/1.0",
              "x-internal-event": event,
              "x-internal-signature": `sha256=${sig}`,
              "x-internal-delivery": deliveryId,
            },
            body,
            signal: AbortSignal.timeout(5000),
          });
          return res.status;
        } catch {
          return null; // transport failure / timeout
        }
      };

      const record = (status: number | null) =>
        db
          .update(webhooks)
          .set({ lastStatus: status ?? 0, lastDeliveryAt: new Date() })
          .where(eq(webhooks.id, h.id))
          .catch(() => {});

      const first = await send();
      await record(first);
      if (!shouldRetry(first, 0)) return;

      // Everything past the first attempt happens off the response path.
      const retry = async () => {
        let status = first;
        for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
          await sleep(backoffMs(attempt - 1));
          status = await send();
          await record(status);
          if (!shouldRetry(status, attempt)) return;
        }
      };
      deferRetry(retry);
    }),
  );
}

/**
 * Run the retry chain after the response. `after()` only exists inside a request
 * scope, so seeds and scripts fall back to a detached promise — best-effort
 * either way, and never allowed to reject into the caller.
 */
function deferRetry(run: () => Promise<void>): void {
  try {
    after(() => run().catch(() => {}));
  } catch {
    void run().catch(() => {});
  }
}
