# Org structure redesign — design

**Date:** 2026-06-25
**Status:** Approved approach (A), pending spec review
**Author:** Sandeep + Claude

## Goal

Remove the structural redundancy in the Gnanalytica hub's org model. Today the
same real-world things are represented two or three times:

- Every product is mirrored as **both a team and a project**, with mismatched
  keys (`HLT` team vs `HLTH` project, `VLT`/`VAL`, `WRK`/`AIW`).
- **Sales / Marketing / Finance** exist as **standalone teams** *and* as
  **department modules** (the per-product CRM matrix).
- **Back-office** (Admin, HR, Finance ops, Compliance, Hiring, Payroll) is
  modeled as teams, even though none of it is a product or a people-pod.

## The target model — four clean axes

| Axis | Means | Backed by |
|---|---|---|
| **Products** | the things we build (external products + internal tools) | `projects` where `kind = 'product'` |
| **Back-office** | running the company; not a product, not a pod | `projects` where `kind = 'ops'` + the Entity-tagged databases |
| **Teams (pods)** | cross-functional groups of people; own one or more products; users belong to many | `teams` + existing `teamMembers` join; new `projects.ownerTeamId` |
| **Departments** | the 5 per-product functional lenses | unchanged: `engineering, sales, marketing, finance, support` on `projects.enabledDepartments` |

Each real-world thing now lives in exactly one axis. "Sales" is **only** a
department lens (not also a team). A product is **only** a project (not also a
team). A pod is **only** a team (not also a per-product mirror).

### Why this works without touching the CRM

- An issue's **product** = `issues.projectId`; its **pod** = `issues.teamId`.
  These are already independent columns, and issue identifiers are per-project
  (`VAL-12`, indexed on `projectId`), so reassigning teams to pods does not
  affect issue numbering.
- The entire CRM matrix (deals, campaigns, content, invoices, tickets) keys on
  `productId → projects.id`. Flagging some projects `kind = 'ops'` leaves all of
  it intact; ops projects simply carry no CRM rows and no department modules.

## Schema changes (Approach A)

Two columns on `projects` (applied via `drizzle-kit push`):

```ts
// projects
kind: text("kind").$type<"product" | "ops">().notNull().default("product"),
ownerTeamId: uuid("owner_team_id").references(() => teams.id, { onDelete: "set null" }),
```

- `kind` — `product` (default) vs `ops`. Drives whether department modules /
  CRM apply and which area of the UI a project shows under.
- `ownerTeamId` — the owning pod (one-to-many: a pod owns many products; a
  product has one owning pod). `null` for ops projects. We deliberately choose
  one-to-many over a many-to-many join (rejected Approach B) — co-owned products
  are YAGNI at current scale and a column is cheaper than a join table + UI.

No other schema changes. `teamMembers` already supports users-in-many-teams.

## Concrete layout after reorg

**Products (`kind = 'product'`)** — owning pod in parens:
- Healthytica *(Products pod)*
- Valytica *(Products pod)*
- AI Workshop *(Products pod)*
- Internal *(Platform pod)*
- Standup-AI *(Platform pod)*

**Back-office (`kind = 'ops'`, `ownerTeamId = null`)**:
- Compliance — India
- Compliance — Netherlands
- Hiring
- NL Payroll Setup
- (plus the Entity-tagged databases: People, Vendors, Contracts, Assets,
  Tools & Subscriptions — unchanged)

**Teams (pods)** — *STRAWMAN, confirm during review*:
- **Products** pod — owns Healthytica, Valytica, AI Workshop
- **Platform** pod — owns Internal, Standup-AI
- Members: all three (Sandeep, Jayasaagar, Shravani) in both pods initially;
  refine later. Users can be in multiple pods.

**Deleted teams** (the 9 current teams collapse): Healthytica, Valytica,
AI Workshop (mirror → replaced by pods + products); Internal Tools (→ Platform
pod); Sales, Marketing, Finance (→ department lenses only); Admin, People (HR)
(→ back-office area, not teams).

**Departments** — unchanged.

## Migration strategy (live data)

The `gnanalytica` workspace already exists, and `seed-org.ts` short-circuits on
an existing workspace. So this is an **in-place, idempotent reorg script**, not
a re-seed:

`src/db/reorg-org.ts` (run: `npm run db:reorg-org`), which on the existing
workspace:

1. Ensure the new pods exist (`Products`, `Platform`); add all members.
2. Set `projects.kind` (`ops` for the 4 back-office projects, `product` for the
   rest) and `projects.ownerTeamId` (pod for products, null for ops).
3. Re-point existing issues: any issue whose `teamId` is an old product-mirror
   team → set to the owning pod of its project (fallback: leave null, product is
   still known via `projectId`).
4. Delete the 9 old teams (issues `set null` on delete — safe; step 3 already
   moved them).
5. Idempotent: re-running makes no further changes.

`seed-org.ts` and `seed-crm-data.ts` are updated to produce this structure
directly on a fresh DB (so new environments seed correctly), and the team list
in `seed-crm-data.ts` (which currently re-adds Sales/Marketing) is reconciled.

## UI touch points (minimal)

- Wherever projects are listed/grouped, split by `kind`: a **Products** section
  and a **Back-office / Ops** section.
- Show a product's owning pod (read `ownerTeamId`); show a pod's owned products.
- Team pickers no longer offer product-mirror or Sales/Marketing/Finance teams.

Exact components TBD in the implementation plan after auditing
`src/components` and `src/lib/data.ts` for team/project rendering.

## Testing

- `src/lib/departments.test.ts` stays green (departments unchanged).
- New: a test for the reorg script's mapping (old team → pod, kind assignment)
  and its idempotency.
- `tsc --noEmit` clean; existing suite green.

## Out of scope / rejected

- **Approach B** (many-to-many team↔product join) — YAGNI now; revisit if a
  product ever needs co-owning pods.
- **Approach C** (first-class `areas` table) — invasive migration across every
  `productId` FK; not worth it at current scale.
- Renaming product/project `key`s — separate cleanup; not required here.
- Any change to the Entity (India/NL/Global) model or the regulated per-entity
  systems.

## Open question for review

1. **Pod arrangement** — is `Products` + `Platform` the right cut, or do you
   want a different split (e.g. by entity, or a single pod, or per-product)?
