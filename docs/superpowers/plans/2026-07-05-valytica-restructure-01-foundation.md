# Valytica Restructure — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three new surfaces (Strategy / Roadmap / Growth) as opt-in departments that appear only for Valytica, plus the `pricingModel` data plumbing and its tested margin helper — leaving each surface as a working placeholder that later plans flesh out.

**Architecture:** Additive and valytica-first. New surfaces are real departments in `src/lib/departments.ts` flagged `defaultOn: false`, so projects with `enabledDepartments = null` (everyone today) never see them; only Valytica's explicit `enabledDepartments` opts in. A new `pricingModel` jsonb column on `projects` sits alongside `economics` (untouched). Routes follow the existing `marketing/page.tsx` server-route pattern and render a shared placeholder for now.

**Tech Stack:** Next.js App Router (params are Promises), Drizzle ORM + Neon HTTP driver, vitest (node env), TypeScript.

## Global Constraints

- **Neon HTTP driver has no transactions** — all DB scripts must be idempotent and sequential; never `db.transaction(...)`. Non-TTY schema push uses `db:push --force`.
- **Route folder name === department slug**; tab hrefs are `${base}/${slug}`.
- **Tests are pure-logic only:** vitest is `environment: "node"`, `include: ["src/**/*.test.ts"]` (no `.test.tsx`, no jsdom/RTL). Only `src/lib/*` pure functions are unit-tested. React views/routes are verified via `npx tsc --noEmit` + `npm run lint` + `npm run build`, not unit tests.
- **No Valytica content.** This plan builds tool capability only — no vision text, pricing numbers, segments, milestones, or issues get seeded. `pricingModel` stays `null` for Valytica; surfaces render empty states.
- **Additive:** do not remove `features`, `economics`, or any existing department. Other products stay byte-for-byte unchanged.

---

### Task 1: Add Strategy / Roadmap / Growth as opt-in departments

**Files:**
- Modify: `src/lib/departments.ts` (the `DepartmentSlug` type, the `DEPARTMENTS` array, and `enabledDepartments()`)
- Test: `src/lib/departments.test.ts`

**Interfaces:**
- Produces: `DEPARTMENTS` now contains slugs `strategy`, `roadmap`, `growth` (each `defaultOn: false`); every entry has a `defaultOn: boolean`. `enabledDepartments(null)` returns only `defaultOn !== false` departments (the legacy seven). `DepartmentSlug` union includes the three new slugs.

- [ ] **Step 1: Update the failing test**

In `src/lib/departments.test.ts`, replace the existing `DEPARTMENTS` slug assertion and add a default-set assertion:

```ts
import { DEPARTMENTS, enabledDepartments } from "@/lib/departments";

describe("DEPARTMENTS", () => {
  it("lists the seven legacy departments plus the three opt-in surfaces", () => {
    expect(DEPARTMENTS.map((d) => d.slug)).toEqual([
      "product", "engineering", "analytics", "marketing",
      "sales", "customer-success", "finance",
      "strategy", "roadmap", "growth",
    ]);
  });

  it("defaults (null) to only the legacy seven — new surfaces are opt-in", () => {
    expect(enabledDepartments(null).map((d) => d.slug)).toEqual([
      "product", "engineering", "analytics", "marketing",
      "sales", "customer-success", "finance",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/departments.test.ts`
Expected: FAIL — current `DEPARTMENTS` has only 7 slugs, and `enabledDepartments(null)` returns all of them (no `defaultOn` filtering yet).

- [ ] **Step 3: Implement the department + default changes**

In `src/lib/departments.ts`:

1. Extend the type:
```ts
export type DepartmentSlug =
  | "product" | "engineering" | "analytics" | "marketing"
  | "sales" | "customer-success" | "finance"
  | "strategy" | "roadmap" | "growth";
```

2. Add `defaultOn: true` to each of the seven existing `DEPARTMENTS` entries, then append the three new ones:
```ts
  {
    slug: "strategy", label: "Strategy", icon: "🎯", color: "#7c3aed",
    tool: "Vision · FDV · economics", defaultOn: false,
  },
  {
    slug: "roadmap", label: "Roadmap", icon: "🗺️", color: "#2563eb",
    tool: "Milestones → issues", defaultOn: false,
  },
  {
    slug: "growth", label: "Growth", icon: "🚀", color: "#db2777",
    tool: "Segments · pipeline · campaigns", defaultOn: false,
  },
```

