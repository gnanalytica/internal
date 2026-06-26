# Product Department (Features + Roadmap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth department module — **Product** — with a `features` table, a status pipeline, a date/quarter roadmap per product, inline+linked specs, and feature→issue traceability.

**Architecture:** Follows the existing Product × Department matrix: a new module table keyed on `productId`, one entry in the `DEPARTMENTS` registry that auto-generates the product tab/route, plus a company-wide lens. The roadmap reuses `src/lib/roadmap.ts` date math with new quarter helpers.

**Tech Stack:** Next.js App Router (server components + server actions), Drizzle ORM + Neon Postgres (`drizzle-kit push`), Vitest, TypeScript, TipTap (`RichEditor`).

Spec: `docs/superpowers/specs/2026-06-26-product-department-design.md`.

---

## File Structure

- `src/db/schema.ts` — `features` table + relations; `issues.featureId` + relation. *(modify)*
- `src/lib/departments.ts` — add `features` department, `DepartmentSlug`, `FEATURE_STATUSES`. *(modify)*
- `src/lib/departments.test.ts` — update slug-list assertion. *(modify)*
- `src/lib/roadmap.ts` — `quartersForRange`, `quarterLabel`. *(modify)*
- `src/lib/roadmap.test.ts` — quarter helper tests. *(create)*
- `src/lib/feature-progress.ts` — pure `featureProgress(issues)`. *(create)*
- `src/lib/feature-progress.test.ts` — tests. *(create)*
- `src/lib/types.ts` — `Feature*` types; `ProductSummary.openFeatures`. *(modify)*
- `src/lib/data.ts` — `getFeatures`, `getFeature`, `openFeatures` rollup. *(modify)*
- `src/lib/actions.ts` — `createFeature`, `updateFeature`, `linkIssueToFeature`, `createIssue` featureId. *(modify)*
- `src/components/feature-timeline.tsx` — shared quarter roadmap. *(create)*
- `src/components/features-view.tsx` — product + company feature views. *(create)*
- `src/components/feature-detail.tsx` — feature detail (spec, dates, issues). *(create)*
- `src/components/pickers.tsx` — `FeaturePicker`. *(modify)*
- `src/components/issue-detail.tsx` — feature picker wiring. *(modify)*
- `src/app/(app)/products/[id]/features/page.tsx` — product roadmap. *(create)*
- `src/app/(app)/products/[id]/features/[fid]/page.tsx` — feature detail route. *(create)*
- `src/app/(app)/features/page.tsx` — company portfolio. *(create)*
- `src/components/sidebar.tsx`, `src/components/products-view.tsx`, `src/app/(app)/products/[id]/page.tsx` — icon maps, nav, overview card. *(modify)*

Patterns to mirror: `tickets` table/relations/actions; `getTickets`; `ProjectPicker`; `roadmap-view.tsx`; `products/[id]/support/page.tsx`.

---

## Task 1: Schema — `features` table + `issues.featureId`

**Files:** Modify `src/db/schema.ts`

- [ ] **Step 1: Add the `features` table** (place near the other department tables, after `tickets`):

```ts
export const features = pgTable(
  "features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("idea"), // idea|planned|building|shipped|archived
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    spec: jsonb("spec"),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    sortKey: text("sort_key").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("features_ws_idx").on(t.workspaceId),
    index("features_product_idx").on(t.productId),
  ],
);

export const featuresRelations = relations(features, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [features.workspaceId], references: [workspaces.id] }),
  product: one(projects, { fields: [features.productId], references: [projects.id] }),
  owner: one(users, { fields: [features.ownerId], references: [users.id] }),
  page: one(pages, { fields: [features.pageId], references: [pages.id] }),
  issues: many(issues),
}));
```

- [ ] **Step 2: Add `featureId` to `issues`** — in the `issues` column block, after `cycleId`:

```ts
    featureId: uuid("feature_id").references(() => features.id, { onDelete: "set null" }),
```

- [ ] **Step 3: Add the relation** — in `issuesRelations`, after the `cycle` relation:

```ts
  feature: one(features, { fields: [issues.featureId], references: [features.id] }),
```

- [ ] **Step 4: Push schema**

