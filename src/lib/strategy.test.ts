import { describe, expect, it } from "vitest";

import {
  applyStrategyOp,
  kpiState,
  pillarScore,
  routeProgress,
  signalIsStale,
  stageProgress,
  templateStrategyModel,
  type Signal,
  type Stage,
} from "@/lib/strategy";

const sig = (over: Partial<Signal>): Signal => ({
  id: "s1",
  pillar: "desirability",
  claim: "claim",
  ok: true,
  ...over,
});

describe("pillarScore", () => {
  it("scores ✓ ÷ total, rounded", () => {
    const signals = [
      sig({ id: "a", ok: true }),
      sig({ id: "b", ok: true }),
      sig({ id: "c", ok: false }),
    ];
    expect(pillarScore(signals, "desirability")).toEqual({ score: 67, ok: 2, total: 3 });
  });

  it("returns null score for an empty pillar", () => {
    expect(pillarScore([], "viability")).toEqual({ score: null, ok: 0, total: 0 });
  });

  it("only counts the requested pillar", () => {
    const signals = [sig({ id: "a", pillar: "feasibility", ok: false })];
    expect(pillarScore(signals, "desirability").total).toBe(0);
  });
});

describe("signalIsStale", () => {
  const now = new Date("2026-07-09T00:00:00Z");
  it("stale when dated more than 90 days ago", () => {
    expect(signalIsStale(sig({ date: "2026-02-01" }), now)).toBe(true);
  });
  it("fresh within 90 days", () => {
    expect(signalIsStale(sig({ date: "2026-06-01" }), now)).toBe(false);
  });
  it("never stale without a date or with an autoKey", () => {
    expect(signalIsStale(sig({}), now)).toBe(false);
    expect(signalIsStale(sig({ date: "2025-01-01", autoKey: "deals.trialWon" }), now)).toBe(false);
  });
});

describe("kpiState", () => {
  it("na when current is null/undefined", () => {
    expect(kpiState({ name: "x", current: null, target: 3 })).toBe("na");
    expect(kpiState({ name: "x" })).toBe("na");
  });
  it("compares numeric current vs target: ok ≥1, warn ≥0.5, bad below", () => {
    expect(kpiState({ name: "x", current: 3, target: 3 })).toBe("ok");
    expect(kpiState({ name: "x", current: 2, target: 3 })).toBe("warn");
    expect(kpiState({ name: "x", current: 1, target: 3 })).toBe("bad");
  });
  it("defaults to ok for non-numeric current with a value", () => {
    expect(kpiState({ name: "x", current: "1.4k" })).toBe("ok");
  });
  it("manual state override wins", () => {
    expect(kpiState({ name: "x", current: 5, target: 5, state: "warn" })).toBe("warn");
  });
});

const stage = (over: Partial<Stage>): Stage => ({
  id: "p1",
  label: "Stage 1",
  status: "active",
  kpis: [],
  ...over,
});

describe("stageProgress", () => {
  it("is the mean of clamped current/target ratios", () => {
    const s = stage({
      kpis: [
        { name: "a", current: 1, target: 2 }, // 0.5
        { name: "b", current: 5, target: 4 }, // clamped to 1
      ],
    });
    expect(stageProgress(s)).toBeCloseTo(0.75);
  });
  it("is 0 with no numeric-targeted KPIs", () => {
    expect(stageProgress(stage({ kpis: [{ name: "a", current: "TBD" }] }))).toBe(0);
  });
});

describe("routeProgress", () => {
  it("active leg contributes its stageProgress within its span", () => {
    const stages = [
      stage({ id: "p1", status: "active", kpis: [{ name: "a", current: 1, target: 2 }] }),
      stage({ id: "p2", status: "next" }),
      stage({ id: "p3", status: "goal" }),
    ];
    expect(routeProgress(stages)).toBeCloseTo(0.5 / 3);
  });
  it("done legs count fully", () => {
    const stages = [
      stage({ id: "p1", status: "done" }),
      stage({ id: "p2", status: "active", kpis: [] }),
      stage({ id: "p3", status: "goal" }),
    ];
    expect(routeProgress(stages)).toBeCloseTo(1 / 3);
  });
  it("is 0 for no stages", () => {
    expect(routeProgress([])).toBe(0);
  });
});

