# Valytica Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Valytica project's hub content on the freshly-cleaned shell as a single canonical seed, with pricing as one source of truth, grounded in the real `valytica` repo and the approved product design.

**Architecture:** The Valytica project row (key `VAL`) already exists and is empty (content torn down 2026-07-03). We add one pricing constants module, point the strategy slide at it, then a single idempotent `seed-valytica.ts` reconstructs milestones → features → docs on the shell. Old multi-script seeds are deleted. Everything is grounded in `/Users/sandeeppvn/code/valytica` (real features/architecture) and `docs/superpowers/specs/2026-07-03-valytica-product-design.md` (positioning, hub-and-spoke, pricing).

**Tech Stack:** Next.js 16, Drizzle ORM over Neon HTTP, tsx seed scripts, Vitest, Tailwind v4.

## Global Constraints

- **Neon HTTP has no transactions** — seed scripts must be idempotent and sequential (upsert-by-natural-key), never `db.transaction`. `db:push --force` only in non-TTY. (See `[[neon-http-no-transactions]]`.)
- **Scope every DB write to `projects.key = "VAL"`** — never workspace-wide; never touch shared `users`/`workspace_members` or other products.
- **One number, one source:** all prices/tiers come from `src/lib/valytica-pricing.ts`. No pricing literal may be hardcoded in the strategy slide, docs, or seeds.
- **Grounding, not invention:** every roadmap feature, milestone, and reference doc must trace to the real `/Users/sandeeppvn/code/valytica` repo or the approved spec. Unknowns become a tracked research item, not a fabricated figure.
- **Currency:** amounts stored as whole units in entity currency; display via existing `src/lib/currency.ts` (INR base). Reuse it — do not add a second currency helper.
- **Money formatting** in seeds/docs uses INR (`₹`) with the existing conventions.

---

### Task 1: Single-source pricing module

**Files:**
- Create: `src/lib/valytica-pricing.ts`
- Test: `src/lib/valytica-pricing.test.ts`

**Interfaces:**
- Produces: `VALYTICA_PRICING` (typed const), `contributionMargin(perReport: number): number`, `type PricingTier`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { VALYTICA_PRICING, contributionMargin } from "@/lib/valytica-pricing";

