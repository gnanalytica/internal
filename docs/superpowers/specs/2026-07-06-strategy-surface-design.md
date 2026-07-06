# Strategy Surface — Design Spec

- **Date:** 2026-07-06
- **Status:** Draft (for review)
- **Parent:** `2026-07-05-valytica-tool-restructure-design.md` (§4.3 Strategy)
- **Reference mockup:** `.superpowers/brainstorm/4462-1783331002/content/strategy-valytica-v8.html` (final, user-approved)

## Scope

Build the **Strategy department page** (`/projects/[id]/strategy`) for projects
that enable the `strategy` surface (valytica-first). This spec defines the
**structure, data model, derivations, and interaction grammar** of the page.

**Explicitly out of scope:** all Valytica *content* (vision text, stages,
signals, KPIs, numbers). The page ships as scaffolding with a guided empty
state; content is entered through the UI. Also out of scope: Growth and
Roadmap surfaces (later plans), and any change to other products.

## 1. Page structure — six sections

Fixed order; each section renders an empty state until its data exists.

| # | Section | Subtitle | Purpose |
|---|---|---|---|
| 1 | **Path to Scale** | today → destination · each leg carries its own kill criterion | phased thesis as a journey |
| 2 | **FDV Scorecard** | Desirability · Feasibility · Viability · score = ✓ ÷ signals | evidence-derived validation |
| 3 | **Strategic Initiatives** | top 3 · gap → initiative → milestone | the action layer |
| 4 | **Traction & North Star** | proof inventory · leading indicators | scoreboard |
| 5 | **Unit Economics** | margin under stress · from pricingModel | economics rationale |
| 6 | **Market Landscape & Moat** | TAM · SAM · SOM · positioning · guardrails | collapsed reference |

Section headers: numbered gradient badge + uppercase title + subtitle on its
own line, divided from content by a rule (as in v8).

