# Linear-parity polish (issues tracker) — Design

Date: 2026-07-27
Status: Approved

## Goal

Close the highest-value gaps between the app's `issues` tracker and Linear's core
experience, chosen from a code audit. Five small, mostly-independent units, all
reusing existing infrastructure — no new dependencies, no vendor changes.

Scope covers the `issues` work-tracker only (not the Zendesk-style `tickets`
support queue, not the `pages` docs system).

## Global constraints

- No new npm dependencies. Charts use the existing homegrown SVG components in
  `src/components/charts.tsx` (`AreaChart`, `ColumnChart`).
- Neon HTTP driver: no interactive transactions — sequential idempotent DB
  statements only. No schema changes are needed for any unit here.
- shadcn components are Base UI (`@base-ui/react`): triggers use `render={<el/>}`,
  menu items use `onClick` (never `asChild`/`onSelect`).
- Follow existing patterns: server actions in `src/lib/actions.ts` with
  `getWorkspace()` scoping + `revalidatePath`; data loaders in `src/lib/data.ts`;
  optimistic `router.refresh()` in client views.
- Gates per unit: `npx tsc --noEmit`, `npm run lint`, `npm test`, and
  `npm run build` at milestones. Commit per unit.

## Unit 1 — "My Issues" view

**Route:** `src/app/(app)/my-issues/page.tsx` (server component).

- Fetch `getIssues(ws.id)`, `getProjects`, `getMembers`, `getLabels`,
  `getSavedViews` (same set as `issues/page.tsx`), plus `getCurrentUser(ws.id)`.
- Filter to issues assigned to the current user: primary `assigneeId === me.id`
  **or** `assignees` set contains `me.id` (multi-assignee aware).
- Render the existing `IssuesView` with `heading="My Issues"`,
  `defaultProjectId={null}`. All existing view toggles (list/board/timeline),
  grouping, sorting, filtering, saved views work unchanged.
- Empty state (no assigned issues): `IssuesView` already renders an empty list;
  no special-casing required beyond passing an empty array.

**Sidebar:** add a "My Issues" rail + expanded entry (icon: `UserCircle` or
`CircleUser` from lucide) directly above "Tasks" in `src/components/sidebar.tsx`.
Active when `pathname === "/my-issues"`.

**Keyboard shortcut:** add `G → M` → `/my-issues` in
`src/components/keyboard-shortcuts.tsx` (mirror the existing `G → I` handler),
and list it in the `?` help.