Run: `npx drizzle-kit push --force`
Expected: creates `features` table, adds `issues.feature_id` + FK. `[✓] Changes applied`.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/db/schema.ts
git commit -m "feat(db): features table + issues.featureId"
```

---

## Task 2: Department registry + statuses

**Files:** Modify `src/lib/departments.ts`, `src/lib/departments.test.ts`

- [ ] **Step 1: Update the failing test first** — in `src/lib/departments.test.ts`, the assertion that lists slugs. Change it to include `features` (append after `support`):

```ts
expect(DEPARTMENTS.map((d) => d.slug)).toEqual([
  "engineering",
  "sales",
  "marketing",
  "finance",
  "support",
  "features",
]);
```

If a separate test asserts `enabledDepartments(null)` slug order, update it the same way (append `"features"`).

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/departments.test.ts`
Expected: FAIL — received array lacks `"features"`.

- [ ] **Step 3: Add the department + type + statuses** in `src/lib/departments.ts`.

Extend the union:
```ts
export type DepartmentSlug =
  | "engineering"
  | "sales"
  | "marketing"
  | "finance"
  | "support"
  | "features";
```

Append to the `DEPARTMENTS` array (after the `support` entry, before `] as const`):
```ts
  {
    slug: "features",
    label: "Product",
    icon: "🧭",
    color: "#8b5cf6",
    tool: "Roadmap & specs",
  },
```

Add the status list (next to `TICKET_STATUSES`):
```ts
// ---- Product: feature pipeline (order = board columns) ----
export const FEATURE_STATUSES = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "planned", label: "Planned", color: "#6366f1" },
  { id: "building", label: "Building", color: "#f59e0b" },
  { id: "shipped", label: "Shipped", color: "#10b981" },
  { id: "archived", label: "Archived", color: "#64748b" },
] as const;

export type FeatureStatusId = (typeof FEATURE_STATUSES)[number]["id"];
export const isFeatureStatus = (v: string): v is FeatureStatusId =>
  FEATURE_STATUSES.some((s) => s.id === v);
// Statuses that count as "open" (still on the roadmap).
export const OPEN_FEATURE_STATUSES: FeatureStatusId[] = ["idea", "planned", "building"];
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/departments.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/departments.ts src/lib/departments.test.ts
git commit -m "feat(departments): add Product (features) department + statuses"
```

---

## Task 3: Roadmap quarter helpers

**Files:** Modify `src/lib/roadmap.ts`; Create `src/lib/roadmap.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/roadmap.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { computeRange, quarterLabel, quartersForRange } from "./roadmap";

describe("quarterLabel", () => {
  it("labels quarters by month", () => {
    expect(quarterLabel(new Date(Date.UTC(2026, 0, 1)))).toBe("Q1 '26"); // Jan
    expect(quarterLabel(new Date(Date.UTC(2026, 6, 1)))).toBe("Q3 '26"); // Jul
    expect(quarterLabel(new Date(Date.UTC(2026, 11, 1)))).toBe("Q4 '26"); // Dec
  });
});

describe("quartersForRange", () => {
  it("buckets the range's months into positioned quarters", () => {
    // Range Jul 2026 .. (exclusive) Jan 2027 = Q3'26 + Q4'26.
    const range = computeRange(
      [{ startDate: new Date(Date.UTC(2026, 6, 1)), targetDate: new Date(Date.UTC(2026, 11, 20)) }],
      new Date(Date.UTC(2026, 6, 15)),
    );
    const qs = quartersForRange(range);
    expect(qs.map((q) => q.label)).toEqual(["Q3 '26", "Q4 '26"]);
    expect(qs[0].leftPct).toBeCloseTo(0, 5);
    // The two quarters together span the whole range.
    const last = qs[qs.length - 1];
    expect(last.leftPct + last.widthPct).toBeCloseTo(100, 0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/roadmap.test.ts`
Expected: FAIL — `quarterLabel`/`quartersForRange` not exported.

- [ ] **Step 3: Implement the helpers** — append to `src/lib/roadmap.ts`:

```ts
export function quarterLabel(d: Date): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  const yy = String(d.getUTCFullYear()).slice(2);
  return `Q${q} '${yy}`;
}

/**
 * Group a range's months into quarter columns for the timeline header, each
 * positioned as a percentage of the whole range (so bars from barMetrics line
 * up). Reuses the month grid already computed by computeRange.
 */
