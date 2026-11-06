import type { SlackAdapter } from "@chat-adapter/slack";
import type { Chat } from "chat";

/**
 * The bot every handler module registers on. Kept apart from bot.ts so the
 * handler modules can import the type without importing the bot (which
 * imports them).
 *
 * Contract for src/lib/slack/handlers/*.ts: export `register(bot: SlackBot)`,
 * which only attaches handlers (onAction, onSlashCommand, onModalSubmit,
 * onNewMention, …) and does no I/O. bot.ts calls each once, when the bot is
 * first built. Handlers run inside the webhook's `after()`, with no session:
 * resolve the person with `appUserForSlack` (users.ts) and call the
 * session-less server functions (src/lib/api/*-ops.ts), which invalidate the
 * same cache tags the web app's actions do.
 */
export type SlackBot = Chat<{ slack: SlackAdapter }>;
