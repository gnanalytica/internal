import "server-only";

import { appBaseUrl } from "@/lib/email";

/**
 * The Slack app's environment. The bot is one Slack app installed in one
 * workspace, so its credentials are env vars rather than per-workspace rows:
 *
 *   SLACK_BOT_TOKEN       xoxb-… (OAuth & Permissions → Bot User OAuth Token)
 *   SLACK_SIGNING_SECRET  Basic Information → App Credentials → Signing Secret
 *   DATABASE_URL          the Chat SDK's state (dedupe, locks, subscriptions)
 *                         lives in the same Neon database, over its pooled URL
 *
 * With either Slack var unset everything Slack is a no-op: nothing is posted,
 * and the webhook route answers 503.
 */
export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET && process.env.DATABASE_URL);
}

/** Where links in Slack messages point — the same base the digest emails use. */
export function appUrl(): string {
  return appBaseUrl().replace(/\/+$/, "");
}