describe("applyStrategyOp", () => {
  it("setVision on null creates a model", () => {
    const m = applyStrategyOp(null, { kind: "setVision", vision: "v" });
    expect(m.vision).toBe("v");
    expect(m.stages).toEqual([]);
    expect(m.signals).toEqual([]);
    expect(m.initiatives).toEqual([]);
  });

  it("upsertSignal appends, then replaces by id", () => {
    let m = applyStrategyOp(null, { kind: "upsertSignal", signal: sig({ id: "a" }) });
    m = applyStrategyOp(m, { kind: "upsertSignal", signal: sig({ id: "a", claim: "new" }) });
    expect(m.signals).toHaveLength(1);
    expect(m.signals[0].claim).toBe("new");
  });

  it("flipSignal toggles ok but never on auto signals", () => {
    let m = applyStrategyOp(null, { kind: "upsertSignal", signal: sig({ id: "a", ok: true }) });
    m = applyStrategyOp(m, {
      kind: "upsertSignal",
      signal: sig({ id: "b", ok: true, autoKey: "deals.trialWon" }),
    });
    m = applyStrategyOp(m, { kind: "flipSignal", id: "a" });
    m = applyStrategyOp(m, { kind: "flipSignal", id: "b" });
    expect(m.signals.find((s) => s.id === "a")!.ok).toBe(false);
    expect(m.signals.find((s) => s.id === "b")!.ok).toBe(true);
  });

  it("setRiskiest is exclusive within the pillar", () => {
    let m = applyStrategyOp(null, {
      kind: "upsertSignal",
      signal: sig({ id: "a", riskiest: true }),
    });
    m = applyStrategyOp(m, { kind: "upsertSignal", signal: sig({ id: "b" }) });
    m = applyStrategyOp(m, { kind: "setRiskiest", id: "b" });
    expect(m.signals.find((s) => s.id === "a")!.riskiest).toBe(false);
    expect(m.signals.find((s) => s.id === "b")!.riskiest).toBe(true);
  });

  it("seedTemplate seeds shape only, and only when the model is null", () => {
    const t = applyStrategyOp(null, { kind: "seedTemplate" });
    expect(t.stages.map((s) => s.status)).toEqual(["active", "next", "goal"]);
    expect(t.stages.map((s) => s.label)).toEqual(["Stage 1", "Stage 2", "Stage 3"]);
    expect(t.signals).toEqual([]);
    const existing = applyStrategyOp(null, { kind: "setVision", vision: "keep" });
    expect(applyStrategyOp(existing, { kind: "seedTemplate" })).toEqual(existing);
  });

  it("templateStrategyModel carries no content", () => {
    const t = templateStrategyModel();
    expect(t.vision).toBeUndefined();
    expect(t.signals).toEqual([]);
    expect(t.initiatives).toEqual([]);
  });
});

describe("derived values never persist", () => {
  it("upsertStage strips current from auto KPIs but keeps manual ones", () => {
    const m = applyStrategyOp(null, {
      kind: "upsertStage",
      stage: stage({
        kpis: [
          { name: "auto", current: 90, autoKey: "pricing.margin.x" },
          { name: "manual", current: 5, target: 10 },
        ],
      }),
    });
    expect(m.stages[0].kpis[0].current).toBeUndefined();
    expect(m.stages[0].kpis[1].current).toBe(5);
  });
  it("setNorthStar and setProofMetrics strip auto currents", () => {
    let m = applyStrategyOp(null, {
      kind: "setNorthStar",
      northStar: { label: "n", current: 42, target: 100, autoKey: "analytics.northStar" },
    });
    expect(m.northStar!.current).toBeUndefined();
    m = applyStrategyOp(m, {
      kind: "setProofMetrics",
      proofMetrics: [{ label: "p", current: 2, autoKey: "deals.trialWon" }],
    });
    expect(m.proofMetrics![0].current).toBeUndefined();
  });
});
