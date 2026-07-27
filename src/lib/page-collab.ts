/**
 * Pure helpers for page collaboration (comments, version history, presence).
 * Kept side-effect-free so the snapshot cadence, staleness window and colour
 * assignment can be unit-tested without a database.
 */

/** How long a page presence heartbeat stays "fresh" before the user is gone. */
export const PRESENCE_STALE_MS = 30_000;

/** Minimum gap between automatic version snapshots for a single page. */
export const VERSION_WINDOW_MS = 10 * 60_000;

/** How many versions to keep per page (older ones are pruned). */
export const VERSION_RETENTION = 50;

/**
 * Deterministic per-user cursor colours (6-hue palette). A user keeps the same
 * colour across sessions because it is derived from their id hash.
 */
export const PRESENCE_COLORS = [
  "#e2544c", // red
  "#e08b2e", // orange
  "#2fa96b", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
] as const;

/** Stable string hash (djb2) → non-negative integer. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Pick a deterministic presence colour for a user id. */
export function presenceColor(userId: string): string {
  return PRESENCE_COLORS[hashString(userId) % PRESENCE_COLORS.length];
}

/**
 * Whether `updatePage` should snapshot the current (pre-update) page state.
 * True when there is no prior version, or the newest one is older than the
 * window — so a burst of debounced saves yields at most one version per window.
 */
export function shouldSnapshot(
  lastVersionAt: Date | null,
  now: Date,
  windowMs: number = VERSION_WINDOW_MS,
): boolean {
  if (!lastVersionAt) return true;
  return now.getTime() - lastVersionAt.getTime() >= windowMs;
}

/** Whether a presence row's heartbeat is recent enough to count as active. */
export function isPresenceFresh(
  lastSeenAt: Date,
  now: Date,
  staleMs: number = PRESENCE_STALE_MS,
): boolean {
  return now.getTime() - lastSeenAt.getTime() < staleMs;
}

/** Filter a set of presence rows down to those still fresh at `now`. */
export function filterFreshPresence<T extends { lastSeenAt: Date }>(
  rows: T[],
  now: Date,
  staleMs: number = PRESENCE_STALE_MS,
): T[] {
  return rows.filter((r) => isPresenceFresh(r.lastSeenAt, now, staleMs));
}
