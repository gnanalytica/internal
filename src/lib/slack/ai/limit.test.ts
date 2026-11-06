import { describe, expect, it } from "vitest";

import { slackAiDailyLimit, slackAiModel } from "./config";
import { takeDailySlot, usageKey, type UsageStore } from "./limit";

/** The two list operations of the Chat SDK's state, in memory, with its trimming. */
function memoryStore(): UsageStore & { lists: Map<string, unknown[]> } {
  const lists = new Map<string, unknown[]>();
  return {
    lists,
    async appendToList(key, value, options) {
      const l = [...(lists.get(key) ?? []), value];
      lists.set(key, options?.maxLength ? l.slice(-options.maxLength) : l);
    },
    async getList<T>(key: string) {
      return (lists.get(key) ?? []) as T[];
    },
  };
}

// 2026-11-06 20:00 UTC is already 7 November in India.
const LATE_UTC = Date.UTC(2026, 10, 6, 20, 0);

describe("takeDailySlot", () => {
  it("allows up to the limit, then refuses", async () => {
    const store = memoryStore();
    const results = [];
    for (let n = 0; n < 4; n++) results.push(await takeDailySlot(store, "w1", 3, LATE_UTC));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
  });

  it("counts per workspace and per India day", async () => {
    const store = memoryStore();
    await takeDailySlot(store, "w1", 1, LATE_UTC);
    expect((await takeDailySlot(store, "w2", 1, LATE_UTC)).ok).toBe(true);
    expect((await takeDailySlot(store, "w1", 1, LATE_UTC + 24 * 3600_000)).ok).toBe(true);
    expect([...store.lists.keys()]).toContain(usageKey("w1", "2026-11-07"));
  });

  it("never lets the list grow past what the check needs", async () => {
    const store = memoryStore();
    for (let n = 0; n < 10; n++) await takeDailySlot(store, "w1", 2, LATE_UTC);
    expect(store.lists.get(usageKey("w1", "2026-11-07"))).toHaveLength(3);
  });

  it("refuses everything at a limit of zero, without touching the store", async () => {
    const store = memoryStore();
    expect((await takeDailySlot(store, "w1", 0)).ok).toBe(false);
    expect(store.lists.size).toBe(0);
  });
});

describe("config", () => {
  it("runs on Haiku 5.5 unless SLACK_AI_MODEL says otherwise, ignoring AI_MODEL", () => {
    expect(slackAiModel({})).toBe("claude-haiku-5-5");
    expect(slackAiModel({ AI_MODEL: "claude-opus-5" })).toBe("claude-haiku-5-5");
    expect(slackAiModel({ SLACK_AI_MODEL: " claude-sonnet-5-5 " })).toBe("claude-sonnet-5-5");
  });

  it("reads the daily limit, falling back to 200 on nonsense", () => {
    expect(slackAiDailyLimit({})).toBe(200);
    expect(slackAiDailyLimit({ SLACK_AI_DAILY_LIMIT: "50" })).toBe(50);
    expect(slackAiDailyLimit({ SLACK_AI_DAILY_LIMIT: "0" })).toBe(0);
    expect(slackAiDailyLimit({ SLACK_AI_DAILY_LIMIT: "lots" })).toBe(200);
    expect(slackAiDailyLimit({ SLACK_AI_DAILY_LIMIT: "-3" })).toBe(200);
  });
});
