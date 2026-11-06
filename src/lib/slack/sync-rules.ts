import { escapeMrkdwn } from "./cards";

/**
 * The rules of two-way thread sync, kept pure (sync-rules.test.ts). A task's
 * Slack threads are the rows of `slack_threads` with record_type "issue".
 *
 * Loops are avoided at both ends:
 * - Slack → app: only a person's reply inside a linked thread becomes a
 *   comment — never the bot's own posts (which is all the app → Slack side
 *   writes), other bots, thread roots, or a message talking to the bot.
 * - App → Slack: a comment that came from a Slack thread (it has a
 *   `slack_comments` row) is not posted back into that thread.
 */

export type InboundMessage = {
  /** Posted by this bot. */
  isMe: boolean;
  isBot: boolean;
  /** @-mentions the bot: it's a conversation with the AI, not a task comment. */
  isMention: boolean;
  text: string;
  /** The message's own ts and the thread's root ts. */
  ts: string;
  threadTs: string;
  /** The author is in a conversation with the AI bot in this thread, so a follow-up is meant for it. */
  inAiConversation?: boolean;
};

export type InboundVerdict = "sync" | "self" | "bot" | "root" | "mention" | "ai_followup" | "empty";

export function inboundVerdict(m: InboundMessage): InboundVerdict {
  if (m.isMe) return "self";
  if (m.isBot) return "bot";
  if (!m.threadTs || m.threadTs === m.ts) return "root";
  if (m.isMention) return "mention";
  if (m.inAiConversation) return "ai_followup";
  if (!m.text.trim()) return "empty";
  return "sync";
}

/**
 * The AI bot's record of who it is talking to in a thread (Chat state), and
 * whether a person is one of them. Mirrors `conversationKey` and the
 * participant half of `shouldAnswer` in src/lib/slack/ai/conversation.ts —
 * keep the two in step.
 */
export const aiConversationKey = (threadId: string): string => `ai:conv:${threadId}`;

export function isAiParticipant(conv: unknown, slackUserId: string): boolean {
  if (!conv || typeof conv !== "object") return false;
  const participants = (conv as { participants?: unknown }).participants;
  return Array.isArray(participants) && participants.includes(slackUserId);
}

export type LinkedThread ={ channel: string; ts: string; createdAt: Date };

/**
 * The threads a new comment is posted into: every linked thread for the task,
 * except the Slack thread it came from, and except a thread started after the
 * comment was written — that one was opened by a channel rule to announce this
 * very comment (notify.ts), so it already says it.
 */
export function mirrorTargets(
  threads: readonly LinkedThread[],
  origin: { channel: string; threadTs: string } | null,
  commentAt: Date,
): LinkedThread[] {
  return threads.filter(
    (t) =>
      !(origin && t.channel === origin.channel && t.ts === origin.threadTs) &&
      t.createdAt.getTime() <= commentAt.getTime(),
  );
}

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** "*Priya*: the text", escaped so a comment can't ping @channel or forge a link. */
export function mirrorText(authorName: string | null, body: string): string {
  const who = authorName?.trim() ? `*${escapeMrkdwn(authorName.trim())}*` : "Someone";
  return `${who}: ${escapeMrkdwn(clip(body.trim(), 3000))}`;
}

/** How an unlinked Slack author reads in the app: "Priya via Slack". */
export const viaSlackLabel = (name: string | null | undefined): string =>
  `${name?.trim() || "Someone"} via Slack`;

/** The comment an `issue.commented` webhook payload is about. */
export function commentFromWebhook(
  event: string,
  data: unknown,
): { issueId: string; commentId: string | null; body: string | null } | null {
  if (event !== "issue.commented" || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  const issueId = str(d.issueId);
  if (!issueId) return null;
  return { issueId, commentId: str(d.commentId), body: str(d.body) };
}

/** Reactions on a task's thread root that mean "done". */
const DONE_EMOJI: ReadonlySet<string> = new Set(["white_check_mark", "heavy_check_mark", "ballot_box_with_check"]);

/** Slack sends the name without colons; a skin tone rides along as "::skin-tone-2". */
export const isDoneReaction = (rawEmoji: string): boolean =>
  DONE_EMOJI.has(rawEmoji.replace(/^:/, "").split("::")[0].replace(/:$/, ""));