**Testing:** manual (assigned issues appear, others don't, multi-assignee counts).

## Unit 2 — Attachment UI

**Data:** add `attachments: { with: { uploader: true } }` to `getIssue`'s `with:`
in `src/lib/data.ts`, ordered by `createdAt`. Extend `IssueDetail` (the
`getIssue` return type `IssueDetail` in `src/lib/types.ts`) to include
`attachments`. Pass through the `issues/[id]/page.tsx` route (already spreads the
issue).

**Component:** `src/components/issue-attachments.tsx` — `IssueAttachments({
issueId, attachments })`:
- Upload zone: a click target + drag-drop area. On file(s) selected/dropped,
  build `FormData` (field `file`) and call the existing
  `uploadAttachment(issueId, formData)` per file, with a `toast.loading` →
  success/error like `RichEditor.uploadAndInsert`. `router.refresh()` after.
- List: each attachment row shows a file-type icon (lucide `FileText` / `Image` /
  `File`), name (links to `url`, `target=_blank`, `download`), human size (reuse
  or add a `formatBytes` helper), uploader name + relative time, and a delete `X`
  (calls `deleteAttachment(id, issueId)`; shown on hover). Images render a small
  thumbnail from `url`.
- Empty state: the upload zone with "Drop files or click to upload".

**Placement:** in `issue-detail.tsx`, a new "Attachments" section between the
description editor and the timeline/activity block.

**Constraints:** `uploadAttachment` already enforces `MAX_ATTACHMENT_BYTES` and
blob config; surface its thrown errors via toast. No client-side type
restriction beyond what the action enforces.

**Testing:** manual (upload, list, download link, delete own, size formatting).

## Unit 3 — Labels: restored + managed

**Actions** (`src/lib/actions.ts`), all workspace-scoped + admin-agnostic (any
member; matches existing label-free-for-all):
- `createLabel(name: string, color?: string)` → insert into `labels`
  (`workspaceId`, `name` trimmed, `color` = provided or next from `SELECT_COLORS`
  by count modulo). Returns the created row. Revalidate `/issues`, `/my-issues`,
  `/settings/labels`.
- `updateLabel(id, patch: { name?: string; color?: string })`.
- `deleteLabel(id)` — cascade removes `issueLabels` rows via FK
  (`onDelete: cascade` already on `issueLabels.labelId`).
- Reuse existing `setIssueLabels(issueId, labelIds)` for assignment.

**Assignment UI:**
- Mount the existing `LabelPicker` (in `src/components/pickers.tsx`) in
  `issue-detail.tsx` (uses the `labels` prop already passed in, currently unused)
  and in `new-issue-dialog.tsx`. The picker must support **inline create**: when
  the typed query matches no existing label, show a "+ Create '<query>'" row that
  calls `createLabel` then selects the new label. Verify `LabelPicker`'s current
  API and extend it with an `onCreate?` path + the full workspace `labels` list;
  keep its existing multi-select behavior.
- `new-issue-dialog.tsx`: currently states "labels were removed from issues" —
  remove that note, add the picker, and pass selected label ids to the create
  path (extend `createIssue` to accept optional `labelIds` and call
  `setIssueLabels` after insert, or call `setIssueLabels` from the client after
  the issue is created — prefer extending `createIssue` for atomicity of the
  create flow).

**Display:** render label chips (name + color dot/bg) on:
- `issue-row.tsx` (compact, after the title, truncating to ~3 + "+N").
- board `SortableCard` in `issue-board.tsx`.
- `issue-detail.tsx` property sidebar (full list with the picker as the editor).
The existing label **filter** in `issues-view.tsx` becomes functional once chips
render + labels can be assigned (no change needed there).

**Management page:** `src/app/(app)/settings/labels/page.tsx` + a client
`labels-settings.tsx`:
- List all workspace labels (color swatch + name + issue-usage count if cheap,
  else just name).
- Create (name + color-swatch picker from `SELECT_COLORS`), inline rename,
  recolor, delete (with a confirm). Match the visual style of
  `settings/slack` / `settings/github` pages.
- Add "Labels" to the settings nav/index (`settings/page.tsx` or the settings
  layout, matching how api/github/slack are linked).

**Testing:** manual (create inline, assign, chips render, filter works, rename /
recolor / delete on settings page, delete detaches from issues).

## Unit 4 — Sub-issue nesting (list + board)

Sub-issues (`issues.parentId`) currently appear only inside the parent's detail.
Surface them in the main list and board.

**Helper** (`src/lib/issue-tree.ts`, pure + tested):
- `buildIssueTree(issues)` / grouping utilities: given a flat `IssueWithRelations[]`
  and the already-grouped output, produce, per group, an ordered list of
  top-level rows each with their in-group children nested, plus a set of child
  ids to suppress from the top level. A child nests under its parent **only when
  the parent is present in the same group**; otherwise the child renders as a
  normal top-level row.
- `subIssueProgress(parent, allById)` → `{ done, total }` for the roll-up badge
  (children counted from the flat set by `parentId`, regardless of group).

**List (`issues-view.tsx` + `issue-row.tsx`):**
- Within each group, render top-level rows; a parent with in-group children gets
  a ▾/▸ expand toggle (default expanded) that shows/hides its indented children.
- `IssueRow` gains an optional `depth` (indent) and an optional
  `subProgress={{done,total}}` badge (`⊟ done/total`) shown on any issue that has
  children.
- Expand/collapse state is local component state keyed by parent id.

**Board (`issue-board.tsx`):**
- Within a column, a child card whose parent is in the **same column** renders
  indented directly under the parent card (display-only, not independently
  `Sortable`); the parent card stays the sortable unit.
- A parent card shows the `⊟ done/total` badge. Children whose parent is in a
  different column render as normal top-level (sortable) cards.
- Drag reordering continues to operate on top-level cards only; nested cards move
  with their parent visually (they are re-derived on each render from the flat
  set, so no sortKey bookkeeping for children).

**Testing:** unit tests for the grouping/nesting helper (parent+child same group
→ nested + child suppressed; parent+child different group → both top-level;
progress counts; orphan child with missing parent → top-level). Manual: expand /
collapse, badge counts, board same-column nesting, cross-column fallback.

## Unit 5 — Cycle burndown (estimate-weighted)

**Helper** (`src/lib/burndown.ts`, pure + tested):
- `computeBurndown(issues, doneEvents, start, end, now)` where:
  - `issues`: `{ id, estimate: number | null, createdAt: Date, status }[]` in the
    cycle.
  - `doneEvents`: `{ issueId, at: Date }[]` — the timestamp each issue reached a
    done status, from the `activity` log (`type === "status"`,
    `data.to === "done"`; take the latest such event per issue). If an issue is
    currently done but has no logged event, treat it as done at `start` (best
    effort).
  - weight = `estimate ?? 1` per issue (estimate-weighted, count fallback).
  - Returns `{ points: { date, remaining, ideal }[] , totalPoints }` with one
    point per day from `start` to `min(end, now)` for `remaining`, and a straight
    ideal line from `totalPoints` at `start` to `0` at `end`. `remaining` on day
    D = sum of weights of issues not done as of end-of-day D (an issue counts as
    removed once `at <= endOfDay(D)`). Scope-in is `createdAt` (an issue created
    mid-cycle enters remaining on its creation day).
- Days computed on UTC date boundaries; `now` passed in (never `Date.now()` in
  the pure helper) so tests are deterministic.

**Data:** in `getCycle` (already loads `cycle.issues`), also load the relevant
`activity` rows: status-change activities for the cycle's issue ids
(`type = "status"`). Add to the `CycleDetail`/`getCycle` return shape a
`doneEvents` array (or the raw activities, reduced in the component). Estimates
already exist on issues.

**UI (`cycle-detail.tsx`):**
- Compute burndown via the helper (passing `new Date()` as `now` from the client,
  or compute in the server component and pass down — prefer server component to
  keep `Date.now()` out of the client render path; `cycle-detail` is a client
  component, so compute `doneEvents` + call `computeBurndown` in the route/server
  and pass `points` down).
- Render an `AreaChart` of `remaining` with the `ideal` line overlaid (or a second
  series), labeled "Burndown (points)", beside the existing done/total progress
  bar. Show `totalPoints` and remaining in a caption.
- Degenerate cases (no issues, cycle not started): render a muted "No burndown
  yet" placeholder instead of an empty chart.

**Testing:** unit tests for `computeBurndown`: empty cycle → totalPoints 0,
placeholder; all issues done before start → remaining flat 0; mid-cycle partial
completion → monotonic non-increasing remaining matching expected points;
estimate-weighting (issues with estimates vs count fallback); an issue created
mid-cycle raises remaining on its creation day.

## Out of scope

- Subscribed-issues ("My Issues" third tab) — needs a subscriptions table.
- Per-team/per-project custom workflow states — statuses stay the hardcoded
  `STATUSES` constant.
- Two-way GitHub sync, triage inbox, SLAs, recurring issues, real-time
  multiplayer on issues.

## Testing summary

- Unit (vitest): `computeBurndown` (Unit 5), sub-issue grouping/progress helper
  (Unit 4).
- Manual/browser: each unit's flows as listed above.
- All existing gates green before each commit; production build at the end.
