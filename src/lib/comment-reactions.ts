/**
 * Emoji reactions on comments. The set is the web's (REACTION_EMOJI in
 * actions.ts, which as a "use server" module cannot export it) — keep in step.
 */
export const REACTION_EMOJI = ["👍", "❤️", "🎉", "😄", "🚀", "👀", "✅"] as const;

export const isReactionEmoji = (v: unknown): v is (typeof REACTION_EMOJI)[number] =>
  typeof v === "string" && (REACTION_EMOJI as readonly string[]).includes(v);

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

/** Group reaction rows per comment, in first-seen order, marking the caller's own. */
export function summarizeReactions(
  rows: { commentId: string; userId: string; emoji: string }[],
  me: string | null,
): Map<string, ReactionSummary[]> {
  const out = new Map<string, ReactionSummary[]>();
  for (const r of rows) {
    const list = out.get(r.commentId) ?? [];
    let entry = list.find((x) => x.emoji === r.emoji);
    if (!entry) {
      entry = { emoji: r.emoji, count: 0, mine: false };
      list.push(entry);
    }
    entry.count += 1;
    if (me && r.userId === me) entry.mine = true;
    out.set(r.commentId, list);
  }
  return out;
}
