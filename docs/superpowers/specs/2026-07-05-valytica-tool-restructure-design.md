# Valytica Tool Restructure — Design Spec

- **Date:** 2026-07-05
- **Status:** Draft (for review)
- **Driver:** Valytica (first adopter); changes are to the hub tool itself.

## Scope

This spec covers **the structure and functionality of the hub tool** — its
surfaces (department tabs), the roadmap model, the pricing data model, and how
docs attach. It is driven by Valytica but the changes are to the tool.

**Explicitly out of scope:** any Valytica *content* — no vision text, no FDV
analysis, no pricing numbers, no milestones, issues, or segments get seeded.
This spec defines the empty structure the content later drops into.

---

## 1. Problem

The current per-project workspace has **7 department tabs** (Product,
Engineering, Analytics, Marketing, Sales, Customer Success, Finance) plus
auxiliary routes (`vision`, `docs`, `milestones`, `tasks`). Against how a
solo-founder product is actually run, this has structural redundancy:

1. **Three execution trackers.** `product` (roadmap + a *features* layer),
   `engineering` (Linear issues), and `tasks` (the same issues tooling) all
   track the same work. The `features` table is a redundant epic layer between
   milestones and issues.
2. **Three GTM departments.** `marketing`, `sales`, and `customer-success` are
   separate tabs for one early-stage motion; mostly empty.
3. **No home for strategy.** `vision` is an auxiliary route with no department
   backing; the "why we win" thesis has nowhere structured to live.
4. **Flat pricing model.** `projects.economics` is a single
   `{ pricePerUnit, costPerUnit }` blob — it cannot express a product whose
   pricing differs *structurally* by customer segment.

## 2. Organizing principle

**One thesis, two engines.** A product workspace is a thesis that aims two
engines. Every item answers exactly one question, which makes placement
unambiguous:

| Question | Surface |
|---|---|
| *Why does this win?* | **Strategy** (the thesis) |
| *What do we ship?* | **Roadmap** (build engine) |
| *How do we make money?* | **Growth** (growth engine) |

Placement rule: is it the thesis, does it build the product, or does it make
money? Pricing *rationale* (margin) is thesis → Strategy; pricing *packaging*
(plans per segment) makes money → Growth.

## 3. Target surface model

Reduce 7 department tabs + 4 aux routes to **3 primary surfaces**, with docs as
a cross-surface capability and analytics as a data feed.

| Surface | Absorbs (old) | Purpose |
|---|---|---|
| **Strategy** | `vision` route + economics from `finance` | Vision + FDV scorecard (Desirability / Feasibility / Viability). Viability holds per-segment unit economics + TAM. |
| **Roadmap** | `product` + `engineering` + `tasks` | Milestones → issues (issues tagged by function via `issues.type`). No features layer. |
| **Growth** | `marketing` + `sales` + `customer-success` | Segments (each owns its pricing shape) · client ladder · pipeline · campaigns · support. |
| *Analytics* (kept) | `analytics` | Product metrics — the "reality" feed behind Strategy. Not a primary thinking surface. |

**Dropped as primary tabs:**
- **Finance** — unit economics move into Strategy/Viability (read from the
  pricing model); transactional invoices/expenses roll up to the company
  Operations project. `OWNER_VISIBLE_DEPARTMENTS`/confidential handling for
  finance is retired for products that adopt the new model.
- **Docs** — demoted from a tab to a **capability**: every surface can hold
  pages; the `docs` route becomes a thin all-pages *index*, not the place you
  author.

## 4. Functionality corrections

### 4.1 Department taxonomy (`src/lib/departments.ts`)
Replace the 7-entry `DEPARTMENTS` array with the new surface set:
`strategy`, `roadmap`, `growth`, `analytics`. Preserve the existing
`enabledDepartments` / `visibleDepartments` machinery unchanged — only the slug
set and their routes change. Old slugs (`product`, `engineering`, `marketing`,
`sales`, `customer-success`, `finance`) are removed or aliased during migration
(§6).

### 4.2 Roadmap
- **Milestones → issues** directly via the existing `issues.milestoneId`. No
  new plumbing.
- **Remove the `features` layer** (table + `features` UI + `issues.featureId`).
  Issues attach straight to a milestone.
