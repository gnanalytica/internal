import { describe, expect, it } from "vitest";

import {
  PRESENCE_COLORS,
  filterFreshPresence,
  isPresenceFresh,
  presenceColor,
  shouldSnapshot,
} from "./page-collab";

describe("shouldSnapshot", () => {
  const now = new Date("2026-07-23T12:00:00Z");

  it("snapshots when there is no prior version", () => {
    expect(shouldSnapshot(null, now)).toBe(true);
  });

  it("snapshots when the newest version is older than the window", () => {
    const old = new Date(now.getTime() - 11 * 60_000);
    expect(shouldSnapshot(old, now)).toBe(true);
  });

  it("does not snapshot within the window", () => {
    const recent = new Date(now.getTime() - 2 * 60_000);
    expect(shouldSnapshot(recent, now)).toBe(false);
  });

  it("snapshots exactly at the window boundary", () => {
    const boundary = new Date(now.getTime() - 10 * 60_000);
    expect(shouldSnapshot(boundary, now)).toBe(true);
  });
});

describe("presence staleness", () => {
  const now = new Date("2026-07-23T12:00:00Z");

  it("treats a recent heartbeat as fresh", () => {
    expect(isPresenceFresh(new Date(now.getTime() - 5_000), now)).toBe(true);
  });

  it("treats a heartbeat older than 30s as stale", () => {
    expect(isPresenceFresh(new Date(now.getTime() - 31_000), now)).toBe(false);
  });

  it("filters a mixed set to only fresh rows", () => {
    const rows = [
      { id: "a", lastSeenAt: new Date(now.getTime() - 1_000) },
      { id: "b", lastSeenAt: new Date(now.getTime() - 60_000) },
      { id: "c", lastSeenAt: new Date(now.getTime() - 10_000) },
    ];
    expect(filterFreshPresence(rows, now).map((r) => r.id)).toEqual(["a", "c"]);
  });
});

describe("presenceColor", () => {
  it("is deterministic for the same id", () => {
    expect(presenceColor("user-123")).toBe(presenceColor("user-123"));
  });

  it("always returns a colour from the palette", () => {
    for (const id of ["a", "b", "c", "xyz", "00000000-0000"]) {
      expect(PRESENCE_COLORS).toContain(presenceColor(id));
    }
  });
});
