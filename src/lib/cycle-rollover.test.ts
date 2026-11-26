import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

import { planAutoRollovers, type RolloverCandidate } from "./cycle-rollover";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const now = D("2026-11-27");
const cycle = (id: string, start: string, end: string, unfinished: number, lastTouched: string | null, projectId = "p1"): RolloverCandidate => ({
  id,
  projectId,
  startDate: D(start),
  endDate: D(end),
  unfinished,
  lastTouched: lastTouched ? D(lastTouched) : null,
});

describe("planAutoRollovers", () => {
  it("rolls a just-ended cycle into the open next one", () => {
    const plan = planAutoRollovers([cycle("c1", "2026-11-12", "2026-11-26", 3, "2026-11-20"), cycle("c2", "2026-11-26", "2026-12-10", 0, null)], now);
    expect(plan).toEqual([{ id: "c1", create: false }]);
  });

  it("creates the next cycle only when the ended one saw work", () => {
    expect(planAutoRollovers([cycle("c1", "2026-11-12", "2026-11-26", 3, "2026-11-20")], now)).toEqual([{ id: "c1", create: true }]);
    // Tasks that only arrived by the last rollover (touched on day one) — an abandoned project: stop.
    expect(planAutoRollovers([cycle("c1", "2026-11-12", "2026-11-26", 3, "2026-11-13")], now)).toEqual([]);
  });

  it("skips cycles with nothing unfinished, still running, or ended over a week ago", () => {
    expect(planAutoRollovers([cycle("c1", "2026-11-12", "2026-11-26", 0, "2026-11-20")], now)).toEqual([]);
    expect(planAutoRollovers([cycle("c1", "2026-11-20", "2026-12-04", 5, "2026-11-25")], now)).toEqual([]);
    expect(planAutoRollovers([cycle("c1", "2026-11-01", "2026-11-15", 5, "2026-11-10")], now)).toEqual([]);
  });

  it("doesn't treat another project's open cycle as a target", () => {
    const plan = planAutoRollovers([cycle("c1", "2026-11-12", "2026-11-26", 2, "2026-11-13"), cycle("x", "2026-11-26", "2026-12-10", 0, null, "p2")], now);
    expect(plan).toEqual([]);
  });
});
