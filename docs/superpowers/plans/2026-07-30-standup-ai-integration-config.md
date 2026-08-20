# Standup AI integration — hub-side configuration & build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## STATUS — 2026-08-17

Tasks **2, 3, 5, 6, 7 are implemented** on branch `feat/standup-ai-integration`,
together with three additions this plan did not have. Task 1 is configuration and
is still yours to do in the running app. Task 4 was fixed the other way round —
see the correction below.

| Task | State | Notes |
|---|---|---|
| 1 — register key + webhook | **open (config only)** | do this in `/settings/api`; nothing to code |
| 2 — `GET /api/v1/users` | done | `src/app/api/v1/users/route.ts`, `userDto`, documented |
| 3 — `externalId` idempotency | done | + `externalSource` and `externalUrl`; **200 vs 201** distinguishes a de-duplicated retry from a create |
| 4 — documented-but-missing routes | done, **inverted** | see correction ① |
| 5 — per-delivery id | done | `X-Internal-Delivery`, stable across retries |
| 6 — retry delivery | done | 3 attempts, 1s/4s backoff, **off the response path** — see correction ② |
| 7 — safe issue numbering | done | retry on SQLSTATE 23505, 4 attempts |
| **new** — `assigneeEmail` | done | see addition ③ — this, not Task 2, is what actually unblocks assignment |
| **new** — `?updatedSince=` | done | see addition ④ |
| **new** — stop leaking `err.message` | done | see addition ⑤ |

### ① Correction to Task 4 — the tables do not exist

Task 4 says *"Both tables exist in the schema, so either implement the routes …
**Prefer implementing**"*. That is wrong: **there is no `teams` table and no
`initiatives` table** in `src/db/schema.ts` — grep it. `docs/API.md` documented two
endpoints for data models this app has never had.

Fixed by deleting the two rows from `docs/API.md` and reconciling the whole
endpoint table against `ls src/app/api/v1/`. Implementing routes for absent tables
would have meant inventing a data model to satisfy a stale doc.

### ② Correction to Task 6 — retries must not block the response

Task 6 Step 3 spotted this and it is right: `dispatchWebhook` is `await`ed inside
server actions and API handlers, so a serially-retried delivery would put its
whole backoff on a user's "Create issue" click (~20s worst case at 3 attempts).

Resolved by awaiting **only the first attempt** — preserving today's worst case of
one 5s timeout — and handing the retry chain to `after()` from `next/server`, so
it runs once the response is sent and Vercel keeps the function alive to finish
it. Outside a request scope (seeds, scripts) it falls back to a detached promise.

### ③ Addition — `assigneeEmail` is the real unblock, not `/users`

