import "server-only";

import { cardToBlockKit, cardToFallbackText } from "@chat-adapter/slack";
import type { CardElement, Channel, Thread } from "chat";

import type { SlackBot } from "./types";

/**
 * Telling one person something privately, from wherever they acted. A slash
 * command or shortcut answers through Slack's `response_url`, which works in
 * any conversation — including channels the bot isn't in and DMs with other
 * people. Elsewhere (after a modal) it's an ephemeral message where they were,
 * or a DM from the bot when that isn't possible.
 */

export type PrivateMessage = string | CardElement;

const asPostable = (m: PrivateMessage) =>
  typeof m === "string" ? { raw: m } : { card: m, fallbackText: cardToFallbackText(m) };

/** Answer a slash command or shortcut through its response URL (Slack's own, nothing else). */
export async function respond(responseUrl: string | undefined, message: PrivateMessage): Promise<boolean> {
  if (!responseUrl || !/^https:\/\/hooks\.slack\.com\//.test(responseUrl)) return false;
  const body =
    typeof message === "string"
      ? { response_type: "ephemeral", text: message }
      : { response_type: "ephemeral", text: cardToFallbackText(message), blocks: cardToBlockKit(message) };
  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Ephemeral where they are, else a DM. */
export async function tell(
  bot: SlackBot,
  slackUserId: string,
  message: PrivateMessage,
  where?: Thread | Channel | null,
): Promise<void> {
  const postable = asPostable(message);
  if (where) {
    const sent = await where.postEphemeral(slackUserId, postable, { fallbackToDM: false }).catch(() => null);
    if (sent) return;
  }
  const dm = await bot.openDM(slackUserId).catch(() => null);
  await dm?.post(postable).catch((err) => console.warn("[slack] couldn't DM", slackUserId, err));
}
