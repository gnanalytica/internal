import type { SlackBot } from "../types";

/**
 * Two-way thread sync: replies in a record's Slack thread become comments in
 * the app, and comments in the app reply in the thread. `slack_threads` maps
 * (record_type, record_id) ↔ (slack_channel_id, slack_thread_ts); notify.ts
 * opens those threads.
 *
 * Not built yet — reserved so that work lands here without touching bot.ts or
 * the other handler modules. See types.ts for the contract.
 */
export function register(bot: SlackBot): void {
  void bot;
}