describe("valytica pricing", () => {
  it("has the four canonical tiers in order", () => {
    expect(VALYTICA_PRICING.tiers.map((t) => t.id)).toEqual([
      "trial", "payg", "firm", "byoc",
    ]);
  });

  it("trial is free with a 5-report allowance", () => {
    const trial = VALYTICA_PRICING.tiers.find((t) => t.id === "trial")!;
    expect(trial.monthly).toBe(0);
    expect(trial.perReport).toBe(0);
    expect(trial.allowance).toBe(5);
  });

  it("BYOC is custom (null price)", () => {
    const byoc = VALYTICA_PRICING.tiers.find((t) => t.id === "byoc")!;
    expect(byoc.monthly).toBeNull();
    expect(byoc.perReport).toBeNull();
  });

  it("computes contribution margin per report against the ₹20 unit cost", () => {
    expect(contributionMargin(175)).toBe(155);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- valytica-pricing`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

```ts
/**
 * Single source of truth for Valytica's pricing. The strategy slide, the
 * seeded pricing doc, and the product economics all derive from here — so a
 * price changes in exactly one place. See
 * docs/superpowers/specs/2026-07-03-valytica-product-design.md §2.6.
 */
export type PricingTier = {
  id: "trial" | "payg" | "firm" | "byoc";
  name: string;
  audience: string;
  /** ₹/month; null = custom (per-deal). */
  monthly: number | null;
  /** ₹/report; null = custom; 0 = free. */
  perReport: number | null;
  /** Free reports before billing starts (trial only). */
  allowance?: number;
  blurb: string;
};

export const VALYTICA_PRICING = {
  currency: "INR",
  unitLabel: "report",
  /** COGS per report — AI inference + fulfilment. ~90% margin at PAYG. */
  costPerReport: 20,
  tiers: [
    {
      id: "trial",
      name: "Reverse trial",
      audience: "Any new valuer",
      monthly: 0,
      perReport: 0,
      allowance: 5,
      blurb: "Full features free for your first 5 reports — this is also the live demo.",
    },
    {
      id: "payg",
      name: "Pay-as-you-go",
      audience: "Independent valuers",
      monthly: 0,
      perReport: 175,
      blurb: "No commitment; pay per certified report after the trial.",
    },
    {
      id: "firm",
      name: "Firm",
      audience: "Small multi-valuer firms doing volume",
      monthly: 2999,
      perReport: 120,
      blurb: "Lower per-report for teams; shared cases, seats, and QA.",
    },
    {
      id: "byoc",
      name: "BYOC / Enterprise",
      audience: "Banks & large firms",
      monthly: null,
      perReport: null,
      blurb: "Custom deploy in your infra: setup + hyper-customization + annual license. Opt-in anonymized-data clause; your case data never leaves your tenant.",
    },
  ] satisfies PricingTier[],
} as const;

/** Contribution margin per report at a given price, vs the fixed unit cost. */
export function contributionMargin(perReport: number): number {
  return perReport - VALYTICA_PRICING.costPerReport;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- valytica-pricing`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/valytica-pricing.ts src/lib/valytica-pricing.test.ts
git commit -m "feat(valytica): single-source pricing module"
```

---

### Task 2: Point the strategy slide at the pricing module + fix positioning

**Files:**
- Modify: `src/components/valytica-market-dashboard.tsx`

**Interfaces:**
- Consumes: `VALYTICA_PRICING`, `contributionMargin` from Task 1.

- [ ] **Step 1: Read the current slide** to find every hardcoded price/TAT/positioning literal.

Run: `grep -nE "₹|report|days|same-day|2-3|200|180" src/components/valytica-market-dashboard.tsx`
Expected: a list of literals (e.g. `₹200/report`, `~90% gross margin`, `2-3 days`).

- [ ] **Step 2: Replace pricing literals with derived values**

Import at top:

```tsx
import { VALYTICA_PRICING, contributionMargin } from "@/lib/valytica-pricing";
```

Replace the hardcoded per-report figure and margin with derived ones, e.g.:

```tsx
const payg = VALYTICA_PRICING.tiers.find((t) => t.id === "payg")!;
// …use `₹${payg.perReport}/report` and
// `₹${contributionMargin(payg.perReport!)}/report` in the JSX.
```

- [ ] **Step 3: Correct the TAT/positioning copy** per spec §2.2 and the research appendix (§5): segment "today's TAT" (residential ~2–5 days; commercial 1–3 weeks; industrial 2–4 weeks) and reframe the speed claim as **"certified report in hours, not days/weeks — valuer keeps inspection & sign-off,"** not a blanket "same-day valuation." Note AVMs (SigmaValue) are instant but not loan-usable — differentiation is *certified-fast*, not fast.

- [ ] **Step 4: Verify it compiles and renders**

Run: `rm -rf .next && npx tsc --noEmit`
Expected: no type errors in the modified file.

- [ ] **Step 5: Commit**

```bash
git add src/components/valytica-market-dashboard.tsx
git commit -m "refactor(valytica): derive slide pricing from module; segment TAT, reframe speed as certified-fast"
```

---

### Task 3: Ground the roadmap in the real valytica repo

**Files:**
- Create: `docs/superpowers/notes/2026-07-03-valytica-repo-grounding.md` (working notes; deleted after Task 5)

**Interfaces:**
- Produces: a structured list of real milestones + features + reference-doc topics for Tasks 4–5.

- [ ] **Step 1: Read the real repo's roadmap surfaces**

Read (do not modify) in `/Users/sandeeppvn/code/valytica`:
- `README.md`, `AGENTS.md`, `docs/ai-retrieval-design.md`
- `src/` top-level structure (feature areas), `supabase/` (schema/migrations for the data model), `scripts/`, `evals/`
- `package.json` deps (the real stack) and any roadmap/feature docs found under `docs/`.

- [ ] **Step 2: Extract, into the notes file:**
  - **Milestones** — the real release phases (shipped vs upcoming), with honest target dates. Reconcile with spec §2 (hub-and-spoke: self-serve hub, BYOC spokes, telemetry/feedback flywheel).
  - **Features** — the actual feature areas (auth/multi-tenant, case lifecycle, AI extraction & verification, valuation methods, reports & billing, etc.), status per real code.
  - **Reference docs** — architecture, AI/retrieval, mobile, data model — topics mirrored from real repo docs.
  - **Flag gaps** — anything not evidenced in the repo becomes a `research`-type task in the seed, not an invented figure.

- [ ] **Step 3: Commit the notes**

```bash
git add docs/superpowers/notes/2026-07-03-valytica-repo-grounding.md
git commit -m "docs(valytica): repo grounding notes for reconstruction"
```

---

### Task 4: Canonical seed — product config + roadmap (milestones + features)

**Files:**
- Create: `src/db/seed-valytica.ts` (replaces the old one — see Task 6 for deletion of the others)
- Modify: `package.json` (ensure `db:seed-valytica` points at it)

**Interfaces:**
- Consumes: Task 3 grounding notes; `VALYTICA_PRICING` (for the economics field).
- Produces: milestones + features on project `VAL`; sets `projects.economics` from pricing.

- [ ] **Step 1: Write the seed** — idempotent, scoped to `VAL`:
  - Look up project by `key = "VAL"` (fail loudly if absent).
  - Set `projects.economics` = `{ currency: "INR", unitLabel: "report", pricePerUnit: <payg.perReport>, costPerUnit: VALYTICA_PRICING.costPerReport, notes: "PAYG tier; see valytica-pricing.ts" }`.
  - Upsert **milestones** by `(projectId, name)` from grounding notes.
  - Upsert **features** by `(projectId, title)`, each linked to its milestone, status from real repo.
  - No `db.transaction`; sequential awaits; re-run = no dupes.

- [ ] **Step 2: Run it**

Run: `npx tsx --env-file=.env.local src/db/seed-valytica.ts`
Expected: logs N milestones + M features created; second run logs 0 new (idempotent).

- [ ] **Step 3: Verify counts**

Run: `npx tsx --env-file=.env.local src/db/valytica-inventory.ts`
Expected: `milestones` and `features` match the grounding notes; `issues`/`pages` still 0.

- [ ] **Step 4: Commit**

```bash
git add src/db/seed-valytica.ts package.json
git commit -m "feat(valytica): canonical seed — product config + roadmap"
```

---

### Task 5: Canonical seed — docs tree (strategy + roadmap + reference)

**Files:**
- Modify: `src/db/seed-valytica.ts` (extend with a docs section)

**Interfaces:**
- Consumes: Task 4 milestones/features; `VALYTICA_PRICING`.
- Produces: `pages` under project `VAL` (TipTap docs).

- [ ] **Step 1: Add a `pages` section** to the seed (idempotent upsert by `(projectId, title)` at each tree level), building:
  - **"Valytica Product Strategy"** (top doc) — positioning, hub-and-spoke, the flywheel + the telemetry-vs-customer-data boundary, and a **pricing table rendered from `VALYTICA_PRICING`** (no literals). Fold in `docs/valytica-pain-points.md` as a grounding subsection.
  - **"Roadmap & Requirements"** — one child page per milestone (requirements checklist), derived from Task 4.
  - **"Reference"** — architecture / AI & retrieval / data model / mobile, mirroring the real repo docs (topics from Task 3).
  - Use the existing TipTap helpers pattern (`p`, `h`, `bullets`, `doc`) as in the old seeds; extract plain text into `contentText` for search.

- [ ] **Step 2: Run + verify**

Run: `npx tsx --env-file=.env.local src/db/seed-valytica.ts && npx tsx --env-file=.env.local src/db/valytica-inventory.ts`
Expected: `pages (docs)` count = strategy + per-milestone + reference pages; re-run adds 0.

- [ ] **Step 3: Delete grounding notes** (served their purpose): `git rm docs/superpowers/notes/2026-07-03-valytica-repo-grounding.md`

- [ ] **Step 4: Commit**

```bash
git add src/db/seed-valytica.ts
git rm docs/superpowers/notes/2026-07-03-valytica-repo-grounding.md
git commit -m "feat(valytica): canonical seed — docs tree (strategy, roadmap, reference)"
```

---

### Task 6: Fold in costs + remove superseded seeds

**Files:**
- Modify: `src/db/seed-valytica.ts` (append the fixed-cost expenses section from the old `seed-valytica-costs.ts`)
- Delete: `src/db/seed-valytica-roadmap.ts`, `src/db/seed-valytica-gtm.ts`, `src/db/seed-valytica-setup.ts`, `src/db/seed-valytica-costs.ts`
- Modify: `package.json` (remove the deleted scripts' entries; keep only `db:seed-valytica`)

**Interfaces:**
- Consumes: existing `expenses` insert logic + `MANAGED_VENDORS` cleanup from `seed-valytica-costs.ts`.

- [ ] **Step 1: Move the fixed-cost expenses** (Vercel/Supabase/Sentry/PostHog/Mappls, scoped to `VAL`, idempotent by `MANAGED_VENDORS`) into a `seedCosts()` section of the canonical seed. Keep the fixed-vs-usage split comment.

- [ ] **Step 2: Delete the superseded seed scripts and their npm entries**

```bash
git rm src/db/seed-valytica-roadmap.ts src/db/seed-valytica-gtm.ts src/db/seed-valytica-setup.ts src/db/seed-valytica-costs.ts
```
Remove `db:seed-valytica-roadmap`, `db:seed-valytica-gtm`, `db:seed-valytica-setup`, `db:seed-valytica-costs` from `package.json` scripts.

- [ ] **Step 3: Grep for dangling references** to the deleted scripts.

Run: `grep -rnE "seed-valytica-(roadmap|gtm|setup|costs)" --include="*.ts" --include="*.json" --include="*.md" . | grep -v node_modules`
Expected: only historical mentions in `docs/superpowers/` specs/plans (acceptable); no live code/package refs.

- [ ] **Step 4: Run the full seed + verify**

Run: `npx tsx --env-file=.env.local src/db/seed-valytica.ts && npx tsx --env-file=.env.local src/db/valytica-inventory.ts`
Expected: milestones + features + pages + `expenses = 5`; idempotent on re-run.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(valytica): fold costs into canonical seed; remove superseded seeds"
```

---

### Task 7: Full rebuild verification + cleanup

**Files:**
- Delete: `src/db/valytica-inventory.ts` (temporary diagnostic)
- Keep: `src/db/valytica-teardown.ts` (documents the clean-rebuild path)

- [ ] **Step 1: Prove the clean-rebuild path** end-to-end:

Run: `npx tsx --env-file=.env.local src/db/valytica-teardown.ts && npx tsx --env-file=.env.local src/db/seed-valytica.ts`
Expected: teardown clears, seed rebuilds; final state matches Task 6.

- [ ] **Step 2: Type-check + tests + lint**

Run: `rm -rf .next && npx tsc --noEmit && npm test && npm run lint`
Expected: all green.

- [ ] **Step 3: Spot-check the hub** — start dev, open the Valytica project, confirm roadmap, docs tree, and Finance render with the rebuilt content and single-source pricing.

Run: `npm run dev` (then visit the Valytica project) — or note manual verification.

- [ ] **Step 4: Remove the temporary inventory script + commit**

```bash
git rm src/db/valytica-inventory.ts
git add -A
git commit -m "chore(valytica): verify clean rebuild; drop temp inventory script"
```

---

## Self-Review

**Spec coverage** (against `2026-07-03-valytica-product-design.md`):
- §2.6 pricing → Task 1 (module) + Task 2 (slide) + Task 5 (doc table). ✓
- §2.2 positioning / TAT → Task 2. ✓
- §3.1 seeds 5→canonical → Tasks 4–6. ✓
- §3.2 single-source pricing → Task 1, enforced by Global Constraints. ✓
- §3.3 canonical strategy doc (+ fold pain-points) → Task 5. ✓
- §3.4 archive spent migrations → **not covered here** (separate from Valytica reconstruction; the migration-archive is a distinct hub-hygiene task — track separately, do not fold in). Noted as out of scope for this plan.
- Grounding constraint → Task 3. ✓

**Placeholder scan:** pricing module + tests are concrete; doc/roadmap *content* is authored at execution from Task 3 grounding (structure specified, not prose — appropriate for a content-seed, and each has a run+verify gate).

**Type consistency:** `VALYTICA_PRICING`, `PricingTier`, `contributionMargin` used consistently in Tasks 1/2/4/5. `perReport` may be null (BYOC) — Task 2/4 use `payg.perReport!` where non-null is guaranteed by tier id.

**Out of scope (tracked separately):** spec §3.4 migration-archive (`add-economics-column`, `rename-product-to-project`, `drop-pods`, `move-feasibility-to-atlas`, `backfill-people`) — hub-wide hygiene, not Valytica content.
