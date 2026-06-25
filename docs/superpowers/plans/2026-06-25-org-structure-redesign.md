# Org Structure Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the duplicated product/team/department/back-office model into four clean axes — Products (`projects.kind='product'`), Back-office (`kind='ops'`), Teams-as-pods (own products via `projects.ownerTeamId`), Departments (unchanged) — and migrate the live `gnanalytica` workspace in place.

**Architecture:** Add two columns to `projects` (`kind`, `ownerTeamId`) + a Drizzle relation. A pure `planReorg()` function computes the migration; `reorg-org.ts` applies it transactionally and idempotently. Seed scripts are rewritten to produce the same end state on a fresh DB. UI surfaces split products vs ops and show pod↔product ownership.

**Tech Stack:** Next.js (App Router), Drizzle ORM + Postgres (Neon), `drizzle-kit push` (no migration files), Vitest, TypeScript.

---

## File Structure

- `src/db/schema.ts` — add `projects.kind`, `projects.ownerTeamId`, `ownerTeam` relation. *(modify)*
- `src/db/reorg-plan.ts` — **new**: pure `planReorg()` (no DB), unit-testable.
- `src/db/reorg-plan.test.ts` — **new**: tests for mapping + idempotency.
- `src/db/reorg-org.ts` — **new**: applies the plan to the live DB in a txn.
- `src/db/seed-org.ts` — rewrite teams/projects/databases to the new shape. *(modify)*
- `src/db/seed-crm-data.ts` — stop seeding Sales/Marketing teams. *(modify)*
- `src/lib/data.ts` — filter products vs ops; expose `ownerTeam`/owned-products. *(modify)*
- `src/lib/actions.ts` — `createProject` accepts `kind` + `ownerTeamId`. *(modify)*
- `src/components/sidebar.tsx` — Products tree = products; add Operations group. *(modify)*
- `src/components/projects-view.tsx` — split Products / Operations sections. *(modify)*
- `src/components/project-detail.tsx` — show owning pod. *(modify)*
- `src/components/team-detail.tsx` — show owned products. *(modify)*
- `package.json` — add `db:reorg-org` script. *(modify)*

Conventions to follow (from the codebase): data fns live in `src/lib/data.ts` and return plain objects; server actions in `src/lib/actions.ts` use `revalidatePath`; tests use Vitest (`describe/it/expect`) like `src/lib/departments.test.ts`; seed helpers build TipTap doc JSON via local `p()/h()/bullets()` helpers.

---

## Task 1: Schema — add `kind` and `ownerTeamId` to projects

**Files:**
- Modify: `src/db/schema.ts` (projects table ~line 68-91; `projectsRelations` ~line 590-600)

- [ ] **Step 1: Add the two columns**

In `src/db/schema.ts`, inside the `projects` `pgTable` column block (after `enabledDepartments`), add:

```ts
    // 'product' = something we build (gets department modules + CRM);
    // 'ops' = back-office (no departments, no CRM).
    kind: text("kind").$type<"product" | "ops">().notNull().default("product"),
    // Owning pod (cross-functional team). null for ops projects.
    ownerTeamId: uuid("owner_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
```

- [ ] **Step 2: Add the relation**

In `projectsRelations`, add an `ownerTeam` one-relation alongside `initiative`:

```ts
  ownerTeam: one(teams, {
    fields: [projects.ownerTeamId],
    references: [teams.id],
  }),
```

- [ ] **Step 3: Push schema to the dev DB**

Run: `npm run db:push`
Expected: drizzle-kit reports adding `kind` and `owner_team_id` to `projects`; no destructive warnings on those columns. Accept the changes.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db): add projects.kind and projects.ownerTeamId"
```

---

## Task 2: Pure reorg plan — `planReorg()` + tests

This is the heart of the migration, kept DB-free so it's fully unit-tested.

**Files:**
- Create: `src/db/reorg-plan.ts`
- Create: `src/db/reorg-plan.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/db/reorg-plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { planReorg, type ReorgInput } from "./reorg-plan";

