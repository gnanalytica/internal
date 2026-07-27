# Linear-parity Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close five high-value gaps between the app's `issues` tracker and Linear — a My Issues view, attachment UI, restored/managed labels, sub-issue nesting in list+board, and an estimate-weighted cycle burndown.

**Architecture:** All units reuse existing infrastructure. Server actions in `src/lib/actions.ts`, data loaders in `src/lib/data.ts`, client views with optimistic `router.refresh()`. Two pure, unit-tested helpers (`src/lib/issue-tree.ts`, `src/lib/burndown.ts`). Charts use the homegrown SVG `AreaChart` (extended for an overlay line). No new dependencies, no schema changes.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon HTTP, TipTap v3, Tailwind v4, Base UI (`@base-ui/react`) shadcn components, vitest.

## Global Constraints

- No new npm dependencies. Charts use `src/components/charts.tsx` (`AreaChart`, `ColumnChart`).
- No schema changes in any task.
- Neon HTTP: no `db.transaction`; sequential idempotent statements only.
- Base UI components: triggers use `render={<el/>}`, menu items use `onClick` (never `asChild`/`onSelect`), `DropdownMenuItem` with `closeOnClick={false}` to stay open.
- Server actions: `getWorkspace()` scoping + `revalidatePath`. Follow existing patterns.
- Pure helpers must not call `Date.now()`/`new Date()` with no args — pass `now` in.
- Gates per task: `npx tsc --noEmit`, `npm run lint`, `npm test`. `npm run build` after the last task.
- Commit per task with trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: "My Issues" view

**Files:**
- Create: `src/app/(app)/my-issues/page.tsx`
- Modify: `src/components/sidebar.tsx` (add rail + expanded nav entry above "Tasks")
- Modify: `src/components/keyboard-shortcuts.tsx` (add `G→M`, help entry)

**Interfaces:**
- Consumes: `getIssues(ws.id)`, `getProjects`, `getMembers`, `getLabels`, `getSavedViews`, `getCurrentUser(ws.id)` from `@/lib/data`; `IssuesView` from `@/components/issues-view` (props: `initialIssues`, `projects`, `members`, `labels`, `heading`, `defaultProjectId`, `savedViews`).
- Produces: route `/my-issues`.

- [ ] **Step 1: Create the route.** Mirror `src/app/(app)/issues/page.tsx`, but fetch `getCurrentUser(ws.id)` and filter:

```tsx
import { IssuesView } from "@/components/issues-view";
import {
  getCurrentUser, getIssues, getLabels, getMembers, getProjects, getSavedViews, getWorkspace,
} from "@/lib/data";

export default async function MyIssuesPage() {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [allIssues, projects, members, labels, savedViews] = await Promise.all([
    getIssues(ws.id), getProjects(ws.id), getMembers(ws.id), getLabels(ws.id), getSavedViews(ws.id),
  ]);
  const mine = allIssues.filter(
    (i) => i.assigneeId === me.id || i.assignees.some((a) => a.id === me.id),
  );
  return (
    <IssuesView
      initialIssues={mine}
      projects={projects}
      members={members}
      labels={labels}
      heading="My Issues"
      defaultProjectId={null}
      savedViews={savedViews}
    />
  );
}
```

- [ ] **Step 2: Verify `IssuesView` prop names.** Read `src/components/issues-view.tsx` prop destructuring; match exactly (esp. `initialIssues` vs `issues`, `defaultProjectId`). Adjust Step 1 if names differ.

- [ ] **Step 3: Add sidebar entries.** In `src/components/sidebar.tsx`, add a `RailLink href="/my-issues"` (icon `CircleUser` from lucide) immediately above the `/issues` RailLink (~line 187), and a matching expanded nav row above the `/issues` row (~line 359). Active when `pathname === "/my-issues"`. Import `CircleUser`.

- [ ] **Step 4: Add keyboard shortcut.** In `src/components/keyboard-shortcuts.tsx`, find the `G→I` handler and add a sibling `case "m"` (within the same "g" chord branch) → `router.push("/my-issues")`. Add "G then M — My Issues" to the `?` help list.

- [ ] **Step 5: Gate + commit.**

```bash
npx tsc --noEmit && npm run lint && npm test
git add -A && git commit -m "feat(issues): My Issues view (assigned to me)"
```

Manual check: `/my-issues` lists only issues assigned to the current user (primary or co-assignee); list/board/timeline toggles work.

