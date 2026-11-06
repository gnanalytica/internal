import type { SlackBot } from "../types";

/**
 * Link unfurls: previews for internal.gnanalytica.com links pasted in Slack
 * (`link_shared`; the manifest already lists the domain). cards.ts has the
 * record card and records.ts reads a record by type and id.
 *
 * Not built yet — reserved so that work lands here without touching bot.ts or
 * the other handler modules. See types.ts for the contract.
 */
export function register(bot: SlackBot): void {
  void bot;
}