export function quartersForRange(
  range: RoadmapRange,
): { label: string; leftPct: number; widthPct: number }[] {
  const total = range.end.getTime() - range.start.getTime();
  const out: { label: string; leftPct: number; widthPct: number }[] = [];
  for (const m of range.months) {
    const label = quarterLabel(m);
    const monthStart = m.getTime();
    const monthEnd = addMonths(m, 1).getTime();
    const leftPct = ((monthStart - range.start.getTime()) / total) * 100;
    const widthPct = ((monthEnd - monthStart) / total) * 100;
    const prev = out[out.length - 1];
    if (prev && prev.label === label) {
      prev.widthPct += widthPct; // extend the existing quarter column
    } else {
      out.push({ label, leftPct, widthPct });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/roadmap.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roadmap.ts src/lib/roadmap.test.ts
git commit -m "feat(roadmap): quarter axis helpers"
```

---

## Task 4: Feature progress helper

**Files:** Create `src/lib/feature-progress.ts`, `src/lib/feature-progress.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/feature-progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { featureProgress } from "./feature-progress";

describe("featureProgress", () => {
  it("counts done vs total and a percentage", () => {
    expect(featureProgress([{ status: "done" }, { status: "backlog" }])).toEqual({
      done: 1,
      total: 2,
      pct: 50,
    });
  });
  it("treats canceled as neither done nor counted toward total", () => {
    expect(featureProgress([{ status: "done" }, { status: "canceled" }])).toEqual({
      done: 1,
      total: 1,
      pct: 100,
    });
  });
  it("is zero for no issues", () => {
    expect(featureProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/feature-progress.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/feature-progress.ts`:

```ts
/** Roll up a feature's linked issues into done/total/pct. Canceled issues are
 * excluded from the total; done counts completed work. Pure — easy to test. */
export function featureProgress(
  issues: { status: string }[],
): { done: number; total: number; pct: number } {
  const counted = issues.filter((i) => i.status !== "canceled");
  const done = counted.filter((i) => i.status === "done").length;
  const total = counted.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/feature-progress.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feature-progress.ts src/lib/feature-progress.test.ts
git commit -m "feat: featureProgress rollup helper"
```

---

## Task 5: Types

**Files:** Modify `src/lib/types.ts`

- [ ] **Step 1: Add feature types** — near the other module types:

```ts
export type Feature = typeof features.$inferSelect;

export type FeatureWithRelations = Feature & {
  product: Project | null;
  owner: Member | null;
  page: { id: string; title: string; icon: string } | null;
};

export type FeatureDetail = FeatureWithRelations & {
  issues: IssueWithRelations[];
};
```

Ensure `features` is imported from the schema at the top of `types.ts` (the file already imports `projects`, `teams`, etc. from `@/db/schema` — add `features`). `Member` and `Project` are already defined in this file.

- [ ] **Step 2: Add `openFeatures` to `ProductSummary`** — in the `ProductSummary` type (around line 118), add:

```ts
  openFeatures: number;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `data.ts`/views that don't yet set `openFeatures` (fixed in Task 6/9). If `types.ts` itself errors, fix the import. Commit after Task 6 keeps the tree green; to commit now, proceed to Task 6 first.

- [ ] **Step 4: Commit** (bundled with Task 6 — see Task 6 Step 6).

---

## Task 6: Data layer — getFeatures, getFeature, rollup

**Files:** Modify `src/lib/data.ts`

- [ ] **Step 1: Add `getFeatures`** (mirror `getTickets`; `features` is already exported from schema via `data.ts`'s `schema` re-export — reference it as `features` after adding to the existing destructured import from `@/db/schema` at the top of `data.ts`):

```ts
export async function getFeatures(
  workspaceId: string,
  productId?: string,
): Promise<FeatureWithRelations[]> {
  return db.query.features.findMany({
    where: productId
      ? and(eq(features.workspaceId, workspaceId), eq(features.productId, productId))
      : eq(features.workspaceId, workspaceId),
    orderBy: [asc(features.sortKey), desc(features.createdAt)],
    with: { product: true, owner: true, page: { columns: { id: true, title: true, icon: true } } },
  });
}
```

- [ ] **Step 2: Add `getFeature`** (detail with linked issues for progress):

```ts
export async function getFeature(
  workspaceId: string,
  id: string,
): Promise<import("@/lib/types").FeatureDetail | null> {
  const row = await db.query.features.findFirst({
    where: and(eq(features.workspaceId, workspaceId), eq(features.id, id)),
    with: {
      product: true,
      owner: true,
      page: { columns: { id: true, title: true, icon: true } },
      issues: {
        orderBy: [asc(issues.sortKey)],
        with: {
          project: true,
          cycle: true,
          team: true,
          assignee: true,
          labels: { with: { label: true } },
        },
      },
    },
  });
  if (!row) return null;
  return { ...row, issues: row.issues.map((i) => ({ ...i, labels: i.labels.map((l) => l.label) })) };
}
```

- [ ] **Step 3: Add the `openFeatures` rollup** in `getProductSummaries`. Add a fetch to the `Promise.all` array:

```ts
    db
      .select({ productId: features.productId, status: features.status })
      .from(features)
      .where(eq(features.workspaceId, workspaceId)),
```

Bind it as `allFeatures` (add to the destructured array), import `OPEN_FEATURE_STATUSES` from `@/lib/departments`, and in the `.map`'s returned object add:

```ts
      openFeatures: allFeatures.filter(
        (f) => f.productId === p.id && OPEN_FEATURE_STATUSES.includes(f.status as never),
      ).length,
```

- [ ] **Step 4: Add `getPagesFlat`** (for the feature → page link picker):

```ts
export async function getPagesFlat(
  workspaceId: string,
): Promise<{ id: string; title: string; icon: string }[]> {
  return db
    .select({ id: pages.id, title: pages.title, icon: pages.icon })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt)))
    .orderBy(asc(pages.title));
}
```

Ensure `isNull` is imported from `drizzle-orm` in `data.ts` (add if missing).

- [ ] **Step 5: Add `features` (and confirm `pages`) in the schema import** at the top of `data.ts` (the destructured `import { … } from "@/db/schema"`).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (types + data now consistent).

- [ ] **Step 7: Commit Tasks 5 + 6**

```bash
git add src/lib/types.ts src/lib/data.ts
git commit -m "feat(data): feature types, getFeatures/getFeature, getPagesFlat, openFeatures rollup"
```

---

## Task 7: Actions — create/update/link

**Files:** Modify `src/lib/actions.ts`

- [ ] **Step 1: Add `createFeature`** (mirror `createTicket`; uses existing `getWorkspace`, `db`, `features`, `revalidateMatrix`):

```ts
export async function createFeature(input: {
  productId: string | null;
  title?: string;
  status?: string;
}) {
  const ws = await getWorkspace();
  const [created] = await db
    .insert(features)
    .values({
      workspaceId: ws.id,
      productId: input.productId,
      title: input.title?.trim() || "New feature",
      status: input.status ?? "idea",
      sortKey: `z${Date.now()}`,
    })
    .returning();
  revalidateMatrix(input.productId);
  return created;
}
```

- [ ] **Step 2: Add `updateFeature`**:

```ts
export async function updateFeature(
  id: string,
  patch: Partial<{
    title: string;
    status: string;
    startDate: Date | null;
    targetDate: Date | null;
    spec: unknown;
    pageId: string | null;
    ownerId: string | null;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(features)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(features.id, id), eq(features.workspaceId, ws.id)));
  revalidateMatrix();
}
```

- [ ] **Step 3: Add `linkIssueToFeature`**:

```ts
export async function linkIssueToFeature(issueId: string, featureId: string | null) {
  const ws = await getWorkspace();
  await db
    .update(issues)
    .set({ featureId, updatedAt: new Date() })
    .where(and(eq(issues.id, issueId), eq(issues.workspaceId, ws.id)));
  revalidateMatrix();
}
```

- [ ] **Step 4: Thread `featureId` into `createIssue`** — add `featureId?: string | null` to the `createIssue` input type and `featureId: input.featureId ?? null` to its insert `.values({…})`.

- [ ] **Step 5: Add `features` to the schema import** in `actions.ts` if not already imported.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/lib/actions.ts
git commit -m "feat(actions): createFeature/updateFeature/linkIssueToFeature + createIssue featureId"
```

---

## Task 8: `FeatureTimeline` component (quarter roadmap)

**Files:** Create `src/components/feature-timeline.tsx`

Adapt `roadmap-view.tsx`: same layout, but a **quarter** header (`quartersForRange`) instead of months, bars **colored by feature status** (`FEATURE_STATUSES` color), optional product swimlanes, and an "Unscheduled" list.

- [ ] **Step 1: Implement** `src/components/feature-timeline.tsx`:

```tsx
"use client";

import Link from "next/link";

import type { FeatureWithRelations } from "@/lib/types";
import { FEATURE_STATUSES } from "@/lib/departments";
import { barMetrics, computeRange, quartersForRange, todayOffset } from "@/lib/roadmap";

const NAME_W = 220;
const statusColor = (s: string) =>
  FEATURE_STATUSES.find((x) => x.id === s)?.color ?? "#94a3b8";

export function FeatureTimeline({
  features,
  nowISO,
  groupByProduct = false,
}: {
  features: FeatureWithRelations[];
  nowISO: string;
  groupByProduct?: boolean;
}) {
  const now = new Date(nowISO);
  const scheduled = features.filter((f) => f.startDate || f.targetDate);
  const unscheduled = features.filter((f) => !f.startDate && !f.targetDate);
  const range = computeRange(scheduled, now);
  const quarters = quartersForRange(range);
  const todayFrac = todayOffset(range, now);

  // Groups: by product (company lens) or a single group (product lens).
  const groups = groupByProduct
    ? [...new Map(features.map((f) => [f.product?.id ?? "none", f.product])).values()].map(
        (prod) => ({
          name: prod?.name ?? "No product",
          color: prod?.color ?? "#94a3b8",
          items: scheduled.filter((f) => (f.product?.id ?? "none") === (prod?.id ?? "none")),
        }),
      )
    : [{ name: "", color: "", items: scheduled }];

  return (
    <div className="scrollbar-thin overflow-auto">
      <div className="relative min-w-full">
        {/* Quarter header */}
        <div className="sticky top-0 z-10 flex border-b bg-background/95 backdrop-blur">
          <div className="shrink-0 px-4 py-2 text-xs font-semibold text-muted-foreground" style={{ width: NAME_W }}>
            Feature
          </div>
          <div className="relative h-8 flex-1">
            {quarters.map((q, i) => (
              <div
                key={i}
                className="absolute top-0 border-l px-2 py-2 text-[11px] font-medium text-muted-foreground"
                style={{ left: `${q.leftPct}%`, width: `${q.widthPct}%` }}
              >
                {q.label}
              </div>
            ))}
          </div>
        </div>

        {todayFrac !== null && (
          <div
            className="pointer-events-none absolute bottom-0 top-8 z-0 w-px bg-brand/50"
            style={{ left: `calc(${NAME_W}px + ${todayFrac} * (100% - ${NAME_W}px))` }}
          />
        )}

        {groups.map((g) => (
          <div key={g.name || "all"}>
            {groupByProduct && (
              <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="text-xs font-semibold">{g.name}</span>
                <span className="text-xs text-muted-foreground">{g.items.length}</span>
              </div>
            )}
            {g.items.map((f) => {
              const bar = barMetrics(f, range);
              return (
                <div key={f.id} className="flex items-center border-b hover:bg-accent/30">
                  <div className="shrink-0 px-4 py-2" style={{ width: NAME_W }}>
                    <Link
                      href={`/products/${f.product?.id}/features/${f.id}`}
                      className="truncate text-sm hover:underline"
                    >
                      {f.title}
                    </Link>
                  </div>
                  <div className="relative h-9 flex-1">
                    {bar && (
                      <Link
                        href={`/products/${f.product?.id}/features/${f.id}`}
                        className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm hover:opacity-90"
                        style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, backgroundColor: statusColor(f.status) }}
                        title={f.title}
                      >
                        <span className="truncate">{f.title}</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {unscheduled.length > 0 && (
          <div className="border-t">
            <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">Unscheduled</div>
            {unscheduled.map((f) => (
              <Link
                key={f.id}
                href={`/products/${f.product?.id}/features/${f.id}`}
                className="flex items-center gap-2 border-b px-4 py-2 text-sm hover:bg-accent/30"
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: statusColor(f.status) }} />
                <span className="truncate">{f.title}</span>
                <span className="text-xs text-muted-foreground">set start &amp; target dates</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/components/feature-timeline.tsx
git commit -m "feat(ui): FeatureTimeline quarter roadmap"
```

---

## Task 9: Product & company feature pages

**Files:** Create `src/components/features-view.tsx`, the two product routes, and `src/app/(app)/features/page.tsx`.

- [ ] **Step 1: `features-view.tsx`** — wraps `FeatureTimeline` with a Topbar + "New feature" button:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";

import { FeatureTimeline } from "@/components/feature-timeline";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createFeature } from "@/lib/actions";
import type { FeatureWithRelations } from "@/lib/types";

export function FeaturesView({
  heading,
  features,
  nowISO,
  scopeProductId,
  groupByProduct,
}: {
  heading: string;
  features: FeatureWithRelations[];
  nowISO: string;
  scopeProductId: string | null;
  groupByProduct?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function newFeature() {
    if (!scopeProductId) return;
    startTransition(async () => {
      const f = await createFeature({ productId: scopeProductId });
      router.push(`/products/${scopeProductId}/features/${f.id}`);
      router.refresh();
    });
  }
  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          scopeProductId ? (
            <Button size="sm" className="h-7 gap-1.5" onClick={newFeature} disabled={pending}>
              <Plus className="size-4" /> New feature
            </Button>
          ) : null
        }
      />
      <div className="flex-1 overflow-hidden">
        <FeatureTimeline features={features} nowISO={nowISO} groupByProduct={groupByProduct} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Product roadmap route** — `src/app/(app)/products/[id]/features/page.tsx` (mirror `support/page.tsx`):

```tsx
import { notFound } from "next/navigation";

import { FeaturesView } from "@/components/features-view";
import { getFeatures, getProduct } from "@/lib/data";
import { getWorkspace } from "@/lib/workspace";
import { isDepartmentEnabled } from "@/lib/departments";

export default async function ProductFeaturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = await getProduct(ws.id, id);
  if (!product) notFound();
  if (!isDepartmentEnabled(product.enabledDepartments, "features")) notFound();
  const features = await getFeatures(ws.id, id);
  return (
    <FeaturesView
      heading={`${product.name} · Product`}
      features={features}
      nowISO={new Date().toISOString()}
      scopeProductId={id}
    />
  );
}
```

> Verify the workspace helper import path used by sibling pages (e.g. `support/page.tsx` imports `getWorkspace` — copy that exact import; it may be `@/lib/workspace` or `@/lib/data`). Use whatever the sibling uses.

- [ ] **Step 3: Company portfolio route** — `src/app/(app)/features/page.tsx`:

```tsx
import { FeaturesView } from "@/components/features-view";
import { getFeatures } from "@/lib/data";
import { getWorkspace } from "@/lib/workspace";

export default async function FeaturesPage() {
  const ws = await getWorkspace();
  const features = await getFeatures(ws.id);
  return (
    <FeaturesView
      heading="Product · all products"
      features={features}
      nowISO={new Date().toISOString()}
      scopeProductId={null}
      groupByProduct
    />
  );
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/components/features-view.tsx "src/app/(app)/products/[id]/features/page.tsx" "src/app/(app)/features/page.tsx"
git commit -m "feat(ui): product roadmap + company portfolio feature pages"
```

---

## Task 10: Feature detail page

**Files:** Create `src/components/feature-detail.tsx`, `src/app/(app)/products/[id]/features/[fid]/page.tsx`

- [ ] **Step 1: `feature-detail.tsx`** — status picker, date inputs, owner, inline spec (`RichEditor`), optional page link, and the linked-issues list with progress. Reuse existing primitives: `RichEditor` from `@/components/editor/rich-editor`, `IssueRow` from `@/components/issue-row`, `Topbar`, `featureProgress`, `updateFeature`. Concrete implementation:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { RichEditor } from "@/components/editor/rich-editor";
import { IssueRow } from "@/components/issue-row";
import { Topbar } from "@/components/topbar";
import { FEATURE_STATUSES } from "@/lib/departments";
import { featureProgress } from "@/lib/feature-progress";
import { updateFeature } from "@/lib/actions";
import type { FeatureDetail, Member } from "@/lib/types";

const toDateInput = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export function FeatureDetailView({
  feature,
  members,
  pages,
}: {
  feature: FeatureDetail;
  members: Member[];
  pages: { id: string; title: string; icon: string }[];
}) {
  const [title, setTitle] = useState(feature.title);
  const [status, setStatus] = useState(feature.status);
  const progress = featureProgress(feature.issues);

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          { label: "Product", href: feature.product ? `/products/${feature.product.id}/features` : "/features" },
          { label: title },
        ]}
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              void updateFeature(feature.id, { title: e.target.value.trim() || "Untitled feature" });
            }}
            className="w-full bg-transparent text-2xl font-bold outline-none"
          />

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                void updateFeature(feature.id, { status: e.target.value });
              }}
              className="rounded-md border bg-transparent px-2 py-1 text-xs"
            >
              {FEATURE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Start
              <input
                type="date"
                defaultValue={toDateInput(feature.startDate)}
                onChange={(e) =>
                  void updateFeature(feature.id, {
                    startDate: e.target.value ? new Date(e.target.value) : null,
                  })
                }
                className="rounded border bg-transparent px-1"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Target
              <input
                type="date"
                defaultValue={toDateInput(feature.targetDate)}
                onChange={(e) =>
                  void updateFeature(feature.id, {
                    targetDate: e.target.value ? new Date(e.target.value) : null,
                  })
                }
                className="rounded border bg-transparent px-1"
              />
            </label>
            <select
              defaultValue={feature.ownerId ?? ""}
              onChange={(e) => void updateFeature(feature.id, { ownerId: e.target.value || null })}
              className="rounded-md border bg-transparent px-2 py-1 text-xs"
            >
              <option value="">No owner</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              defaultValue={feature.pageId ?? ""}
              onChange={(e) => void updateFeature(feature.id, { pageId: e.target.value || null })}
              className="rounded-md border bg-transparent px-2 py-1 text-xs"
              aria-label="Linked page"
            >
              <option value="">No linked page</option>
              {pages.map((pg) => (
                <option key={pg.id} value={pg.id}>{pg.icon} {pg.title}</option>
              ))}
            </select>
            {feature.page && (
              <Link href={`/pages/${feature.page.id}`} className="text-xs text-brand hover:underline">
                Open {feature.page.icon} {feature.page.title}
              </Link>
            )}
          </div>

          {/* Inline spec / PRD */}
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spec</h3>
            <RichEditor
              content={feature.spec ?? null}
              onChange={(json) => void updateFeature(feature.id, { spec: json })}
              placeholder="Write the PRD…"
            />
          </div>

          {/* Linked issues */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Issues
              </h3>
              <span className="text-xs text-muted-foreground">
                {progress.done}/{progress.total} · {progress.pct}%
              </span>
            </div>
            {feature.issues.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No issues linked yet. Set an issue&apos;s <strong>Feature</strong> to add it here.
              </p>
            ) : (
              <div className="mt-2 divide-y rounded-lg border">
                {feature.issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} members={members} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

> Verify the exact props of `RichEditor` (from `src/components/editor/rich-editor.tsx`) and `IssueRow`, and adapt the prop names if they differ (e.g. `content`/`onChange`, `value`/`onUpdate`). Match the call sites in `issue-detail.tsx` / `page-view.tsx`.

- [ ] **Step 2: Detail route** — `src/app/(app)/products/[id]/features/[fid]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { FeatureDetailView } from "@/components/feature-detail";
import { getFeature, getMembers, getPagesFlat } from "@/lib/data";
import { getWorkspace } from "@/lib/workspace";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string; fid: string }>;
}) {
  const { fid } = await params;
  const ws = await getWorkspace();
  const [feature, members, pages] = await Promise.all([
    getFeature(ws.id, fid),
    getMembers(ws.id),
    getPagesFlat(ws.id),
  ]);
  if (!feature) notFound();
  return <FeatureDetailView feature={feature} members={members} pages={pages} />;
}
```

> Use the same `getMembers` (or equivalent) the issue detail page uses to populate member dropdowns; copy that import.

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/components/feature-detail.tsx "src/app/(app)/products/[id]/features/[fid]/page.tsx"
git commit -m "feat(ui): feature detail page (spec, dates, linked issues)"
```

---

## Task 11: Issue ↔ feature linking UI

**Files:** Modify `src/components/pickers.tsx`, `src/components/issue-detail.tsx`

- [ ] **Step 1: Add `FeaturePicker`** to `pickers.tsx` (mirror `ProjectPicker`, no `key` chip):

```tsx
export function FeaturePicker({
  features,
  value,
  onChange,
  compact,
}: {
  features: { id: string; title: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  compact?: boolean;
}) {
  const f = features.find((x) => x.id === value) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerCls} aria-label="Set feature">
        <span className="size-2.5 rounded-full border border-dashed border-muted-foreground/60" />
        {!compact && <span>{f ? f.title : "No feature"}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => onChange(null)} className="gap-2 text-xs">
          <span className="flex-1">No feature</span>
          {!value && <Check className="size-3.5 opacity-70" />}
        </DropdownMenuItem>
        {features.map((feat) => (
          <DropdownMenuItem key={feat.id} onClick={() => onChange(feat.id)} className="gap-2 text-xs">
            <span className="flex-1 truncate">{feat.title}</span>
            {value === feat.id && <Check className="size-3.5 opacity-70" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Wire it into `issue-detail.tsx`** — alongside the existing `ProjectPicker`/`TeamPicker`. Pass the workspace features (fetched in the issue detail page via `getFeatures(ws.id)`), render `FeaturePicker` with `value={issue.featureId}` and `onChange={(v) => linkIssueToFeature(issue.id, v)}` wrapped in the file's existing transition/persist helper. Import `linkIssueToFeature` from `@/lib/actions` and `getFeatures` result is passed as a new prop `features` from `src/app/(app)/issues/[id]/page.tsx` (add `getFeatures(ws.id)` to that page's `Promise.all` and thread the prop through).

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/components/pickers.tsx src/components/issue-detail.tsx "src/app/(app)/issues/[id]/page.tsx"
git commit -m "feat(ui): link issues to features from issue detail"
```

---

## Task 12: Nav + icon maps + product overview card

**Files:** Modify `src/components/sidebar.tsx`, `src/components/products-view.tsx`, `src/app/(app)/products/[id]/page.tsx`

- [ ] **Step 1: Sidebar dept icon** — in `sidebar.tsx`, add to the `deptIcons` `Record<DepartmentSlug, …>` map a `features` entry, importing a lucide icon (e.g. `Compass`):

```tsx
    features: <Compass className="size-3.5" />,
```

Add `Compass` to the lucide import at the top.

- [ ] **Step 2: Top-level nav** — add a `<NavItem>` to the company-wide department nav group (near the Sales/Marketing/Finance/Support items):

```tsx
<NavItem href="/features" active={pathname.startsWith("/features")} icon={<Compass className="size-4" />} label="Product" />
```

- [ ] **Step 3: products-view icon** — in `products-view.tsx`, add `features` to its `DEPT_ICONS` `Record<DepartmentSlug, …>` (import the same icon).

- [ ] **Step 4: Product overview card** — in `src/app/(app)/products/[id]/page.tsx`, add a Product/Features card to the overview cards, gated by `isDepartmentEnabled(product.enabledDepartments, "features")`, showing `summary.openFeatures` and linking to `/products/[id]/features`. Match the existing card markup for the other departments in that file.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/components/sidebar.tsx src/components/products-view.tsx "src/app/(app)/products/[id]/page.tsx"
git commit -m "feat(ui): Product department nav, icons, overview card"
```

---

## Task 13: Full verification + seed sample data + PR

**Files:** optionally `src/db/seed-crm-data.ts` (sample features)

- [ ] **Step 1: Whole suite**

Run: `npx vitest run`
Expected: all pass (incl. `roadmap.test.ts`, `feature-progress.test.ts`, updated `departments.test.ts`).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run build` → succeeds; new routes `/features`, `/products/[id]/features`, `/products/[id]/features/[fid]` appear.

- [ ] **Step 3: (Optional) seed a few sample features** in `seedCrm` (so the live hub shows a roadmap). Insert 2–3 `features` per product with `startDate`/`targetDate` a quarter or two out and varied statuses, guarded by "any feature exists" like the deal guard. Then `npm run db:reorg-org` is NOT needed; add a small `db:seed` path or insert via a one-off. Keep idempotent (skip if features already exist).

- [ ] **Step 4: Smoke-check**

Start the app; confirm: a product's **Product** tab shows the quarter roadmap; "New feature" creates one and opens its detail; setting start/target dates moves its bar; editing the spec persists; linking an issue (from issue detail) shows it under the feature with progress; `/features` shows the portfolio grouped by product; the product overview shows the open-features card.

- [ ] **Step 5: Push + PR**

```bash
git push -u origin feat/product-department
gh pr create --base main --title "Product department: features + quarterly roadmap" --body "Implements docs/superpowers/specs/2026-06-26-product-department-design.md"
```

---

## Notes for the implementer

- **Follow sibling imports exactly** — `getWorkspace`, `getMembers`, `RichEditor`/`IssueRow` prop names: copy from the nearest existing page/component rather than trusting this plan's import paths, which are inferred.
- **No transactions** — not needed here (all additive single-table writes). Schema via `drizzle-kit push --force` (non-TTY).
- **`revalidateMatrix`** already revalidates the product + company department lenses; call it on every feature mutation (the create/update/link snippets do).
