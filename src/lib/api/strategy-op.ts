/**
 * The API boundary for strategy edits. The web applies a `StrategyOp` through a
 * server action whose argument is typed by the compiler; an API body is not, so
 * this turns an untrusted JSON body into exactly the op shapes `applyStrategyOp`
 * accepts — rebuilt field by field, so nothing unknown is ever written into
 * `projects.strategyModel`.
 *
 * Pure (no IO) so every rule is unit-tested.
 */
import { ApiInputError } from "./errors";
import type {
  Initiative,
  KpiState,
  Pillar,
  Signal,
  Stage,
  StageKpi,
  StageStatus,
  StrategyModel,
  StrategyOp,
} from "@/lib/strategy";

const MAX_TEXT = 2000;
const MAX_LIST = 200;

const STAGE_STATUSES: StageStatus[] = ["active", "next", "goal", "done"];
const KPI_STATES: KpiState[] = ["ok", "warn", "bad", "na"];
const PILLAR_IDS: Pillar[] = ["desirability", "feasibility", "viability"];

export const STRATEGY_OP_KINDS = [
  "setVision",
  "setProblem",
  "upsertStage",
  "removeStage",
  "upsertSignal",
  "removeSignal",
  "flipSignal",
  "setRiskiest",
  "upsertInitiative",
  "removeInitiative",
  "setNorthStar",
  "setProofMetrics",
  "setMarket",
  "setPositioning",
  "setGuardrails",
  "seedTemplate",
] as const satisfies readonly StrategyOp["kind"][];

type Obj = Record<string, unknown>;

const bad = (path: string, what: string): never => {
  throw new ApiInputError(`\`${path}\`: ${what}.`);
};

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function obj(v: unknown, path: string): Obj {
  if (!isObj(v)) bad(path, "expected an object");
  return v as Obj;
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) bad(path, "expected an array");
  const arr = v as unknown[];
  if (arr.length > MAX_LIST) bad(path, `at most ${MAX_LIST} items`);
  return arr;
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string") bad(path, "expected text");
  const s = (v as string).trim();
  if (s.length > MAX_TEXT) bad(path, `at most ${MAX_TEXT} characters`);
  return s;
}

function requiredStr(v: unknown, path: string): string {
  const s = str(v, path);
  if (!s) bad(path, "cannot be empty");
  return s;
}

/** Optional text: absent, null and "" all read as "not set". */
function optStr(v: unknown, path: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = str(v, path);
  return s || undefined;
}

function num(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) bad(path, "expected a number");
  return v as number;
}

function optNum(v: unknown, path: string): number | undefined {
  return v === undefined || v === null ? undefined : num(v, path);
}

function nullableNum(v: unknown, path: string): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return num(v, path);
}

function optBool(v: unknown, path: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") bad(path, "expected true or false");
  return v as boolean;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): T {
  if (typeof v !== "string" || !allowed.includes(v as T)) bad(path, `expected one of: ${allowed.join(", ")}`);
  return v as T;
}

