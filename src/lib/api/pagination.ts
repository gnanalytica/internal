export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof c?.createdAt === "string" && typeof c?.id === "string") return c;
  } catch {
    // fall through
  }
  return null;
}

/** Parse `?limit=&cursor=` query params with sane bounds. */
export function pageParams(url: string): { limit: number; cursor: Cursor | null } {
  const sp = new URL(url).searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 200);
  return { limit, cursor: decodeCursor(sp.get("cursor")) };
}

/**
 * How long one cursor "tick" is — the resolution a cursor can express.
 *
 * A cursor is JSON, so its timestamp is an ISO string, so it carries
 * MILLISECONDS. `timestamptz` in Postgres carries microseconds. That mismatch
 * is the whole bug: the cursor is built with
 * `new Date(row.createdAt).toISOString()`, which truncates .970512 to .970,
 * and the page-two predicate then asked for
 *
 *     created_at < '…970'  OR (created_at = '…970' AND id < cursor.id)
 *
 * A row at .970001 satisfies neither. It is not less than .970, and it is not
 * equal to .970. So every row sharing the cursor row's millisecond but sorting
 * after it was **silently dropped** — no error, no gap in the response, just a
 * shorter list than the data.
 *
 * It needs two fixes and they do different jobs:
 *
 *  1. The predicate below treats the cursor's millisecond as a RANGE rather
 *    than a point, so those rows come back. That works whatever precision the
 *    column has and fixes the dropping on its own.
 *  2. `issues.created_at` and `pages.created_at` are declared `precision: 3`,
 *    so what Postgres stores is what a cursor can express. Without that, the
 *    ORDER BY inside one millisecond is by microsecond and the predicate's
 *    tiebreak is by id — two different orderings, so a row in that band could
 *    still be repeated or skipped. With it, the range collapses to exactly one
 *    stored value and the id tiebreak is the whole ordering.
 */
export const CURSOR_TICK_MS = 1;

/**
 * The bounds a keyset predicate needs for `ORDER BY created_at DESC, id DESC`.
 *
 * `at` is the cursor's millisecond; `next` is the millisecond after it. A row
 * is strictly after the cursor when it is earlier than `at`, or inside
 * `[at, next)` with a smaller id.
 */
export function cursorBounds(c: Cursor): { at: Date; next: Date; id: string } {
  const at = new Date(c.createdAt);
  return { at, next: new Date(at.getTime() + CURSOR_TICK_MS), id: c.id };
}

/**
 * Microseconds since the epoch.
 *
 * A JS `Date` cannot hold them — `new Date("…970512Z").getTime()` is 970 — and
 * that is not a detail, it IS the bug: the database compares at microsecond
 * resolution and the cursor can only carry milliseconds. Anything reasoning
 * about this predicate has to work in the database's units or it reproduces the
 * app's blind spot and proves nothing.
 */
export function toMicros(v: Date | string): number {
  if (v instanceof Date) return v.getTime() * 1000;
  const m = /\.(\d{1,6})/.exec(v);
  const base = new Date(v).getTime();               // truncated to ms
  if (!m) return base * 1000;
  const frac = m[1].padEnd(6, "0");                 // ".97"   -> 970000 µs
  return Math.floor(base / 1000) * 1_000_000 + Number(frac);
}

/**
 * The same rule in plain TypeScript, in the database's units.
 *
 * `src/lib/api/pagination.test.ts` walks generated rows with this and asserts
 * the walk reproduces a brute-force sort — including rows that share a
 * millisecond but differ in microseconds, which is the case the SQL got wrong
 * and the only case that can tell the old predicate from this one.
 */
export function isAfterCursor(row: { createdAt: Date | string; id: string }, c: Cursor): boolean {
  const at = toMicros(c.createdAt);
  const next = at + CURSOR_TICK_MS * 1000;
  const t = toMicros(row.createdAt);
  if (t < at) return true;
  return t >= at && t < next && row.id < c.id;
}

/**
 * The predicate as it shipped, kept so the test can prove the new one differs.
 *
 * An assertion that passes against both is an assertion that tests nothing —
 * and the first version of that test did exactly that, because it generated
 * rows on exact millisecond boundaries where the two agree.
 */
export function isAfterCursorLegacy(row: { createdAt: Date | string; id: string }, c: Cursor): boolean {
  const at = toMicros(c.createdAt);
  const t = toMicros(row.createdAt);
  if (t < at) return true;
  return t === at && row.id < c.id;
}