---

### Task 2: Attachment UI on issue detail

**Files:**
- Modify: `src/lib/data.ts` (`getIssue` `with:` — add `attachments`)
- Modify: `src/lib/types.ts` (`IssueDetail` type — add `attachments`)
- Create: `src/components/issue-attachments.tsx`
- Modify: `src/components/issue-detail.tsx` (render `<IssueAttachments>`)
- Modify: `src/lib/utils.ts` (add `formatBytes`)

**Interfaces:**
- Consumes: `uploadAttachment(issueId, formData)`, `deleteAttachment(id, issueId)` from `@/lib/actions`.
- Produces: `IssueAttachments({ issueId, attachments })`; `formatBytes(n: number): string`.

- [ ] **Step 1: Load attachments in `getIssue`.** In `src/lib/data.ts` `getIssue`'s `with:`, add:

```ts
attachments: { with: { uploader: true }, orderBy: (a, { desc }) => [desc(a.createdAt)] },
```

Ensure the returned object includes `attachments` (spread already carries it; confirm the mapped return doesn't drop it).

- [ ] **Step 2: Extend `IssueDetail` type.** In `src/lib/types.ts`, add to the `IssueDetail` type:

```ts
attachments: (typeof attachments.$inferSelect & { uploader: Member | null })[];
```

Import `attachments` table type if needed (it's inferred from schema; follow how other detail relations are typed there).

- [ ] **Step 3: Add `formatBytes`.** In `src/lib/utils.ts`:

```ts
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 4: Build `IssueAttachments`.** Create `src/components/issue-attachments.tsx` (client). Upload zone: hidden `<input type="file" multiple>` triggered by a click target that is also a drop target (`onDragOver`/`onDrop`). For each file → `FormData` (append `"file"`), `toast.loading` → `await uploadAttachment(issueId, fd)` → success/error toast → `router.refresh()`. List rows: type icon (`Image` if `contentType?.startsWith("image/")`, else `FileText`), a `<a href={url} target="_blank" rel="noreferrer" download>` name, `formatBytes(size)`, uploader name + `formatDistanceToNowStrict(createdAt)`, and a hover `X` → `deleteAttachment(id, issueId)` + refresh. Show image thumbnails (`<img src={url} className="size-8 rounded object-cover">`) for image content types.

- [ ] **Step 5: Mount in detail.** In `src/components/issue-detail.tsx`, render `<IssueAttachments issueId={issue.id} attachments={issue.attachments} />` in a new "Attachments" section between the description editor and the timeline/activity block. Match the section heading style used for "Linked tasks"/"Sub-issues".

- [ ] **Step 6: Gate + commit.**

```bash
npx tsc --noEmit && npm run lint && npm test
git add -A && git commit -m "feat(issues): attachment upload/list/delete on issue detail"
```

Manual: upload a file + an image, see thumbnail, download link opens, delete removes it.

---

### Task 3: Label actions + inline-create picker

**Files:**
- Modify: `src/lib/actions.ts` (add `createLabel`, `updateLabel`, `deleteLabel`)
- Modify: `src/components/pickers.tsx` (`LabelPicker` — inline create + search)

**Interfaces:**
- Consumes: `labels` table, `SELECT_COLORS` from `@/lib/types`, `getWorkspace` from `@/lib/data`.
- Produces:
  - `createLabel(name: string, color?: string): Promise<Label>`
  - `updateLabel(id: string, patch: { name?: string; color?: string }): Promise<void>`
  - `deleteLabel(id: string): Promise<void>`
  - `LabelPicker` extended props: `labels: Label[]`, `value: string[]`, `onChange: (v: string[]) => void`, `onCreate?: (name: string) => Promise<Label>`.

- [ ] **Step 1: Add label actions.** In `src/lib/actions.ts` (import `labels` from schema — already imported; import `SELECT_COLORS` from `@/lib/types`):

```ts
export async function createLabel(name: string, color?: string) {
  const text = name.trim();
  if (!text) throw new Error("Label name required.");
  const ws = await getWorkspace();
  const count = await db.select({ id: labels.id }).from(labels).where(eq(labels.workspaceId, ws.id));
  const picked = color ?? SELECT_COLORS[count.length % SELECT_COLORS.length];
  const [row] = await db
    .insert(labels)
    .values({ workspaceId: ws.id, name: text, color: picked })
    .returning();
  revalidatePath("/issues");
  revalidatePath("/my-issues");
  revalidatePath("/settings/labels");
  return row;
}

export async function updateLabel(id: string, patch: { name?: string; color?: string }) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.color !== undefined) values.color = patch.color;
  if (Object.keys(values).length === 0) return;
  await db.update(labels).set(values).where(and(eq(labels.workspaceId, ws.id), eq(labels.id, id)));
  revalidatePath("/issues");
  revalidatePath("/my-issues");
  revalidatePath("/settings/labels");
}

