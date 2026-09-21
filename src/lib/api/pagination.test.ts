/**
 * Cursor pagination, checked against a brute-force sort.
 *
 * `GET /api/v1/issues` silently dropped rows whose `created_at` shared a
 * millisecond with the last row of the previous page. Not an error, not a gap
 * in the response — just a shorter list than the data, which is the hardest
 * kind of bug to notice from the outside and the reason a syncing client would
 * quietly end up with an incomplete mirror.
 *
 * The cause is a resolution mismatch. A cursor is JSON, so its timestamp is an
 * ISO string, so it carries MILLISECONDS. `timestamptz` carries microseconds.
 * The predicate asked for `created_at < cursor OR created_at = cursor`, and a
 * row at `.970001` against a cursor of `.970` satisfies neither.
 *
 * The test below does not mock a database. It generates rows — deliberately
 * with heavy ties — sorts them the way the SQL does, then walks pages using
 * only the cursor rule and asserts the walk reproduces the sort exactly: every
 * row once, in order, none missing. That is the property the endpoint claims
 * and the one it was breaking.
 */
import { describe, expect, it } from "vitest";
import {
  cursorBounds,
  decodeCursor,
  encodeCursor,
  isAfterCursor,
  isAfterCursorLegacy,
  pageParams,
  toMicros,
  type Cursor,
} from "./pagination";

/**
 * `createdAt` is an ISO string with MICROSECONDS, the way Postgres stores it.
 * A JS `Date` cannot hold them, and generating rows as `Date`s is how the first
 * version of this test managed to pass against the broken predicate: on exact
 * millisecond boundaries the old rule and the new one agree.
 */
type Row = { id: string; createdAt: string };

/** `ORDER BY created_at DESC, id DESC`, at the database's resolution. */
function sortLikeSql(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    const t = toMicros(b.createdAt) - toMicros(a.createdAt);
    return t !== 0 ? t : (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  });
}

function cursorFor(row: Row): Cursor {
  // Exactly what getIssuesPage builds — including the truncation to ms, which
  // is the thing under test.
  return { createdAt: new Date(row.createdAt).toISOString(), id: row.id };
}

/** Walk the whole set `limit` at a time, using only the cursor rule. */
function paginate(
  rows: Row[],
  limit: number,
  rule: (row: Row, c: Cursor) => boolean = isAfterCursor,
): Row[] {
  const sorted = sortLikeSql(rows);
  const seen: Row[] = [];
  let cursor: Cursor | null = null;
  for (let guard = 0; guard < 100; guard++) {
    const eligible = cursor ? sorted.filter((r) => rule(r, cursor!)) : sorted;
    const page = eligible.slice(0, limit);
    if (page.length === 0) break;
    seen.push(...page);
    if (eligible.length <= limit) break;
    cursor = cursorFor(page[page.length - 1]);
  }
  return seen;
}

/** Ids that sort in a stable, readable way. */
const id = (n: number) => `0000${n}`.slice(-5);

/** An ISO timestamp at microsecond resolution. */
const at = (ms: number, micros = 0) =>
  `${new Date(ms).toISOString().slice(0, -1)}${String(micros).padStart(3, "0")}Z`;