- **Issue = cross-functional** via existing `issues.type` (the "functional
  category" field). Align its allowed values to the functional taxonomy
  (e.g. `eng`, `design`, `gtm`, `ops`, `research`) so one milestone shows work
  from several functions in a single view.
- Collapse `product` + `engineering` + `tasks` routes into one Roadmap surface
  with the existing List / Board / Timeline views.

### 4.3 Strategy
Structural scaffolding only (no content):
- **Vision** banner slot (headline + north-star metric field).
- **FDV** three-pillar layout: Desirability / Feasibility / Viability, each a
  section that holds claim + evidence and a RAG status.
- **Viability** renders the **per-segment unit economics** (§4.5) — margins per
  segment + a TAM slot — derived, never hardcoded.

### 4.4 Growth
Structural scaffolding only (no content):
- **Segments** list — each segment is a first-class object owning its own
  pricing shape (§4.5), motion, and win-condition fields.
- **Ladder** — an ordered progression across segments with a trigger field per
  step (how a customer moves up).
- **Pipeline + campaigns + support** — the existing CRM/marketing/tickets tools,
  re-homed as tabs within Growth.

### 4.5 Per-segment pricing model (the core data change)
Replace the flat `projects.economics` with a **per-segment pricing config** that
is the single source of truth, consumed by both Strategy (margins) and Growth
(plans). Proposed shape (jsonb on `projects`, superseding `economics`):

```ts
pricingModel: {
  currency?: string;            // "INR"
  unitLabel?: string;           // "report"
  segments: Array<{
    id: string;                 // "solo" | "firm" | "bank"
    label: string;
    model: "usage" | "subscription+usage" | "license";
    costPerUnit?: number;       // COGS for this segment's unit
    params: Record<string, number | string>; // e.g. pricePerUnit, monthly, seats, setupFee, license
    creditSources?: string[];   // e.g. ["free","referral","payg","bundle"] (usage models)
  }>;
} | null
```

- Strategy/Viability computes margin **per segment** (not one blended number).
- Growth renders each segment's plan from the same config.
- No token/usage quota mechanic; usage is metered as telemetry only (out of
  scope here — a product concern, not a tool structure concern).

### 4.6 Docs as capability
- Pages remain project-scoped (`pages`). Allow a page to attach to a surface
  (and to a milestone/issue via existing `pageId` links).
- The `docs` route becomes an aggregated index/library of all project pages;
  authoring happens in-context on each surface.

## 5. Schema changes (summary)

| Change | Table/field | Note |
|---|---|---|
| Remove features layer | drop `features` table; drop `issues.featureId` | migrate data first (§6) |
| Function tag on issues | `issues.type` | already exists; constrain values to functional taxonomy |
| Per-segment pricing | replace `projects.economics` with `projects.pricingModel` (jsonb) | migration converts existing single-segment economics into a one-segment array |
| Department slugs | `DEPARTMENTS` in `departments.ts` | new set: strategy/roadmap/growth/analytics |
| Enabled departments | `projects.enabledDepartments` | valytica set explicitly to new slugs; `null` (all) still valid |

## 6. Migration / blast radius

The department taxonomy and the `features` table are **hub-wide**, so other
products (e.g. Healthytica) are affected. Phased approach:

1. **Data migration first:** convert every `features` row to an issue
   (`feature.title` → issue title, `feature.milestoneId` → `issue.milestoneId`,
   `feature.spec` → issue description or a linked page, `feature.status` →
   issue status). Re-point `feedback.featureId` to the issue or milestone. Then
   drop the table + `issues.featureId`.
2. **Department remap:** map old slugs to new for existing projects
   (`product`+`engineering` → `roadmap`; `marketing`+`sales`+`customer-success`
   → `growth`; `vision`+`finance`(economics) → `strategy`). Projects with
   `enabledDepartments = null` need no change (all-on).
3. **Economics → pricingModel:** wrap each existing `economics` blob as a
   single-segment `pricingModel` so nothing is lost.

Migrations are Neon-HTTP-safe: idempotent, sequential, no `db.transaction`.

## 7. Out of scope

- All Valytica business content (vision, FDV text, segment definitions, pricing
  numbers, milestones, issues).
- The usage-metering / telemetry mechanics of the product itself.
- Any change to the company Operations project's consolidated books.

## 8. Open questions

1. **Hub-wide vs valytica-first:** do we migrate all products to the new
   taxonomy now (cleaner, bigger), or ship the new surfaces and adopt for
   valytica first with old slugs aliased (safer, some temporary duplication)?
2. **Growth internal shape:** one merged surface with Pipeline/Campaigns/Support
   as sub-tabs, or keep Pipeline visually separate from Marketing even now?
3. **pricingModel storage:** jsonb on `projects` (simple, matches today) vs a
   normalized `pricing_segments` table (queryable, more work).
