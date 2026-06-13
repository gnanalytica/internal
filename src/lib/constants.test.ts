import { describe, expect, it } from "vitest";

import {
  PRIORITIES,
  PRIORITY_MAP,
  STATUSES,
  STATUS_MAP,
  isPriority,
  isStatus,
} from "@/lib/constants";

describe("isStatus", () => {
  it("accepts known statuses", () => {
    expect(isStatus("backlog")).toBe(true);
    expect(isStatus("in_progress")).toBe(true);
    expect(isStatus("done")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isStatus("nope")).toBe(false);
    expect(isStatus("")).toBe(false);
  });
});

describe("isPriority", () => {
  it("accepts known priorities", () => {
    expect(isPriority("urgent")).toBe(true);
    expect(isPriority("none")).toBe(true);
  });

  it("rejects unknown priorities", () => {
    expect(isPriority("critical")).toBe(false);
  });
});

describe("lookup maps", () => {
  it("has a map entry for every status", () => {
    for (const s of STATUSES) {
      expect(STATUS_MAP[s.id]).toBeDefined();
      expect(STATUS_MAP[s.id].label).toBe(s.label);
    }
  });

  it("has a map entry for every priority", () => {
    for (const p of PRIORITIES) {
      expect(PRIORITY_MAP[p.id]).toBeDefined();
    }
  });

  it("ranks priorities from most to least urgent", () => {
    const ranks = PRIORITIES.map((p) => p.rank);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });
});
