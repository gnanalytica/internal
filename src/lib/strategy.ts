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

function stripAutoCurrent<T extends { autoKey?: string; current?: number | string | null }>(x: T): T {
  return x.autoKey ? { ...x, current: undefined } : x;
}

export function applyStrategyOp(model: StrategyModel | null, op: StrategyOp): StrategyModel {
  const m = model ?? emptyStrategyModel();
  switch (op.kind) {
    case "setVision":
      return { ...m, vision: op.vision };
    case "setProblem":
      return { ...m, problem: op.problem };
    case "upsertStage":
      return { ...m, stages: upsert(m.stages, { ...op.stage, kpis: op.stage.kpis.map(stripAutoCurrent) }) };
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
      return { ...m, northStar: op.northStar ? stripAutoCurrent(op.northStar) : op.northStar };
    case "setProofMetrics":
      return { ...m, proofMetrics: op.proofMetrics.map(stripAutoCurrent) };
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
