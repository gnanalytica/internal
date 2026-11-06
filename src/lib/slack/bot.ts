import "server-only";

import { createSlackAdapter } from "@chat-adapter/slack";
import { createPostgresState } from "@chat-adapter/state-pg";
import { Chat } from "chat";
import pg from "pg";

import { isSlackConfigured } from "./config";
import { register as registerAi } from "./handlers/ai";
import { register as registerCommands } from "./handlers/commands";
import { register as registerNotificationActions } from "./handlers/notifications-actions";
import { register as registerThreadSync } from "./handlers/thread-sync";
import { register as registerUnfurl } from "./handlers/unfurl";
import type { SlackBot } from "./types";

/**
 * The Slack bot: one Chat SDK instance with the Slack adapter, built on first
 * use. Nothing is constructed at import time — the adapter throws without a
 * signing secret, and `next build` imports this module with no env at all.
 *
 * State (dedupe of Slack's retried deliveries, thread locks, subscriptions,
 * short-lived tokens) lives in the app's own Neon database through
 * `@chat-adapter/state-pg`. The app's Drizzle client uses Neon's HTTP driver,
 * which has no sessions or transactions, so the state adapter gets its own
 * small node-postgres pool over the same (pooled) DATABASE_URL. The tables are
 * created by src/db/add-slack.ts, not on connect, so a cold start never runs
 * DDL.
 *
 * Each feature registers its handlers from its own module under handlers/, so
 * work on commands, unfurls, thread sync and the AI bot never touches this
 * file or each other.
 */

let instance: SlackBot | null = null;

function build(): SlackBot {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // A serverless instance handles one webhook at a time; a couple of
    // connections is plenty, and idle ones are let go quickly so a warm
    // instance doesn't pin pooler slots.
    max: 3,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const bot: SlackBot = new Chat({
    userName: "Internal",
    adapters: {
      slack: createSlackAdapter({
        botToken: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
      }),
    },
    state: createPostgresState({ client: pool, autoCreateSchema: false, keyPrefix: "internal" }),
    // Slack retries any delivery it doesn't see acknowledged within 3s.
    dedupeTtlMs: 10 * 60_000,
    logger: process.env.NODE_ENV === "production" ? "warn" : "info",
  });

  registerNotificationActions(bot);
  registerCommands(bot);
  registerUnfurl(bot);
  registerThreadSync(bot);
  registerAi(bot);
  return bot;
}

/** The bot, or null when Slack isn't configured (see config.ts). */
export function getBot(): SlackBot | null {
  if (!isSlackConfigured()) return null;
  if (!instance) instance = build();
  return instance;
}

/**
 * The bot, connected and ready to post from outside a webhook (a server
 * action, an `after()` job). Webhooks initialize it themselves.
 */
export async function getReadyBot(): Promise<SlackBot | null> {
  const bot = getBot();
  if (!bot) return null;
  await bot.initialize();
  return bot;
}

/** The Slack Web API client, for calls the Chat SDK doesn't wrap. */
export async function slackWebClient() {
  const bot = await getReadyBot();
  return bot ? bot.getAdapter("slack").webClient : null;
}
