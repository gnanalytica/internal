/**
 * Lightweight @mention support. Mentions are plain-text tokens of the form
 * `@<token>` where the token matches a member's first name or email prefix
 * (case-insensitive). Keeping the matching here means the comment highlighter
 * and the server-side notifier can never drift apart.
 */

type MentionMember = { id: string; name: string; email: string };

/** The set of tokens that resolve to a given member (lowercased, no spaces). */
export function mentionKeysForMember(m: { name: string; email: string }): string[] {
  return [
    m.name.split(/\s+/)[0].toLowerCase(),
    m.email.split("@")[0].toLowerCase(),
  ].filter(Boolean);
}

/** All `@token` strings present in a body (without the leading `@`). */
export function extractMentionTokens(body: string): string[] {
  return (body.match(/@([\w.-]+)/g) ?? []).map((t) => t.slice(1).toLowerCase());
}

/** Member ids that are mentioned in the body. */
export function findMentionedMemberIds(
  body: string,
  members: MentionMember[],
): string[] {
  const tokens = new Set(extractMentionTokens(body));
  if (tokens.size === 0) return [];
  return members
    .filter((m) => mentionKeysForMember(m).some((k) => tokens.has(k)))
    .map((m) => m.id);
}

/** True when `token` (without `@`) resolves to any provided member. */
export function isMentionToken(
  token: string,
  members: { name: string; email: string }[],
): boolean {
  const t = token.toLowerCase();
  return members.some((m) => mentionKeysForMember(m).includes(t));
}
