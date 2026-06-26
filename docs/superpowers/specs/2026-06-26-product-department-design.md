# Product department (features + roadmap) — design

**Date:** 2026-06-26
**Status:** Approved approach — pending spec review
**Author:** Sandeep + Claude

## Goal

Add a sixth department module — **Product** — to the Product × Department
matrix. It introduces **features** (the PM unit, above engineering issues) with
a status pipeline, a **date/quarter-based roadmap** per product, an inline
spec/PRD per feature with an optional linked wiki page, and traceability from
features down to the engineering issues that implement them.

This sits above engineering: a *feature* is the "what/why", *issues* are the
execution. Every product gets the module automatically (matrix convention).

## Decisions locked in brainstorming

- **Feature ↔ issues:** a feature *owns many issues* (new `features` table; issues
  gain a nullable `featureId`; progress rolls up done/total).
- **Spec/PRD:** inline rich-text on the feature **plus** an optional link to a
  deeper wiki page.
- **Roadmap:** professional, **date & quarter based** (not now/next/later) — a
  quarterly timeline with date-positioned bars, reusing `src/lib/roadmap.ts`.
- **Scope:** build it all (module + issue-linking + inline spec + page link +
  per-product roadmap + company-wide portfolio lens).

## Naming / routing

- Department `slug: "features"`, `label: "Product"`, icon `🧭`.
  - Product-scoped route: `/products/[id]/features` (auto-generated from the
    `DEPARTMENTS` registry + tabs).
  - Company-wide route: `/features` (manual sidebar entry, like the other
    top-level department lenses).
- Slug is `features` (not `product`) so the path isn't `/products/[id]/product`.
- This coexists with the existing `/roadmap` (portfolio of **projects** by
  initiative). Different altitudes: `/roadmap` = which products/initiatives ship
  when; `/features` + `/products/[id]/features` = which **features** ship when.

## Data model

### New table: `features` (follows the `tickets`/`deals` pattern)

```ts
export const features = pgTable(
  "features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // idea | planned | building | shipped | archived
    status: text("status").notNull().default("idea"),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    spec: jsonb("spec"),              // inline TipTap PRD
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }), // optional deep doc
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
```

Quarters are **derived from `startDate`/`targetDate`**, not stored — so there's
no quarter field to keep in sync.

Relations: `workspace`, `product` (projects), `owner` (users), `page` (pages),
`issues: many(issues)`.

### `issues` — add the back-link

Add `featureId: uuid("feature_id").references(() => features.id, { onDelete: "set null" })`
(nullable, after `cycleId`) + a `feature: one(features, …)` relation in
`issuesRelations`. Issues with no feature behave exactly as today.

### Department registry

Add to `DEPARTMENTS` in `src/lib/departments.ts`:
```ts
{ slug: "features", label: "Product", icon: "🧭", color: "#8b5cf6", tool: "Roadmap & specs" },
```
and extend `DepartmentSlug` with `"features"`. Add a feature-status constant
list `FEATURE_STATUSES = [idea, planned, building, shipped, archived]` (order =
pipeline / board columns) next to the other module status lists.

## Roadmap rendering (date + quarter)

Extend `src/lib/roadmap.ts` (pure, unit-tested) with quarter helpers, reusing
the existing date math:
- `quartersForRange(range): { label: string; leftPct: number; widthPct: number }[]`
  — groups the range's months into quarters for the timeline header (e.g.
  `Q3 '26`), each positioned by fraction of the total range.
- `quarterLabel(date): string` → `"Q3 '26"`.

`barMetrics`, `computeRange`, `todayOffset` are reused **unchanged** — bars stay
date-accurate; only the header axis switches from months to quarters.

A shared `<FeatureTimeline>` component (adapted from `roadmap-view.tsx`) renders:
- Quarter column headers across the top; a "today" marker line.
- One row per feature, a bar spanning `startDate → targetDate`, **colored by
  status**; click → feature detail. Single-date features get a default 2-week
  span (existing `barMetrics` behavior).
- Features with no dates → an **"Unscheduled"** list below the timeline with a
  "set start & target dates" prompt (mirrors current roadmap-view).
- Grouping: **product lens** (`/products/[id]/features`) is a flat timeline of
  that product's features. **Company lens** (`/features`) groups rows into
  swimlanes **by product**.

## Views & routes

| Route | Lens | Data |
|---|---|---|
| `/products/[id]/features` | one product: roadmap timeline + feature list | `getFeatures(ws, productId)` |
| `/features` | all products: portfolio roadmap grouped by product | `getFeatures(ws)` |
| `/products/[id]/features/[featureId]` *(or a detail panel)* | one feature | `getFeature(ws, id)` |

**Feature detail** shows: title, status picker, start/target date pickers, owner,
the **inline spec** editor (reuse `RichEditor`), an optional **linked page**
(page picker; shows a link when set), and a **Linked issues** section listing the
feature's issues with rolled-up progress (`done / total`) and a control to
link/create issues under it.

**Product overview** (`/products/[id]/page.tsx`) gains a Product/Features card
(open feature count) alongside the existing department cards, gated by
`isDepartmentEnabled(..., "features")`.

## Data & actions

Following the tickets pattern:
- `src/lib/data.ts`: `getFeatures(workspaceId, productId?)` (branch on productId
  like `getTickets`), `getFeature(workspaceId, id)` (with `product`, `owner`,
  `page`, and `issues` for progress). Extend `getProductSummaries` with an
  `openFeatures` count (status ∈ idea/planned/building).
- `src/lib/actions.ts`: `createFeature`, `updateFeature` (status, dates, owner,
  spec, pageId, title), `linkIssueToFeature(issueId, featureId|null)` — plus
  thread an optional `featureId` into the existing `createIssue`. Each mutation
  calls the existing `revalidateMatrix(productId)` helper.
- Issue detail gains a `FeaturePicker` (same pattern as `ProjectPicker`/
  `TeamPicker` in `pickers.tsx`).

## Types

`Feature = typeof features.$inferSelect`; `FeatureWithRelations` (+ product,
owner, page, issues); `FeatureDetail`; add `openFeatures: number` to
`ProductSummary`.

## UI wiring (from the codebase audit)

- `src/components/sidebar.tsx`: add the `"features"` icon to the `deptIcons`
  map; add a top-level `<NavItem href="/features" label="Product" …>`.
- `src/components/products-view.tsx`: add `"features"` to `DEPT_ICONS`.
- `src/components/product-modules-config.tsx`: auto-includes the new toggle (it
  maps over `DEPARTMENTS`) — verify it renders.
- `ProductTabs`: auto-includes the new tab from `DEPARTMENTS`.

## Testing

- `src/lib/roadmap.test.ts` (extend or add): `quartersForRange` produces the
  right quarter labels/positions for a multi-quarter range; `quarterLabel`
  boundaries (Q1–Q4); reused `barMetrics` still correct.
- A pure `featureProgress(issues)` helper (`done/total`) with unit tests.
- `src/lib/departments.test.ts`: update the slug-list assertion to include
  `"features"` (now 6 modules); keep per-product enable/disable tests green.
- `tsc --noEmit` clean; existing suite green; `next build` succeeds.

## Out of scope / rejected

- Now/next/later horizon (replaced by date/quarter).
- Feature-as-issue-type (rejected: features are a dedicated entity).
- Dependencies between features, prioritization scoring, multiple linked pages
  per feature — YAGNI for now.
- Changing the existing `/roadmap` (projects) view.

## Open questions

None blocking. Default choices: feature statuses `idea/planned/building/shipped/
archived`; feature detail is a dedicated page at `/products/[id]/features/[fid]`.
