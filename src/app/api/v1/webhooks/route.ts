import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { ApiInputError } from "@/lib/api/errors";
import { ok, withApiAuth } from "@/lib/api/http";
import { newWebhookSecret, WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/api/webhooks";

/** Webhooks registered for the key's workspace. Secrets are never returned. */
export const GET = withApiAuth(async (_req, auth) => {
  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      active: webhooks.active,
      lastStatus: webhooks.lastStatus,
      lastDeliveryAt: webhooks.lastDeliveryAt,
    })
    .from(webhooks)
    .where(eq(webhooks.workspaceId, auth.workspaceId));
  return ok({ data: rows, count: rows.length });
});

/**
 * Register a webhook, so an integration can wire its own delivery instead of a
 * human copying a `whsec_` between two settings screens — the step most likely
 * to be skipped or mistyped, and the one whose failure is silent (events simply
 * never arrive).
 *
 * **Idempotent on URL.** Re-connecting must not accumulate duplicate webhooks
 * that each deliver the same event. An existing registration for the same URL is
 * updated in place and its secret is ROTATED — the caller is proving it controls
 * that URL right now, and returning the old secret would mean storing a
 * plaintext secret we could hand back, which we deliberately do not do.
 */
export const POST = withApiAuth(async (req, auth) => {
  let body: { url?: unknown; events?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    throw new ApiInputError("Body must be JSON.");
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) throw new ApiInputError("`url` is required.");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiInputError("`url` must be an absolute URL.");
  }
  // https only: the secret authenticates the payload, but the payload itself
  // carries issue titles and status — cleartext delivery would leak them.
  if (parsed.protocol !== "https:") {
    throw new ApiInputError("`url` must be https.");
  }

  const requested = Array.isArray(body.events) ? body.events : [];
  const events = requested
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim())
    .filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e)) as WebhookEvent[];
  if (events.length === 0) {
    throw new ApiInputError(
      `\`events\` must contain at least one of: ${WEBHOOK_EVENTS.join(", ")}.`,
    );
  }

  const secret = newWebhookSecret();
  const [existing] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.workspaceId, auth.workspaceId), eq(webhooks.url, url)))
    .limit(1);

  if (existing) {
    await db
      .update(webhooks)
      .set({ secret, events, active: true })
      .where(eq(webhooks.id, existing.id));
    // 200, not 201: nothing new was created. A client that retries a
    // timed-out-but-successful registration can tell the difference.
    return ok({ data: { id: existing.id, url, events, secret } }, 200);
  }

  const [created] = await db
    .insert(webhooks)
    .values({
      workspaceId: auth.workspaceId,
      url,
      secret,
      events,
      active: true,
      createdBy: auth.userId,
    })
    .returning({ id: webhooks.id });

  return ok({ data: { id: created.id, url, events, secret } }, 201);
});