3. Change the null branch of `enabledDepartments` to respect `defaultOn`:
```ts
export function enabledDepartments(
  enabled: string[] | null | undefined,
): (typeof DEPARTMENTS)[number][] {
  if (enabled == null) return DEPARTMENTS.filter((d) => d.defaultOn !== false);
  return DEPARTMENTS.filter((d) => enabled.includes(d.slug));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/departments.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck (the `as const` array now needs `defaultOn` on every entry)**

Run: `npx tsc --noEmit`
Expected: exit 0. If it errors on a missing `defaultOn`, add `defaultOn: true` to the entry it names.

- [ ] **Step 6: Commit**

```bash
git add src/lib/departments.ts src/lib/departments.test.ts
git commit -m "feat(hub): add Strategy/Roadmap/Growth as opt-in departments (defaultOn:false)"
```

---

### Task 2: Add the `pricingModel` jsonb column

**Files:**
- Modify: `src/db/schema.ts` (add the column to the `projects` table, right after `economics`)
- Create: `src/db/add-pricing-model-column.ts`
- Modify: `package.json` (add a convenience script)

**Interfaces:**
- Produces: `projects.pricingModel` typed jsonb (nullable) with the per-segment shape; a live `pricing_model` column on the DB.

- [ ] **Step 1: Add the typed column to the schema**

In `src/db/schema.ts`, immediately after the `economics: jsonb(...)` block in the `projects` table, add:

```ts
    // Per-segment pricing model (supersedes `economics` for products on the new
    // model). Each segment declares its own pricing shape. null = not set yet.
    pricingModel: jsonb("pricing_model").$type<{
      currency?: string;   // ISO code, e.g. "INR".
      unitLabel?: string;  // what one unit is, e.g. "report".
      segments: Array<{
        id: string;        // "solo" | "firm" | "bank" | …
        label: string;
        model: "usage" | "subscription+usage" | "license";
        costPerUnit?: number;                       // COGS for this segment's unit
        params: Record<string, number | string>;    // pricePerUnit, monthly, seats, setupFee, license…
        creditSources?: string[];                    // e.g. ["free","referral","payg","bundle"]
      }>;
    } | null>(),
```

- [ ] **Step 2: Write the idempotent migration script**

Create `src/db/add-pricing-model-column.ts` (mirrors `src/db/add-economics-column.ts`):

```ts
import { config } from "dotenv";

config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

/**
 * Idempotent: add the `pricing_model` jsonb column to `projects`.
 * Neon HTTP — plain SQL, no transaction. Safe to re-run.
 * Run: npx tsx --env-file=.env.local src/db/add-pricing-model-column.ts
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_model jsonb`;
  const [{ exists }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'pricing_model'
    ) AS exists`;
  console.log(exists ? "✓ pricing_model present" : "✗ pricing_model missing");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Add a convenience script to package.json**

In `package.json` `scripts`, add after `"db:push"`:
```json
    "db:add-pricing-model": "tsx --env-file=.env.local src/db/add-pricing-model-column.ts",
```

- [ ] **Step 4: Run the migration and verify**

Run: `npm run db:add-pricing-model`
Expected output includes: `✓ pricing_model present`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (the schema change is type-only for now).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/add-pricing-model-column.ts package.json
git commit -m "feat(db): add projects.pricingModel jsonb column (idempotent migration)"
```

---

### Task 3: Pricing margin helper (the tested seam)

**Files:**
- Create: `src/lib/pricing.ts`
- Test: `src/lib/pricing.test.ts`

**Interfaces:**
- Produces:
  - `type PricingSegmentModel = "usage" | "subscription+usage" | "license"`
  - `interface PricingSegment { id: string; label: string; model: PricingSegmentModel; costPerUnit?: number; params: Record<string, number | string>; creditSources?: string[] }`
  - `interface PricingModel { currency?: string; unitLabel?: string; segments: PricingSegment[] }`
  - `function segmentUnitMargin(seg: PricingSegment): { price: number; cost: number; contribution: number; marginPct: number } | null` — returns `null` when the segment has no per-unit price (e.g. `license`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { segmentUnitMargin, type PricingSegment } from "@/lib/pricing";

const usage: PricingSegment = {
  id: "solo", label: "Independent", model: "usage",
  costPerUnit: 20, params: { pricePerUnit: 200 },
  creditSources: ["free", "referral", "payg", "bundle"],
};

const license: PricingSegment = {
  id: "bank", label: "Bank / BYOC", model: "license",
  params: { setupFee: 500000, license: 1200000 },
};

describe("segmentUnitMargin", () => {
  it("computes contribution and margin% for a usage segment", () => {
    expect(segmentUnitMargin(usage)).toEqual({
      price: 200, cost: 20, contribution: 180, marginPct: 90,
    });
  });

  it("treats a missing costPerUnit as zero cost", () => {
    const m = segmentUnitMargin({ ...usage, costPerUnit: undefined });
    expect(m).toEqual({ price: 200, cost: 0, contribution: 200, marginPct: 100 });
  });

  it("returns null when there is no per-unit price (license)", () => {
    expect(segmentUnitMargin(license)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/pricing.test.ts`
Expected: FAIL with "Cannot find module '@/lib/pricing'".

- [ ] **Step 3: Implement the helper**

Create `src/lib/pricing.ts`:

```ts
/**
 * Per-segment pricing model — the single source of truth read by the Strategy
 * (Viability) and Growth surfaces. Numbers live in `projects.pricingModel`;
 * this module only derives from them (never hardcodes a price).
 */