// Mirrors the CURRENT seeded state (pre-reorg).
const CURRENT: ReorgInput = {
  teams: [
    { id: "t-hlt", name: "Healthytica" },
    { id: "t-vlt", name: "Valytica" },
    { id: "t-wrk", name: "AI Workshop" },
    { id: "t-itl", name: "Internal Tools" },
    { id: "t-adm", name: "Admin" },
    { id: "t-hr", name: "People (HR)" },
    { id: "t-fin", name: "Finance" },
    { id: "t-sal", name: "Sales" },
    { id: "t-mkt", name: "Marketing" },
  ],
  projects: [
    { id: "p-hlt", name: "Healthytica" },
    { id: "p-vlt", name: "Valytica" },
    { id: "p-aiw", name: "AI Workshop" },
    { id: "p-int", name: "Internal" },
    { id: "p-std", name: "Standup-AI" },
    { id: "p-cin", name: "Compliance — India" },
    { id: "p-cnl", name: "Compliance — Netherlands" },
    { id: "p-hire", name: "Hiring" },
    { id: "p-pay", name: "NL Payroll Setup" },
  ],
  databases: [
    { id: "d-ppl", name: "People" },
    { id: "d-ven", name: "Vendors" },
    { id: "d-con", name: "Contracts" },
    { id: "d-ast", name: "Assets" },
    { id: "d-tls", name: "Tools & Subscriptions" },
  ],
};

