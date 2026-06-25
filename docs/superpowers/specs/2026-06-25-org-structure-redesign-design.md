# Org structure redesign — design

**Date:** 2026-06-25
**Status:** Approved (Approach A) — final
**Author:** Sandeep + Claude

## Goal

Remove the structural redundancy in the Gnanalytica hub's org model. Today the
same real-world things are represented two or three times:

- Every product is mirrored as **both a team and a project**, with mismatched
  keys (`HLT` team vs `HLTH` project, etc.).
- **Sales / Marketing / Finance** exist as **standalone teams** *and* as
  **department modules**.
- **Back-office** is modeled as teams, though none of it is a product or a pod.
- The back-office carries 5 databases that don't fit a ~10-person IT company.

## The target model — four clean axes

| Axis | Means | Backed by |
|---|---|---|
| **Products** | the things we build (external + internal tools) | `projects` where `kind = 'product'` |
| **Back-office** | running the company; not a product, not a pod | `projects` where `kind = 'ops'` + a couple of databases |
| **Teams (pods)** | cross-functional groups of people; own products; users belong to many | `teams` + existing `teamMembers`; new `projects.ownerTeamId` |
| **Departments** | the 5 per-product functional lenses | unchanged: `engineering, sales, marketing, finance, support` on `projects.enabledDepartments` |

Each real-world thing now lives in exactly one axis. "Sales" is **only** a
department lens. A product is **only** a project. A pod is **only** a team.

### Why this works without touching the CRM

- An issue's **product** = `issues.projectId`; its **pod** = `issues.teamId` —
  independent columns; issue identifiers are per-project (`VAL-12`), so
  reassigning teams to pods doesn't affect numbering.
- The CRM matrix (deals, campaigns, content, invoices, tickets) keys on
  `productId → projects.id`. Flagging some projects `kind = 'ops'` leaves it all
  intact; ops projects carry no CRM rows and no department modules.

## Schema changes (Approach A)

Two columns on `projects` (applied via `drizzle-kit push`):

```ts
// projects
kind: text("kind").$type<"product" | "ops">().notNull().default("product"),
ownerTeamId: uuid("owner_team_id").references(() => teams.id, { onDelete: "set null" }),
```

Plus the matching relation in `projectsRelations`:

```ts
ownerTeam: one(teams, { fields: [projects.ownerTeamId], references: [teams.id] }),
```

- `kind` — `product` (default) vs `ops`. Drives department/CRM applicability and
  which UI area a project shows under.
- `ownerTeamId` — owning pod (one-to-many). `null` for ops projects. One-to-many
  chosen over a join table (rejected Approach B): co-owned products are YAGNI.

No other schema changes. `teamMembers` already supports users-in-many-teams.

## Concrete layout after reorg

**Products (`kind = 'product'`)** — owning pod in parens:
- Healthytica · Valytica · AI Workshop · **Standup-AI** *(all → Products pod, all external)*
- Internal — the hub *(→ Platform pod)*

**Teams (pods)** — confirmed:
- **Products** pod → Healthytica, Valytica, AI Workshop, Standup-AI
- **Platform** pod → Internal
- Members: Sandeep, Jayasaagar, Shravani in both initially; users may be in many.

