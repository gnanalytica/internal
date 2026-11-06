import { after } from "next/server";

import { getBot } from "@/lib/slack/bot";

/**
 * Everything Slack sends: Events API callbacks, interactivity (buttons,
 * selects, modals, shortcuts) and slash commands, all pointed here by
 * slack/manifest.json. The adapter verifies Slack's signature (and answers the
 * URL-verification challenge) before any handler runs, and acknowledges within
 * Slack's 3s; the handlers then run in `after()`.
 *
 * No route segment config: under Cache Components every route is dynamic.
 */
export async function POST(request: Request): Promise<Response> {
  const bot = getBot();
  if (!bot) return new Response("Slack isn't configured.", { status: 503 });
  return bot.webhooks.slack(request, {
    waitUntil: (task) => after(() => task),
  });
}
