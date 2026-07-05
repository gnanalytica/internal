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
**Additive (valytica-first).** *Add* the new surface slugs — `strategy`,
`roadmap`, `growth` — to the `DEPARTMENTS` registry alongside the existing seven.
Do **not** remove the old slugs. Valytica opts into the new set via
`enabledDepartments = ["strategy","roadmap","growth","analytics"]`; every other
product keeps its current departments unchanged. The existing
`enabledDepartments` / `visibleDepartments` machinery is reused as-is. A later,
separate effort can migrate other products and retire the old slugs — not this
spec.

### 4.2 Roadmap
- **Milestones → issues** directly via the existing `issues.milestoneId`. No
  new plumbing.
- **Valytica does not use the `features` layer** — issues attach straight to a
  milestone. The `features` table, its UI, and `issues.featureId` **stay** for
  products that still use them (valytica-first: no hub-wide removal). Valytica
  simply never populates features.
- **Issue = cross-functional** via existing `issues.type` (the "functional
  category" field). Extend its allowed values to the functional taxonomy
  (e.g. `eng`, `design`, `gtm`, `ops`, `research`) so one milestone shows work
  from several functions in a single view. Additive to existing values.
- The Roadmap surface reuses the existing issues module (List / Board /
  Timeline) scoped to a milestone view; `product` / `engineering` / `tasks`
  routes are simply not enabled for valytica.

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
**Add** a per-segment pricing config as a **new `pricingModel` jsonb field on
`projects`** (flexible; schema-less so the per-segment shape can evolve). The
existing `economics` field stays for products not yet on the new model. Valytica
uses `pricingModel` as its single source of truth, consumed by both Strategy
(margins) and Growth (plans). Shape:

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

All changes are **additive** — nothing existing is dropped (valytica-first).

| Change | Table/field | Note |
|---|---|---|
| Add function-tag values | `issues.type` | field already exists; *extend* allowed values (eng/design/gtm/ops/research) |
| Add per-segment pricing | new `projects.pricingModel` (jsonb) | `economics` retained for other products |
| Add surface slugs | `DEPARTMENTS` in `departments.ts` | *add* strategy/roadmap/growth; old seven stay |
| Opt valytica in | `projects.enabledDepartments` | set valytica to the new slugs; others unchanged |
| Features layer | `features` table, `issues.featureId` | **unchanged** — valytica just doesn't use it |

## 6. Blast radius (valytica-first = minimal)

Because everything is additive and only valytica opts in, **no other product is
affected**:

- Other products keep `enabledDepartments = null` (all old departments on) and
  their `features` layer. Untouched.
- `db:push` adds the new `pricingModel` column and new `DEPARTMENTS` entries;
  existing rows/fields are untouched.
- Valytica's `enabledDepartments` is set to the new slugs so it renders only the
  new surfaces.

A future, separate effort can migrate the other products and retire the old
slugs / `features` table — deliberately out of scope here.

Any DB scripts are Neon-HTTP-safe: idempotent, sequential, no `db.transaction`;
`db:push --force` in non-TTY.

## 7. Out of scope

- All Valytica business content (vision, FDV text, segment definitions, pricing
  numbers, milestones, issues).
- The usage-metering / telemetry mechanics of the product itself.
- Any change to the company Operations project's consolidated books.

## 8. Resolved decisions

1. **Valytica-first.** Additive rollout; valytica opts into the new surfaces,
   other products untouched. Hub-wide migration is a later, separate effort.
2. **Growth shape:** one merged surface with **Pipeline / Campaigns / Support as
   sub-tabs** (kept flexible — sub-tabs can be reorganized without a schema
   change).
3. **`pricingModel` storage:** **jsonb on `projects`** (flexible / schema-less),
   not a normalized table.