export async function deleteLabel(id: string) {
  const ws = await getWorkspace();
  await db.delete(labels).where(and(eq(labels.workspaceId, ws.id), eq(labels.id, id)));
  revalidatePath("/issues");
  revalidatePath("/my-issues");
  revalidatePath("/settings/labels");
}
```

(`issueLabels.labelId` FK is `onDelete: cascade`, so deleting a label detaches it from issues automatically.)

- [ ] **Step 2: Extend `LabelPicker` with search + inline create.** In `src/components/pickers.tsx`, add a `query` state + a text input at the top of the `DropdownMenuContent`, filter `labels` by `query` (case-insensitive `name.includes`), and when `query` is non-empty and matches no existing label name exactly, render a "+ Create '<query>'" item that calls `await onCreate(query)`, then selects the returned label (`onChange([...value, created.id])`) and clears the query. Keep the existing multi-select toggle behavior for existing labels. New optional prop `onCreate?: (name: string) => Promise<Label>`.

```tsx
// new prop + state
onCreate?: (name: string) => Promise<Label>;
// ...
const [query, setQuery] = useState("");
const q = query.trim().toLowerCase();
const filtered = labels.filter((l) => l.name.toLowerCase().includes(q));
const exact = labels.some((l) => l.name.toLowerCase() === q);
// inside content, above the list:
<div className="px-1.5 py-1">
  <input
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Search or create…"
    className="w-full rounded border bg-transparent px-1.5 py-1 text-xs outline-none"
  />
</div>
// render `filtered` instead of `labels`; after the list, if onCreate && q && !exact:
<DropdownMenuItem
  closeOnClick={false}
  onClick={async () => {
    const created = await onCreate(query.trim());
    onChange([...value, created.id]);
    setQuery("");
  }}
  className="gap-2 text-xs"
>
  <Plus className="size-3.5" /> Create “{query.trim()}”
