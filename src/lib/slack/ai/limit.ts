import type { StateAdapter } from "chat";

import { todayIST } from "@/lib/prospects/stats";

/**
 * The daily cost guard: at most `limit` AI replies per workspace per day, the
 * day being India's (the team's), so the count resets at midnight IST.
 *
 * Counted in the Chat SDK's state rather than a table of our own. The state
 * has no atomic increment, but appending to a list is a single insert, so each
 * request appends a tick and then reads how many ticks the day has. Two
 * requests racing at the boundary can both see the count past the limit and
 * both be refused — the cap errs towards spending less, never more. The list
 * is trimmed to limit + 1, so it never grows past what the check needs, and
 * it expires two days on.
 */

export type UsageStore = Pick<StateAdapter, "appendToList" | "getList">;

const DAY_TTL_MS = 2 * 24 * 60 * 60_000;

export const usageKey = (workspaceId: string, day: string) => `ai:usage:${workspaceId}:${day}`;

export async function takeDailySlot(
  store: UsageStore,
  workspaceId: string,
  limit: number,
  now = Date.now(),
): Promise<{ ok: boolean; used: number }> {
  if (limit <= 0) return { ok: false, used: 0 };
  const key = usageKey(workspaceId, todayIST(now));
  await store.appendToList(key, now, { maxLength: limit + 1, ttlMs: DAY_TTL_MS });
  const used = (await store.getList(key)).length;
  return { ok: used <= limit, used };
}

export function limitReachedText(limit: number): string {
  return `The workspace has used today's ${limit} AI replies, so I'm off until midnight IST. Everything is still in Internal in the meantime.`;
}
