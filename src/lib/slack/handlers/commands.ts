import type { SlackBot } from "../types";

/**
 * Slash commands and modals: `/internal …`, and the "Create task" message
 * shortcut (callback id `create_task_from_message`). Both are declared in
 * slack/manifest.json.
 *
 * Not built yet — reserved so that work lands here without touching bot.ts or
 * the other handler modules. See types.ts for the contract.
 */
export function register(bot: SlackBot): void {
  void bot;
}
