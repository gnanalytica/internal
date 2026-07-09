# Strategy Surface (Plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Strategy department page (`/projects/[id]/strategy`) — six executive sections driven by a new `projects.strategyModel` jsonb column, with derived (never hand-typed) scores and edit-in-place knobs.

**Architecture:** Pure data layer in `src/lib/strategy.ts` (types + helpers + a `StrategyOp` reducer) and `src/lib/strategy-derive.ts` (autoKey → value resolver), one server action that applies ops with a single-row update (Neon HTTP — no transactions), and client section components under `src/components/strategy/` composed by a server page that loads the derivation context (milestones/issues/deals/pricingModel).

**Tech Stack:** Next.js App Router (params are Promises), Drizzle + Neon HTTP driver, Tailwind (shadcn hsl tokens: `bg-card`, `border`, `text-muted-foreground`), vitest (node env, `src/**/*.test.ts` only).

**Spec:** `docs/superpowers/specs/2026-07-06-strategy-surface-design.md`

## Global Constraints

- **No Valytica content anywhere** — no vision text, stage names, signals, KPIs, or numbers get seeded or hardcoded. Template seeds *shape only*: stages labeled "Stage 1/2/3", empty pillars.
- Neon HTTP driver: **no `db.transaction`** — single-row updates only; idempotent scripts; `npx tsx --env-file=.env.local` for DB scripts.
- Next.js route params are **Promises** (`params: Promise<{ id: string }>` → `await params`).
- Gate the page with `isDepartmentEnabled(project.enabledDepartments, "strategy")` → `notFound()`.
- Tests: vitest **node env only**, colocated `src/lib/*.test.ts`. No component/jsdom tests.
- FDV pillars display in **D · F · V order**: Desirability ("do they want it?"), Feasibility ("can we build it?"), Viability ("does it pay?").
- Scores and `auto` values are **derived, never typed**; a signal with `autoKey` cannot be flipped by hand.
- Signal staleness threshold: **90 days**. Pillar ring colors: **≥75 green, ≥50 amber, else red**.
- Language: executive labels with plain-gloss subtitles; on-page text is keywords; explanations live in `data-tip` popouts.
- Section order fixed: 1 Path to Scale · 2 FDV Scorecard · 3 Strategic Initiatives · 4 Traction & North Star · 5 Unit Economics · 6 Market Landscape & Moat (collapsed).
- Animations respect `prefers-reduced-motion`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/strategy.ts` (create) | StrategyModel types, PILLARS, pure helpers, StrategyOp reducer |
| `src/lib/strategy.test.ts` (create) | tests for the above |
| `src/lib/strategy-derive.ts` (create) | DeriveCtx, resolveAuto registry, collectAutoKeys, applyAuto |
| `src/lib/strategy-derive.test.ts` (create) | tests for the above |
| `src/lib/pricing.ts` (modify) | add optional `costPerUnitHeavy` + `segmentUnitMarginHeavy` |
| `src/lib/pricing.test.ts` (modify) | test heavy-tail margin |
| `src/db/schema.ts` (modify, ~line 102) | add `strategyModel` jsonb after `pricingModel` |
| `src/db/add-strategy-model-column.ts` (create) | idempotent column-add script |
| `src/lib/strategy-actions.ts` (create) | `"use server"` — applyStrategyOpAction |
| `src/components/strategy/strategy.css` (create) | tooltip/animation/editable helper classes |
| `src/components/strategy/ui.tsx` (create) | Section, TipLayer, Ring, HBar, KpiChipView, Editable, InlineAdd |
| `src/components/strategy/path-to-scale.tsx` (create) | §1 |
| `src/components/strategy/fdv-scorecard.tsx` (create) | §2 |
| `src/components/strategy/initiatives-traction.tsx` (create) | §3 + §4 |
| `src/components/strategy/unit-economics.tsx` (create) | §5 |
| `src/components/strategy/backdrop.tsx` (create) | §6 |
| `src/components/strategy/empty-state.tsx` (create) | guided empty state |
| `src/app/(app)/projects/[id]/strategy/page.tsx` (replace) | server page: data + derivations + composition |

---

### Task 1: Strategy model lib (types, helpers, op reducer)

**Files:**
- Create: `src/lib/strategy.ts`
- Test: `src/lib/strategy.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (used by every later task): all types below, `PILLARS`, `pillarScore(signals, pillar)`, `signalIsStale(signal, now?)`, `kpiState(kpi)`, `stageProgress(stage)`, `routeProgress(stages)`, `applyStrategyOp(model | null, op)`, `emptyStrategyModel()`, `templateStrategyModel()`, `StrategyOp`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/strategy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/strategy.test.ts`
Expected: FAIL — `Cannot find module '@/lib/strategy'` (or equivalent).

- [ ] **Step 3: Write the implementation**

Create `src/lib/strategy.ts`:

```ts
/**
 * Strategy surface data model + pure helpers. All strategy content lives in
 * `projects.strategyModel` (jsonb); this module defines its shape and derives
 * from it — no content, no IO. Scores are derived, never typed.
 */

export type StageStatus = "active" | "next" | "goal" | "done";
export type KpiState = "ok" | "warn" | "bad" | "na";
export type Pillar = "desirability" | "feasibility" | "viability";

export interface StageKpi {
  name: string;
  current?: number | string | null;
  target?: number | null;
  autoKey?: string; // derivation id (src/lib/strategy-derive.ts); overrides current
  tip?: string; // hover popout text
  state?: KpiState; // manual override; computed from current/target otherwise
}

export interface Stage {
  id: string;
  label: string;
  status: StageStatus;
  what?: string;
  why?: string;
  kpis: StageKpi[];
  exitCriteria?: string;
  killCriteria?: string;
}

export interface Signal {
  id: string;
  pillar: Pillar;
  claim: string; // keyword text
  ok: boolean; // ✓ / ✕ (auto-resolved when autoKey is set)
  why?: string; // keyword reasoning: why · flip condition
  source?: { label: string; href?: string };
  date?: string; // ISO; > STALE_DAYS ⇒ stale badge
  stageId?: string; // phase tag
  riskiest?: boolean; // at most one per pillar (enforced by setRiskiest)
  autoKey?: string;
}

export interface Initiative {
  id: string;
  name: string;
  stageId?: string;
  signalId?: string; // the gap it answers
  milestoneId?: string; // Roadmap link; drives auto progress
  done?: boolean;
}

export interface StrategyModel {
  vision?: string;
  problem?: { pains: { label: string; signalId?: string }[]; whyNow?: string };
  stages: Stage[];
  signals: Signal[];
  scoreHistory?: { date: string; d: number; f: number; v: number }[];
  initiatives: Initiative[];
  northStar?: { label: string; current?: number | null; target?: number | null; autoKey?: string };
  proofMetrics?: { label: string; current?: number | null; target?: number | null; autoKey?: string }[];
  market?: { tamLabel?: string; tam?: string; sam?: number; capturePct?: number };
  positioning?: {
    xLabel?: string;
    yLabel?: string;
    dots: { label: string; x: number; y: number; self?: boolean }[];
  };
  guardrails?: string[];
}

/** Display order is D · F · V. */
export const PILLARS: { id: Pillar; label: string; question: string }[] = [
  { id: "desirability", label: "Desirability", question: "do they want it?" },
  { id: "feasibility", label: "Feasibility", question: "can we build it?" },
  { id: "viability", label: "Viability", question: "does it pay?" },
];

export const STALE_DAYS = 90;

export function pillarScore(
  signals: Signal[],
  pillar: Pillar,
): { score: number | null; ok: number; total: number } {
  const rows = signals.filter((s) => s.pillar === pillar);
  const ok = rows.filter((s) => s.ok).length;
  const total = rows.length;
  return { score: total ? Math.round((ok / total) * 100) : null, ok, total };
}