This plan (and the Standup AI companion's v1) treats `GET /users` as the hard
dependency for assignment. It is not the cheapest one. `apiCreateIssue` and
`apiUpdateIssue` now accept **`assigneeEmail`** and resolve it through
`workspaceMembers`, so a caller can assign work without ever learning our uuids —
and without building an email→uuid cache on their side.

The join through `workspaceMembers` is load-bearing: `users.email` is globally
unique, so matching the `users` table alone would let a key for workspace A assign
an issue to a member of workspace B.

An unrecognised address files the issue **unassigned** rather than erroring.
`/users` remains valuable — for the picker UI and for warning a human *before*
they file — but it no longer gates anything.

### ④ Addition — `GET /issues?updatedSince=`

Because delivery is best-effort, consumers run a poll-back fallback. Without a
change-feed that is one `GET /issues/{id}` **per tracked issue per pass**, forever.
`?updatedSince=` collapses a pass to one request. Ordering is unchanged
(created-desc, existing cursor semantics intact) — it is purely a filter. Indexed
by `issues_ws_updated_idx`.

### ⑤ Addition — the API leaked internal error text

`withApiAuth` reflected any thrown `err.message` to the caller as a **400**. That
exposed Drizzle constraint text (table and index names) and Neon connection
detail, and it mislabelled our own faults as the caller's bad input, so a client
would not retry when it should. Deliberate failures now throw `ApiInputError`
(4xx, caller-safe message); everything else logs and returns a generic **500**.

### Verification

`tsc --noEmit` clean · `eslint` clean · `vitest` 219 passing, 13 of them new
(`src/lib/api/errors.test.ts`, `src/lib/api/webhook-retry.test.ts`).

> One **pre-existing** failure in `src/lib/matrix-format.test.ts` is unrelated:
> `formatDate("2026-08-15T00:00:00.000Z")` is asserted to be `"Aug 15, 2026"`,
> which only holds in a non-negative UTC offset. It fails on `main` too.

**Still to do:** `npm run db:push` for the three new `issues` columns and two new
indexes (Task 3 Step 2) — a schema change nobody has applied yet.

---

**Goal:** let Standup AI file approved meeting action items into this hub as issues, keep status in sync both ways, and assign them to the right person — by closing the five gaps that currently make that impossible or unsafe.

**Companion doc:** `D:/Gnanalytica/Standup AI/docs/integrations/internal-hub-connector-plan.md` — the connector work on the Standup AI side. That side can start today; **Tasks 2 and 3 here are its hard blockers.**

**Architecture:** Everything reuses existing infrastructure — `withApiAuth` + `src/lib/api/ops.ts` + `src/lib/api/dto.ts` for the API surface, `dispatchWebhook` for outbound events, `getMembers` for the directory. Two schema additions (Task 3, Task 5) and one new route folder (Task 2). No new dependencies.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon HTTP, vitest.

## Global Constraints

- No new npm dependencies.
- Neon HTTP: no `db.transaction`; sequential idempotent statements only.
- Server actions: `getWorkspace()` scoping + `revalidatePath`. Follow existing patterns.
- API routes: always `withApiAuth`; return `ok(...)` / `apiError(...)` from `src/lib/api/http.ts`; shape every response through a `*Dto` in `src/lib/api/dto.ts` — **never** return a raw Drizzle row (it would leak columns).
- Schema changes: `npm run db:push` after each, and note it in the task's commit body so the deploy runbook stays honest.
- Gates per task: `npx tsc --noEmit`, `npm run lint`, `npm test`. `npm run build` after the last task.
- Commit per task with trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Context: what already works, and what doesn't

I read the API, the schema, the ops layer and the webhook dispatcher. **The good news is that most of this is already built.** `POST /api/v1/issues` and `PATCH /api/v1/issues/{id}` do exactly what a connector needs, comments work, and outbound webhooks are already HMAC-signed. A one-way "file the task here" flow needs **nothing from this repo**.

What blocks the *useful* version:

| # | Gap | Consequence | Task |
|---|---|---|---|
| 1 | No webhook registered for Standup AI | no status sync back to Standup AI | Task 1 (config only) |
| 2 | **No `/users` endpoint** — `assigneeId` is a bare uuid | every filed issue lands **unassigned**; nobody is accountable | **Task 2** |
| 3 | No `externalId` on issues, no idempotency on create | a retried create duplicates the issue; no backlink to the meeting | **Task 3** |
| 4 | `docs/API.md` documents `/initiatives` and `/teams`; **neither route exists** | an integrator writes against a 404 | Task 4 |
| 5 | Webhook has no per-delivery id | the receiver must synthesize a replay nonce, which can false-positive | Task 5 |
| 6 | Webhook delivery never retries | one blip silently loses a status change | Task 6 |
| 7 | `issues.number` allocated via `max(number)+1` | concurrent creates collide on `issues_project_number_idx` | Task 7 |

Tasks 1–3 are the integration. Tasks 4–7 are correctness/robustness that the integration will expose; 6 and 7 are pre-existing and would bite any API consumer.

---

### Task 1: Register the Standup AI webhook + API key (configuration, no code)

**Files:** none — this is done in the running app.

This is the only step needed for the connector's Phase 2, and it takes five minutes.

- [ ] **Step 1: Create an API key.** Settings → API & MCP (`/settings/api`) → create a key named `standup-ai`. Copy the `int_…` value — it is shown once (only `keyHash` + `keyPrefix` are stored, `src/db/schema.ts:486`). Hand it to whoever configures the Standup AI side; it goes into their encrypted per-tenant credential store, not into any env file.

- [ ] **Step 2: Register the webhook.** Settings → API & MCP → Webhooks → add:
  - **URL:** `https://standup.gnanalytica.com/api/integrations/internal/webhook/<tenant>`
    (the trailing `<tenant>` is how Standup AI resolves which of its tenants this hub belongs to — ask them for the exact slug; for Gnanalytica's own workspace it is the tenant id used by their prod deployment)
  - **Events:** `issue.updated` and `issue.commented` **only**.
    > ⚠️ **Do not subscribe to `issue.created` or `*`.** `apiCreateIssue` fires `issue.created` (`src/lib/api/ops.ts:82`), so when Standup AI creates an issue this hub immediately posts it back to them — a feedback loop. They defend against it on their side too, but not subscribing is the clean fix.
  - Copy the `whsec_…` secret (shown once) to the Standup AI credential as `webhook_secret`.

- [ ] **Step 3: Verify delivery.** Change any issue's status in the UI, then check the webhook's `lastStatus` in the dashboard. `200` = wired. `0` = the request never completed (URL wrong, or their route not deployed yet).

---

### Task 2: `GET /api/v1/users` — the assignee directory  ← **blocks Standup AI Phase 3**

**Files:**
- Create: `src/app/api/v1/users/route.ts`
- Modify: `src/lib/api/dto.ts` (add `userDto`)
- Modify: `docs/API.md` (document it)

**Interfaces:**
- Consumes: `getMembersWithRole(workspaceId)` from `@/lib/data` (`src/lib/data.ts:201`) — it already joins `workspaceMembers` → `users` and carries the HR fields.
- Produces: `GET /api/v1/users` → `{ "data": [...], "count": n }`.

**Why:** `issues.assigneeId` is a `uuid` FK to `users`. Standup AI knows an owner as a **name or email** ("Harshith", `harshith@gnanalytica.com`). Without a way to list users with their emails, there is no mapping and every filed issue is unassigned. Email is the natural join key — both systems already use the same `@gnanalytica.com` addresses (`src/db/seed-standup.ts:17-29` seeds exactly those people).

- [ ] **Step 1: Add `userDto`.** In `src/lib/api/dto.ts`, mirroring the other DTOs:

```ts
export function userDto(u: { id: string; name: string; email: string; avatarColor?: string }) {
  return { id: u.id, name: u.name, email: u.email, avatarColor: u.avatarColor ?? null };
}
```

  Deliberately **omits** the HR fields on `workspaceMembers` (`title`, `entity`, `employment`, `startDate`, `managerId`). Per `docs/ORG.md`, HR/PII should not be exposed to integrations — an API key that can list issues must not thereby read the org's employment data. Add those later behind an explicit scope if something genuinely needs them.

- [ ] **Step 2: Create the route.**

```ts
import { userDto } from "@/lib/api/dto";
import { ok, withApiAuth } from "@/lib/api/http";
import { getMembersWithRole } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const members = await getMembersWithRole(auth.workspaceId);
  const rows = email
    ? members.filter((m) => m.email?.toLowerCase() === email)
    : members;
  return ok({ data: rows.map(userDto), count: rows.length });
});
```

  `?email=` gives the connector a direct lookup instead of fetching the whole roster per task. Case-insensitive, because Standup AI's identity layer lower-cases addresses.

- [ ] **Step 3: Verify the shape `getMembersWithRole` returns.** Read its return type in `src/lib/data.ts` — if it nests the user under a key (e.g. `{ user, role }`) rather than flattening, adjust the `.map()` in Step 2. Do not guess.

- [ ] **Step 4: Document it** in `docs/API.md` — add the row to the endpoint table and a short "Assignee mapping" note saying email is the join key.

- [ ] **Step 5: Test.** `src/lib/api/__tests__/users.test.ts` (or wherever the API tests live — check `vitest.config.ts` include globs first): a key scoped to workspace A must not see workspace B's members, and `?email=` must match case-insensitively.

---

### Task 3: `externalId` on issues — idempotent creates + a backlink

**Files:**
- Modify: `src/db/schema.ts` (two columns + one unique index on `issues`)
- Modify: `src/lib/api/ops.ts` (`apiCreateIssue`)
- Modify: `src/lib/api/dto.ts` (`issueDto`)
- Modify: `docs/API.md`

**Why two separate problems share one task:**

1. **Idempotency.** `POST /api/v1/issues` has no dedupe key. Standup AI posts through a resilient HTTP wrapper with a deliberate one-shot-POST posture, but a network timeout after the row is written still leaves *them* thinking it failed. Any retry — theirs or a human's — creates a **second issue for the same task**. In a tracker, duplicates are worse than a missing row: two people work the same thing.
2. **Provenance.** Nothing records that an issue came from a meeting. Someone reading `ENG-42` cannot get back to the standup that produced it.

- [ ] **Step 1: Add the columns.** In `src/db/schema.ts`, on `issues`:

```ts
    // Stable id from the system that created this issue (e.g. a Standup AI
    // proposal id). Makes POST /api/v1/issues idempotent per source: a retried
    // create returns the existing issue instead of duplicating it.
    externalId: text("external_id"),
    // Deep link back to the source record (the meeting/task in Standup AI), so
    // provenance is two-way.
    externalUrl: text("external_url"),
```

  and in the table's index array:

```ts
    uniqueIndex("issues_workspace_external_idx").on(t.workspaceId, t.externalId),
```

  > Postgres treats `NULL`s as distinct in a unique index, so existing and hand-created issues (all `NULL`) are unaffected — no partial index needed.

- [ ] **Step 2: `npm run db:push`.**

- [ ] **Step 3: Make `apiCreateIssue` idempotent.** At the top of the function in `src/lib/api/ops.ts`, before the `max(number)` query:

```ts
  const externalId = typeof input.externalId === "string" ? input.externalId.trim() : null;
  if (externalId) {
    const [existing] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.externalId, externalId)))
      .limit(1);
    // Return the existing id WITHOUT re-dispatching issue.created — a retry is
    // not a new event, and re-firing it would make the caller's echo-suppression
    // window the only thing standing between them and a loop.
    if (existing) return existing.id;
  }
```

  Add `externalId?: string | null` and `externalUrl?: string | null` to the `input` type, and pass both through to `.values({...})`.

- [ ] **Step 4: Expose them in `issueDto`.** Add `externalId: i.externalId ?? null, externalUrl: i.externalUrl ?? null`. The caller needs to read back what it set to confirm a retry resolved to the same row.

- [ ] **Step 5: Verify `IssueWithRelations` picks the new columns up.** It is derived from the table type, so it should — but check `src/lib/types.ts` for an explicit column pick list that would need extending.

- [ ] **Step 6: Document** `externalId` / `externalUrl` in `docs/API.md`'s create-issue section, and state the idempotency contract plainly: *"passing the same `externalId` twice returns the original issue and fires no second `issue.created`."*

- [ ] **Step 7: Test.** Same `externalId` twice ⇒ one row, same id returned, **one** webhook dispatch. Different `externalId` ⇒ two rows. `null` `externalId` twice ⇒ two rows (unchanged behaviour).

---

### Task 4: Fix the documented-but-missing endpoints

**Files:** `docs/API.md`, and possibly `src/app/api/v1/teams/route.ts` + `src/app/api/v1/initiatives/route.ts`.

`docs/API.md` lists `GET /initiatives` and `GET /teams`, but `src/app/api/v1/` contains neither — an integrator following the docs gets a 404 from a documented endpoint.

- [ ] **Step 1: Decide which way to fix it.** Both tables exist in the schema, so either implement the routes (mirror `src/app/api/v1/cycles/route.ts` — it is ~10 lines) or delete the rows from the table in `docs/API.md`. **Prefer implementing:** Standup AI's roadmap already lives here as an initiative (`src/db/seed-standup.ts`), and a connector that can read initiatives can eventually roll meeting outcomes up to them.

- [ ] **Step 2: If implementing,** add `teamDto` and `initiativeDto` to `src/lib/api/dto.ts` (there is currently no `teamDto` at all) and follow the `{ data, count }` convention the docs promise for non-paginated lists.

- [ ] **Step 3: Reconcile the whole table in `docs/API.md` against `ls src/app/api/v1/`.** Fix any other drift found while in there.

---

### Task 5: Add a per-delivery id to webhooks

**Files:** `src/lib/api/webhooks.ts`, `docs/API.md`.

**Why:** the payload carries `timestamp` but no delivery identifier. A receiver that wants replay protection (Standup AI does — it is one of their hard invariants) has to synthesize a nonce by hashing the body. Two genuinely distinct events with identical bodies in the same second then collide, and the second is silently dropped as a "replay".

- [ ] **Step 1: Mint an id per delivery.** In `dispatchWebhook`, before building the body:

```ts
  const deliveryId = crypto.randomUUID();
```

  Include it in the signed body (`{ event, deliveryId, workspaceId, data, timestamp }`) **and** as a header alongside the existing ones:

```ts
            "x-internal-delivery": deliveryId,
```

  In the body so it is covered by the HMAC; in the header so a receiver can dedupe before parsing.

- [ ] **Step 2: One id per delivery, not per target.** Generate it **outside** the `targets.map()` if you want the same logical event to share an id across subscribers, or inside if each delivery should be distinct. **Choose inside** — a receiver dedupes *deliveries*, and a retry (Task 6) must reuse its delivery's id, which is easier to reason about when the id belongs to the delivery.

- [ ] **Step 3: Document it** in `docs/API.md`'s Webhooks section: the header, the body field, and one line telling receivers to dedupe on it.

---

### Task 6: Retry webhook delivery once

**Files:** `src/lib/api/webhooks.ts`.

**Why:** delivery is fire-and-forget — one `fetch`, record `lastStatus`, done. A 5s timeout during the receiver's deploy loses the event permanently, and the hub reports `0` with no further attempt. For a *status sync* that means the two systems silently disagree until something else reconciles them.

- [ ] **Step 1: Retry once on a retryable outcome** — a thrown error (timeout/DNS) or a `5xx`. **Never** retry a `4xx`: that is the receiver rejecting the payload (bad signature, replay), and retrying it is noise.

- [ ] **Step 2: Back off briefly** (~1s) before the retry, and **reuse the same `deliveryId`** from Task 5 so the receiver's dedupe recognises it as the same delivery rather than a new event.

- [ ] **Step 3: Keep the whole thing bounded and non-throwing.** The function's contract (its own docstring) is "best-effort: never throws, bounded by a short timeout" — one retry with a 5s timeout each keeps the worst case at ~11s. Confirm nothing calls `dispatchWebhook` in a path where that is unacceptable; it is currently `await`ed inside server actions and API handlers, so an 11s worst case **would** be felt by a user. **If it would, fire-and-forget the retry** (`void` the promise) rather than making a create request wait on it.

  > This is the actual decision in this task. Read the call sites in `src/lib/actions.ts` and `src/lib/api/ops.ts` before choosing.

---

### Task 7: Make `issues.number` allocation concurrency-safe

**Files:** `src/lib/api/ops.ts` (and `src/lib/actions.ts` if it duplicates the logic).

**Why:** `apiCreateIssue` computes `number` as `max(number) + 1` then inserts. Two concurrent creates in the same project read the same max and the second violates `issues_project_number_idx`, surfacing as a generic `400` from `withApiAuth`'s catch-all. Standup AI approves tasks in bulk and dispatches concurrently, so this is reachable, not theoretical.

- [ ] **Step 1: Reproduce it** with a test that fires two `apiCreateIssue` calls for the same project via `Promise.all` and asserts both succeed.

- [ ] **Step 2: Fix it.** Neon HTTP has no transactions, so prefer a single-statement allocation:

```sql
insert into issues (..., number)
select ..., coalesce(max(number), 0) + 1 from issues where workspace_id = $1 and project_id = $2
```

  expressed via Drizzle's `sql` template. If that proves awkward, the acceptable fallback is a bounded retry loop (3 attempts) that re-reads `max` on a unique-violation — correct, just less elegant. **Do not** widen or drop the unique index; it is the thing keeping identifiers meaningful.

- [ ] **Step 3: Return a clear error** if allocation still fails after retries, rather than the generic 400.

---

## Sequencing

| Order | Task | Why here |
|---|---|---|
| 1 | **Task 1** (config) | 5 minutes, unblocks Standup AI Phase 2 immediately |
| 2 | **Task 2** (`/users`) | their Phase 3 blocker — assignment is the whole point |
| 3 | **Task 3** (`externalId`) | prevents duplicate issues before real volume arrives |
| 4 | Task 7 (`number` race) | correctness; cheap; bulk approval will hit it |
| 5 | Task 5 + 6 (webhook id + retry) | makes the sync trustworthy rather than best-effort |
| 6 | Task 4 (doc drift) | no functional impact, but it misleads the next integrator |

Tasks 1–3 are the integration. 4–7 are things worth fixing regardless of Standup AI.

---

## Deliberately not in this plan

- **Multi-tenancy.** The README lists it as intentionally deferred. One API key per Standup AI tenant is enough while this hub is a single workspace.
- **Encrypting `webhooks.secret` / `workspaces.githubToken`.** Both are stored as plaintext `text` columns. On a single-workspace internal tool behind auth that is a defensible trade, but it is worth a decision record rather than an accident — the counterpart system seals every credential at rest. Out of scope here; raise it separately.
- **Importing hub issues into Standup AI.** Wrong direction: meetings are the source of truth for meeting-derived tasks.
- **Real authentication.** Still the biggest open item in the README, and it is upstream of everything here. This plan does not depend on it — API keys are already independent of the demo session.