</DropdownMenuItem>
```

- [ ] **Step 3: Gate + commit.**

```bash
npx tsc --noEmit && npm run lint && npm test
git add -A && git commit -m "feat(labels): create/update/delete actions + inline-create picker"
```

---

### Task 4: Label chips display + new-issue wiring

**Files:**
- Modify: `src/components/issue-row.tsx` (label chips)
- Modify: `src/components/issue-board.tsx` (`SortableCard` label chips)
- Modify: `src/components/issue-detail.tsx` (mount `LabelPicker` with `onCreate`, show chips)
- Modify: `src/components/new-issue-dialog.tsx` (mount `LabelPicker`, pass `labelIds`)
- Modify: `src/lib/actions.ts` (`createIssue` — accept optional `labelIds`)

**Interfaces:**
- Consumes: `createLabel`, `setIssueLabels`, `createIssue` (extended), `LabelPicker`.
- Produces: `createIssue` accepts `labelIds?: string[]`.

- [ ] **Step 1: Label chip component.** Add a small `LabelChips` (either inline in `issue-row.tsx` or a tiny shared component) that renders up to 3 chips (`color` dot + name) + "+N". Reuse in row + card.

```tsx
export function LabelChips({ labels, max = 3 }: { labels: Label[]; max?: number }) {
  if (!labels.length) return null;
  const shown = labels.slice(0, max);
  return (
    <span className="flex items-center gap-1">
      {shown.map((l) => (
        <span key={l.id} className="flex items-center gap-1 rounded px-1 text-[10px]"
          style={{ backgroundColor: `${l.color}1a`, color: l.color }}>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
          {l.name}
        </span>
      ))}
      {labels.length > max && <span className="text-[10px] text-muted-foreground">+{labels.length - max}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Render chips** in `issue-row.tsx` (after the title, before metadata) and in `issue-board.tsx` `SortableCard` (below the title). Both already receive `issue.labels` (loaded by `getIssues`).

- [ ] **Step 3: Detail label editor.** In `issue-detail.tsx`, in the property sidebar add a "Labels" field: current chips + `LabelPicker` with `value={issue.labels.map(l=>l.id)}`, `labels={labels}` (the already-passed prop), `onChange={(ids) => persist(() => setIssueLabels(issue.id, ids))}`, `onCreate={createLabel}`.

- [ ] **Step 4: New-issue dialog.** In `new-issue-dialog.tsx`, remove the "labels were removed from issues" note, add local `labelIds` state + `LabelPicker` (`labels` from props/loader, `onCreate={createLabel}`), and pass `labelIds` into the create call.

- [ ] **Step 5: Extend `createIssue`.** In `src/lib/actions.ts`, add optional `labelIds?: string[]` to `createIssue`'s input; after the issue insert + returning, if `labelIds?.length`, `await db.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId: created.id, labelId })))`. Verify `new-issue-dialog` passes `labelIds` through.

- [ ] **Step 6: Gate + commit.**

```bash
npx tsc --noEmit && npm run lint && npm test
git add -A && git commit -m "feat(labels): chips on rows/cards/detail + assign on create"
```

Manual: create a label inline in detail, chip shows on the row + board; filter by label now returns matches; new-issue dialog assigns labels.

---

### Task 5: Settings → Labels management page

**Files:**
- Create: `src/app/(app)/settings/labels/page.tsx`
- Create: `src/components/labels-settings.tsx`
- Modify: settings index/nav (`src/app/(app)/settings/page.tsx` or settings layout) — add a "Labels" link

**Interfaces:**
- Consumes: `getLabels`, `getWorkspace`; `createLabel`, `updateLabel`, `deleteLabel`.

- [ ] **Step 1: Route.** `settings/labels/page.tsx` (server): `const ws = await getWorkspace(); const labels = await getLabels(ws.id);` → `<LabelsSettings labels={labels} />`.

- [ ] **Step 2: Client `LabelsSettings`.** List each label: color swatch (click → recolor via a `SELECT_COLORS` swatch popover calling `updateLabel(id,{color})`), inline-editable name (`onBlur`/Enter → `updateLabel(id,{name})`), delete `X` with an inline confirm → `deleteLabel(id)`. A "New label" row at top: name input + color swatch + Add → `createLabel(name, color)`. `router.refresh()` after each mutation. Match `settings/slack` page visual style (read it for the card/heading pattern).

- [ ] **Step 3: Link it.** Add "Labels" to the settings navigation the same way `api`/`github`/`slack` are linked (read `settings/page.tsx` / settings layout to match).

- [ ] **Step 4: Gate + commit.**

```bash
npx tsc --noEmit && npm run lint && npm test
git add -A && git commit -m "feat(labels): settings management page (rename/recolor/delete)"
```

---

### Task 6: Sub-issue nesting helper (pure, TDD)

**Files:**
- Create: `src/lib/issue-tree.ts`
- Create: `src/lib/issue-tree.test.ts`

**Interfaces:**
- Produces:
  - `subIssueProgress(parentId, all): { done, total }` — counts children by `parentId` from the flat set (`done` = status `"done"`).
  - `nestGroup(groupItems): { rows: { issue; children }[]; suppressed: Set<string> }` — given the issues in ONE group (already filtered/sorted), returns top-level rows with in-group children nested, and the set of child ids to suppress from top level. A child nests under its parent only if the parent is in `groupItems`; else it stays top-level.

- [ ] **Step 1: Write failing tests.** `src/lib/issue-tree.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nestGroup, subIssueProgress } from "./issue-tree";

const mk = (id: string, parentId: string | null, status = "todo") =>
  ({ id, parentId, status }) as any;

describe("nestGroup", () => {
  it("nests a child under its parent when both are in the group", () => {
    const items = [mk("p", null), mk("c", "p")];
    const { rows, suppressed } = nestGroup(items);
    expect(rows.map((r) => r.issue.id)).toEqual(["p"]);
    expect(rows[0].children.map((c) => c.id)).toEqual(["c"]);
    expect(suppressed.has("c")).toBe(true);
  });

  it("keeps a child top-level when its parent is not in the group", () => {
    const items = [mk("c", "p")]; // parent p is in another group
    const { rows, suppressed } = nestGroup(items);
    expect(rows.map((r) => r.issue.id)).toEqual(["c"]);
    expect(suppressed.size).toBe(0);
  });

  it("keeps ordering of top-level items", () => {
    const items = [mk("a", null), mk("p", null), mk("c", "p"), mk("b", null)];
    const { rows } = nestGroup(items);
    expect(rows.map((r) => r.issue.id)).toEqual(["a", "p", "b"]);
  });
});

describe("subIssueProgress", () => {
  const all = [mk("p", null), mk("c1", "p", "done"), mk("c2", "p", "todo"), mk("x", null)];
  it("counts done/total children", () => {
    expect(subIssueProgress("p", all)).toEqual({ done: 1, total: 2 });
  });
  it("returns zero total for a leaf", () => {
    expect(subIssueProgress("x", all)).toEqual({ done: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`nestGroup`/`subIssueProgress` not defined). `npm test -- issue-tree`.

- [ ] **Step 3: Implement `src/lib/issue-tree.ts`.**

```ts
type Node = { id: string; parentId: string | null; status: string };

export function subIssueProgress<T extends Node>(parentId: string, all: T[]) {
  const kids = all.filter((i) => i.parentId === parentId);
  return { done: kids.filter((k) => k.status === "done").length, total: kids.length };
}

export function nestGroup<T extends Node>(groupItems: T[]) {
  const inGroup = new Set(groupItems.map((i) => i.id));
  const childrenByParent = new Map<string, T[]>();
  const suppressed = new Set<string>();
  for (const i of groupItems) {
    if (i.parentId && inGroup.has(i.parentId)) {
      const arr = childrenByParent.get(i.parentId) ?? [];
      arr.push(i);
      childrenByParent.set(i.parentId, arr);
      suppressed.add(i.id);
    }
  }
  const rows = groupItems
    .filter((i) => !suppressed.has(i.id))
    .map((issue) => ({ issue, children: childrenByParent.get(issue.id) ?? [] }));
  return { rows, suppressed };
}
```

- [ ] **Step 4: Run — expect PASS.** `npm test -- issue-tree`.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/issue-tree.ts src/lib/issue-tree.test.ts
git commit -m "feat(issues): pure sub-issue nesting + progress helpers"
```

---

### Task 7: Sub-issue nesting in list + board

**Files:**
- Modify: `src/components/issues-view.tsx` (list: use `nestGroup`, expand/collapse)
- Modify: `src/components/issue-row.tsx` (`depth` indent + `subProgress` badge + expand toggle)
- Modify: `src/components/issue-board.tsx` (nest same-column children; parent badge)

**Interfaces:**
- Consumes: `nestGroup`, `subIssueProgress` from `@/lib/issue-tree`.

- [ ] **Step 1: List nesting.** In `issues-view.tsx`, where each group's items render, pass the group items through `nestGroup`. Render top-level `rows`; for a row with `children.length`, render an expand/collapse ▾/▸ toggle (local `Set<string>` of collapsed parent ids) and, when expanded, its children as `IssueRow` with `depth={1}`. Compute the parent badge via `subIssueProgress(issue.id, visible)`.

- [ ] **Step 2: `IssueRow` props.** Add optional `depth?: number` (apply `paddingLeft: depth*20` or a `pl-*` class) and `subProgress?: { done: number; total: number }` (render a `⊟ done/total` badge when `total > 0`). Add an optional `expandToggle?: React.ReactNode` slot at the row start for the ▾/▸ control.

- [ ] **Step 3: Board nesting.** In `issue-board.tsx` `BoardColumn`, run the column's `items` through `nestGroup`; render top-level `SortableCard`s, and under any card with `children`, render its children as non-sortable indented mini-cards. Add the `subProgress` badge to `SortableCard` (compute from the full flat issue set passed into the board). Keep the sortable `SortableContext` `items` = top-level card ids only.

- [ ] **Step 4: Gate + commit.**

```bash
npx tsc --noEmit && npm run lint && npm test
git add -A && git commit -m "feat(issues): sub-issue nesting in list and board views"
```

Manual: parent shows `done/total`, list expands/collapses, board nests same-column children and keeps cross-column children top-level.

---

### Task 8: Cycle burndown helper (pure, TDD)

**Files:**
- Create: `src/lib/burndown.ts`
- Create: `src/lib/burndown.test.ts`

**Interfaces:**
- Produces:
  - `computeBurndown(input): { points: { date: string; remaining: number; ideal: number }[]; totalPoints: number }`
  - `input`: `{ issues: { id: string; estimate: number | null; createdAt: Date }[]; doneEvents: { issueId: string; at: Date }[]; start: Date; end: Date; now: Date }`
  - weight per issue = `estimate ?? 1`. `remaining` on day D = sum of weights of issues whose `createdAt <= endOfDay(D)` and which are not done as of `endOfDay(D)` (done when a `doneEvents.at <= endOfDay(D)`). Days span `start`..`min(end, now)` inclusive (UTC date granularity). `ideal` = straight line from `totalPoints` at day 0 to `0` at the last day (`end`-based).

- [ ] **Step 1: Write failing tests.** `src/lib/burndown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeBurndown } from "./burndown";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("computeBurndown", () => {
  const start = d("2026-07-01"), end = d("2026-07-03");

  it("returns totalPoints 0 and no points for an empty cycle", () => {
    const r = computeBurndown({ issues: [], doneEvents: [], start, end, now: end });
    expect(r.totalPoints).toBe(0);
    expect(r.points).toEqual([]);
  });

  it("weights by estimate, falling back to 1", () => {
    const r = computeBurndown({
      issues: [
        { id: "a", estimate: 3, createdAt: start },
        { id: "b", estimate: null, createdAt: start },
      ],
      doneEvents: [],
      start, end, now: end,
    });
    expect(r.totalPoints).toBe(4);
    expect(r.points[0].remaining).toBe(4); // nothing done
    expect(r.points[r.points.length - 1].remaining).toBe(4);
  });

  it("drops remaining when an issue is completed", () => {
    const r = computeBurndown({
      issues: [
        { id: "a", estimate: 2, createdAt: start },
        { id: "b", estimate: 2, createdAt: start },
      ],
      doneEvents: [{ issueId: "a", at: d("2026-07-02") }],
      start, end, now: end,
    });
    // day0 (07-01): 4 remaining; day1 (07-02): a done -> 2; day2: 2
    expect(r.points.map((p) => p.remaining)).toEqual([4, 2, 2]);
  });

  it("adds scope for an issue created mid-cycle", () => {
    const r = computeBurndown({
      issues: [
        { id: "a", estimate: 1, createdAt: start },
        { id: "b", estimate: 1, createdAt: d("2026-07-02") },
      ],
      doneEvents: [],
      start, end, now: end,
    });
    expect(r.points.map((p) => p.remaining)).toEqual([1, 2, 2]);
  });

  it("ideal line runs from totalPoints to 0 across the span", () => {
    const r = computeBurndown({
      issues: [{ id: "a", estimate: 4, createdAt: start }],
      doneEvents: [], start, end, now: end,
    });
    expect(r.points[0].ideal).toBe(4);
    expect(r.points[r.points.length - 1].ideal).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm test -- burndown`.

- [ ] **Step 3: Implement `src/lib/burndown.ts`.**

```ts
type Issue = { id: string; estimate: number | null; createdAt: Date };
type DoneEvent = { issueId: string; at: Date };

function endOfUtcDay(dayIndex: number, start: Date): Date {
  const dt = new Date(start);
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCDate(dt.getUTCDate() + dayIndex + 1); // end of day D = start of D+1
  return dt;
}

function isoDay(dayIndex: number, start: Date): string {
  const dt = new Date(start);
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCDate(dt.getUTCDate() + dayIndex);
  return dt.toISOString().slice(0, 10);
}

export function computeBurndown(input: {
  issues: Issue[];
  doneEvents: DoneEvent[];
  start: Date;
  end: Date;
  now: Date;
}) {
  const { issues, doneEvents, start, end, now } = input;
  const weight = (i: Issue) => i.estimate ?? 1;
  const totalPoints = issues.reduce((s, i) => s + weight(i), 0);
  if (issues.length === 0) return { points: [], totalPoints: 0 };

  const doneAt = new Map<string, number>();
  for (const e of doneEvents) {
    const t = e.at.getTime();
    if (!doneAt.has(e.issueId) || t > doneAt.get(e.issueId)!) doneAt.set(e.issueId, t);
  }

  const lastTime = Math.min(end.getTime(), now.getTime());
  const s0 = new Date(start); s0.setUTCHours(0, 0, 0, 0);
  const dayMs = 86_400_000;
  const spanDays = Math.max(0, Math.floor((lastTime - s0.getTime()) / dayMs));
  const totalSpan = Math.max(1, Math.floor((end.getTime() - s0.getTime()) / dayMs));

  const points = [];
  for (let dphi = 0; dphi <= spanDays; dphi++) {
    const eod = endOfUtcDay(dphi, start).getTime();
    let remaining = 0;
    for (const i of issues) {
      if (i.createdAt.getTime() > eod) continue; // not yet in scope
      const done = doneAt.get(i.id);
      if (done !== undefined && done <= eod) continue; // completed
      remaining += weight(i);
    }
    const ideal = Math.max(0, totalPoints * (1 - dphi / totalSpan));
    points.push({ date: isoDay(dphi, start), remaining, ideal: Math.round(ideal * 100) / 100 });
  }
  return { points, totalPoints };
}
```

- [ ] **Step 4: Run — expect PASS.** `npm test -- burndown`. (Adjust off-by-one against the tests if the day boundary math differs; the tests are the contract.)

- [ ] **Step 5: Commit.**

```bash
git add src/lib/burndown.ts src/lib/burndown.test.ts
git commit -m "feat(cycles): pure estimate-weighted burndown helper"
```

---

### Task 9: Burndown chart + wiring

**Files:**
- Modify: `src/components/charts.tsx` (`AreaChart` — optional `overlay` dashed line)
- Modify: `src/lib/data.ts` (`getCycle` — return `doneEvents` from activity)
- Modify: `src/app/(app)/cycles/[id]/page.tsx` (compute burndown server-side, pass `points`+`totalPoints`)
- Modify: `src/components/cycle-detail.tsx` (render burndown)

**Interfaces:**
- Consumes: `computeBurndown` from `@/lib/burndown`; `AreaChart` from `@/components/charts`.
- Produces: `AreaChart` optional `overlay?: { label: string; value: number }[]`.

- [ ] **Step 1: `AreaChart` overlay.** In `charts.tsx`, add an optional `overlay?: { label: string; value: number }[]` prop; when present, draw a second polyline using the same `x`/`y` scale (share `max` across both series) with `stroke-dasharray="3 3"` and a muted color. Keep the primary series rendering unchanged.

- [ ] **Step 2: `getCycle` done-events.** In `src/lib/data.ts` `getCycle`, after loading `cycle.issues`, query `activity` rows for those issue ids where `type = "status"`, and reduce to `doneEvents: { issueId, at }[]` keeping rows whose `data.to === "done"`. Add `doneEvents` to the returned object (extend the `Cycle & { issues }` return type in `types.ts` accordingly, or return it alongside).

- [ ] **Step 3: Route computes burndown.** In `cycles/[id]/page.tsx`, after `getCycle`, call `computeBurndown({ issues: cycle.issues.map(i => ({ id: i.id, estimate: i.estimate, createdAt: i.createdAt })), doneEvents: cycle.doneEvents, start: cycle.startDate, end: cycle.endDate, now: new Date() })` and pass `points` + `totalPoints` to `CycleDetail`. (Server component — `new Date()` is fine here, keeping it out of the client.)

- [ ] **Step 4: Render in `cycle-detail.tsx`.** Add `points`/`totalPoints` props. If `points.length` and `totalPoints > 0`, render a card titled "Burndown (points)" with `<AreaChart data={points.map(p => ({label: p.date.slice(5), value: p.remaining}))} overlay={points.map(p => ({label: p.date.slice(5), value: p.ideal}))} color="#6366f1" />` beside the existing done/total bar. Else render a muted "No burndown yet" placeholder.

- [ ] **Step 5: Final gates + commit.**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
git add -A && git commit -m "feat(cycles): estimate-weighted burndown chart on cycle detail"
```

Manual: a cycle with completed + estimated issues shows a descending remaining line with a dashed ideal overlay; empty cycle shows the placeholder.

---

## Self-review notes

- **Spec coverage:** Unit 1→Task 1; Unit 2→Task 2; Unit 3→Tasks 3–5; Unit 4→Tasks 6–7; Unit 5→Tasks 8–9. All covered.
- **Type consistency:** `nestGroup`/`subIssueProgress` names consistent across Tasks 6–7; `computeBurndown` shape (`{points:{date,remaining,ideal}[], totalPoints}`) consistent across Tasks 8–9; `createLabel`/`updateLabel`/`deleteLabel` consistent across Tasks 3–5; `LabelPicker` `onCreate` consistent Tasks 3–4.
- **Verification hooks:** Steps that say "verify X" (IssuesView prop names, settings nav pattern) are because those exact strings live in files the implementer will open; they are lookups, not placeholders.
