/**
 * Turning a pile of unread notifications into one email worth opening.
 *
 * Per-event email trains a small team to filter the sender, which is worse
 * than no email at all. A digest groups by the thing that changed, so five
 * comments on one task read as one line rather than five, and leads with the
 * items where you are actually on the hook.
 *
 * Pure and side-effect-free — `now` is passed in, never read from the clock —
 * so the grouping and ordering are unit-tested without a database or a mailbox.
 */

export type DigestNotification = {
  type: string;
  title: string;
  body: string | null;
  createdAt: Date;
  issueId: string | null;
  pageId: string | null;
};

export type DigestGroup = {
  /** Stable key for the thing that changed; ungrouped items key on themselves. */
  key: string;
  /** Relative link to the thing, or null when the event points nowhere. */
  href: string | null;
  /** Headline for the group — the most recent event's title. */
  title: string;
  count: number;
  /** True when at least one event in the group names you directly. */
  personal: boolean;
  latestAt: Date;
};

export type Digest = {
  groups: DigestGroup[];
  total: number;
  /** How many of the groups are things you're personally on the hook for. */
  personalCount: number;
};

/** Events that name you directly, as opposed to things you merely follow. */
const PERSONAL = new Set(["assigned", "mentioned"]);

function targetKey(n: DigestNotification): string | null {
  if (n.issueId) return `issue:${n.issueId}`;
  if (n.pageId) return `page:${n.pageId}`;
  return null;
}

function hrefFor(n: DigestNotification): string | null {
  if (n.issueId) return `/issues/${n.issueId}`;
  if (n.pageId) return `/pages/${n.pageId}`;
  return null;
}

/**
 * Group unread notifications by target, newest first, with anything that names
 * you directly floated to the top.
 */
export function buildDigest(notifications: DigestNotification[]): Digest {
  const groups = new Map<string, DigestGroup>();

  notifications.forEach((n, i) => {
    // Events with no target can't be merged with anything, so they key on
    // their own position rather than collapsing into one meaningless group.
    const key = targetKey(n) ?? `event:${i}`;
    const existing = groups.get(key);
    const personal = PERSONAL.has(n.type);

    if (!existing) {
      groups.set(key, {
        key,
        href: hrefFor(n),
        title: n.title,
        count: 1,
        personal,
        latestAt: n.createdAt,
      });
      return;
    }

    existing.count += 1;
    existing.personal = existing.personal || personal;
    // Keep the most recent event as the headline.
    if (n.createdAt.getTime() > existing.latestAt.getTime()) {
      existing.latestAt = n.createdAt;
      existing.title = n.title;
    }
  });

  const ordered = [...groups.values()].sort((a, b) => {
    if (a.personal !== b.personal) return a.personal ? -1 : 1;
    return b.latestAt.getTime() - a.latestAt.getTime();
  });

  return {
    groups: ordered,
    total: notifications.length,
    personalCount: ordered.filter((g) => g.personal).length,
  };
}

/** Subject line: what's waiting, and how much of it is yours. */
export function digestSubject(digest: Digest, workspaceName: string): string {
  const { total, personalCount } = digest;
  const items = `${total} update${total === 1 ? "" : "s"}`;
  if (personalCount > 0) {
    return `${workspaceName}: ${items}, ${personalCount} for you`;
  }
  return `${workspaceName}: ${items}`;
}

/** Plain-text body. Kept alongside the HTML so text-only clients get sense. */
export function digestText(digest: Digest, baseUrl: string): string {
  return digest.groups
    .map((g) => {
      const times = g.count > 1 ? ` (${g.count} updates)` : "";
      const link = g.href ? `\n  ${baseUrl}${g.href}` : "";
      return `${g.personal ? "* " : "- "}${g.title}${times}${link}`;
    })
    .join("\n");
}