export function signalIsStale(signal: Signal, now: Date = new Date()): boolean {
  if (!signal.date || signal.autoKey) return false;
  return now.getTime() - new Date(signal.date).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function kpiState(kpi: StageKpi): KpiState {
  if (kpi.state) return kpi.state;
  if (kpi.current == null) return "na";
  if (typeof kpi.current === "number" && typeof kpi.target === "number" && kpi.target > 0) {
    const r = kpi.current / kpi.target;
    return r >= 1 ? "ok" : r >= 0.5 ? "warn" : "bad";
  }
  return "ok";
}

/** Mean of clamped current/target ratios over numeric-targeted KPIs; 0 if none. */
export function stageProgress(stage: Stage): number {
  const ratios = stage.kpis
    .filter(
      (k) => typeof k.current === "number" && typeof k.target === "number" && k.target > 0,
    )
    .map((k) => Math.min(1, Math.max(0, (k.current as number) / (k.target as number))));
  if (!ratios.length) return 0;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

/** Done legs count fully; the active leg adds its stageProgress within its span. */
export function routeProgress(stages: Stage[]): number {
  if (!stages.length) return 0;
  const span = 1 / stages.length;
  let p = 0;
  stages.forEach((s, i) => {
    if (s.status === "done") p = Math.max(p, (i + 1) * span);
    if (s.status === "active") p = Math.max(p, i * span + stageProgress(s) * span);
  });
  return Math.min(1, p);
}

// ---- ops (applied by the server action; pure and unit-testable) ----

export type StrategyOp =
  | { kind: "setVision"; vision: string }
  | { kind: "setProblem"; problem: StrategyModel["problem"] }
  | { kind: "upsertStage"; stage: Stage }
  | { kind: "removeStage"; id: string }
  | { kind: "upsertSignal"; signal: Signal }
  | { kind: "removeSignal"; id: string }
  | { kind: "flipSignal"; id: string }
  | { kind: "setRiskiest"; id: string }
  | { kind: "upsertInitiative"; initiative: Initiative }
  | { kind: "removeInitiative"; id: string }
  | { kind: "setNorthStar"; northStar: StrategyModel["northStar"] }
  | { kind: "setProofMetrics"; proofMetrics: NonNullable<StrategyModel["proofMetrics"]> }
  | { kind: "setMarket"; market: StrategyModel["market"] }
  | { kind: "setPositioning"; positioning: StrategyModel["positioning"] }
  | { kind: "setGuardrails"; guardrails: string[] }
  | { kind: "seedTemplate" };

export function emptyStrategyModel(): StrategyModel {
  return { stages: [], signals: [], initiatives: [] };
}

/** Shape-only starter — generic stage-gates, empty pillars. Never any content. */
export function templateStrategyModel(): StrategyModel {
  return {
    stages: [
      { id: "s1", label: "Stage 1", status: "active", kpis: [] },
      { id: "s2", label: "Stage 2", status: "next", kpis: [] },
      { id: "s3", label: "Stage 3", status: "goal", kpis: [] },
    ],
    signals: [],
    initiatives: [],
    guardrails: [],
  };
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  return i === -1 ? [...list, item] : list.map((x, j) => (j === i ? item : x));
}

export function applyStrategyOp(model: StrategyModel | null, op: StrategyOp): StrategyModel {
  const m = model ?? emptyStrategyModel();
  switch (op.kind) {
    case "setVision":
      return { ...m, vision: op.vision };
    case "setProblem":
      return { ...m, problem: op.problem };
    case "upsertStage":
      return { ...m, stages: upsert(m.stages, op.stage) };
    case "removeStage":
      return { ...m, stages: m.stages.filter((s) => s.id !== op.id) };
    case "upsertSignal":
      return { ...m, signals: upsert(m.signals, op.signal) };
    case "removeSignal":
      return { ...m, signals: m.signals.filter((s) => s.id !== op.id) };
    case "flipSignal":
      return {
        ...m,
        signals: m.signals.map((s) =>
          s.id === op.id && !s.autoKey ? { ...s, ok: !s.ok } : s,
        ),
      };
    case "setRiskiest": {
      const target = m.signals.find((s) => s.id === op.id);
      if (!target) return m;
      return {
        ...m,
        signals: m.signals.map((s) =>
          s.pillar === target.pillar ? { ...s, riskiest: s.id === op.id } : s,
        ),
      };
    }
    case "upsertInitiative":
      return { ...m, initiatives: upsert(m.initiatives, op.initiative) };
    case "removeInitiative":
      return { ...m, initiatives: m.initiatives.filter((i) => i.id !== op.id) };
    case "setNorthStar":
      return { ...m, northStar: op.northStar };
    case "setProofMetrics":
      return { ...m, proofMetrics: op.proofMetrics };
    case "setMarket":
      return { ...m, market: op.market };
    case "setPositioning":
      return { ...m, positioning: op.positioning };
    case "setGuardrails":
      return { ...m, guardrails: op.guardrails };
    case "seedTemplate":
      return model ?? templateStrategyModel();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/strategy.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy.ts src/lib/strategy.test.ts
git commit -m "feat(strategy): data model, pure helpers, op reducer"
```

---

### Task 2: Derivation registry (autoKey → value)

**Files:**
- Create: `src/lib/strategy-derive.ts`
- Test: `src/lib/strategy-derive.test.ts`

**Interfaces:**
- Consumes: `segmentUnitMargin`, `PricingModel` from `@/lib/pricing`; `StrategyModel` from `@/lib/strategy` (Task 1).
- Produces (used by Tasks 8, 11): `DeriveCtx { pricingModel, milestones: {id,name,total,closed}[], dealsWonThisQuarter }`, `AutoValue { value: number | null; ok?: boolean }`, `resolveAuto(key, ctx): AutoValue`, `collectAutoKeys(model): string[]`, `applyAuto(model, auto): StrategyModel`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/strategy-derive.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  applyAuto,
  collectAutoKeys,
  resolveAuto,
  type DeriveCtx,
} from "@/lib/strategy-derive";
import type { StrategyModel } from "@/lib/strategy";

const ctx: DeriveCtx = {
  pricingModel: {
    segments: [
      { id: "solo", label: "Solo", model: "usage", costPerUnit: 20, params: { pricePerUnit: 200 } },
      { id: "bank", label: "Bank", model: "license", params: { license: 1200000 } },
    ],
  },
  milestones: [
    { id: "m1", name: "MVP", total: 4, closed: 4 },
    { id: "m2", name: "Edge cases", total: 10, closed: 6 },
    { id: "m0", name: "Empty", total: 0, closed: 0 },
  ],
  dealsWonThisQuarter: 2,
};

describe("resolveAuto", () => {
  it("pricing.margin.<seg> → marginPct, ok at ≥50", () => {
    expect(resolveAuto("pricing.margin.solo", ctx)).toEqual({ value: 90, ok: true });
  });
  it("pricing.margin for a license segment (no per-unit price) → null", () => {
    expect(resolveAuto("pricing.margin.bank", ctx)).toEqual({ value: null });
  });
  it("pricing.margin for an unknown segment → null", () => {
    expect(resolveAuto("pricing.margin.nope", ctx)).toEqual({ value: null });
  });
  it("milestone.progress.<id> → pct, ok only at 100", () => {
    expect(resolveAuto("milestone.progress.m1", ctx)).toEqual({ value: 100, ok: true });
    expect(resolveAuto("milestone.progress.m2", ctx)).toEqual({ value: 60, ok: false });
    expect(resolveAuto("milestone.progress.m0", ctx)).toEqual({ value: null });
  });
  it("deals.trialWon → count, ok when > 0", () => {
    expect(resolveAuto("deals.trialWon", ctx)).toEqual({ value: 2, ok: true });
    expect(resolveAuto("deals.trialWon", { ...ctx, dealsWonThisQuarter: 0 })).toEqual({
      value: 0,
      ok: false,
    });
  });
  it("analytics.northStar and unknown keys → null (not wired)", () => {
    expect(resolveAuto("analytics.northStar", ctx)).toEqual({ value: null });
    expect(resolveAuto("bogus.key", ctx)).toEqual({ value: null });
  });
});

const model: StrategyModel = {
  stages: [
    {
      id: "p1",
      label: "Stage 1",
      status: "active",
      kpis: [
        { name: "margin", autoKey: "pricing.margin.solo" },
        { name: "manual", current: 5, target: 10 },
      ],
    },
  ],
  signals: [
    { id: "a", pillar: "viability", claim: "margin ok", ok: false, autoKey: "pricing.margin.solo" },
    { id: "b", pillar: "desirability", claim: "manual", ok: true },
  ],
  initiatives: [],
  northStar: { label: "reports/mo", target: 100, autoKey: "analytics.northStar" },
  proofMetrics: [{ label: "won", autoKey: "deals.trialWon" }],
};

describe("collectAutoKeys", () => {
  it("collects and dedupes keys from signals, kpis, northStar, proofMetrics", () => {
    expect(collectAutoKeys(model).sort()).toEqual([
      "analytics.northStar",
      "deals.trialWon",
      "pricing.margin.solo",
    ]);
  });
});

describe("applyAuto", () => {
  const auto = {
    "pricing.margin.solo": { value: 90, ok: true },
    "deals.trialWon": { value: 2, ok: true },
    "analytics.northStar": { value: null },
  };
  it("overrides auto signal ok, leaves manual signals untouched", () => {
    const out = applyAuto(model, auto);
    expect(out.signals.find((s) => s.id === "a")!.ok).toBe(true);
    expect(out.signals.find((s) => s.id === "b")!.ok).toBe(true);
  });
  it("fills kpi and proof-metric currents; null resolutions leave fields alone", () => {
    const out = applyAuto(model, auto);
    expect(out.stages[0].kpis[0].current).toBe(90);
    expect(out.stages[0].kpis[1].current).toBe(5);
    expect(out.proofMetrics![0].current).toBe(2);
    expect(out.northStar!.current).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/strategy-derive.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/strategy-derive.ts`:

```ts
/**
 * autoKey → value derivations. A signal/KPI carrying an `autoKey` renders an
 * `auto` badge and cannot be hand-set; its value comes from hub data via this
 * registry. Pure: the server page assembles DeriveCtx, this module only maps.
 */
import { segmentUnitMargin, type PricingModel } from "@/lib/pricing";
import type { StrategyModel } from "@/lib/strategy";

export interface DeriveCtx {
  pricingModel: PricingModel | null;
  milestones: { id: string; name: string; total: number; closed: number }[];
  dealsWonThisQuarter: number;
}

export interface AutoValue {
  value: number | null;
  ok?: boolean; // drives signal ✓/✕ when defined
}

export function resolveAuto(key: string, ctx: DeriveCtx): AutoValue {
  if (key.startsWith("pricing.margin.")) {
    const segId = key.slice("pricing.margin.".length);
    const seg = ctx.pricingModel?.segments.find((s) => s.id === segId);
    const m = seg ? segmentUnitMargin(seg) : null;
    return m ? { value: m.marginPct, ok: m.marginPct >= 50 } : { value: null };
  }
  if (key.startsWith("milestone.progress.")) {
    const id = key.slice("milestone.progress.".length);
    const ms = ctx.milestones.find((x) => x.id === id);
    if (!ms || ms.total === 0) return { value: null };
    const pct = Math.round((ms.closed / ms.total) * 100);
    return { value: pct, ok: pct >= 100 };
  }
  if (key === "deals.trialWon") {
    return { value: ctx.dealsWonThisQuarter, ok: ctx.dealsWonThisQuarter > 0 };
  }
  // analytics.northStar: stub until Analytics wiring exists (spec §8).
  return { value: null };
}

export function collectAutoKeys(model: StrategyModel): string[] {
  const keys = new Set<string>();
  for (const s of model.signals) if (s.autoKey) keys.add(s.autoKey);
  for (const st of model.stages) for (const k of st.kpis) if (k.autoKey) keys.add(k.autoKey);
  if (model.northStar?.autoKey) keys.add(model.northStar.autoKey);
  for (const p of model.proofMetrics ?? []) if (p.autoKey) keys.add(p.autoKey);
  return [...keys];
}

/** Merge resolved auto values into a copy of the model. */
export function applyAuto(
  model: StrategyModel,
  auto: Record<string, AutoValue>,
): StrategyModel {
  const get = (k?: string) => (k ? auto[k] : undefined);
  return {
    ...model,
    signals: model.signals.map((s) => {
      const a = get(s.autoKey);
      return a && a.ok !== undefined ? { ...s, ok: a.ok } : s;
    }),
    stages: model.stages.map((st) => ({
      ...st,
      kpis: st.kpis.map((k) => {
        const a = get(k.autoKey);
        return a && a.value !== null ? { ...k, current: a.value } : k;
      }),
    })),
    northStar: (() => {
      const a = get(model.northStar?.autoKey);
      return a && a.value !== null && model.northStar
        ? { ...model.northStar, current: a.value }
        : model.northStar;
    })(),
    proofMetrics: model.proofMetrics?.map((p) => {
      const a = get(p.autoKey);
      return a && a.value !== null ? { ...p, current: a.value } : p;
    }),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/strategy-derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy-derive.ts src/lib/strategy-derive.test.ts
git commit -m "feat(strategy): autoKey derivation registry (pricing, milestones, deals)"
```

---

### Task 3: Heavy-tail margin in pricing lib

**Files:**
- Modify: `src/lib/pricing.ts`
- Test: `src/lib/pricing.test.ts`

**Interfaces:**
- Consumes: existing `PricingSegment`, `segmentUnitMargin`.
- Produces (used by Task 9): `PricingSegment.costPerUnitHeavy?: number` and `segmentUnitMarginHeavy(seg): { price, cost, contribution, marginPct } | null` (same return shape as `segmentUnitMargin`, using `costPerUnitHeavy ?? costPerUnit`).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/pricing.test.ts`:

```ts
describe("segmentUnitMarginHeavy", () => {
  it("uses costPerUnitHeavy when present", () => {
    const m = segmentUnitMarginHeavy({ ...usage, costPerUnitHeavy: 70 });
    expect(m).toEqual({ price: 200, cost: 70, contribution: 130, marginPct: 65 });
  });
  it("falls back to costPerUnit when no heavy cost is set", () => {
    expect(segmentUnitMarginHeavy(usage)).toEqual(segmentUnitMargin(usage));
  });
  it("returns null without a per-unit price", () => {
    expect(segmentUnitMarginHeavy(license)).toBeNull();
  });
});
```

Also add `segmentUnitMarginHeavy` to the existing import from `@/lib/pricing` at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pricing.test.ts`
Expected: FAIL — `segmentUnitMarginHeavy` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/pricing.ts`, add to `PricingSegment`:

```ts
  /** Worst-case COGS for a heavy-tail unit (stress band ceiling). Optional. */
  costPerUnitHeavy?: number;
```

and append:

```ts
/** Heavy-tail (worst-case) unit economics: costPerUnitHeavy ?? costPerUnit. */
export function segmentUnitMarginHeavy(
  seg: PricingSegment,
): { price: number; cost: number; contribution: number; marginPct: number } | null {
  const base = segmentUnitMargin(seg);
  if (base === null) return null;
  const cost = seg.costPerUnitHeavy ?? base.cost;
  const contribution = base.price - cost;
  const marginPct = base.price > 0 ? Math.round((contribution / base.price) * 100) : 0;
  return { price: base.price, cost, contribution, marginPct };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat(pricing): heavy-tail cost + segmentUnitMarginHeavy for margin stress bands"
```

---

### Task 4: DB column `strategy_model`

**Files:**
- Modify: `src/db/schema.ts` (projects table — insert directly after the `pricingModel` line, ~line 102; add the type import near the existing `import type { PricingModel } from "@/lib/pricing";`)
- Create: `src/db/add-strategy-model-column.ts`

**Interfaces:**
- Consumes: `StrategyModel` from `@/lib/strategy` (Task 1).
- Produces (used by Tasks 5, 11): `projects.strategyModel: StrategyModel | null` on the Drizzle row type.

- [ ] **Step 1: Add the column to the schema**

In `src/db/schema.ts`, next to the existing `import type { PricingModel } from "@/lib/pricing";` add:

```ts
import type { StrategyModel } from "@/lib/strategy";
```

and directly after the `pricingModel` field in the `projects` table:

```ts
    // Strategy surface model (vision, stages, FDV signals, initiatives, …).
    // Shape is defined once in src/lib/strategy.ts. null = guided empty state.
    strategyModel: jsonb("strategy_model").$type<StrategyModel | null>(),
```

- [ ] **Step 2: Create the idempotent column script**

Create `src/db/add-strategy-model-column.ts` (mirrors `add-pricing-model-column.ts`):

```ts
import { config } from "dotenv";

config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

/**
 * Idempotent: add the `strategy_model` jsonb column to `projects`.
 * Neon HTTP — plain SQL, no transaction. Safe to re-run.
 * Run: npx tsx --env-file=.env.local src/db/add-strategy-model-column.ts
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS strategy_model jsonb`;
  const [{ exists }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'strategy_model'
    ) AS exists`;
  console.log(exists ? "✓ strategy_model present" : "✗ strategy_model missing");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Run the script and verify**

Run: `npx tsx --env-file=.env.local src/db/add-strategy-model-column.ts`
Expected output: `✓ strategy_model present`

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/add-strategy-model-column.ts
git commit -m "feat(strategy): projects.strategy_model jsonb column + idempotent add script"
```

---

### Task 5: Server action

**Files:**
- Create: `src/lib/strategy-actions.ts`

**Interfaces:**
- Consumes: `applyStrategyOp`, `StrategyOp`, `StrategyModel` (Task 1); `projects.strategyModel` column (Task 4); `getWorkspace` from `@/lib/data`; `isDepartmentEnabled` from `@/lib/departments`.
- Produces (used by Tasks 6–10): `applyStrategyOpAction(projectId: string, op: StrategyOp): Promise<void>` — importable from client components.

- [ ] **Step 1: Implement**

Create `src/lib/strategy-actions.ts`:

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { getWorkspace } from "@/lib/data";
import { isDepartmentEnabled } from "@/lib/departments";
import { applyStrategyOp, type StrategyModel, type StrategyOp } from "@/lib/strategy";

/**
 * Apply one StrategyOp to a project's strategyModel. Single-row read + write
 * (Neon HTTP — no transactions). Reducer logic lives in src/lib/strategy.ts.
 */
export async function applyStrategyOpAction(projectId: string, op: StrategyOp): Promise<void> {
  const ws = await getWorkspace();
  const [row] = await db
    .select({
      id: projects.id,
      enabledDepartments: projects.enabledDepartments,
      strategyModel: projects.strategyModel,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!row) throw new Error("Project not found");
  if (!isDepartmentEnabled(row.enabledDepartments, "strategy")) {
    throw new Error("Strategy surface is not enabled for this project");
  }
  const next = applyStrategyOp(row.strategyModel as StrategyModel | null, op);
  await db.update(projects).set({ strategyModel: next }).where(eq(projects.id, projectId));
  revalidatePath(`/projects/${projectId}/strategy`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/strategy-actions.ts
git commit -m "feat(strategy): applyStrategyOpAction server action (single-row op apply)"
```

---

### Task 6: UI primitives + interaction CSS

**Files:**
- Create: `src/components/strategy/strategy.css`
- Create: `src/components/strategy/ui.tsx`

**Interfaces:**
- Consumes: `KpiState`, `StageKpi`, `kpiState` from `@/lib/strategy`.
- Produces (used by Tasks 7–10 — exact signatures):
  - `Section({ n, title, sub, children, className? })`
  - `TipLayer()` — mount once; any element with `data-tip` gets a cursor-following popout
  - `Ring({ pct, size?, label? })` — `pct: number | null`
  - `HBar({ pct, className? })` — animated horizontal bar, `pct` 0–100
  - `KpiChipView({ kpi })` — renders name + current/target colored by `kpiState`
  - `Editable({ value, placeholder, onSave, className? })` — contentEditable, saves on blur
  - `InlineAdd({ fields, onAdd, label? })` — `fields: { key; placeholder; type? }[]`, `onAdd(values: Record<string, string>)`

- [ ] **Step 1: Create the CSS**

Create `src/components/strategy/strategy.css`:

```css
/* Strategy surface interaction grammar: keywords on page, sentences on hover. */
.s-tip {
  position: fixed;
  z-index: 50;
  pointer-events: none;
  max-width: 250px;
  transform: translate(-50%, calc(-100% - 12px)) scale(0.95);
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1.45;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
}
.s-tip-on {
  opacity: 1;
  transform: translate(-50%, calc(-100% - 12px)) scale(1);
}
.s-rise {
  animation: s-rise 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) both;
}
@keyframes s-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
.s-set {
  border-bottom: 1px dashed #4f9cff;
  cursor: text;
  outline: none;
  border-radius: 3px;
  padding: 0 2px;
}
.s-set:focus {
  background: rgb(79 156 255 / 0.08);
}
.s-chip {
  font-size: 11px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  padding: 2px 8px;
  white-space: nowrap;
  transition: transform 0.15s;
}
button.s-chip:hover {
  transform: translateY(-1px);
}
.s-grow {
  transform-origin: left;
  animation: s-grow 0.8s cubic-bezier(0.2, 0.7, 0.3, 1) both 0.3s;
}
@keyframes s-grow {
  from {
    transform: scaleX(0);
  }
}
.s-ring-arc {
  transition: stroke-dashoffset 0.9s cubic-bezier(0.2, 0.8, 0.2, 1), stroke 0.45s;
}
@media (prefers-reduced-motion: reduce) {
  .s-rise,
  .s-grow {
    animation: none;
  }
  .s-tip,
  .s-ring-arc {
    transition: none;
  }
}
```

- [ ] **Step 2: Create the primitives**

Create `src/components/strategy/ui.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { kpiState, type KpiState, type StageKpi } from "@/lib/strategy";

/** Numbered section header: badge + uppercase title + plain-gloss subtitle. */
export function Section({
  n,
  title,
  sub,
  children,
  className,
}: {
  n: number;
  title: string;
  sub: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`s-rise rounded-xl border bg-card p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2.5 border-b pb-2.5">
        <span className="grid size-6 flex-none place-items-center rounded-md bg-gradient-to-br from-teal-500 to-sky-500 text-xs font-extrabold text-white">
          {n}
        </span>
        <div className="flex flex-col">
          <h2 className="text-[13px] font-bold uppercase tracking-wider">{title}</h2>
          <span className="text-[10.5px] text-muted-foreground">{sub}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Cursor-following tooltip for every element carrying a data-tip. Mount once. */
export function TipLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    let on = false;
    const over = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest?.("[data-tip]") as HTMLElement | null;
      if (t?.dataset.tip) {
        tip.textContent = t.dataset.tip;
        on = true;
        tip.classList.add("s-tip-on");
      } else if (on) {
        on = false;
        tip.classList.remove("s-tip-on");
      }
    };
    const move = (e: MouseEvent) => {
      if (on) {
        tip.style.left = `${e.clientX}px`;
        tip.style.top = `${e.clientY}px`;
      }
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mousemove", move);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mousemove", move);
    };
  }, []);
  return <div ref={ref} className="s-tip" />;
}

const RING_R = 23;
const RING_C = 2 * Math.PI * RING_R;

/** Score ring: ≥75 green, ≥50 amber, else red; null = grey/em-dash. */
export function Ring({ pct, size = 46, label }: { pct: number | null; size?: number; label?: string }) {
  const stroke =
    pct == null ? "#64748b" : pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const off = pct == null ? RING_C : RING_C * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox="0 0 58 58" aria-label={label}>
      <circle cx="29" cy="29" r={RING_R} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
      <circle
        className="s-ring-arc"
        cx="29"
        cy="29"
        r={RING_R}
        fill="none"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={off}
        transform="rotate(-90 29 29)"
      />
      <text x="29" y="34" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">
        {pct ?? "—"}
      </text>
    </svg>
  );
}

/** Animated horizontal progress bar (pct 0–100). */
export function HBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-muted ${className ?? ""}`}>
      <div
        className="s-grow h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

const KPI_TEXT: Record<KpiState, string> = {
  ok: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
  na: "text-muted-foreground",
};

/** KPI chip: name + current(/target), value colored by kpiState. */
export function KpiChipView({ kpi }: { kpi: StageKpi }) {
  const state = kpiState(kpi);
  return (
    <span className="s-chip inline-flex items-baseline gap-1 text-muted-foreground" data-tip={kpi.tip}>
      {kpi.name}
      <b className={`font-bold ${KPI_TEXT[state]}`}>
        {kpi.current ?? "—"}
        {typeof kpi.target === "number" ? `/${kpi.target}` : ""}
      </b>
      {kpi.autoKey ? (
        <span className="rounded bg-sky-500 px-1 text-[9px] font-bold text-white" data-tip="auto-derived from hub data — can't be hand-set">
          auto
        </span>
      ) : null}
    </span>
  );
}

/** Edit-in-place text: dashed-underline span, saves on blur when changed. */
export function Editable({
  value,
  placeholder,
  onSave,
  className,
}: {
  value?: string;
  placeholder: string;
  onSave: (next: string) => void;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      data-tip="editable — click and type"
      className={`s-set ${value ? "" : "text-muted-foreground"} ${className ?? ""}`}
      onBlur={(e) => {
        const next = e.currentTarget.textContent?.trim() ?? "";
        if (next !== (value ?? "") && next !== placeholder) onSave(next);
      }}
    >
      {value || placeholder}
    </span>
  );
}

/** Tiny expandable add-form: a “＋” chip that opens inline inputs. */
export function InlineAdd({
  fields,
  onAdd,
  label = "add",
}: {
  fields: { key: string; placeholder: string; type?: "text" | "number" }[];
  onAdd: (values: Record<string, string>) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  if (!open) {
    return (
      <button type="button" className="s-chip text-muted-foreground" onClick={() => setOpen(true)}>
        ＋ {label}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(vals);
        setVals({});
        setOpen(false);
      }}
    >
      {fields.map((f) => (
        <input
          key={f.key}
          type={f.type ?? "text"}
          placeholder={f.placeholder}
          value={vals[f.key] ?? ""}
          onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
          className="h-7 w-28 rounded-md border bg-transparent px-2 text-xs"
        />
      ))}
      <button type="submit" className="s-chip">
        save
      </button>
      <button type="button" className="s-chip" onClick={() => setOpen(false)}>
        ×
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/strategy/strategy.css src/components/strategy/ui.tsx
git commit -m "feat(strategy): UI primitives (section, tooltip layer, ring, chips, edit-in-place)"
```

---

### Task 7: §1 Path to Scale

**Files:**
- Create: `src/components/strategy/path-to-scale.tsx`

**Interfaces:**
- Consumes: `Section`, `Editable`, `InlineAdd`, `KpiChipView` (Task 6); `applyStrategyOpAction` (Task 5); `routeProgress`, `Stage`, `StrategyModel` (Task 1).
- Produces (used by Task 11): `PathToScale({ model, projectId }: { model: StrategyModel; projectId: string })`.

- [ ] **Step 1: Implement**

Create `src/components/strategy/path-to-scale.tsx`:

```tsx
"use client";

import { applyStrategyOpAction } from "@/lib/strategy-actions";
import { routeProgress, type Stage, type StrategyModel } from "@/lib/strategy";

import { Editable, InlineAdd, KpiChipView, Section } from "./ui";

const BADGE: Record<Stage["status"], { label: string; cls: string }> = {
  active: { label: "ACTIVE", cls: "bg-teal-500 text-white" },
  next: { label: "NEXT", cls: "border text-muted-foreground" },
  goal: { label: "GOAL", cls: "bg-amber-500 text-white" },
  done: { label: "DONE", cls: "bg-emerald-600 text-white" },
};

const STAGE_COLORS = ["#14b8a6", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899"];

/** Route: ascending line, one station per stage, flag at the end. */
function Route({ stages }: { stages: Stage[] }) {
  const n = stages.length;
  if (!n) return null;
  const pct = Math.round(routeProgress(stages) * 100);
  const x = (i: number) => 40 + (i * 890) / Math.max(1, n - 1 + 0.45);
  const y = (i: number) => 78 - (i * 58) / Math.max(1, n - 1 + 0.45);
  const d = `M 20 82 ${stages.map((_, i) => `L ${x(i)} ${y(i)}`).join(" ")} L 968 16`;
  return (
    <svg viewBox="0 0 1000 96" className="my-1 w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="hsl(var(--border))" strokeWidth="4" strokeLinecap="round" pathLength={100} />
      <path
        d={d}
        fill="none"
        stroke="#14b8a6"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${pct} ${100 - pct}`}
      />
      {stages.map((s, i) => (
        <circle
          key={s.id}
          cx={x(i)}
          cy={y(i)}
          r="8"
          fill="hsl(var(--card))"
          stroke={STAGE_COLORS[i % STAGE_COLORS.length]}
          strokeWidth="3"
          data-tip={`${s.label}${s.what ? ` — ${s.what}` : ""}`}
        />
      ))}
      <text x="968" y="38" textAnchor="middle" fontSize="15" data-tip="Destination — the vision">
        🏁
      </text>
    </svg>
  );
}

function StageCard({ stage, projectId }: { stage: Stage; projectId: string }) {
  const badge = BADGE[stage.status];
  const save = (patch: Partial<Stage>) =>
    applyStrategyOpAction(projectId, { kind: "upsertStage", stage: { ...stage, ...patch } });
  const row = "grid grid-cols-[42px_1fr] items-baseline gap-2 border-t border-dashed py-1.5 text-xs";
  const lbl = "text-[9px] font-extrabold tracking-widest text-muted-foreground";
  return (
    <div className="min-w-56 flex-1 rounded-lg border bg-background/40 p-3 transition-transform hover:-translate-y-0.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
          <Editable value={stage.label} placeholder="Stage name" onSave={(v) => save({ label: v })} />
        </span>
        <span className={`ml-auto rounded px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-widest ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      <div className={`${row} border-t-0`}>
        <span className={lbl}>WHAT</span>
        <Editable value={stage.what} placeholder="offer · motion · who" onSave={(v) => save({ what: v })} />
      </div>
      <div className={row}>
        <span className={lbl}>WHY</span>
        <Editable value={stage.why} placeholder="the job this stage does" onSave={(v) => save({ why: v })} />
      </div>
      <div className={row}>
        <span className={lbl}>KPI</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {stage.kpis.map((k) => (
            <KpiChipView key={k.name} kpi={k} />
          ))}
          <InlineAdd
            label="KPI"
            fields={[
              { key: "name", placeholder: "name" },
              { key: "current", placeholder: "current", type: "number" },
              { key: "target", placeholder: "target", type: "number" },
            ]}
            onAdd={(v) =>
              v.name &&
              save({
                kpis: [
                  ...stage.kpis,
                  {
                    name: v.name,
                    current: v.current === "" ? null : Number(v.current),
                    target: v.target === "" ? null : Number(v.target),
                  },
                ],
              })
            }
          />
        </div>
      </div>
      <div className={row}>
        <span className={lbl}>EXIT</span>
        <span className="text-sky-600 dark:text-sky-400" data-tip="the gate that unlocks the next stage">
          <Editable value={stage.exitCriteria} placeholder="gate to the next stage" onSave={(v) => save({ exitCriteria: v })} />
        </span>
      </div>
      <div className={row}>
        <span className={lbl}>KILL</span>
        <span className="text-red-500" data-tip="stop or pivot if this fires">
          <Editable value={stage.killCriteria} placeholder="stop / pivot trigger" onSave={(v) => save({ killCriteria: v })} />
        </span>
      </div>
    </div>
  );
}

export function PathToScale({ model, projectId }: { model: StrategyModel; projectId: string }) {
  const pains = model.problem?.pains ?? [];
  return (
    <Section n={1} title="Path to Scale" sub="today → destination · each stage carries its own kill criterion">
      <div className="flex flex-wrap items-baseline gap-3">
        <div className="text-[11.5px] text-muted-foreground" data-tip={model.problem?.whyNow || "edit the diagnosis in §6 Market Landscape"}>
          <span className="mr-1 text-[9px] font-extrabold tracking-widest text-red-500">PROBLEM</span>
          {pains.length ? pains.map((p) => p.label).join(" · ") : "define pains in §6"}
          {model.problem?.whyNow ? (
            <>
              <span className="mx-1.5 text-[9px] font-extrabold tracking-widest text-sky-500">WHY NOW</span>
              {model.problem.whyNow}
            </>
          ) : null}
        </div>
        <div className="ml-auto flex items-baseline gap-2 text-[13px]">
          <span className="text-[9px] font-extrabold tracking-widest text-amber-500">DESTINATION</span>
          <span aria-hidden>🏁</span>
          <Editable
            value={model.vision}
            placeholder="one-line vision"
            className="font-semibold"
            onSave={(v) => applyStrategyOpAction(projectId, { kind: "setVision", vision: v })}
          />
        </div>
      </div>
      <Route stages={model.stages} />
      <div className="flex flex-wrap items-stretch gap-3">
        {model.stages.map((s) => (
          <StageCard key={s.id} stage={s} projectId={projectId} />
        ))}
        <div className="self-center">
          <InlineAdd
            label="stage"
            fields={[{ key: "label", placeholder: "stage name" }]}
            onAdd={(v) =>
              v.label &&
              applyStrategyOpAction(projectId, {
                kind: "upsertStage",
                stage: {
                  id: crypto.randomUUID(),
                  label: v.label,
                  status: model.stages.length ? "next" : "active",
                  kpis: [],
                },
              })
            }
          />
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/path-to-scale.tsx
git commit -m "feat(strategy): §1 Path to Scale (problem line, destination, route, stage-gate cards)"
```

---

### Task 8: §2 FDV Scorecard

**Files:**
- Create: `src/components/strategy/fdv-scorecard.tsx`

**Interfaces:**
- Consumes: `Section`, `Ring`, `InlineAdd`, `HBar` (Task 6); `applyStrategyOpAction` (Task 5); `PILLARS`, `pillarScore`, `signalIsStale`, `Signal`, `StrategyModel` (Task 1).
- Produces (used by Task 11): `FdvScorecard({ model, projectId, milestones }: { model: StrategyModel; projectId: string; milestones: { id: string; name: string; total: number; closed: number }[] })`. The `model` passed in is already auto-resolved (Task 11 applies `applyAuto` before rendering).

- [ ] **Step 1: Implement**

Create `src/components/strategy/fdv-scorecard.tsx`:

```tsx
"use client";

import { useState } from "react";

import { applyStrategyOpAction } from "@/lib/strategy-actions";
import {
  PILLARS,
  pillarScore,
  signalIsStale,
  type Pillar,
  type Signal,
  type StrategyModel,
} from "@/lib/strategy";

import { InlineAdd, Ring, Section } from "./ui";

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const pts = points
    .map((v, i) => `${2 + (i * 60) / (points.length - 1)},${24 - (v / 100) * 20}`)
    .join(" ");
  return (
    <svg width="64" height="26" viewBox="0 0 64 26" data-tip="score trend — direction matters more than the number">
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SignalRow({ signal, projectId }: { signal: Signal; projectId: string }) {
  const [open, setOpen] = useState(false);
  const stale = signalIsStale(signal);
  return (
    <div className="rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/50">
      <div className="flex cursor-pointer items-start gap-2" onClick={() => setOpen((v) => !v)}>
        <button
          type="button"
          data-tip={signal.autoKey ? "auto-derived — recomputes from hub data" : "click to re-assess — the pillar score recomputes"}
          className={`mt-0.5 grid size-4 flex-none place-items-center rounded border text-[10px] font-extrabold transition-transform hover:scale-110 ${
            signal.ok
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
              : "border-red-500/50 bg-red-500/10 text-red-500"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (!signal.autoKey) applyStrategyOpAction(projectId, { kind: "flipSignal", id: signal.id });
          }}
        >
          {signal.ok ? "✓" : "✕"}
        </button>
        <span className={signal.ok ? "" : "text-muted-foreground"}>{signal.claim}</span>
        <span className="ml-auto flex flex-none gap-1 self-center">
          {signal.stageId ? (
            <span className="s-chip text-[9px] text-violet-500" data-tip="the stage this signal de-risks">
              {signal.stageId}
            </span>
          ) : null}
          {signal.riskiest ? (
            <span className="s-chip text-[8px] font-bold text-red-500" data-tip="the fastest thesis-killer in this pillar">
              RISKIEST
            </span>
          ) : null}
          {signal.autoKey ? (
            <span className="rounded bg-sky-500 px-1 text-[9px] font-bold text-white">auto</span>
          ) : null}
          {stale ? (
            <span className="s-chip text-[9px] text-amber-500" data-tip="evidence older than 90 days — refresh it or it fades">
              stale
            </span>
          ) : null}
          {signal.source ? (
            signal.source.href ? (
              <a href={signal.source.href} className="s-chip text-[9px]" data-tip="source record — the underlying evidence" onClick={(e) => e.stopPropagation()}>
                {signal.source.label}
              </a>
            ) : (
              <span className="s-chip text-[9px]">{signal.source.label}</span>
            )
          ) : null}
          {!signal.ok ? (
            <button
              type="button"
              className="s-chip text-[9px] text-pink-500"
              data-tip="queue this gap as a Strategic Initiative"
              onClick={(e) => {
                e.stopPropagation();
                applyStrategyOpAction(projectId, {
                  kind: "upsertInitiative",
                  initiative: { id: crypto.randomUUID(), name: signal.claim, signalId: signal.id, stageId: signal.stageId },
                });
              }}
            >
              ✕ → initiative
            </button>
          ) : null}
        </span>
      </div>
      {open ? (
        <div className="mt-1 flex items-baseline gap-2 pl-6 text-[11px] text-muted-foreground">
          <span>{signal.why || "no reasoning recorded"}</span>
          <button
            type="button"
            className="s-chip ml-auto text-[9px]"
            onClick={() => applyStrategyOpAction(projectId, { kind: "setRiskiest", id: signal.id })}
          >
            mark riskiest
          </button>
          <button
            type="button"
            className="s-chip text-[9px] text-red-500"
            onClick={() => applyStrategyOpAction(projectId, { kind: "removeSignal", id: signal.id })}
          >
            remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PillarChart({
  pillar,
  milestones,
}: {
  pillar: Pillar;
  milestones: { id: string; name: string; total: number; closed: number }[];
}) {
  if (pillar === "feasibility" && milestones.length) {
    return (
      <div className="mt-2 border-t border-dashed pt-2">
        <span className="text-[8.5px] font-semibold uppercase tracking-widest text-muted-foreground">
          Capability burn-up · auto — Roadmap
        </span>
        <div className="mt-1.5 space-y-1.5">
          {milestones.slice(0, 4).map((m) => {
            const pct = m.total ? Math.round((m.closed / m.total) * 100) : 0;
            return (
              <div key={m.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="w-24 truncate">{m.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="s-grow h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 border-t border-dashed pt-2 text-[10px] text-muted-foreground">
      {pillar === "desirability"
        ? "adoption funnel appears when Growth data is wired"
        : pillar === "viability"
          ? "finalize-rate trend appears when Analytics is wired"
          : "capability burn-up appears when milestones exist"}
    </div>
  );
}

export function FdvScorecard({
  model,
  projectId,
  milestones,
}: {
  model: StrategyModel;
  projectId: string;
  milestones: { id: string; name: string; total: number; closed: number }[];
}) {
  const historyFor = (p: Pillar) =>
    (model.scoreHistory ?? []).map((h) => (p === "desirability" ? h.d : p === "feasibility" ? h.f : h.v));
  return (
    <Section n={2} title="FDV Scorecard" sub="Desirability · Feasibility · Viability · score = ✓ ÷ signals">
      <div className="flex flex-wrap items-stretch gap-3">
        {PILLARS.map((p) => {
          const { score, ok, total } = pillarScore(model.signals, p.id);
          return (
            <div key={p.id} className="min-w-60 flex-1 rounded-lg border bg-background/40 p-3">
              <div className="mb-2 flex items-center gap-2.5">
                <Ring pct={score} label={`${p.label} score`} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">{p.question}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {ok} / {total} signals
                  </span>
                </div>
                <span className="ml-auto self-start">
                  <Spark points={historyFor(p.id)} />
                </span>
              </div>
              {model.signals
                .filter((s) => s.pillar === p.id)
                .map((s) => (
                  <SignalRow key={s.id} signal={s} projectId={projectId} />
                ))}
              <div className="mt-1.5">
                <InlineAdd
                  label="signal"
                  fields={[
                    { key: "claim", placeholder: "keyword claim" },
                    { key: "why", placeholder: "why · flip condition" },
                    { key: "source", placeholder: "source label" },
                  ]}
                  onAdd={(v) =>
                    v.claim &&
                    applyStrategyOpAction(projectId, {
                      kind: "upsertSignal",
                      signal: {
                        id: crypto.randomUUID(),
                        pillar: p.id,
                        claim: v.claim,
                        ok: false,
                        why: v.why || undefined,
                        source: v.source ? { label: v.source } : undefined,
                        date: new Date().toISOString().slice(0, 10),
                      },
                    })
                  }
                />
              </div>
              <PillarChart pillar={p.id} milestones={milestones} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/fdv-scorecard.tsx
git commit -m "feat(strategy): §2 FDV scorecard (derived rings, signal rows, pillar charts)"
```

---

### Task 9: §3 Strategic Initiatives + §4 Traction & North Star

**Files:**
- Create: `src/components/strategy/initiatives-traction.tsx`

**Interfaces:**
- Consumes: `Section`, `Ring`, `HBar`, `Editable`, `InlineAdd` (Task 6); `applyStrategyOpAction` (Task 5); `Initiative`, `StrategyModel` (Task 1).
- Produces (used by Task 11): `InitiativesTraction({ model, projectId, milestones })` — same `milestones` shape as Task 8 (`{ id, name, total, closed }[]`), used for initiative progress + milestone picker.

- [ ] **Step 1: Implement**

Create `src/components/strategy/initiatives-traction.tsx`:

```tsx
"use client";

import { applyStrategyOpAction } from "@/lib/strategy-actions";
import type { Initiative, StrategyModel } from "@/lib/strategy";

import { Editable, HBar, InlineAdd, Ring, Section } from "./ui";

type MilestoneRow = { id: string; name: string; total: number; closed: number };

function InitiativeRow({
  initiative,
  model,
  projectId,
  milestones,
}: {
  initiative: Initiative;
  model: StrategyModel;
  projectId: string;
  milestones: MilestoneRow[];
}) {
  const gap = model.signals.find((s) => s.id === initiative.signalId);
  const ms = milestones.find((m) => m.id === initiative.milestoneId);
  const pct = ms && ms.total ? Math.round((ms.closed / ms.total) * 100) : 0;
  return (
    <div className="mt-2 rounded-lg border bg-background/40 p-3 transition-transform hover:translate-x-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {initiative.stageId ? (
          <span className="s-chip text-[9px] text-violet-500">{initiative.stageId}</span>
        ) : null}
        {gap ? (
          <span className="s-chip text-[10px] text-red-500" data-tip="the ✕ gap this initiative answers">
            ✕ {gap.claim}
          </span>
        ) : null}
        <span className="font-bold">{initiative.name}</span>
        {initiative.milestoneId ? (
          <a
            href={`#milestone-${initiative.milestoneId}`}
            className="s-chip text-[10px] text-sky-500"
            data-tip="Roadmap milestone driving this bar"
          >
            ◇ {ms?.name ?? "milestone"}
          </a>
        ) : (
          <select
            className="h-6 rounded-md border bg-transparent px-1 text-[10px]"
            defaultValue=""
            onChange={(e) =>
              e.target.value &&
              applyStrategyOpAction(projectId, {
                kind: "upsertInitiative",
                initiative: { ...initiative, milestoneId: e.target.value },
              })
            }
          >
            <option value="">link milestone…</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
        <button
          type="button"
          className="s-chip text-[9px] text-red-500"
          onClick={() => applyStrategyOpAction(projectId, { kind: "removeInitiative", id: initiative.id })}
        >
          remove
        </button>
      </div>
      <HBar pct={pct} className="mt-2" />
    </div>
  );
}

export function InitiativesTraction({
  model,
  projectId,
  milestones,
}: {
  model: StrategyModel;
  projectId: string;
  milestones: MilestoneRow[];
}) {
  const northStar = model.northStar;
  const nsPct =
    northStar && typeof northStar.current === "number" && typeof northStar.target === "number" && northStar.target > 0
      ? Math.min(100, Math.round((northStar.current / northStar.target) * 100))
      : null;
  return (
    <div className="grid gap-3.5 lg:grid-cols-[2fr_1fr]">
      <Section n={3} title="Strategic Initiatives" sub="top 3 · gap → initiative → milestone">
        {model.initiatives.filter((i) => !i.done).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            no initiatives yet — queue one from a red ✕ in the scorecard, or add below
          </p>
        ) : null}
        {model.initiatives
          .filter((i) => !i.done)
          .slice(0, 3)
          .map((i) => (
            <InitiativeRow key={i.id} initiative={i} model={model} projectId={projectId} milestones={milestones} />
          ))}
        <div className="mt-2">
          <InlineAdd
            label="initiative"
            fields={[{ key: "name", placeholder: "initiative name" }]}
            onAdd={(v) =>
              v.name &&
              applyStrategyOpAction(projectId, {
                kind: "upsertInitiative",
                initiative: { id: crypto.randomUUID(), name: v.name },
              })
            }
          />
        </div>
      </Section>
      <Section n={4} title="Traction & North Star" sub="proof inventory · leading indicators">
        <div className="flex items-center gap-3">
          <Ring pct={nsPct} label="north star progress" />
          <div className="flex flex-col text-xs">
            <span className="font-semibold tabular-nums">
              {northStar?.current ?? "—"} →{" "}
              <Editable
                value={northStar?.target != null ? String(northStar.target) : undefined}
                placeholder="target"
                onSave={(v) =>
                  applyStrategyOpAction(projectId, {
                    kind: "setNorthStar",
                    northStar: { label: northStar?.label ?? "north star", ...northStar, target: Number(v) || null },
                  })
                }
              />
            </span>
            <Editable
              value={northStar?.label}
              placeholder="north star metric"
              className="text-[10px] text-muted-foreground"
              onSave={(v) =>
                applyStrategyOpAction(projectId, {
                  kind: "setNorthStar",
                  northStar: { ...northStar, label: v },
                })
              }
            />
          </div>
        </div>
        <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Proof inventory
        </p>
        {(model.proofMetrics ?? []).map((m, idx) => {
          const pct =
            typeof m.current === "number" && typeof m.target === "number" && m.target > 0
              ? Math.round((m.current / m.target) * 100)
              : 0;
          return (
            <div key={idx} className="mt-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{m.label}</span>
                <span className="tabular-nums">
                  {m.current ?? "—"}
                  {m.target != null ? ` / ${m.target}` : ""}
                </span>
              </div>
              <HBar pct={pct} className="mt-1" />
            </div>
          );
        })}
        <div className="mt-2">
          <InlineAdd
            label="metric"
            fields={[
              { key: "label", placeholder: "label" },
              { key: "current", placeholder: "current", type: "number" },
              { key: "target", placeholder: "target", type: "number" },
            ]}
            onAdd={(v) =>
              v.label &&
              applyStrategyOpAction(projectId, {
                kind: "setProofMetrics",
                proofMetrics: [
                  ...(model.proofMetrics ?? []),
                  {
                    label: v.label,
                    current: v.current === "" ? null : Number(v.current),
                    target: v.target === "" ? null : Number(v.target),
                  },
                ],
              })
            }
          />
        </div>
      </Section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/initiatives-traction.tsx
git commit -m "feat(strategy): §3 initiatives + §4 traction/north star"
```

---

### Task 10: §5 Unit Economics + §6 Backdrop + empty state

**Files:**
- Create: `src/components/strategy/unit-economics.tsx`
- Create: `src/components/strategy/backdrop.tsx`
- Create: `src/components/strategy/empty-state.tsx`

**Interfaces:**
- Consumes: `Section`, `Editable`, `InlineAdd` (Task 6); `applyStrategyOpAction` (Task 5); `segmentUnitMargin`, `segmentUnitMarginHeavy`, `PricingModel` (Task 3); `StrategyModel` (Task 1).
- Produces (used by Task 11): `UnitEconomics({ pricingModel }: { pricingModel: PricingModel | null })`, `Backdrop({ model, projectId })`, `StrategyEmptyState({ projectId })`.

- [ ] **Step 1: Create `src/components/strategy/unit-economics.tsx`**

```tsx
"use client";

import { useState } from "react";

import {
  segmentUnitMargin,
  segmentUnitMarginHeavy,
  type PricingModel,
} from "@/lib/pricing";

import { Section } from "./ui";

export function UnitEconomics({ pricingModel }: { pricingModel: PricingModel | null }) {
  const [finalizeRatio, setFinalizeRatio] = useState(2);
  const [heavyShare, setHeavyShare] = useState(10);
  const segments = pricingModel?.segments ?? [];
  const first = segments.map((s) => ({ s, m: segmentUnitMargin(s) })).find((x) => x.m);
  let effective: number | null = null;
  if (first?.m) {
    const heavy = segmentUnitMarginHeavy(first.s)!;
    const caseCost = ((100 - heavyShare) / 100) * first.m.cost + (heavyShare / 100) * heavy.cost;
    effective = Math.max(0, Math.round(((first.m.price - caseCost * finalizeRatio) / first.m.price) * 100));
  }
  return (
    <Section n={5} title="Unit Economics" sub="margin under stress · from pricingModel · packaging → Growth">
      {!segments.length ? (
        <p className="text-xs text-muted-foreground">set a pricing model on this project to derive margins</p>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-72 flex-[1.4] space-y-2.5">
            {segments.map((seg) => {
              const base = segmentUnitMargin(seg);
              if (!base) {
                return (
                  <p key={seg.id} className="text-[11px] text-muted-foreground">
                    {seg.label}: no per-unit price ({seg.model}) — margin derives per deal
                  </p>
                );
              }
              const heavy = segmentUnitMarginHeavy(seg)!;
              return (
                <div key={seg.id}>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {seg.label} · {seg.params.pricePerUnit as number}/{pricingModel?.unitLabel ?? "unit"}
                    </span>
                    <b className="tabular-nums">
                      {heavy.marginPct !== base.marginPct ? `${base.marginPct}% → ${heavy.marginPct}%` : `${base.marginPct}%`}
                    </b>
                  </div>
                  <div className="relative mt-1 h-3.5 overflow-hidden rounded-full bg-muted" data-tip="teal = margin kept · amber = heavy-tail erosion">
                    <span className="s-grow absolute inset-y-0 left-0 rounded-full bg-teal-500" style={{ width: `${heavy.marginPct}%` }} />
                    <span className="absolute inset-y-0 bg-amber-500/60" style={{ left: `${heavy.marginPct}%`, width: `${Math.max(0, base.marginPct - heavy.marginPct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {first?.m ? (
            <div className="min-w-64 flex-1">
              <label className="flex justify-between text-[10px] text-muted-foreground">
                <span>finalize rate (drafted per finalized)</span>
                <b className="tabular-nums">{finalizeRatio.toFixed(1)}×</b>
              </label>
              <input type="range" min="10" max="60" value={finalizeRatio * 10} className="w-full" onChange={(e) => setFinalizeRatio(Number(e.target.value) / 10)} />
              <label className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>heavy-tail share of cases</span>
                <b className="tabular-nums">{heavyShare}%</b>
              </label>
              <input type="range" min="0" max="40" value={heavyShare} className="w-full" onChange={(e) => setHeavyShare(Number(e.target.value))} />
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">effective margin</span>
                <b className={`ml-auto text-xl tabular-nums ${effective != null && effective >= 75 ? "text-teal-500" : effective != null && effective >= 50 ? "text-amber-500" : "text-red-500"}`}>
                  {effective ?? "—"}%
                </b>
              </div>
              <p className="text-[10px] text-muted-foreground">cost per paid unit = case cost × finalize ratio</p>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Create `src/components/strategy/backdrop.tsx`**

```tsx
"use client";

import { applyStrategyOpAction } from "@/lib/strategy-actions";
import type { StrategyModel } from "@/lib/strategy";

import { Editable, InlineAdd } from "./ui";

export function Backdrop({ model, projectId }: { model: StrategyModel; projectId: string }) {
  const market = model.market ?? {};
  const positioning = model.positioning ?? { dots: [] };
  const som =
    typeof market.sam === "number" && typeof market.capturePct === "number"
      ? Math.round(market.sam * (market.capturePct / 100))
      : null;
  const pains = model.problem?.pains ?? [];
  return (
    <details className="s-rise rounded-xl border border-dashed px-4">
      <summary className="cursor-pointer list-none py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span className="mr-2 inline-grid size-6 place-items-center rounded-md bg-gradient-to-br from-teal-500 to-sky-500 align-middle text-xs font-extrabold text-white">
          6
        </span>
        Market Landscape &amp; Moat
        <span className="ml-2 text-[10.5px] font-normal normal-case tracking-normal">
          problem · TAM · SAM · SOM · positioning · strategic guardrails
        </span>
      </summary>
      <div className="flex flex-wrap gap-3.5 pb-4">
        <div className="min-w-64 flex-1 rounded-lg border bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Problem &amp; why now</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pains.map((p, i) => (
              <button
                key={i}
                type="button"
                className="s-chip text-[10px] text-red-500"
                data-tip="click to remove"
                onClick={() =>
                  applyStrategyOpAction(projectId, {
                    kind: "setProblem",
                    problem: { pains: pains.filter((_, j) => j !== i), whyNow: model.problem?.whyNow },
                  })
                }
              >
                {p.label} ×
              </button>
            ))}
            <InlineAdd
              label="pain"
              fields={[{ key: "label", placeholder: "pain keyword" }]}
              onAdd={(v) =>
                v.label &&
                applyStrategyOpAction(projectId, {
                  kind: "setProblem",
                  problem: { pains: [...pains, { label: v.label }], whyNow: model.problem?.whyNow },
                })
              }
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            <span className="mr-1 text-[9px] font-extrabold tracking-widest text-sky-500">WHY NOW</span>
            <Editable
              value={model.problem?.whyNow}
              placeholder="what changed — the diagnosis"
              onSave={(v) => applyStrategyOpAction(projectId, { kind: "setProblem", problem: { pains, whyNow: v } })}
            />
          </p>
        </div>
        <div className="min-w-64 flex-1 rounded-lg border bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            TAM → SAM → SOM <span className="normal-case tracking-normal">(whole · reachable · ours)</span>
          </p>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <p>
              <span className="text-muted-foreground">TAM: </span>
              <Editable value={market.tam} placeholder="whole market" onSave={(v) => applyStrategyOpAction(projectId, { kind: "setMarket", market: { ...market, tam: v } })} />
            </p>
            <p>
              <span className="text-muted-foreground">SAM: </span>
              <Editable value={market.sam != null ? String(market.sam) : undefined} placeholder="reachable (number)" onSave={(v) => applyStrategyOpAction(projectId, { kind: "setMarket", market: { ...market, sam: Number(v) || undefined } })} />
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">capture</span>
              <input
                type="range"
                min="1"
                max="50"
                defaultValue={market.capturePct ?? 10}
                className="flex-1"
                onMouseUp={(e) =>
                  applyStrategyOpAction(projectId, {
                    kind: "setMarket",
                    market: { ...market, capturePct: Number((e.target as HTMLInputElement).value) },
                  })
                }
              />
              <b className="tabular-nums">{market.capturePct ?? 10}%</b>
            </div>
            <p className="font-semibold text-teal-600 dark:text-teal-400 tabular-nums">SOM: {som ?? "—"}</p>
          </div>
        </div>
        <div className="min-w-64 flex-1 rounded-lg border bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Competitive positioning</p>
          <svg viewBox="0 0 300 170" className="mt-2 w-full">
            <rect x="30" y="8" width="262" height="130" rx="8" fill="none" stroke="hsl(var(--border))" />
            <line x1="161" y1="8" x2="161" y2="138" stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <line x1="30" y1="73" x2="292" y2="73" stroke="hsl(var(--border))" strokeDasharray="3 4" />
            {positioning.dots.map((d, i) => (
              <g key={i}>
                <circle cx={30 + (d.x / 100) * 262} cy={138 - (d.y / 100) * 130} r={d.self ? 8 : 6} fill={d.self ? "#14b8a6" : "#64748b"} data-tip={d.label} />
                <text x={30 + (d.x / 100) * 262} y={138 - (d.y / 100) * 130 - 10} textAnchor="middle" fontSize="9" fill="currentColor" opacity=".7">
                  {d.label}
                </text>
              </g>
            ))}
            <text x="161" y="160" textAnchor="middle" fontSize="9" opacity=".6" fill="currentColor">
              {positioning.xLabel ?? "x axis"}
            </text>
          </svg>
          <InlineAdd
            label="dot"
            fields={[
              { key: "label", placeholder: "name" },
              { key: "x", placeholder: "x 0–100", type: "number" },
              { key: "y", placeholder: "y 0–100", type: "number" },
            ]}
            onAdd={(v) =>
              v.label &&
              applyStrategyOpAction(projectId, {
                kind: "setPositioning",
                positioning: {
                  ...positioning,
                  dots: [...positioning.dots, { label: v.label, x: Number(v.x) || 50, y: Number(v.y) || 50, self: positioning.dots.length === 0 }],
                },
              })
            }
          />
        </div>
        <div className="min-w-56 flex-[0.8] rounded-lg border bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Strategic guardrails <span className="normal-case tracking-normal">(ruled out on purpose)</span>
          </p>
          <div className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
            {(model.guardrails ?? []).map((g, i) => (
              <p key={i}>
                ✋ {g}{" "}
                <button
                  type="button"
                  className="text-[9px] text-red-500"
                  onClick={() =>
                    applyStrategyOpAction(projectId, {
                      kind: "setGuardrails",
                      guardrails: (model.guardrails ?? []).filter((_, j) => j !== i),
                    })
                  }
                >
                  ×
                </button>
              </p>
            ))}
          </div>
          <div className="mt-2">
            <InlineAdd
              label="guardrail"
              fields={[{ key: "label", placeholder: "not doing…" }]}
              onAdd={(v) =>
                v.label &&
                applyStrategyOpAction(projectId, {
                  kind: "setGuardrails",
                  guardrails: [...(model.guardrails ?? []), v.label],
                })
              }
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">ruled out = strategy too</p>
        </div>
      </div>
    </details>
  );
}
```

- [ ] **Step 3: Create `src/components/strategy/empty-state.tsx`**

```tsx
"use client";

import { applyStrategyOpAction } from "@/lib/strategy-actions";

export function StrategyEmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="s-rise mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 text-center">
      <h2 className="text-sm font-bold uppercase tracking-wider">Set up Strategy</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Vision &amp; path · FDV scorecard · initiatives · traction · unit economics · market backdrop.
        Start from the shape template (three stage-gates, empty pillars) and fill it in-place — nothing
        is pre-written.
      </p>
      <button
        type="button"
        className="s-chip mt-4 border-teal-500/50 text-teal-600 dark:text-teal-400"
        onClick={() => applyStrategyOpAction(projectId, { kind: "seedTemplate" })}
      >
        Start from template
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/strategy/unit-economics.tsx src/components/strategy/backdrop.tsx src/components/strategy/empty-state.tsx
git commit -m "feat(strategy): §5 unit economics, §6 backdrop, guided empty state"
```

---

### Task 11: Page wiring + full verification

**Files:**
- Modify (replace contents): `src/app/(app)/projects/[id]/strategy/page.tsx`

**Interfaces:**
- Consumes: everything above — `PathToScale`, `FdvScorecard`, `InitiativesTraction`, `UnitEconomics`, `Backdrop`, `StrategyEmptyState`, `TipLayer`; `collectAutoKeys`, `resolveAuto`, `applyAuto`, `DeriveCtx` (Task 2); `getProject`, `getWorkspace` from `@/lib/data`; `Topbar` from `@/components/topbar`; drizzle `db`, `issues`, `milestones`, `deals` from schema.
- Produces: the live Strategy page.

- [ ] **Step 1: Replace the placeholder page**

Replace `src/app/(app)/projects/[id]/strategy/page.tsx` with:

```tsx
import { and, eq, gte } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { deals, issues, milestones } from "@/db/schema";
import { Topbar } from "@/components/topbar";
import { Backdrop } from "@/components/strategy/backdrop";
import { StrategyEmptyState } from "@/components/strategy/empty-state";
import { FdvScorecard } from "@/components/strategy/fdv-scorecard";
import { InitiativesTraction } from "@/components/strategy/initiatives-traction";
import { PathToScale } from "@/components/strategy/path-to-scale";
import { UnitEconomics } from "@/components/strategy/unit-economics";
import { TipLayer } from "@/components/strategy/ui";
import { isDepartmentEnabled } from "@/lib/departments";
import { getProject, getWorkspace } from "@/lib/data";
import { applyAuto, collectAutoKeys, resolveAuto, type AutoValue, type DeriveCtx } from "@/lib/strategy-derive";
import type { StrategyModel } from "@/lib/strategy";

import "@/components/strategy/strategy.css";

function quarterStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
}

export default async function ProjectStrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "strategy")) notFound();

  const model = (project.strategyModel ?? null) as StrategyModel | null;

  // Derivation context: milestone burn-up + won deals this quarter. Two plain
  // reads (Neon HTTP — no transactions), reduced in JS.
  const msRows = await db
    .select({ id: milestones.id, name: milestones.name })
    .from(milestones)
    .where(eq(milestones.projectId, id));
  const issueRows = await db
    .select({ milestoneId: issues.milestoneId, status: issues.status })
    .from(issues)
    .where(eq(issues.projectId, id));
  const msProgress = msRows.map((m) => {
    const rows = issueRows.filter((i) => i.milestoneId === m.id);
    return {
      id: m.id,
      name: m.name,
      total: rows.length,
      closed: rows.filter((i) => i.status === "done").length,
    };
  });
  const wonRows = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.projectId, id), eq(deals.stage, "won"), gte(deals.updatedAt, quarterStart())));

  const breadcrumb = [
    { label: project.name, href: `/projects/${id}` },
    { label: "Strategy" },
  ];

  if (!model) {
    return (
      <div className="flex h-full flex-col">
        <Topbar breadcrumb={breadcrumb} />
        <div className="flex-1 overflow-y-auto p-4">
          <StrategyEmptyState projectId={id} />
        </div>
        <TipLayer />
      </div>
    );
  }

  const ctx: DeriveCtx = {
    pricingModel: project.pricingModel ?? null,
    milestones: msProgress,
    dealsWonThisQuarter: wonRows.length,
  };
  const auto: Record<string, AutoValue> = Object.fromEntries(
    collectAutoKeys(model).map((k) => [k, resolveAuto(k, ctx)]),
  );
  const resolved = applyAuto(model, auto);

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={breadcrumb} />
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
        <PathToScale model={resolved} projectId={id} />
        <FdvScorecard model={resolved} projectId={id} milestones={msProgress} />
        <InitiativesTraction model={resolved} projectId={id} milestones={msProgress} />
        <UnitEconomics pricingModel={project.pricingModel ?? null} />
        <Backdrop model={resolved} projectId={id} />
      </div>
      <TipLayer />
    </div>
  );
}
```

Note: if `getProject`'s return type does not include `strategyModel`/`pricingModel` (check `src/lib/data.ts:399` — it selects project columns), extend its select to include them rather than querying twice.

- [ ] **Step 2: Typecheck + full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all vitest suites pass (including the pre-existing ones).

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev` — open the Valytica project → Strategy tab.
Expected: guided empty state renders; "Start from template" produces three stage cards (Stage 1/2/3), empty FDV pillars with add-signal forms, empty initiatives/traction, unit economics derived from the pricing model, collapsed §6. No Valytica content appears anywhere pre-filled.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/projects/[id]/strategy/page.tsx"
git commit -m "feat(strategy): live strategy page — data loading, derivations, six sections"
```

---

## Self-Review

- **Spec coverage:** §1 route+stage-gates (Task 7), §2 three-layer FDV (Task 8), §3/§4 (Task 9), §5 stress bands + dials (Tasks 3, 10), §6 incl. problem & why-now (Task 10), data model (Task 1), derivations (Task 2), column (Task 4), server action (Task 5), interaction grammar + reduced-motion (Task 6), empty state/template (Tasks 1, 10), gating + params-Promise (Task 11), tests (Tasks 1–3). Score-history snapshotting is spec §8 out-of-scope (sparkline renders when data exists).
- **Placeholder scan:** none — every step carries full code; the only "TBD"s are user-facing copy in empty states, which is the product's empty state by design.
- **Type consistency:** `milestones` prop shape `{ id, name, total, closed }[]` is identical in Tasks 2, 8, 9, 11; `StrategyOp` kinds used by components (Tasks 7–10) all exist in Task 1; `segmentUnitMarginHeavy` (Task 3) matches Task 10's import.
