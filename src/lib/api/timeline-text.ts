import { PRIORITY_MAP, STATUS_MAP, type PriorityId, type StatusId } from "@/lib/constants";

/**
 * One activity row as a phrase ("set status to In Progress"), worded like the
 * web timeline so a phone and a browser describe the same event the same way.
 */
export function describeActivity(
  type: string,
  data: { from?: string | null; to?: string | null } | null,
  nameOf: (id: string) => string | undefined,
): string {
  const memberName = (id?: string | null) => (id ? (nameOf(id) ?? "someone") : "no one");
  switch (type) {
    case "created":
      return "created the issue";
    case "status":
      return `set status to ${STATUS_MAP[data?.to as StatusId]?.label ?? data?.to}`;
    case "priority":
      return `set priority to ${PRIORITY_MAP[data?.to as PriorityId]?.label ?? data?.to}`;
    case "assignee":
      return data?.to ? `assigned ${memberName(data.to)}` : "removed the assignee";
    default:
      return "updated the issue";
  }
}

export const REACTION_EMOJI = ["👍", "❤️", "🎉", "😄", "🚀", "👀", "✅"] as const;

/** Reactions rolled up per emoji, in first-seen order, marking the caller's own. */
export function summarizeReactions(
  rows: { emoji: string; userId: string }[],
  me: string | null,
): { emoji: string; count: number; mine: boolean }[] {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of rows) {
    const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (me && r.userId === me) cur.mine = true;
    byEmoji.set(r.emoji, cur);
  }
  return [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, ...v }));
}