/** Only web links: the web renders a signal's source as an `<a href>`. */
function optHref(v: unknown, path: string): string | undefined {
  const s = optStr(v, path);
  if (s === undefined) return undefined;
  if (!/^https?:\/\//i.test(s)) bad(path, "must be an http(s) link");
  return s;
}

/** Drop keys whose value is undefined so the stored JSON stays tidy. */
function compact<T extends Obj>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function kpi(v: unknown, path: string): StageKpi {
  const o = obj(v, path);
  let current: StageKpi["current"];
  if (o.current === null) current = null;
  else if (typeof o.current === "string") current = str(o.current, `${path}.current`);
  else current = optNum(o.current, `${path}.current`);
  return compact({
    name: requiredStr(o.name, `${path}.name`),
    current,
    target: nullableNum(o.target, `${path}.target`),
    autoKey: optStr(o.autoKey, `${path}.autoKey`),
    tip: optStr(o.tip, `${path}.tip`),
    state: o.state === undefined || o.state === null ? undefined : oneOf(o.state, KPI_STATES, `${path}.state`),
  });
}

function stage(v: unknown, path: string): Stage {
  const o = obj(v, path);
  return compact({
    id: requiredStr(o.id, `${path}.id`),
    label: requiredStr(o.label, `${path}.label`),
    status: oneOf(o.status, STAGE_STATUSES, `${path}.status`),
    what: optStr(o.what, `${path}.what`),
    why: optStr(o.why, `${path}.why`),
    kpis: list(o.kpis ?? [], `${path}.kpis`).map((k, i) => kpi(k, `${path}.kpis[${i}]`)),
    exitCriteria: optStr(o.exitCriteria, `${path}.exitCriteria`),
    killCriteria: optStr(o.killCriteria, `${path}.killCriteria`),
  });
}

function signal(v: unknown, path: string): Signal {
  const o = obj(v, path);
  let source: Signal["source"];
  if (o.source !== undefined && o.source !== null) {
    const s = obj(o.source, `${path}.source`);
    source = compact({ label: requiredStr(s.label, `${path}.source.label`), href: optHref(s.href, `${path}.source.href`) });
  }
  const date = optStr(o.date, `${path}.date`);
  if (date !== undefined && Number.isNaN(new Date(date).getTime())) bad(`${path}.date`, "expected an ISO date");
  return compact({
    id: requiredStr(o.id, `${path}.id`),
    pillar: oneOf(o.pillar, PILLAR_IDS, `${path}.pillar`),
    claim: requiredStr(o.claim, `${path}.claim`),
    ok: optBool(o.ok, `${path}.ok`) ?? false,
    why: optStr(o.why, `${path}.why`),
    source,
    date,
    stageId: optStr(o.stageId, `${path}.stageId`),
    riskiest: optBool(o.riskiest, `${path}.riskiest`),
    autoKey: optStr(o.autoKey, `${path}.autoKey`),
  });
}

function initiative(v: unknown, path: string): Initiative {
  const o = obj(v, path);
  return compact({
    id: requiredStr(o.id, `${path}.id`),
    name: requiredStr(o.name, `${path}.name`),
    stageId: optStr(o.stageId, `${path}.stageId`),
    signalId: optStr(o.signalId, `${path}.signalId`),
    milestoneId: optStr(o.milestoneId, `${path}.milestoneId`),
    done: optBool(o.done, `${path}.done`),
  });
}

type Metric = { label: string; current?: number | null; target?: number | null; autoKey?: string };

function metric(v: unknown, path: string): Metric {
  const o = obj(v, path);
  return compact({
    label: requiredStr(o.label, `${path}.label`),
    current: nullableNum(o.current, `${path}.current`),
    target: nullableNum(o.target, `${path}.target`),
    autoKey: optStr(o.autoKey, `${path}.autoKey`),
  });
}

function problem(v: unknown, path: string): StrategyModel["problem"] {
  if (v === undefined || v === null) return undefined;
  const o = obj(v, path);
  return compact({
    pains: list(o.pains ?? [], `${path}.pains`).map((p, i) => {
      const po = obj(p, `${path}.pains[${i}]`);
      return compact({ label: requiredStr(po.label, `${path}.pains[${i}].label`), signalId: optStr(po.signalId, `${path}.pains[${i}].signalId`) });
    }),
    whyNow: optStr(o.whyNow, `${path}.whyNow`),
  });
}

function market(v: unknown, path: string): StrategyModel["market"] {
  if (v === undefined || v === null) return undefined;
  const o = obj(v, path);
  const capturePct = optNum(o.capturePct, `${path}.capturePct`);
  if (capturePct !== undefined && (capturePct < 0 || capturePct > 100)) bad(`${path}.capturePct`, "must be between 0 and 100");
  return compact({
    tamLabel: optStr(o.tamLabel, `${path}.tamLabel`),
    tam: optStr(o.tam, `${path}.tam`),
    sam: optNum(o.sam, `${path}.sam`),
    capturePct,
  });
}

function positioning(v: unknown, path: string): StrategyModel["positioning"] {
  if (v === undefined || v === null) return undefined;
  const o = obj(v, path);
  const coord = (x: unknown, p: string) => {
    const n = num(x, p);
    if (n < 0 || n > 100) bad(p, "must be between 0 and 100");
    return n;
  };
  return compact({
    xLabel: optStr(o.xLabel, `${path}.xLabel`),
    yLabel: optStr(o.yLabel, `${path}.yLabel`),
    dots: list(o.dots ?? [], `${path}.dots`).map((d, i) => {
      const dot = obj(d, `${path}.dots[${i}]`);
      return compact({
        label: requiredStr(dot.label, `${path}.dots[${i}].label`),
        x: coord(dot.x, `${path}.dots[${i}].x`),
        y: coord(dot.y, `${path}.dots[${i}].y`),
        self: optBool(dot.self, `${path}.dots[${i}].self`),
      });
    }),
  });
}

/**
 * Parse `{ op: "<kind>", ...fields }` (or `{ kind: … }`, the web's own spelling)
 * into a `StrategyOp`. Throws `ApiInputError` naming the offending field.
 */
export function parseStrategyOp(body: unknown): StrategyOp {
  const o = obj(body, "body");
  const kind = oneOf(o.op ?? o.kind, STRATEGY_OP_KINDS, "op");
  switch (kind) {
    case "setVision":
      return { kind, vision: str(o.vision ?? "", "vision") };
    case "setProblem":
      return { kind, problem: problem(o.problem, "problem") };
    case "upsertStage":
      return { kind, stage: stage(o.stage, "stage") };
    case "removeStage":
    case "removeSignal":
    case "flipSignal":
    case "setRiskiest":
    case "removeInitiative":
      return { kind, id: requiredStr(o.id, "id") };
    case "upsertSignal":
      return { kind, signal: signal(o.signal, "signal") };
    case "upsertInitiative":
      return { kind, initiative: initiative(o.initiative, "initiative") };
    case "setNorthStar":
      return { kind, northStar: o.northStar === undefined || o.northStar === null ? undefined : metric(o.northStar, "northStar") };
    case "setProofMetrics":
      return { kind, proofMetrics: list(o.proofMetrics ?? [], "proofMetrics").map((m, i) => metric(m, `proofMetrics[${i}]`)) };
    case "setMarket":
      return { kind, market: market(o.market, "market") };
    case "setPositioning":
      return { kind, positioning: positioning(o.positioning, "positioning") };
    case "setGuardrails":
      return { kind, guardrails: list(o.guardrails ?? [], "guardrails").map((g, i) => requiredStr(g, `guardrails[${i}]`)) };
    case "seedTemplate":
      return { kind };
  }
}