**Back-office (`kind = 'ops'`, `ownerTeamId = null`)**:
- Projects: **Hiring**, **India Payroll Setup**
- Databases (2, was 5):
  - **People** — Entity-tagged (India/NL/Global), ~10 rows max.
  - **Tools & Subscriptions** — absorbs the old *Vendors* DB (a vendor is just a
    tool's provider). Fields: Tool, Provider, Monthly cost, Owner, Entity,
    Renewal date, URL. Seeded with **Odoo** (provider=Odoo, entity=Netherlands,
    the NL accounting/VAT/payroll system of record).
- Wiki: Company Handbook, Policies, SOPs, India Entity Reference, Netherlands
  Entity Reference. The **NL Entity Reference links to Odoo**.

**Departments** — unchanged (5 per-product lenses).

### Dropped in the reorg
- **Teams (9 → 2):** the product-mirror teams (Healthytica/Valytica/AI Workshop),
  Internal Tools, Sales, Marketing, Finance, Admin, People (HR) — all gone.
- **Projects:** `Compliance — India` and `Compliance — Netherlands` removed.
  India compliance is out of scope for now; NL compliance is handled by Odoo
  (linked, not tracked as deadline tasks). `NL Payroll Setup` → renamed/replaced
  by `India Payroll Setup`.
- **Databases (5 → 2):** drop `Vendors` (merged into Tools & Subscriptions),
  `Contracts` (customer contracts live in CRM, employment in People), `Assets`
  (IT company, no physical assets).
- **Initiatives:** `Compliance & Legal` initiative removed (no compliance
  projects left); `Revenue FY26` and `Hiring` stay.

## Migration strategy (live data)

The `gnanalytica` workspace already exists and `seed-org.ts` short-circuits on
it, so this is an **in-place, idempotent reorg script** — not a re-seed.

**Design for testability:** split a pure planning function from DB I/O.
- `src/db/reorg-plan.ts` — pure: `planReorg({ teams, projects })` returns the
  intended changes (which projects get which `kind`/`ownerTeamId`, old-team→pod
  issue remapping, teams/projects/databases to delete). Unit-tested, no DB.
- `src/db/reorg-org.ts` — applies the plan to the DB inside a transaction
  (run: `npm run db:reorg-org`). Idempotent: re-running is a no-op.

Apply order in `reorg-org.ts`:
1. Ensure pods `Products` + `Platform` exist; add all three members to each.
2. Set `projects.kind` + `ownerTeamId` per the plan.
3. Remap issues whose `teamId` is an old product-mirror team → the owning pod of
   the issue's project (fallback: leave null; product is still known via
   `projectId`).
4. Merge `Vendors` rows into `Tools & Subscriptions`; ensure the Odoo row.
5. Delete dropped databases (Vendors, Contracts, Assets), dropped projects
   (Compliance ×2), rename `NL Payroll Setup` → `India Payroll Setup`, delete the
   `Compliance & Legal` initiative, delete the 7 dropped teams.

`seed-org.ts` and `seed-crm-data.ts` are updated to produce this exact structure
on a fresh DB (2 pods, kinds/owners set, 2 databases, Odoo row), so new
environments seed correctly.

## UI changes (minimal, from the code audit)

- **`src/lib/data.ts`** — `getProductSummaries` (1394) filters `kind='product'`;
  `getProject`/`getProduct` include `ownerTeam`; add `getTeam` "owned products"
  via the new relation; `getProjectsWithCounts` returns `kind` so the list can
  split.
- **`src/components/sidebar.tsx`** (376–502) — the "Products" tree shows only
  `kind='product'`; add a small "Operations" group for `kind='ops'` projects
  (no department children).
- **`src/components/projects-view.tsx`** — split into **Products** and
  **Operations** sections by `kind` (badge on ops).
- **`src/components/project-detail.tsx`** — show the owning pod for products.
- **`src/components/team-detail.tsx`** / `teams-view.tsx` — show "Owns N
  products" per pod.
- **`src/lib/actions.ts`** `createProject` (830) — accept `kind` + `ownerTeamId`.
- Pickers unchanged: `TeamPicker` auto-shows the 2 pods (others deleted);
  `ProjectPicker` keeps listing all projects.

## Testing

- New `src/db/reorg-plan.test.ts` — the plan maps the 9 projects to correct
  kinds/owners, remaps old teams → pods, lists the right deletions, and a second
  `planReorg` over the *post-reorg* state is a no-op (idempotency).
- New `src/lib/departments.test.ts` stays green (departments unchanged).
- `tsc --noEmit` clean; existing suite green.

## Out of scope / rejected

- **Approach B** (many-to-many team↔product) and **Approach C** (first-class
  `areas` table) — YAGNI / too invasive at current scale.
- Renaming product/project `key`s — separate cleanup.
- Any change to the Entity model or to the regulated per-entity systems (Odoo,
  India CA) themselves.
- India compliance tracking — deferred until it matters.