describe("cursor encoding", () => {
  it("round-trips", () => {
    const c: Cursor = { createdAt: "2026-09-08T06:07:43.970Z", id: "abc" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("rejects junk rather than throwing", () => {
    expect(decodeCursor("not-base64-at-all!!")).toBeNull();
    expect(decodeCursor(Buffer.from('{"createdAt":1}').toString("base64url"))).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });

  it("bounds one millisecond, not one instant", () => {
    const { at, next } = cursorBounds({ createdAt: "2026-09-08T06:07:43.970Z", id: "x" });
    expect(next.getTime() - at.getTime()).toBe(1);
  });
});

describe("keyset walk, against a millisecond column", () => {
  // `issues.created_at` and `pages.created_at` are declared `precision: 3`, so
  // what Postgres stores is exactly what a cursor can express. These are the
  // guarantees the endpoint makes.

  it("returns every row exactly once when no two rows share a timestamp", () => {
    const rows: Row[] = Array.from({ length: 23 }, (_, i) => ({
      id: id(i),
      createdAt: at(1_700_000_000_000 + i * 1000),
    }));
    expect(paginate(rows, 5).map((r) => r.id)).toEqual(sortLikeSql(rows).map((r) => r.id));
  });

  it("does not drop rows that share a timestamp across a page boundary", () => {
    // Ten rows on the same millisecond, paged five at a time, so the page
    // boundary lands inside the tie. The id tiebreak is the whole ordering here
    // — which is exactly what `precision: 3` buys.
    const rows: Row[] = Array.from({ length: 10 }, (_, i) => ({
      id: id(i),
      createdAt: at(1_700_000_000_000),
    }));
    const walked = paginate(rows, 5);
    expect(walked.map((r) => r.id)).toEqual(sortLikeSql(rows).map((r) => r.id));
    expect(new Set(walked.map((r) => r.id)).size).toBe(10);
  });

  it("handles a tie that straddles a page boundary in a mixed set, at every limit", () => {
    const base = 1_700_000_000_000;
    const rows: Row[] = [
      ...Array.from({ length: 4 }, (_, i) => ({ id: id(i), createdAt: at(base + 2000) })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: id(10 + i), createdAt: at(base + 1000) })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: id(20 + i), createdAt: at(base) })),
    ];
    for (const limit of [1, 2, 3, 5, 7, 13]) {
      const walked = paginate(rows, limit);
      expect(walked.map((r) => r.id), `limit=${limit}`).toEqual(sortLikeSql(rows).map((r) => r.id));
    }
  });

  it("never returns a row twice and never misses one", () => {
    const base = 1_700_000_000_000;
    // Timestamps drawn from a small set, so ties are everywhere.
    const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({
      id: id(i),
      createdAt: at(base + (i % 4) * 1000),
    }));
    for (const limit of [1, 3, 6, 9]) {
      const walked = paginate(rows, limit);
      expect(new Set(walked.map((r) => r.id)).size, `limit=${limit}`).toBe(rows.length);
      expect(walked.map((r) => r.id), `limit=${limit}`).toEqual(sortLikeSql(rows).map((r) => r.id));
    }
  });

  it("a single page needs no cursor at all", () => {
    const rows: Row[] = [{ id: id(1), createdAt: at(1_700_000_000_000) }];
    expect(paginate(rows, 50).map((r) => r.id)).toEqual([id(1)]);
  });
});

describe("the bug, reproduced", () => {
  // Microsecond timestamps — what the column stored before `precision: 3`, and
  // what existing rows carry until the ALTER rounds them.

  const microRows = (n: number, base = 1_700_000_000_000): Row[] =>
    Array.from({ length: n }, (_, i) => ({ id: id(i), createdAt: at(base, i * 17) }));

  it("the shipped predicate silently drops every tied row after the cursor", () => {
    const rows = microRows(10);
    const walked = paginate(rows, 5, isAfterCursorLegacy);
    // Page one comes back. Page two asks for `created_at < '…000'` OR
    // `= '…000'`, and a row at `…000085` satisfies neither — so the walk stops
    // early with no error and no gap in the response, just less data than the
    // table has. (It picks up the one row sitting exactly on the millisecond
    // boundary, which is the only value the old `=` branch could ever match.)
    expect(walked.length).toBeLessThan(rows.length);
    expect(new Set(walked.map((r) => r.id)).size).toBeLessThan(rows.length);
  });

  it("the range predicate returns them", () => {
    const rows = microRows(10);
    const walked = paginate(rows, 5);
    expect(new Set(walked.map((r) => r.id)).size).toBe(10);
  });

  it("but ORDER is only guaranteed once the column stores milliseconds", () => {
    // Worth an assertion rather than a comment, because it is the reason
    // `precision: 3` is part of this fix and not a tidy-up. Inside one
    // millisecond the SQL orders by MICROSECOND while the cursor's tiebreak is
    // by ID. Two different orderings, so a row with a lower microsecond and a
    // higher id sorts after the cursor row and is still excluded by `id <
    // cursor.id`. The range predicate cannot fix that; only removing the
    // sub-millisecond distinction can.
    const base = 1_700_000_000_000;
    // Ids DESCEND as microseconds ASCEND, so the two orderings disagree
    // maximally.
    const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({
      id: id(100 - i),
      createdAt: at(base, i * 31),
    }));
    const walked = paginate(rows, 2, isAfterCursor);
    expect(walked.length).toBeLessThan(rows.length);

    // The same rows at millisecond resolution walk perfectly.
    const rounded: Row[] = rows.map((r) => ({ ...r, createdAt: at(base) }));
    expect(paginate(rounded, 2).map((r) => r.id)).toEqual(sortLikeSql(rounded).map((r) => r.id));
  });
});

describe("pageParams", () => {
  it("clamps the limit and ignores a junk cursor", () => {
    expect(pageParams("https://x/api?limit=0").limit).toBe(50);
    expect(pageParams("https://x/api?limit=9999").limit).toBe(200);
    expect(pageParams("https://x/api?limit=abc").limit).toBe(50);
    expect(pageParams("https://x/api?cursor=zzz").cursor).toBeNull();
  });
});
