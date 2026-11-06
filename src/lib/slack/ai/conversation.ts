/**
 * Which messages in a channel thread the bot answers. Pure.
 *
 * Once the bot has replied in a thread it subscribes to it, so it hears every
 * later message there — including people talking to each other, and (since
 * other features subscribe to record threads too) threads it was never asked
 * into. Answering all of that would be noise and cost. So: an @mention is
 * always answered; otherwise only a follow-up from someone who has already
 * talked to the bot in that thread. DMs don't come through here — every DM is
 * for the bot.
 */

export type Conversation = { participants: string[]; startedAt: number };

export const conversationKey = (threadId: string) => `ai:conv:${threadId}`;
export const CONVERSATION_TTL_MS = 14 * 24 * 60 * 60_000;

export function shouldAnswer(
  conv: Conversation | null,
  msg: { isMention?: boolean; authorId: string; authorIsBot: boolean | "unknown"; authorIsMe: boolean },
): boolean {
  if (msg.authorIsMe || msg.authorIsBot === true) return false;
  if (msg.isMention) return true;
  return Boolean(conv?.participants.includes(msg.authorId));
}

export function withParticipant(conv: Conversation | null, userId: string, now = Date.now()): Conversation {
  if (!conv) return { participants: [userId], startedAt: now };
  return conv.participants.includes(userId) ? conv : { ...conv, participants: [...conv.participants, userId] };
}

/** Unlinked people hear how to link their account at most once a day, not under every answer. */
export const linkHintKey = (slackUserId: string) => `ai:link-hint:${slackUserId}`;
export const LINK_HINT_TTL_MS = 24 * 60 * 60_000;