describe("planReorg", () => {
  const plan = planReorg(CURRENT);

  it("creates the two pods", () => {
    expect(plan.pods.map((p) => p.name)).toEqual(["Products", "Platform"]);
  });

  it("assigns each kept product a kind and owning pod", () => {
    const byProject = Object.fromEntries(plan.projectUpdates.map((u) => [u.name, u]));
    expect(byProject["Healthytica"]).toMatchObject({ kind: "product", ownerPod: "Products" });
    expect(byProject["Standup-AI"]).toMatchObject({ kind: "product", ownerPod: "Products" });
    expect(byProject["Internal"]).toMatchObject({ kind: "product", ownerPod: "Platform" });
    expect(byProject["Hiring"]).toMatchObject({ kind: "ops", ownerPod: null });
  });

  it("renames NL Payroll Setup to India Payroll Setup", () => {
    const rename = plan.projectRenames.find((r) => r.from === "NL Payroll Setup");
    expect(rename?.to).toBe("India Payroll Setup");
  });

  it("deletes the compliance projects", () => {
    expect(plan.deleteProjectIds).toEqual(expect.arrayContaining(["p-cin", "p-cnl"]));
  });

  it("deletes the 7 redundant teams, keeps none of them", () => {
    expect(plan.deleteTeamIds.sort()).toEqual(
      ["t-hlt", "t-vlt", "t-wrk", "t-itl", "t-adm", "t-hr", "t-fin", "t-sal", "t-mkt"].sort(),
    );
  });

  it("drops Vendors, Contracts, Assets databases; keeps People + Tools", () => {
    expect(plan.deleteDatabaseIds.sort()).toEqual(["d-ast", "d-con", "d-ven"].sort());
    expect(plan.mergeVendorsIntoToolsId).toEqual({ from: "d-ven", to: "d-tls" });
  });

  it("maps old product-mirror teams to their pod for issue remapping", () => {
    expect(plan.teamToPod["t-hlt"]).toBe("Products");
    expect(plan.teamToPod["t-itl"]).toBe("Platform");
  });

  it("is idempotent: planning the post-reorg state is a no-op", () => {
    const POST: ReorgInput = {
      teams: [{ id: "t-prod", name: "Products" }, { id: "t-plat", name: "Platform" }],
      projects: [
        { id: "p-hlt", name: "Healthytica", kind: "product", ownerTeamId: "t-prod" },
        { id: "p-int", name: "Internal", kind: "product", ownerTeamId: "t-plat" },
        { id: "p-hire", name: "Hiring", kind: "ops", ownerTeamId: null },
        { id: "p-pay", name: "India Payroll Setup", kind: "ops", ownerTeamId: null },
      ],
      databases: [{ id: "d-ppl", name: "People" }, { id: "d-tls", name: "Tools & Subscriptions" }],
    };
    const p2 = planReorg(POST);
    expect(p2.deleteTeamIds).toEqual([]);
    expect(p2.deleteProjectIds).toEqual([]);
    expect(p2.deleteDatabaseIds).toEqual([]);
    expect(p2.projectRenames).toEqual([]);
    expect(p2.isNoop).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/reorg-plan.test.ts`
Expected: FAIL — `Cannot find module './reorg-plan'`.

- [ ] **Step 3: Implement `planReorg`**

Create `src/db/reorg-plan.ts`:

```ts
// Pure migration planner — NO database access. Given the current org rows,
// returns the set of changes to reach the redesigned structure (see
// docs/superpowers/specs/2026-06-25-org-structure-redesign-design.md).

export type ReorgInput = {
  teams: { id: string; name: string }[];
  projects: {
    id: string;
    name: string;
    kind?: "product" | "ops";
    ownerTeamId?: string | null;
  }[];
  databases: { id: string; name: string }[];
};

type PodName = "Products" | "Platform";

// Which products belong to which pod (by current project name).
const PRODUCTS_POD = new Set(["Healthytica", "Valytica", "AI Workshop", "Standup-AI"]);
const PLATFORM_POD = new Set(["Internal"]);
const OPS_PROJECTS = new Set(["Hiring", "NL Payroll Setup", "India Payroll Setup"]);
const DELETE_PROJECTS = new Set(["Compliance — India", "Compliance — Netherlands"]);
const KEEP_DATABASES = new Set(["People", "Tools & Subscriptions"]);
const RENAMES: Record<string, string> = { "NL Payroll Setup": "India Payroll Setup" };

// Old team name -> pod it folds into, for remapping issues.
const TEAM_TO_POD: Record<string, PodName> = {
  Healthytica: "Products",
  Valytica: "Products",
  "AI Workshop": "Products",
  "Internal Tools": "Platform",
};

const POD_NAMES: PodName[] = ["Products", "Platform"];

export type ReorgPlan = {
  pods: { name: PodName }[];
  projectUpdates: { id: string; name: string; kind: "product" | "ops"; ownerPod: PodName | null }[];
  projectRenames: { id: string; from: string; to: string }[];
  deleteProjectIds: string[];
  deleteTeamIds: string[];
  deleteDatabaseIds: string[];
  mergeVendorsIntoToolsId: { from: string; to: string } | null;
  teamToPod: Record<string, PodName>;
  isNoop: boolean;
};

function podForProject(name: string): PodName | null {
  if (PRODUCTS_POD.has(name)) return "Products";
  if (PLATFORM_POD.has(name)) return "Platform";
  return null;
}

export function planReorg(input: ReorgInput): ReorgPlan {
  const existingPodNames = new Set(input.teams.map((t) => t.name));
  const pods = POD_NAMES.filter((n) => !existingPodNames.has(n)).map((name) => ({ name }));

  const projectUpdates: ReorgPlan["projectUpdates"] = [];
  const projectRenames: ReorgPlan["projectRenames"] = [];
  const deleteProjectIds: string[] = [];

  for (const proj of input.projects) {
    if (DELETE_PROJECTS.has(proj.name)) {
      deleteProjectIds.push(proj.id);
      continue;
    }
    const finalName = RENAMES[proj.name] ?? proj.name;
    if (finalName !== proj.name) {
      projectRenames.push({ id: proj.id, from: proj.name, to: finalName });
    }
    const kind: "product" | "ops" = OPS_PROJECTS.has(proj.name) ? "ops" : "product";
    const ownerPod = kind === "ops" ? null : podForProject(finalName);
    projectUpdates.push({ id: proj.id, name: finalName, kind, ownerPod });
  }

  // Teams to delete = every current team that isn't one of the two pods.
  const deleteTeamIds = input.teams
    .filter((t) => !POD_NAMES.includes(t.name as PodName))
    .map((t) => t.id);

  // Databases.
  const deleteDatabaseIds = input.databases
    .filter((d) => !KEEP_DATABASES.has(d.name) && d.name !== "Vendors")
    .map((d) => d.id);
  const vendors = input.databases.find((d) => d.name === "Vendors");
  const tools = input.databases.find((d) => d.name === "Tools & Subscriptions");
  const mergeVendorsIntoToolsId =
    vendors && tools ? { from: vendors.id, to: tools.id } : null;
  if (vendors) deleteDatabaseIds.push(vendors.id);

  // teamToPod: old team ID -> pod name, for remapping issues off mirror teams.
  const teamToPod: Record<string, PodName> = {};
  for (const t of input.teams) {
    const pod = TEAM_TO_POD[t.name];
    if (pod) teamToPod[t.id] = pod;
  }

  const isNoop =
    pods.length === 0 &&
    projectRenames.length === 0 &&
    deleteProjectIds.length === 0 &&
    deleteTeamIds.length === 0 &&
    deleteDatabaseIds.length === 0;

  return {
    pods,
    projectUpdates,
    projectRenames,
    deleteProjectIds,
    deleteTeamIds,
    deleteDatabaseIds,
    mergeVendorsIntoToolsId,
    teamToPod,
    isNoop,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/reorg-plan.test.ts`
Expected: PASS (8 tests).

Note: in the idempotency case, `KEEP_DATABASES` already excludes the absent
Vendors DB, `deleteDatabaseIds` is empty, and no pods/renames/deletes are
produced, so `isNoop` is true.

- [ ] **Step 5: Commit**

```bash
git add src/db/reorg-plan.ts src/db/reorg-plan.test.ts
git commit -m "feat(db): pure planReorg() with tests for the org migration"
```

---

## Task 3: Apply the reorg to the DB — `reorg-org.ts`

**Files:**
- Create: `src/db/reorg-org.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Add the npm script**

In `package.json` `"scripts"`, after `"db:seed-org"` (or near the other `db:` scripts), add:

```json
    "db:reorg-org": "tsx src/db/reorg-org.ts",
```

(Match the runner used by the existing `db:seed-org` script — if it uses `tsx`, use `tsx`; if `dotenv -e .env.local -- tsx`, mirror that exactly.)

- [ ] **Step 2: Implement the applier**

Create `src/db/reorg-org.ts`:

```ts
import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "./index";
import { planReorg } from "./reorg-plan";

/**
 * In-place, idempotent migration of the existing Gnanalytica workspace to the
 * redesigned org structure. Safe to re-run. See
 * docs/superpowers/specs/2026-06-25-org-structure-redesign-design.md.
 *
 * Run: npm run db:reorg-org
 */

const POD_META: Record<string, { key: string; icon: string; color: string }> = {
  Products: { key: "PROD", icon: "🚀", color: "#6366f1" },
  Platform: { key: "PLAT", icon: "🛠️", color: "#3b82f6" },
};

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) {
    console.log("No gnanalytica workspace — run db:seed-org first. Nothing to do.");
    return;
  }

  const teams = await db
    .select({ id: schema.teams.id, name: schema.teams.name })
    .from(schema.teams)
    .where(eq(schema.teams.workspaceId, ws.id));
  const projects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      kind: schema.projects.kind,
      ownerTeamId: schema.projects.ownerTeamId,
    })
    .from(schema.projects)
    .where(eq(schema.projects.workspaceId, ws.id));
  const databases = await db
    .select({ id: schema.databases.id, name: schema.databases.name })
    .from(schema.databases)
    .where(eq(schema.databases.workspaceId, ws.id));

  const plan = planReorg({ teams, projects, databases });
  if (plan.isNoop) {
    console.log("Org already in the redesigned shape — no changes.");
    return;
  }

  await db.transaction(async (tx) => {
    // 1. Ensure pods exist; collect their ids by name.
    const podIdByName = new Map<string, string>();
    for (const t of teams) podIdByName.set(t.name, t.id);
    for (const pod of plan.pods) {
      const meta = POD_META[pod.name];
      const [row] = await tx
        .insert(schema.teams)
        .values({ workspaceId: ws.id, name: pod.name, key: meta.key, icon: meta.icon, color: meta.color })
        .returning({ id: schema.teams.id });
      podIdByName.set(pod.name, row.id);
    }

    // 2. Add all workspace members to each pod.
    const members = await tx
      .select({ userId: schema.workspaceMembers.userId })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.workspaceId, ws.id));
    for (const podName of ["Products", "Platform"]) {
      const podId = podIdByName.get(podName)!;
      for (const m of members) {
        await tx
          .insert(schema.teamMembers)
          .values({ teamId: podId, userId: m.userId })
          .onConflictDoNothing();
      }
    }

    // 3. Renames.
    for (const r of plan.projectRenames) {
      await tx.update(schema.projects).set({ name: r.to }).where(eq(schema.projects.id, r.id));
    }

    // 4. Set kind + ownerTeamId per project.
    for (const u of plan.projectUpdates) {
      await tx
        .update(schema.projects)
        .set({ kind: u.kind, ownerTeamId: u.ownerPod ? podIdByName.get(u.ownerPod)! : null })
        .where(eq(schema.projects.id, u.id));
    }

    // 5. Remap issues off old product-mirror teams to their pod.
    //    plan.teamToPod is keyed by the OLD team id -> pod name. Must run
    //    before the teams are deleted in step 7.
    for (const [oldTeamId, podName] of Object.entries(plan.teamToPod)) {
      const podId = podIdByName.get(podName);
      if (!podId) continue;
      await tx
        .update(schema.issues)
        .set({ teamId: podId })
        .where(eq(schema.issues.teamId, oldTeamId));
    }

    // 6. Merge Vendors rows into Tools & Subscriptions (best-effort: move rows).
    if (plan.mergeVendorsIntoToolsId) {
      await tx
        .update(schema.databaseRows)
        .set({ databaseId: plan.mergeVendorsIntoToolsId.to })
        .where(eq(schema.databaseRows.databaseId, plan.mergeVendorsIntoToolsId.from));
    }

    // 7. Deletes.
    if (plan.deleteProjectIds.length) {
      await tx.delete(schema.projects).where(inArray(schema.projects.id, plan.deleteProjectIds));
    }
    if (plan.deleteDatabaseIds.length) {
      await tx.delete(schema.databases).where(inArray(schema.databases.id, plan.deleteDatabaseIds));
    }
    if (plan.deleteTeamIds.length) {
      await tx.delete(schema.teams).where(inArray(schema.teams.id, plan.deleteTeamIds));
    }

    // 8. Drop the now-empty Compliance & Legal initiative.
    await tx
      .delete(schema.initiatives)
      .where(and(eq(schema.initiatives.workspaceId, ws.id), eq(schema.initiatives.name, "Compliance & Legal")));
  });

  console.log("Reorg applied.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

> **NOTE for the implementer:** issue remap (step 5) filters by old `teamId`
> only — team ids are workspace-unique, so no workspace predicate is needed.
> It must run before the team deletes (step 7); `issues.teamId` is
> `onDelete: set null`, so any issue missed by the remap simply loses its team
> (its product is still known via `projectId`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 after removing the placeholder block.

- [ ] **Step 4: Dry-run mentally / commit before running on live data**

```bash
git add src/db/reorg-org.ts package.json
git commit -m "feat(db): in-place idempotent db:reorg-org applier"
```

- [ ] **Step 5: Run against the DB, then re-run to confirm idempotency**

Run: `npm run db:reorg-org`
Expected: `Reorg applied.`
Run again: `npm run db:reorg-org`
Expected: `Org already in the redesigned shape — no changes.`

---

## Task 4: Rewrite seeds for fresh DBs

**Files:**
- Modify: `src/db/seed-org.ts` (teams ~87-97, initiatives ~99-107, projects ~111-121, databases ~161-220)
- Modify: `src/db/seed-crm-data.ts` (teams ~82-83)

- [ ] **Step 1: Replace the teams array**

In `src/db/seed-org.ts`, replace the 9-team `teams` insert with the two pods:

```ts
  const podRows = await db
    .insert(schema.teams)
    .values([
      { workspaceId: ws.id, name: "Products", key: "PROD", icon: "🚀", color: "#6366f1" },
      { workspaceId: ws.id, name: "Platform", key: "PLAT", icon: "🛠️", color: "#3b82f6" },
    ])
    .returning({ id: schema.teams.id, name: schema.teams.name });
  const podId = (name: string) => podRows.find((p) => p.name === name)!.id;
```

- [ ] **Step 2: Add all members to both pods**

After the owner/admins are ensured, add memberships:

```ts
  const wsMembers = await db
    .select({ userId: schema.workspaceMembers.userId })
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.workspaceId, ws.id));
  for (const pod of podRows) {
    for (const m of wsMembers) {
      await db
        .insert(schema.teamMembers)
        .values({ teamId: pod.id, userId: m.userId })
        .onConflictDoNothing();
    }
  }
```

- [ ] **Step 3: Update initiatives — drop Compliance & Legal**

Replace the initiatives insert with:

```ts
  const initiatives = await db
    .insert(schema.initiatives)
    .values([
      { workspaceId: ws.id, name: "Revenue FY26", color: "#10b981" },
      { workspaceId: ws.id, name: "Hiring", color: "#5e6ad2" },
    ])
    .returning();
```

- [ ] **Step 4: Replace the projects insert with kind + ownerTeamId**

```ts
  await db.insert(schema.projects).values([
    { workspaceId: ws.id, name: "Healthytica", key: "HLTH", color: "#10b981", kind: "product", ownerTeamId: podId("Products"), initiativeId: init("Revenue FY26"), description: "AI blood-biomarker health intelligence." },
    { workspaceId: ws.id, name: "Valytica", key: "VAL", color: "#6366f1", kind: "product", ownerTeamId: podId("Products"), initiativeId: init("Revenue FY26"), description: "AI valuation management for Indian valuers." },
    { workspaceId: ws.id, name: "AI Workshop", key: "AIW", color: "#a855f7", kind: "product", ownerTeamId: podId("Products"), initiativeId: init("Revenue FY26"), description: "SaaS LMS for the 30-day AI workshop." },
    { workspaceId: ws.id, name: "Standup-AI", key: "STDA", color: "#3b82f6", kind: "product", ownerTeamId: podId("Products"), initiativeId: init("Revenue FY26"), description: "Autonomous standup bot." },
    { workspaceId: ws.id, name: "Internal", key: "INT", color: "#3b82f6", kind: "product", ownerTeamId: podId("Platform"), description: "The internal Notion + Linear hub (this app)." },
    { workspaceId: ws.id, name: "Hiring", key: "HIRE", color: "#5e6ad2", kind: "ops", initiativeId: init("Hiring"), description: "Open roles across entities." },
    { workspaceId: ws.id, name: "India Payroll Setup", key: "PAY", color: "#f59e0b", kind: "ops", description: "Stand up India payroll." },
  ]);
```

(Standup-AI moves to Revenue FY26 + Products pod. Compliance projects and NL Payroll are gone.)

- [ ] **Step 5: Reduce databases to People + Tools & Subscriptions (Vendors merged)**

Delete the `makeDb("Vendors", …)`, `makeDb("Contracts", …)`, and `makeDb("Assets", …)` calls. Update the Tools & Subscriptions DB to carry the provider/renewal/url fields and an Odoo row:

```ts
  await makeDb(
    "Tools & Subscriptions",
    "🧰",
    [
      { name: "Tool", type: "text" },
      { name: "Provider", type: "text" },
      { name: "Monthly cost", type: "number" },
      { name: "Owner", type: "text" },
      { name: "Entity", type: "select", options: ENTITY },
      { name: "Renewal date", type: "date" },
      { name: "URL", type: "url" },
    ],
    [
      { Tool: "Odoo", Provider: "Odoo", Entity: "Netherlands", Owner: "Sandeep", URL: "https://www.odoo.com" },
    ],
  );
```

- [ ] **Step 6: Link Odoo from the Netherlands Entity Reference page**

In the `Netherlands — Entity Reference` page content, change the Providers bullet for bookkeeping to reference Odoo, e.g. replace `"Bookkeeper/accountant: …"` with `"Bookkeeper/accountant: Odoo (https://www.odoo.com) — accounts, BTW/VAT, payroll."`.

- [ ] **Step 7: Stop seeding Sales/Marketing teams in CRM seed**

In `src/db/seed-crm-data.ts`, remove the insert of the `Sales` and `Marketing` teams (~lines 82-83) and any now-unused variables around it. The CRM rows themselves key on `productId` (projects) and are unaffected.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Verify a fresh seed produces the new shape (against a scratch/dev DB only)**

If a disposable dev DB is available: drop the workspace and run `npm run db:seed-org`, then confirm 2 teams, 7 projects with correct `kind`, 2 databases. **Do not run against production.** If no scratch DB, rely on the `reorg-org` path for the live DB and the unit tests for correctness.

- [ ] **Step 10: Commit**

```bash
git add src/db/seed-org.ts src/db/seed-crm-data.ts
git commit -m "feat(db): seed the redesigned org shape on fresh DBs"
```

---

## Task 5: Data layer — products vs ops, owner/owned relations

**Files:**
- Modify: `src/lib/data.ts` (`getProjectsWithCounts` ~228-241, `getProject` ~275-300, `getProductSummaries` ~1394-1448, `getTeam` ~1251-1277)

- [ ] **Step 1: Return `kind` from the project list query**

In `getProjectsWithCounts`, include `kind` and `ownerTeamId` in the selected columns so callers can split and label. Example (match the existing select shape):

```ts
      kind: schema.projects.kind,
      ownerTeamId: schema.projects.ownerTeamId,
```

- [ ] **Step 2: Filter product summaries to products only**

In `getProductSummaries`, add a `where` clause restricting to `kind = 'product'`:

```ts
    .where(and(eq(schema.projects.workspaceId, workspaceId), eq(schema.projects.kind, "product")))
```

(Ensure `and`/`eq` are imported in `data.ts` — they already are for other queries.)

- [ ] **Step 3: Include owning pod on project detail**

In `getProject`, fetch the `ownerTeam` relation (or join `teams`) and return `ownerTeam: { id, name } | null`. If `getProject` uses `db.query.projects.findFirst`, add `with: { ownerTeam: true }`; if it uses a manual select, add a left join on `teams` via `ownerTeamId`.

- [ ] **Step 4: Include owned products on team detail**

In `getTeam`, add the products this pod owns:

```ts
  const ownedProducts = await db
    .select({ id: schema.projects.id, name: schema.projects.name, color: schema.projects.color })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, workspaceId), eq(schema.projects.ownerTeamId, id)));
```

Return `ownedProducts` on the team object.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data.ts
git commit -m "feat(data): split products vs ops, expose pod ownership"
```

---

## Task 6: Actions — createProject accepts kind + ownerTeamId

**Files:**
- Modify: `src/lib/actions.ts` (`createProject` ~830-865)

- [ ] **Step 1: Thread the new fields through createProject**

Add optional `kind` (default `'product'`) and `ownerTeamId` to the `createProject` input and the insert values:

```ts
export async function createProject(input: {
  name: string;
  key: string;
  kind?: "product" | "ops";
  ownerTeamId?: string | null;
  // …existing fields…
}) {
  // …
  await db.insert(schema.projects).values({
    // …existing…
    kind: input.kind ?? "product",
    ownerTeamId: input.ownerTeamId ?? null,
  });
  // …revalidatePath as before…
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(actions): createProject accepts kind and ownerTeamId"
```

---

## Task 7: UI — sidebar + project list split, ownership badges

**Files:**
- Modify: `src/components/sidebar.tsx` (Products tree ~376-379, `ProductNavItem` ~458-502)
- Modify: `src/components/projects-view.tsx`
- Modify: `src/components/project-detail.tsx`
- Modify: `src/components/team-detail.tsx`

- [ ] **Step 1: Sidebar — products under Products, ops under Operations**

Where `projects` are mapped under the "Products" section (sidebar.tsx ~376), filter to `kind === 'product'`. Add a sibling "Operations" group that lists `kind === 'ops'` projects as plain links (no department children — `ProductNavItem` expands departments, so render ops projects with a simpler item or pass a flag to skip the department expansion).

```tsx
{projects.filter((p) => p.kind === "product").map((p) => (
  <ProductNavItem key={p.id} project={p} /* …existing props… */ />
))}
// …Operations group…
{projects.filter((p) => p.kind === "ops").map((p) => (
  <SidebarLink key={p.id} href={`/projects/${p.id}`} label={p.name} />
))}
```

(Use the existing simple-link component the sidebar already uses for non-expandable entries; if none exists, render an `<a>`/`<Link>` matching the sidebar's link styling.)

- [ ] **Step 2: Projects view — two sections**

In `projects-view.tsx`, partition the incoming `projects` by `kind` and render a **Products** group and an **Operations** group with headings. Ops cards can omit the product-only metrics; a small "Ops" badge distinguishes them.

- [ ] **Step 3: Project detail — show owning pod**

In `project-detail.tsx`, if `project.ownerTeam` is present, render a small badge/line: `Owned by {project.ownerTeam.name}` linking to `/teams/{ownerTeam.id}`. Only for `kind === 'product'`.

- [ ] **Step 4: Team detail — show owned products**

In `team-detail.tsx`, render an "Owns" section listing `team.ownedProducts` (name + color chip, linking to each product). Hide the section when empty.

- [ ] **Step 5: Typecheck + run dev build check**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npm run build` (or `next build`) if quick; otherwise rely on tsc + a manual smoke check in Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/components/projects-view.tsx src/components/project-detail.tsx src/components/team-detail.tsx
git commit -m "feat(ui): split products vs ops, show pod ownership"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all pass, including `reorg-plan.test.ts` and `departments.test.ts`.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Smoke-check the running app**

Start the app, sign in to the Gnanalytica workspace, and confirm:
- Sidebar shows 5 products (Healthytica, Valytica, AI Workshop, Standup-AI, Internal) under Products and 2 ops projects under Operations.
- `/teams` shows exactly **Products** and **Platform**; each lists its owned products.
- A product detail shows its owning pod.
- `/databases` shows **People** and **Tools & Subscriptions** (with an Odoo row); no Vendors/Contracts/Assets.
- Issue create/edit still works; the team picker offers only the two pods.

- [ ] **Step 5: Final commit / open PR**

```bash
git add -A && git commit -m "chore: org structure redesign — verification pass" || true
git push -u origin reorg/org-structure
gh pr create --base main --title "Org structure redesign: products, pods, departments, back-office" --body "Implements docs/superpowers/specs/2026-06-25-org-structure-redesign-design.md"
```

---

## Notes for the implementer

- **Production data:** `db:reorg-org` (Task 3) runs against the live Neon DB. It's
  wrapped in a transaction and is idempotent, but take a Neon branch/snapshot
  first if one isn't automatic.
- **Match existing runner:** mirror how `db:seed-org` invokes TS (tsx / dotenv)
  for the new `db:reorg-org` script.
- **Don't restructure** unrelated code; follow the file boundaries above.
