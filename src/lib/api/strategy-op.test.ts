import { describe, expect, it } from "vitest";

import { applyStrategyOp, type StrategyModel } from "@/lib/strategy";

import { ApiInputError } from "./errors";
import { parseStrategyOp, STRATEGY_OP_KINDS } from "./strategy-op";

const reject = (body: unknown, match: RegExp) => {
  let err: unknown;
  try {
    parseStrategyOp(body);
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(ApiInputError);
  expect((err as ApiInputError).status).toBe(400);
  expect((err as Error).message).toMatch(match);
};

describe("parseStrategyOp", () => {
  it("accepts the web's `kind` spelling and the API's `op` spelling", () => {
    expect(parseStrategyOp({ op: "flipSignal", id: "s1" })).toEqual({ kind: "flipSignal", id: "s1" });
    expect(parseStrategyOp({ kind: "removeStage", id: "st" })).toEqual({ kind: "removeStage", id: "st" });
    expect(parseStrategyOp({ op: "seedTemplate" })).toEqual({ kind: "seedTemplate" });
  });

  it("rejects an unknown or missing op", () => {
    reject({ op: "dropTable" }, /`op`: expected one of/);
    reject({}, /`op`/);
    reject(null, /`body`: expected an object/);
    reject([], /`body`/);
  });

  it("covers every op the reducer knows", () => {
    expect([...STRATEGY_OP_KINDS].sort()).toEqual(
      [
        "setVision", "setProblem", "upsertStage", "removeStage", "upsertSignal", "removeSignal", "flipSignal", "setRiskiest",
        "upsertInitiative", "removeInitiative", "setNorthStar", "setProofMetrics", "setMarket", "setPositioning", "setGuardrails", "seedTemplate",
      ].sort(),
    );
  });

  it("requires an id for the id-only ops", () => {
    for (const op of ["removeStage", "removeSignal", "flipSignal", "setRiskiest", "removeInitiative"]) reject({ op }, /`id`/);
    reject({ op: "flipSignal", id: "  " }, /`id`: cannot be empty/);
  });

  it("rebuilds a stage, dropping unknown keys and validating the status", () => {
    const op = parseStrategyOp({
      op: "upsertStage",
      stage: { id: "s1", label: " Pilot ", status: "active", kpis: [{ name: "Firms", current: 3, target: 10, junk: 1 }], evil: "<script>" },
    });
    expect(op).toEqual({ kind: "upsertStage", stage: { id: "s1", label: "Pilot", status: "active", kpis: [{ name: "Firms", current: 3, target: 10 }] } });
    reject({ op: "upsertStage", stage: { id: "s1", label: "x", status: "paused", kpis: [] } }, /`stage.status`/);
    reject({ op: "upsertStage", stage: { id: "s1", label: "x", status: "next", kpis: [{ name: "" }] } }, /`stage.kpis\[0\].name`/);
    reject({ op: "upsertStage", stage: { id: "s1", label: "x", status: "next", kpis: [{ name: "a", target: "10" }] } }, /`stage.kpis\[0\].target`: expected a number/);
  });

  it("keeps a KPI's text current value and a null target", () => {
    const op = parseStrategyOp({ op: "upsertStage", stage: { id: "s", label: "S", status: "goal", kpis: [{ name: "NPS", current: "high", target: null }] } });
    expect(op.kind === "upsertStage" && op.stage.kpis[0]).toEqual({ name: "NPS", current: "high", target: null });
  });

  it("validates a signal and only lets http(s) sources through", () => {
    const op = parseStrategyOp({
      op: "upsertSignal",
      signal: { id: "g1", pillar: "viability", claim: "Pays ₹200/report", ok: true, source: { label: "Deal", href: "https://internal.example/deals/1" }, date: "2026-09-01" },
    });
    expect(op).toMatchObject({ kind: "upsertSignal", signal: { pillar: "viability", ok: true, source: { href: "https://internal.example/deals/1" } } });
    reject({ op: "upsertSignal", signal: { id: "g", pillar: "viability", claim: "x", source: { label: "a", href: "javascript:alert(1)" } } }, /must be an http\(s\) link/);
    reject({ op: "upsertSignal", signal: { id: "g", pillar: "virality", claim: "x" } }, /`signal.pillar`/);
    reject({ op: "upsertSignal", signal: { id: "g", pillar: "viability", claim: "x", date: "someday" } }, /`signal.date`/);
  });

  it("defaults a new signal to not-yet-proven", () => {
    const op = parseStrategyOp({ op: "upsertSignal", signal: { id: "g", pillar: "desirability", claim: "Valuers ask for it" } });
    expect(op.kind === "upsertSignal" && op.signal.ok).toBe(false);
  });

  it("clamps market capture and positioning to percentages", () => {
    expect(parseStrategyOp({ op: "setMarket", market: { tam: "₹4,000 cr", sam: 1200, capturePct: 12 } })).toEqual({
      kind: "setMarket",
      market: { tam: "₹4,000 cr", sam: 1200, capturePct: 12 },
    });
    reject({ op: "setMarket", market: { capturePct: 140 } }, /`market.capturePct`/);
    reject({ op: "setPositioning", positioning: { dots: [{ label: "Us", x: 101, y: 5 }] } }, /`positioning.dots\[0\].x`/);
  });

  it("allows clearing optional sections", () => {
    expect(parseStrategyOp({ op: "setNorthStar", northStar: null })).toEqual({ kind: "setNorthStar", northStar: undefined });
    expect(parseStrategyOp({ op: "setProblem" })).toEqual({ kind: "setProblem", problem: undefined });
    expect(parseStrategyOp({ op: "setVision", vision: "" })).toEqual({ kind: "setVision", vision: "" });
  });

  it("rejects blank guardrails and oversized lists", () => {
    reject({ op: "setGuardrails", guardrails: ["No enterprise", " "] }, /`guardrails\[1\]`/);
    reject({ op: "setGuardrails", guardrails: "No enterprise" }, /expected an array/);
    reject({ op: "setGuardrails", guardrails: Array.from({ length: 201 }, (_, i) => `g${i}`) }, /at most 200/);
  });

  it("produces ops the reducer applies exactly as the web's do", () => {
    const model: StrategyModel = { stages: [], signals: [{ id: "a", pillar: "feasibility", claim: "OCR works", ok: false }], initiatives: [] };
    const flipped = applyStrategyOp(model, parseStrategyOp({ op: "flipSignal", id: "a" }));
    expect(flipped.signals[0].ok).toBe(true);
    const withInit = applyStrategyOp(flipped, parseStrategyOp({ op: "upsertInitiative", initiative: { id: "i1", name: "Scan fixtures", signalId: "a" } }));
    expect(withInit.initiatives).toEqual([{ id: "i1", name: "Scan fixtures", signalId: "a" }]);
  });
});