export type PricingSegmentModel = "usage" | "subscription+usage" | "license";

export interface PricingSegment {
  id: string;
  label: string;
  model: PricingSegmentModel;
  costPerUnit?: number;
  params: Record<string, number | string>;
  creditSources?: string[];
}

export interface PricingModel {
  currency?: string;
  unitLabel?: string;
  segments: PricingSegment[];
}

/**
 * Per-unit economics for a segment, or null when the segment has no per-unit
 * price (e.g. a `license` model priced by setup + annual fee, not per unit).
 */
export function segmentUnitMargin(
  seg: PricingSegment,
): { price: number; cost: number; contribution: number; marginPct: number } | null {
  const price = typeof seg.params.pricePerUnit === "number" ? seg.params.pricePerUnit : null;
  if (price == null) return null;
  const cost = seg.costPerUnit ?? 0;
  const contribution = price - cost;
  const marginPct = price > 0 ? Math.round((contribution / price) * 100) : 0;
  return { price, cost, contribution, marginPct };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/pricing.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat(pricing): per-segment PricingModel types + segmentUnitMargin helper"
```

---

### Task 4: Opt Valytica into the new surfaces

**Files:**
- Create: `src/db/valytica-enable-surfaces.ts`
- Modify: `package.json` (convenience script)

**Interfaces:**
- Consumes: `DepartmentSlug` values from Task 1.
- Produces: Valytica's `projects.enabledDepartments = ["strategy","roadmap","growth","analytics"]`. `pricingModel` is left `null` (no content).

- [ ] **Step 1: Write the idempotent enablement script**

Create `src/db/valytica-enable-surfaces.ts`:

```ts
import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Opt Valytica (key VAL) into the new surface set. Idempotent — re-running sets
 * the same array. Other products keep enabledDepartments = null (legacy set).
 * Run: npx tsx --env-file=.env.local src/db/valytica-enable-surfaces.ts
 */
async function main() {
  const res = await db
    .update(schema.projects)
    .set({ enabledDepartments: ["strategy", "roadmap", "growth", "analytics"] })
    .where(eq(schema.projects.key, "VAL"))
    .returning({ key: schema.projects.key });
  console.log(res.length ? `✓ enabled surfaces for ${res[0].key}` : "✗ VAL project not found");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add a convenience script to package.json**

In `package.json` `scripts`, add:
```json
    "db:enable-valytica-surfaces": "tsx --env-file=.env.local src/db/valytica-enable-surfaces.ts",
```

- [ ] **Step 3: Run it and verify**

Run: `npm run db:enable-valytica-surfaces`
Expected output: `✓ enabled surfaces for VAL`

- [ ] **Step 4: Commit**

```bash
git add src/db/valytica-enable-surfaces.ts package.json
git commit -m "feat(valytica): opt into strategy/roadmap/growth/analytics surfaces"
```

---

### Task 5: Placeholder routes + hide the duplicate Strategy tab

**Files:**
- Create: `src/components/surface-placeholder.tsx`
- Create: `src/app/(app)/projects/[id]/strategy/page.tsx`
- Create: `src/app/(app)/projects/[id]/roadmap/page.tsx`
- Create: `src/app/(app)/projects/[id]/growth/page.tsx`
- Modify: `src/components/project-tabs.tsx` (guard the hardcoded `vision` → "Strategy" tab)

**Interfaces:**
- Consumes: `isDepartmentEnabled(enabled, slug)` from `@/lib/departments`; `getProject`, `getWorkspace` from `@/lib/data`; `Topbar` from `@/components/topbar`.
- Produces: three navigable routes that render a placeholder; Valytica's tab strip shows Strategy/Roadmap/Growth/Analytics without a duplicate "Strategy".

- [ ] **Step 1: Create the shared placeholder component**

Create `src/components/surface-placeholder.tsx`:

```tsx
import { Topbar } from "@/components/topbar";

/** Temporary empty surface shell — replaced by Plans 2–4. */
export function SurfacePlaceholder({
  projectName,
  projectId,
  title,
}: {
  projectName: string;
  projectId: string;
  title: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: projectName, href: `/projects/${projectId}` }, { label: title }]} />
      <div className="flex flex-1 items-center justify-center p-4 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          {title} for {projectName} will live here.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the three routes**

Create `src/app/(app)/projects/[id]/strategy/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { SurfacePlaceholder } from "@/components/surface-placeholder";
import { isDepartmentEnabled } from "@/lib/departments";
import { getProject, getWorkspace } from "@/lib/data";

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
  return <SurfacePlaceholder projectName={project.name} projectId={id} title="Strategy" />;
}
```

Create `src/app/(app)/projects/[id]/roadmap/page.tsx` — identical, but slug `"roadmap"`, title `"Roadmap"`, function name `ProjectRoadmapPage`.

Create `src/app/(app)/projects/[id]/growth/page.tsx` — identical, but slug `"growth"`, title `"Growth"`, function name `ProjectGrowthPage`.

- [ ] **Step 3: Guard the hardcoded Strategy (vision) tab in project-tabs**

In `src/components/project-tabs.tsx`, add `isDepartmentEnabled` to the existing departments import:
```tsx
import { isDepartmentEnabled, visibleDepartments } from "@/lib/departments";
```
Then replace the hardcoded vision tab line so it only shows when the new `strategy` surface is NOT enabled (legacy products keep it; Valytica uses the `strategy` department instead):
```tsx
        // Legacy Strategy tab (the vision placeholder); hidden once the new
        // strategy surface is enabled so it isn't duplicated.
        ...(isDepartmentEnabled(project.enabledDepartments, "strategy")
          ? []
          : [{ href: `${base}/vision`, label: "Strategy" }]),
```

- [ ] **Step 4: Verify typecheck, lint, and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass. The three routes compile; Valytica's nav resolves Strategy/Roadmap/Growth/Analytics with no duplicate.

- [ ] **Step 5: Commit**

```bash
git add src/components/surface-placeholder.tsx "src/app/(app)/projects/[id]/strategy" "src/app/(app)/projects/[id]/roadmap" "src/app/(app)/projects/[id]/growth" src/components/project-tabs.tsx
git commit -m "feat(hub): placeholder Strategy/Roadmap/Growth routes; dedupe Strategy tab"
```

---

## Self-Review

- **Spec coverage:** §4.1 departments (Task 1), §4.5 pricingModel + §5 schema (Tasks 2–3), valytica opt-in / §6 (Task 4), §3 surface routes + tab wiring (Task 5). FDV/segment/ladder *content* scaffolding is intentionally deferred to Plans 2–4 (see below). Docs-as-capability (§4.6) is deferred to Plan 2/4 where pages attach to surfaces.
- **Placeholders:** none — every step has full code/commands.
- **Type consistency:** `PricingSegment`/`PricingModel` in Task 3 match the jsonb `$type` shape in Task 2. `isDepartmentEnabled` (Task 5) and `enabledDepartments` (Task 1) are existing/'updated exports. `defaultOn` added uniformly (Task 1 Step 5 guards the `as const` typecheck).

## Follow-on plans (to be written when we reach them)

Each is independent and builds only on this foundation; each replaces one placeholder route with a real surface. No Valytica content — structural scaffolding + empty states only.

- **Plan 2 — Strategy surface:** `strategy-view.tsx` with a Vision banner slot, FDV three-pillar layout (Desirability/Feasibility/Viability, each claim + RAG status), and a Viability pricing rollup that reads `pricingModel` via `segmentUnitMargin` (empty state when `null`). Attach docs (pages) to the surface.
- **Plan 3 — Growth surface:** `growth-view.tsx` merging Pipeline (reuse `getDeals`/`getAccounts`) · Campaigns (reuse `getCampaigns`/`getContentItems`) · Support (reuse `getTickets`) as sub-tabs, plus a Segments list (each rendering its `pricingModel` segment) and an ordered Ladder with per-step trigger fields.
- **Plan 4 — Roadmap surface:** `roadmap-view.tsx` listing milestones (`getMilestones`) with, per milestone, its `directIssues` (`getMilestone`) and an embedded `IssuesView` (`embedded`, pre-filtered by `projectId`), issues tagged via existing `issues.type` / `ISSUE_TYPES`. No `features` layer.