### §1 Path to Scale
- **Destination line** (top-right): 🏁 + editable vision text.
- **Route SVG**: ascending line, one station per stage, flag at end, progress
  fill + "YOU ARE HERE" marker. Progress derives from the **active** stage's
  KPIs vs their targets (mean of per-KPI progress, clamped 0–1, mapped to
  the active leg's span of the route).
- **Stage cards** (one per stage, uniform five rows):
  `WHAT / WHY / KPI / EXIT / KILL` + status badge (`ACTIVE / NEXT / GOAL`,
  from stage.status). KPI chips colored by state (ok/warn/bad/na) from
  current-vs-target. EXIT text styled blue, KILL red.

### §2 FDV Scorecard
Three pillars in **D · F · V order**, each with three layers:
1. **Score ring** — `round(✓ ÷ total × 100)`, colored ≥75 green / ≥50 amber /
   else red. Never hand-set. + **trend sparkline** (score history snapshots).
2. **Signal rows** — tick (✓/✕, click to re-assess), keyword claim, badges:
   source chip (links to a hub object when set), `auto` (derived), `stale`
   (dated > 90 days), phase tag (`P1`/`P2`… = stage id), `RISKIEST` (one per
   pillar, user-flagged), `✕ → initiative` action. Row click expands a
   keyword reasoning line (`why · flip condition`).
3. **Pillar chart** — one auto chart per pillar (see §3 Derivations):
   Desirability = adoption funnel; Feasibility = capability burn-up;
   Viability = finalize-rate / margin trend. Placeholder empty state when the
   feeding data is absent.

### §3 Strategic Initiatives
- Max 3 visible; each row: phase tag · gap chip (the ✕ it answers) · name ·
  milestone chip (links to Roadmap milestone) · progress bar (auto = that
  milestone's closed/total issues).
- `✕ → initiative` in §2 creates a draft initiative pre-linked to the signal.
- Soft rule shown in subtitle: ≤1 initiative for a non-active stage.

### §4 Traction & North Star
- North Star ring: metric label + current (auto if wired, else set) + editable
  target.
- Proof-inventory bars (ordered list of metrics: label, current, target).
- Revenue line last, de-emphasized.

### §5 Unit Economics
- **Stress bands**: one per pricing segment/rate — best-case → worst-case
  margin (teal kept / amber erosion), derived from `pricingModel` via
  `segmentUnitMargin` extended with an optional cost range
  (`costPerUnitHeavy`).
- **Dials**: finalize-rate × heavy-tail-share → effective margin readout
  (client-side, from the same pricing params). Packaging/plan UI stays in
  Growth.

### §6 Market Landscape & Moat (collapsed `<details>`)
- TAM/SAM/SOM funnel (three editable values + capture % slider → SOM).
- Positioning map: 2 axes (editable labels) + competitor dots + self dot.
- Strategic guardrails: editable list of short "not doing" lines.

## 2. Data model

One new jsonb column, mirroring the `pricingModel` precedent:

```ts
// src/db/schema.ts (projects)
strategyModel: jsonb("strategy_model").$type<StrategyModel | null>()
```

```ts
// src/lib/strategy.ts (new; all types exported, all fields optional-first)
export type StageStatus = "active" | "next" | "goal" | "done";
export type KpiState = "ok" | "warn" | "bad" | "na";

export type StageKpi = {
  name: string;
  current?: number | string | null;   // null → "—" / na
  target?: number | string | null;
  autoKey?: string;                    // derivation id (see §3); overrides current
  tip?: string;                        // hover popout text
};

export type Stage = {
  id: string;                          // "p1", "p2", …
  label: string;                       // "SMB — PRODUCT-LED"
  status: StageStatus;
  what?: string; why?: string;
  kpis: StageKpi[];
  exitCriteria?: string;
  killCriteria?: string;
};

export type Signal = {
  id: string;
  pillar: "desirability" | "feasibility" | "viability";
  claim: string;                       // keyword text
  ok: boolean;                         // ✓ / ✕ (ignored when autoKey resolves)
  why?: string;                        // reasoning line (keywords)
  source?: { label: string; href?: string };  // href = hub route or URL
  date?: string;                       // ISO; > 90 days ⇒ stale badge
  stageId?: string;                    // phase tag
  riskiest?: boolean;
  autoKey?: string;                    // derivation id; renders `auto` badge
};

export type Initiative = {
  id: string;
  name: string;
  stageId?: string;
  signalId?: string;                   // the gap it answers
  milestoneId?: string;                // Roadmap link + auto progress
  done?: boolean;
};

export type StrategyModel = {
  vision?: string;
  stages: Stage[];
  signals: Signal[];
  scoreHistory?: { date: string; d: number; f: number; v: number }[]; // sparklines
  initiatives: Initiative[];
  northStar?: { label: string; current?: number; target?: number; autoKey?: string };
  proofMetrics?: { label: string; current?: number; target?: number; autoKey?: string }[];
  market?: { tamLabel?: string; tam?: string; sam?: number; capturePct?: number };
  positioning?: { xLabel?: string; yLabel?: string;
    dots: { label: string; x: number; y: number; self?: boolean }[] };
  guardrails?: string[];
} | null;
```

Pure helpers in `src/lib/strategy.ts` (unit-tested, node-env vitest):
- `pillarScore(signals, pillar)` → `{ score, ok, total }` (auto-resolved
  values already merged in by the caller).
- `signalIsStale(signal, now)` → boolean (> 90 days).
- `kpiState(kpi)` → KpiState (numeric compare vs target; na when current null).
- `stageProgress(stage)` → 0–1 (mean of numeric KPI current/target, clamped).
- `routeProgress(stages)` → 0–1 (done legs full + active leg's stageProgress
  scaled into its span).

## 3. Derivations (`autoKey` registry)

Server-side resolver map: `resolveAuto(key, ctx)` where ctx carries the
project's hub data. Initial keys (all optional — an unknown key renders "—"):

| key | source | value |
|---|---|---|
| `pricing.margin.<segmentId>` | `pricingModel` | unit margin % (existing `segmentUnitMargin`) |
| `milestone.progress.<milestoneId>` | issues | closed ÷ total for that milestone |
| `deals.trialWon` | deals | count of won deals this quarter |
| `analytics.northStar` | (stub) | returns null until Analytics wiring exists |

A signal/KPI with an `autoKey` shows the `auto` badge and cannot be flipped
by hand; its resolved value drives `ok` (signals: truthy/threshold in the
resolver) and `current` (KPIs). Resolution happens in the server component;
the client receives plain values plus an `auto` flag.

## 4. Interaction grammar (applies page-wide)

- **Popouts, not paragraphs:** long explanations live in a cursor-following
  tooltip (`data-tip`); on-page text stays keywords. One shared tooltip
  component.
- **Hover:** cards lift + cursor-following glow; evidence rows nudge; ticks
  scale; chips lift.
- **Entrance:** sections rise staggered; rings/bars/route/sparklines animate
  in once on mount (CSS-driven; respects `prefers-reduced-motion`).
- **Edit-in-place:** `set`-styled fields (dashed blue underline) save on blur
  via a server action updating `strategyModel`. Tick flips, riskiest flag,
  `✕ → initiative`, guardrail edits: same action.
- **Score pop:** flipping a tick recomputes and pops the pillar score.

## 5. Server / routing

- `src/app/(app)/projects/[id]/strategy/page.tsx` replaces the placeholder:
  server component; loads project + strategyModel + derivation ctx (issues,
  milestones, deals, pricingModel); gates on `isDepartmentEnabled`.
- One server action module (`updateStrategyModel` with narrow patch ops:
  set vision, upsert stage/signal/initiative, flip tick, etc.). Neon-HTTP
  safe: single-row `update projects set strategy_model = …` per op — no
  transactions.
- Client components for the interactive sections; server passes resolved data.

## 6. Empty state (structure ships, content doesn't)

With `strategyModel = null`, the page shows a **guided setup**: cards for
each section with one-line explanations and "add" actions (define vision →
add stages → add signals…). A "start from template" action seeds the *shape*
only: 3 unnamed stages (active/next/goal), 3 empty pillars, blank North Star —
no product content. Valytica launches in this state.

## 7. Testing

- `src/lib/strategy.test.ts`: pillarScore, kpiState, signalIsStale,
  stageProgress, routeProgress, and the pricing-margin derivation (pure fns,
  node env — matches existing vitest setup).
- No component/jsdom tests (repo convention).

## 8. Out of scope

- Valytica strategy content (entered later via UI).
- Growth surface (segments/packaging/pipeline — Plan 3), Roadmap surface
  polish (Plan 4).
- Analytics wiring for `analytics.northStar` (stub returns null).
- Score-history snapshotting job (append on manual save only, for now).

## 9. Resolved decisions

1. **Storage:** single `projects.strategyModel` jsonb (mirrors `pricingModel`;
   flexible, no new tables). Signals/initiatives volumes are small (solo use).
2. **Section set & order:** the six sections of v8, fixed.
3. **Stage model:** WHAT/WHY/KPI/EXIT/KILL with status badges (stage-gate
   vocabulary: KPIs measure, exit criteria advance, kill criteria stop).
4. **Scores are derived, never typed.** Same for `auto` values.
5. **Language:** executive terms as labels, plain gloss as subtitle/popout.
