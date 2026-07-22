# Markdown Editor Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the TipTap editor to Notion-level editing: Tab indentation, multi-level list styles, six new slash commands (toggle, columns, TOC, date, emoji, duplicate), a right-click context menu, and richer selection styling (highlight palette, alignment, turn-into).

**Architecture:** All features are additive TipTap v3 extensions + UI components under `src/components/editor/`. Official MIT extensions (`details`, `emoji` data, `text-align`) where they exist; small custom extensions (indent, columns, toc, emoji suggestion) where they don't. Content keeps serializing to the existing TipTap JSON `content` column — no DB changes.

**Tech Stack:** Next.js 16 App Router, TipTap v3.26+, shadcn/ui (ContextMenu, DropdownMenu, Popover), Tailwind v4 CSS in `globals.css`, Vitest for `src/lib/markdown.ts` tests.

**Spec:** `docs/superpowers/specs/2026-07-22-markdown-editor-refinements-design.md`

## Global Constraints

- TipTap packages must stay on the v3 line (`^3.26.1` installed; new packages install as `@tiptap/extension-*@^3`).
- Dark mode selector is the `.dark` class (`@custom-variant dark (&:is(.dark *))` in `globals.css`).
- Indent range is 0–6. Indent CSS step is `1.5rem` per level.
- Columns: 2 or 3 only, top-level only; a `column` may not contain another `columnBlock`, a table, or a details block.
- Markdown export: toggle → bold summary line + content; columns → flattened sequentially; TOC → omitted; `indent`/`textAlign` attrs → ignored.
- All editor UI files are client components (`"use client"`).
- Tests: `npm test` (vitest). Lint: `npm run lint`. Typecheck: `npx tsc --noEmit`.
- Commit after every task with a `feat(editor):`/`fix(editor):`/`docs:` conventional message ending in the Claude co-author trailer.
- Node names used throughout (must match exactly): `details`, `detailsSummary`, `detailsContent`, `columnBlock`, `column`, `toc`, `paragraph`, `heading`, `callout`.

---

### Task 1: Markdown conversions for new nodes (TDD)

`docToMarkdown` is pure, so the new node conversions can be built test-first before the editor nodes exist.

**Files:**
- Modify: `src/lib/markdown.ts`
- Test: `src/lib/markdown.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `docToMarkdown` handles `details`, `columnBlock`, `toc` node types. Later tasks (4, 5, 6) create editor nodes with exactly these type names and shapes:
  - `{ type: "details", content: [{ type: "detailsSummary", content: [inline...] }, { type: "detailsContent", content: [blocks...] }] }`
  - `{ type: "columnBlock", content: [{ type: "column", content: [blocks...] }, ...] }`
  - `{ type: "toc" }`

- [x] **Step 1: Write the failing tests**

Append to the `describe("docToMarkdown", ...)` block in `src/lib/markdown.test.ts`:

```ts
  it("renders a details toggle as a bold summary plus content", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "details",
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "Rollout plan" }] },
            {
              type: "detailsContent",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Phase one." }] },
                { type: "paragraph", content: [{ type: "text", text: "Phase two." }] },
              ],
            },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("**Rollout plan**\n\nPhase one.\n\nPhase two.");
  });

  it("flattens columns sequentially in document order", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "columnBlock",
          content: [
            {
              type: "column",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Left" }] }],
            },
            {
              type: "column",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Right" }] }],
            },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Left\n\nRight");
  });

  it("omits table-of-contents blocks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "toc" },
        { type: "paragraph", content: [{ type: "text", text: "Body" }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Body");
  });

  it("ignores indent and textAlign attributes on paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { indent: 3, textAlign: "center" },
          content: [{ type: "text", text: "Indented" }],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Indented");
  });
```

- [x] **Step 2: Run tests to verify the new ones fail**

Run: `npm test`
Expected: the details test FAILS (empty/incorrect output), the columns test FAILS, the toc test FAILS (toc renders as ""; joined output becomes "Body" — if this one already passes because unknown nodes render empty and get filtered, that is fine, keep it as a regression guard). The indent/textAlign test should already PASS (attrs are ignored by design) — also a regression guard.

- [x] **Step 3: Implement the conversions**

In `src/lib/markdown.ts`, add three cases to the `switch` in `block()` before `default:`:

```ts
    case "details": {
      const summary = (node.content ?? []).find((c) => c.type === "detailsSummary");
      const body = (node.content ?? []).find((c) => c.type === "detailsContent");
      const parts = [`**${inline(summary?.content)}**`];
      for (const c of body?.content ?? []) parts.push(block(c, depth));
      return parts.filter((s) => s.length > 0).join("\n\n");
    }
    case "columnBlock":
      return (node.content ?? [])
        .map((col) =>
          (col.content ?? [])
            .map((c) => block(c, depth))
            .filter((s) => s.length > 0)
            .join("\n\n"),
        )
        .filter((s) => s.length > 0)
        .join("\n\n");
    case "toc":
      return "";
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/markdown.ts src/lib/markdown.test.ts
git commit -m "feat(editor): markdown conversions for details, columns, and toc nodes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Indent extension (Tab / Shift+Tab / Backspace)

**Files:**
- Create: `src/components/editor/indent.ts`
- Modify: `src/components/editor/rich-editor.tsx` (extensions array)
- Modify: `src/app/globals.css` (indent CSS)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Indent` extension export; commands `editor.commands.indent()` and `editor.commands.outdent()` (used by nothing else yet, but part of the editor command surface). `indent` attribute (number 0–6) on `paragraph` and `heading`, rendered as `data-indent`.

There is no headless test rig for TipTap in this repo (vitest has no DOM environment configured); this task is verified by typecheck + manual pass in Task 10. Keep the extension logic pure and small.

- [x] **Step 1: Create `src/components/editor/indent.ts`**

```ts
"use client";

import { Extension, type CommandProps } from "@tiptap/core";

// Block types that carry an indent level. Lists indent structurally instead.
const TYPES = ["paragraph", "heading"];
const MAX_INDENT = 6;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Indent every selected paragraph/heading one level (max 6). */
      indent: () => ReturnType;
      /** Outdent every selected paragraph/heading one level (min 0). */
      outdent: () => ReturnType;
    };
  }
}

const applyIndent =
  (delta: 1 | -1) =>
  () =>
  ({ state, tr, dispatch }: CommandProps) => {
    const { from, to } = state.selection;
    let changed = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!TYPES.includes(node.type.name)) return;
      const cur = Number(node.attrs.indent ?? 0);
      const next = Math.max(0, Math.min(MAX_INDENT, cur + delta));
      if (next !== cur) {
        tr.setNodeAttribute(pos, "indent", next);
        changed = true;
      }
    });
    if (changed && dispatch) dispatch(tr);
    return changed;
  };

/**
 * Notion-style block indentation.
 * Tab precedence: list item → native sink/lift; code block → two spaces;
 * otherwise indent/outdent every paragraph/heading the selection touches.
 * Tab always returns true so keyboard focus never leaves the editor.
 */
export const Indent = Extension.create({
  name: "indent",
  priority: 1000,

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Number(el.getAttribute("data-indent")) || 0,
            renderHTML: (attrs) =>
              attrs.indent ? { "data-indent": attrs.indent } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent: applyIndent(1),
      outdent: applyIndent(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const e = this.editor;
        if (e.isActive("taskItem")) {
          e.chain().focus().sinkListItem("taskItem").run();
          return true;
        }
        if (e.isActive("listItem")) {
          e.chain().focus().sinkListItem("listItem").run();
          return true;
        }
        if (e.isActive("codeBlock")) return e.commands.insertContent("  ");
        e.commands.indent();
        return true;
      },
      "Shift-Tab": () => {
        const e = this.editor;
        if (e.isActive("taskItem")) {
          e.chain().focus().liftListItem("taskItem").run();
          return true;
        }
        if (e.isActive("listItem")) {
          e.chain().focus().liftListItem("listItem").run();
          return true;
        }
        e.commands.outdent();
        return true;
      },
      Backspace: () => {
        const e = this.editor;
        const { empty, $from } = e.state.selection;
        if (!empty || $from.parentOffset !== 0) return false;
        if (!TYPES.includes($from.parent.type.name)) return false;
        if (Number($from.parent.attrs.indent ?? 0) <= 0) return false;
        return e.commands.outdent();
      },
    };
  },
});
```

Notes for the implementer:
- `priority: 1000` makes these Tab bindings win over StarterKit's list-item bindings; the handler re-implements the list behavior explicitly so Tab is ALWAYS swallowed (a failed `sinkListItem` on a first item must not move browser focus).
- The `isActive("codeBlock")` check is false for a selection spanning a code block plus other blocks, which gives the spec's "entire selection inside one code block" guard for free.

- [x] **Step 2: Register the extension in `rich-editor.tsx`**

Add the import and put `Indent` in the extensions array (after `SlashCommand`):

```ts
import { Indent } from "./indent";
```

```ts
      SlashCommand,
      Indent,
      Callout,
```

- [x] **Step 3: Add indent CSS to `globals.css`**

Add after the `.tiptap li { ... }` rule:

```css
.tiptap [data-indent="1"] { padding-left: 1.5rem; }
.tiptap [data-indent="2"] { padding-left: 3rem; }
.tiptap [data-indent="3"] { padding-left: 4.5rem; }
.tiptap [data-indent="4"] { padding-left: 6rem; }
.tiptap [data-indent="5"] { padding-left: 7.5rem; }
.tiptap [data-indent="6"] { padding-left: 9rem; }
```

- [x] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors (pre-existing warnings unrelated to editor files are acceptable).

- [x] **Step 5: Commit**

```bash
git add src/components/editor/indent.ts src/components/editor/rich-editor.tsx src/app/globals.css
git commit -m "feat(editor): Tab/Shift+Tab block indentation with list and code-block precedence

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Multi-level list marker styles (CSS only)

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:** none — pure CSS.

- [x] **Step 1: Add nested marker rules**

In `globals.css`, directly after the existing `.tiptap ul { list-style: disc; }` and `.tiptap ol { list-style: decimal; }` rules, add:

```css
.tiptap ul ul { list-style: circle; }
.tiptap ul ul ul { list-style: square; }
.tiptap ul ul ul ul { list-style: disc; }
.tiptap ol ol { list-style: lower-alpha; }
.tiptap ol ol ol { list-style: lower-roman; }
.tiptap ol ol ol ol { list-style: decimal; }
.tiptap li > ul,
.tiptap li > ol {
  margin: 0.1rem 0;
}
```

(The `ul[data-type="taskList"]` rules already neutralize `list-style` for task lists, and nested task lists inherit that — no change needed.)

- [x] **Step 2: Manual spot check**

Run: `npm run dev`, open any page with the editor, type a bullet list, Tab twice on sub-items.
Expected: markers cycle • → ○ → ▪; ordered lists cycle 1. → a. → i.; nested task lists stay checkbox-styled.

- [x] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(editor): nested list marker styles (disc/circle/square, 1/a/i)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Toggle (Details) block + slash command

**Files:**
- Modify: `package.json` (install `@tiptap/extension-details`)
- Modify: `src/components/editor/rich-editor.tsx`
- Modify: `src/components/editor/slash-command.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: markdown `details` conversion from Task 1 (node names must match: `details`, `detailsSummary`, `detailsContent` — these are the extension's built-in names, do not rename).
- Produces: Details nodes available in the schema; slash command "Toggle". Task 8's turn-into module inserts the same `details` JSON shape.

- [x] **Step 1: Install the extension**

Run: `npm install @tiptap/extension-details@^3`
Expected: adds one line to package.json dependencies; version ^3.x.

- [x] **Step 2: Verify the rendered markup before styling**

Run: `grep -o "renderHTML[^}]*" node_modules/@tiptap/extension-details/dist/index.js | head -5` and skim the output (or open the file).
Expected: `Details` renders a `div` with `data-type="details"` containing a toggle `<button>` (added by its node view), `DetailsSummary` renders a `summary`, `DetailsContent` a `div` with `data-type="detailsContent"`. If the markup differs, adjust the CSS selectors in Step 5 to match what you actually find — the selectors below assume this markup.

- [x] **Step 3: Register in `rich-editor.tsx`**

```ts
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
```

Add to the extensions array (after `Indent`):

```ts
      Details.configure({ persist: true, HTMLAttributes: { class: "details" } }),
      DetailsSummary,
      DetailsContent,
```

Also extend the Placeholder config so an empty summary gets a hint. Replace the existing `placeholder` callback:

```ts
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading";
          if (node.type.name === "detailsSummary") return "Toggle title";
          return placeholder;
        },
        includeChildren: true,
      }),
```

- [x] **Step 4: Add the slash command**

In `slash-command.ts`, add `ChevronRight` to the lucide imports and add to `COMMANDS` (in the `Blocks` group, after "Divider"):

```ts
  {
    title: "Toggle",
    description: "Collapsible block with a summary",
    icon: createElement(ChevronRight, { className: "size-4" }),
    keywords: "toggle collapse details expand accordion",
    group: "Blocks",
    run: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent({
          type: "details",
          content: [
            { type: "detailsSummary" },
            { type: "detailsContent", content: [{ type: "paragraph" }] },
          ],
        })
        .run(),
  },
```

- [x] **Step 5: Style the toggle in `globals.css`**

Add after the callout rules:

```css
.tiptap .details {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  margin: 0.35rem 0;
  border-radius: 0.5rem;
  padding: 0.15rem 0.25rem;
}
.tiptap .details > button {
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  margin-top: 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  color: var(--muted-foreground);
  cursor: pointer;
}
.tiptap .details > button:hover {
  background: var(--accent);
}
.tiptap .details > button::before {
  content: "\25B6";
  transition: transform 0.15s ease;
}
.tiptap .details.is-open > button::before,
.tiptap .details[open] > button::before {
  transform: rotate(90deg);
}
.tiptap .details > div {
  flex: 1 1 auto;
  min-width: 0;
}
.tiptap .details summary {
  list-style: none;
  font-weight: 600;
}
.tiptap .details summary::-webkit-details-marker {
  display: none;
}
.tiptap .details [data-type="detailsContent"] > :first-child {
  margin-top: 0.15rem;
}
```

- [x] **Step 6: Verify**

Run: `npx tsc --noEmit && npm test` (markdown tests from Task 1 must still pass).
Then `npm run dev`: type `/toggle`, insert one, type a summary, press Enter into the body, collapse/expand with the chevron. Reload the page — the open/closed state persists (persist: true) and content survives. Also open the page's read-only view and confirm the chevron still toggles.
Expected: all of the above work.

- [x] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/editor/rich-editor.tsx src/components/editor/slash-command.ts src/app/globals.css
git commit -m "feat(editor): collapsible toggle block via tiptap Details with slash command

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Columns block + slash commands

**Files:**
- Create: `src/components/editor/columns.ts`
- Modify: `src/components/editor/rich-editor.tsx`
- Modify: `src/components/editor/slash-command.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: markdown `columnBlock`/`column` conversion from Task 1.
- Produces: `ColumnBlock` and `Column` node exports (names `columnBlock`, `column`).

- [x] **Step 1: Create `src/components/editor/columns.ts`**

```ts
import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Side-by-side column layout. `columnBlock` holds 2–3 `column` children.
 * A column's content expression is an explicit whitelist: no nested columns,
 * tables, or toggles (per spec), everything else ordinary.
 */
export const ColumnBlock = Node.create({
  name: "columnBlock",
  group: "block",
  content: "column{2,3}",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "column-block", class: "column-block" }),
      0,
    ];
  },
});

export const Column = Node.create({
  name: "column",
  content:
    "(paragraph | heading | bulletList | orderedList | taskList | blockquote | codeBlock | image | callout | horizontalRule)+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "column", class: "column" }),
      0,
    ];
  },
});
```

- [x] **Step 2: Register both nodes in `rich-editor.tsx`**

```ts
import { Column, ColumnBlock } from "./columns";
```

Extensions array (after the Details trio):

```ts
      ColumnBlock,
      Column,
```

- [x] **Step 3: Add slash commands**

In `slash-command.ts`, import `Columns2` and `Columns3` from lucide, add a helper next to the `callout` helper:

```ts
const columns = (count: 2 | 3) => (e: Editor, r: Range) =>
  e
    .chain()
    .focus()
    .deleteRange(r)
    .insertContent({
      type: "columnBlock",
      content: Array.from({ length: count }, () => ({
        type: "column",
        content: [{ type: "paragraph" }],
      })),
    })
    .run();
```

And two commands in the `Blocks` group:

```ts
  {
    title: "Columns (2)",
    description: "Two columns side by side",
    icon: createElement(Columns2, { className: "size-4" }),
    keywords: "columns two layout side",
    group: "Blocks",
    run: columns(2),
  },
  {
    title: "Columns (3)",
    description: "Three columns side by side",
    icon: createElement(Columns3, { className: "size-4" }),
    keywords: "columns three layout side",
    group: "Blocks",
    run: columns(3),
  },
```

(`insertContent` places the block at the nearest valid position; since `column` content forbids `columnBlock`, ProseMirror hoists the insertion out of a column automatically — verify in Step 5.)

- [x] **Step 4: Style columns in `globals.css`**

```css
.tiptap .column-block {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 1rem;
  margin: 0.5rem 0;
}
.tiptap .column {
  min-width: 0;
  border-radius: 0.5rem;
  border: 1px dashed transparent;
  padding: 0.25rem 0.5rem;
}
.tiptap.ProseMirror-focused .column {
  border-color: color-mix(in oklch, var(--border) 70%, transparent);
}
@media (max-width: 640px) {
  .tiptap .column-block {
    grid-auto-flow: row;
  }
}
```

- [x] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test`.
Then `npm run dev`: insert `/columns` (2 and 3), type in each column, put a bullet list and heading inside a column; try `/columns` while the cursor is inside a column and confirm the new block lands outside (not nested); confirm dashed borders show only while editing and the read-only view renders columns cleanly.
Expected: all of the above.

- [x] **Step 6: Commit**

```bash
git add src/components/editor/columns.ts src/components/editor/rich-editor.tsx src/components/editor/slash-command.ts src/app/globals.css
git commit -m "feat(editor): 2-3 column layout blocks with slash commands

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Table of contents block

Custom atom node + React node view that reads headings straight from the doc and links to existing `data-block-id` anchors. (No new dependency — this replaces the spec's `@tiptap/extension-table-of-contents` suggestion with something smaller that reuses the BlockId infrastructure; the UX is identical.)

**Files:**
- Create: `src/components/editor/toc.tsx`
- Modify: `src/components/editor/rich-editor.tsx`
- Modify: `src/components/editor/slash-command.ts`

**Interfaces:**
- Consumes: `blockId` attribute on top-level headings (from the existing BlockId extension); markdown `toc` omission from Task 1.
- Produces: `Toc` node export (name `toc`).

- [x] **Step 1: Create `src/components/editor/toc.tsx`**

```tsx
"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { ListTree } from "lucide-react";
import { useEffect, useState } from "react";

type HeadingRef = { level: number; text: string; blockId: string | null };

function readHeadings(editor: NodeViewProps["editor"]): HeadingRef[] {
  const out: HeadingRef[] = [];
  editor.state.doc.forEach((node) => {
    if (node.type.name !== "heading") return;
    out.push({
      level: Number(node.attrs.level ?? 1),
      text: node.textContent,
      blockId: (node.attrs.blockId as string | null) ?? null,
    });
  });
  return out;
}

function TocView({ editor }: NodeViewProps) {
  const [headings, setHeadings] = useState<HeadingRef[]>(() => readHeadings(editor));

  useEffect(() => {
    const update = () => setHeadings(readHeadings(editor));
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const jump = (blockId: string | null) => {
    if (!blockId) return;
    const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("block-flash");
    setTimeout(() => el.classList.remove("block-flash"), 1600);
  };

  return (
    <NodeViewWrapper
      className="my-2 rounded-lg border bg-muted/30 px-3 py-2"
      data-type="toc"
      contentEditable={false}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ListTree className="size-3" /> Contents
      </div>
      {headings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add headings to build a table of contents.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {headings.map((h, i) => (
            <li key={i} style={{ paddingLeft: `${(h.level - 1) * 0.85}rem` }}>
              <button
                type="button"
                onClick={() => jump(h.blockId)}
                className="text-left text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {h.text || "Untitled"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </NodeViewWrapper>
  );
}

/** Atom block that renders a live table of contents from the page's headings. */
export const Toc = Node.create({
  name: "toc",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "toc" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocView);
  },
});
```

- [x] **Step 2: Register in `rich-editor.tsx`**

```ts
import { Toc } from "./toc";
```

Extensions array (after `Column`):

```ts
      Toc,
```

- [x] **Step 3: Add slash command**

Import `ListTree` in `slash-command.ts` and add to the `Blocks` group:

```ts
  {
    title: "Table of contents",
    description: "Live index of this page's headings",
    icon: createElement(ListTree, { className: "size-4" }),
    keywords: "toc table of contents outline index headings",
    group: "Blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: "toc" }).run(),
  },
```

- [x] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test`.
Then `npm run dev`: insert `/table of contents` at the top of a page with several headings. Expected: it lists headings with level-based indentation, updates as you add/rename headings, empty-state text shows on a heading-less page, and clicking an entry scrolls to the heading with the flash effect. Works in read-only view too.

- [x] **Step 5: Commit**

```bash
git add src/components/editor/toc.tsx src/components/editor/rich-editor.tsx src/components/editor/slash-command.ts
git commit -m "feat(editor): live table-of-contents block

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Emoji suggestion, Date, and Duplicate-block slash commands

Emoji uses the `gitHubEmojis` dataset from `@tiptap/extension-emoji` but inserts plain unicode text via our own `:` suggestion popup — no emoji nodes in the doc, so markdown output needs no changes.

**Files:**
- Modify: `package.json` (install `@tiptap/extension-emoji` for its dataset)
- Create: `src/components/editor/emoji-suggestion.tsx`
- Modify: `src/components/editor/rich-editor.tsx`
- Modify: `src/components/editor/slash-command.ts`

**Interfaces:**
- Consumes: `CommandList`-style popup positioning pattern from `slash-command.ts` (duplicated here deliberately — the render plumbing is suggestion-specific).
- Produces: `EmojiSuggestion` extension export; slash commands "Date", "Emoji", "Duplicate block".

- [x] **Step 1: Install and verify the dataset export**

Run: `npm install @tiptap/extension-emoji@^3 && grep -c "gitHubEmojis" node_modules/@tiptap/extension-emoji/dist/index.js`
Expected: count ≥ 1. If the export is missing, check `node_modules/@tiptap/extension-emoji/dist/` for the data module and adjust the import in Step 2.

- [x] **Step 2: Create `src/components/editor/emoji-suggestion.tsx`**

```tsx
"use client";

import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { gitHubEmojis } from "@tiptap/extension-emoji";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type EmojiEntry = { name: string; emoji: string; shortcodes: string[]; tags: string[] };

// Only entries with a real unicode char (skips custom-image emojis).
const EMOJIS: EmojiEntry[] = (
  gitHubEmojis as { name: string; emoji?: string; shortcodes: string[]; tags: string[] }[]
)
  .filter((e): e is EmojiEntry => Boolean(e.emoji))
  .map((e) => ({ name: e.name, emoji: e.emoji, shortcodes: e.shortcodes, tags: e.tags }));

const EmojiList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  { items: EmojiEntry[]; command: (item: EmojiEntry) => void }
>(function EmojiList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => setSelected(0), [items]);
  useEffect(() => {
    itemRefs.current[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selected]) command(items[selected]);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div className="scrollbar-thin max-h-64 w-56 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
      {items.map((item, i) => (
        <button
          key={item.name}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          onMouseEnter={() => setSelected(i)}
          onClick={() => command(item)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${
            i === selected ? "bg-accent" : ""
          }`}
        >
          <span className="text-base leading-none">{item.emoji}</span>
          <span className="truncate text-xs text-muted-foreground">:{item.shortcodes[0]}:</span>
        </button>
      ))}
    </div>
  );
});

/** `:` suggestion popup that inserts plain unicode emoji text. */
export const EmojiSuggestion = Extension.create({
  name: "emojiSuggestion",

  addProseMirrorPlugins() {
    return [
      Suggestion<EmojiEntry>({
        editor: this.editor,
        pluginKey: new PluginKey("emojiSuggestion"),
        char: ":",
        startOfLine: false,
        command: ({ editor, range, props }) =>
          editor.chain().focus().deleteRange(range).insertContent(`${props.emoji} `).run(),
        items: ({ query }) => {
          const q = query.toLowerCase();
          if (q.length < 2) return [];
          return EMOJIS.filter(
            (e) =>
              e.name.toLowerCase().includes(q) ||
              e.shortcodes.some((s) => s.includes(q)) ||
              e.tags.some((t) => t.includes(q)),
          ).slice(0, 10);
        },
        render: () => {
          let component: ReactRenderer<
            { onKeyDown: (p: { event: KeyboardEvent }) => boolean }
          > | null = null;
          let el: HTMLDivElement | null = null;

          const position = (clientRect?: (() => DOMRect | null) | null) => {
            if (!el || !clientRect) return;
            const rect = clientRect();
            if (!rect) return;
            const margin = 8;
            const maxHeight = 260;
            const top =
              rect.bottom + maxHeight > window.innerHeight
                ? rect.top - maxHeight - margin
                : rect.bottom + margin;
            el.style.left = `${rect.left}px`;
            el.style.top = `${Math.max(margin, top)}px`;
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(EmojiList, {
                editor: props.editor,
                props: {
                  items: props.items,
                  command: (item: EmojiEntry) => props.command(item),
                },
              });
              el = document.createElement("div");
              el.style.position = "fixed";
              el.style.zIndex = "50";
              el.appendChild(component.element);
              document.body.appendChild(el);
              position(props.clientRect);
            },
            onUpdate: (props) => {
              component?.updateProps({
                items: props.items,
                command: (item: EmojiEntry) => props.command(item),
              });
              position(props.clientRect);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                el?.remove();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              el?.remove();
              el = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
```

- [x] **Step 3: Register in `rich-editor.tsx`**

```ts
import { EmojiSuggestion } from "./emoji-suggestion";
```

Extensions array (after `Toc`):

```ts
      EmojiSuggestion,
```

- [x] **Step 4: Add Date, Emoji, and Duplicate slash commands**

In `slash-command.ts`, import `CalendarDays`, `CopyPlus`, `Smile` from lucide and add to `COMMANDS` in the `Basic` group:

```ts
  {
    title: "Date",
    description: "Insert today's date",
    icon: createElement(CalendarDays, { className: "size-4" }),
    keywords: "date today calendar timestamp",
    group: "Basic",
    run: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent(
          `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} `,
        )
        .run(),
  },
  {
    title: "Emoji",
    description: "Search and insert an emoji",
    icon: createElement(Smile, { className: "size-4" }),
    keywords: "emoji smiley reaction icon",
    group: "Basic",
    run: (e, r) => e.chain().focus().deleteRange(r).insertContent(":").run(),
  },
  {
    title: "Duplicate block",
    description: "Copy the current block below",
    icon: createElement(CopyPlus, { className: "size-4" }),
    keywords: "duplicate copy clone repeat block",
    group: "Basic",
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      const { $from } = e.state.selection;
      if ($from.depth < 1) return;
      const node = $from.node(1);
      const json = node.toJSON() as { attrs?: Record<string, unknown> };
      json.attrs = { ...json.attrs, blockId: null };
      e.chain().insertContentAt($from.after(1), json).run();
    },
  },
```

(`blockId: null` on the copy lets the BlockId plugin assign a fresh id.)

- [x] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test`.
Then `npm run dev`: type `:fir` → popup shows 🔥 etc., Enter inserts the unicode char; `/date` inserts e.g. "Jul 22, 2026"; `/emoji` inserts `:` and typing 2+ chars opens the popup; `/duplicate` on a list block copies the whole list below with content intact. Confirm typing "3:30pm" does NOT open the emoji popup (query stops at the space; "30" alone matches nothing meaningful — if it does open annoyingly, raise the min query length to 3).
Expected: all of the above.

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/editor/emoji-suggestion.tsx src/components/editor/rich-editor.tsx src/components/editor/slash-command.ts
git commit -m "feat(editor): emoji suggestion popup plus date and duplicate slash commands

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Turn-into module, highlight palette, and alignment in the bubble menu

**Files:**
- Modify: `package.json` (install `@tiptap/extension-text-align`)
- Create: `src/components/editor/turn-into.tsx`
- Modify: `src/components/editor/rich-editor.tsx`
- Modify: `src/components/editor/editor-bubble-menu.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `details` node shape (Task 4), `callout` node (existing).
- Produces (Task 9 depends on these exact exports from `turn-into.tsx`):
  - `type TurnIntoOption = { key: string; label: string; icon: React.ReactNode; isActive: (editor: Editor) => boolean; run: (editor: Editor) => void }`
  - `const TURN_INTO_OPTIONS: TurnIntoOption[]`
  - `function currentBlockLabel(editor: Editor): string`
  - `const HIGHLIGHT_COLORS: { name: string; value: string }[]` (CSS var references)

- [x] **Step 1: Install TextAlign**

Run: `npm install @tiptap/extension-text-align@^3`

- [x] **Step 2: Register TextAlign in `rich-editor.tsx`**

```ts
import TextAlign from "@tiptap/extension-text-align";
```

Extensions array (after `Highlight.configure(...)`):

```ts
      TextAlign.configure({ types: ["heading", "paragraph"] }),
```

- [x] **Step 3: Create `src/components/editor/turn-into.tsx`**

```tsx
"use client";

import type { Editor } from "@tiptap/core";
import {
  CheckSquare,
  ChevronRight,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
} from "lucide-react";

export type TurnIntoOption = {
  key: string;
  label: string;
  icon: React.ReactNode;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

export const HIGHLIGHT_COLORS: { name: string; value: string }[] = [
  { name: "Yellow", value: "var(--hl-yellow)" },
  { name: "Green", value: "var(--hl-green)" },
  { name: "Blue", value: "var(--hl-blue)" },
  { name: "Pink", value: "var(--hl-pink)" },
  { name: "Orange", value: "var(--hl-orange)" },
];

const heading = (level: 1 | 2 | 3, icon: React.ReactNode): TurnIntoOption => ({
  key: `h${level}`,
  label: `Heading ${level}`,
  icon,
  isActive: (e) => e.isActive("heading", { level }),
  run: (e) => e.chain().focus().setNode("heading", { level }).run(),
});

export const TURN_INTO_OPTIONS: TurnIntoOption[] = [
  {
    key: "text",
    label: "Text",
    icon: <Pilcrow className="size-4" />,
    isActive: (e) => e.isActive("paragraph") && !e.isActive("bulletList") && !e.isActive("orderedList") && !e.isActive("taskList") && !e.isActive("blockquote") && !e.isActive("callout") && !e.isActive("details"),
    run: (e) => {
      const chain = e.chain().focus();
      if (e.isActive("bulletList")) chain.toggleBulletList();
      else if (e.isActive("orderedList")) chain.toggleOrderedList();
      else if (e.isActive("taskList")) chain.toggleTaskList();
      else if (e.isActive("blockquote")) chain.lift("blockquote");
      else if (e.isActive("callout")) chain.lift("callout");
      chain.setParagraph().run();
    },
  },
  heading(1, <Heading1 className="size-4" />),
  heading(2, <Heading2 className="size-4" />),
  heading(3, <Heading3 className="size-4" />),
  {
    key: "bullet",
    label: "Bullet list",
    icon: <List className="size-4" />,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: "ordered",
    label: "Numbered list",
    icon: <ListOrdered className="size-4" />,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: "task",
    label: "To-do list",
    icon: <CheckSquare className="size-4" />,
    isActive: (e) => e.isActive("taskList"),
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    key: "quote",
    label: "Quote",
    icon: <Quote className="size-4" />,
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: "callout",
    label: "Callout",
    icon: <Info className="size-4" />,
    isActive: (e) => e.isActive("callout"),
    run: (e) =>
      e.isActive("callout")
        ? e.chain().focus().lift("callout").run()
        : e.chain().focus().wrapIn("callout").run(),
  },
  {
    key: "toggle",
    label: "Toggle",
    icon: <ChevronRight className="size-4" />,
    isActive: (e) => e.isActive("details"),
    run: (e) => {
      if (e.isActive("details")) return;
      const { $from } = e.state.selection;
      if ($from.depth < 1) return;
      const node = $from.node(1);
      const text = node.textContent;
      const from = $from.before(1);
      const to = $from.after(1);
      e.chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, {
          type: "details",
          content: [
            {
              type: "detailsSummary",
              content: text ? [{ type: "text", text }] : [],
            },
            { type: "detailsContent", content: [{ type: "paragraph" }] },
          ],
        })
        .run();
    },
  },
];

/** Label for the block type at the current selection, for the bubble-menu trigger. */
export function currentBlockLabel(editor: Editor): string {
  const active = TURN_INTO_OPTIONS.find((o) => o.key !== "text" && o.isActive(editor));
  return active?.label ?? "Text";
}
```

- [x] **Step 4: Add highlight color variables and mark styling to `globals.css`**

In the `:root { ... }` block (where other theme vars live), add:

```css
  --hl-yellow: #fef08a;
  --hl-green: #bbf7d0;
  --hl-blue: #bfdbfe;
  --hl-pink: #fbcfe8;
  --hl-orange: #fed7aa;
```

In the `.dark { ... }` block:

```css
  --hl-yellow: #713f12;
  --hl-green: #14532d;
  --hl-blue: #1e3a8a;
  --hl-pink: #831843;
  --hl-orange: #7c2d12;
```

And with the other `.tiptap` rules:

```css
.tiptap mark {
  border-radius: 0.2rem;
  padding: 0 0.1rem;
  color: inherit;
}
```

(Swatch values are stored in the document as `var(--hl-*)` strings, so existing highlights re-theme when the palette or mode changes. Old documents with the raw `#fef08a` keep working — the style attribute still resolves.)

- [x] **Step 5: Rewrite `editor-bubble-menu.tsx`**

Replace the file's content with:

```tsx
"use client";

import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currentBlockLabel, HIGHLIGHT_COLORS, TURN_INTO_OPTIONS } from "./turn-into";

const TEXT_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"];

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        "grid size-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground " +
        (active ? "bg-accent text-foreground" : "")
      }
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-border" />;

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const [palette, setPalette] = useState<"none" | "color" | "highlight">("none");

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const inTable = editor.isActive("table");

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) => {
        if (!ed.isEditable) return false;
        if (ed.isActive("codeBlock")) return false;
        if (ed.isActive("image")) return false;
        if (ed.isActive("table")) return true;
        return !ed.state.selection.empty;
      }}
      className="flex max-w-xl flex-wrap items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
    >
      {/* Turn into */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            className="flex h-7 items-center gap-1 rounded px-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {currentBlockLabel(editor)}
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {TURN_INTO_OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.key}
              onSelect={() => o.run(editor)}
              className="gap-2 text-sm"
            >
              {o.icon}
              {o.label}
              {o.isActive(editor) && <Check className="ml-auto size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </Btn>
      <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </Btn>
      <Btn
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </Btn>
      <Btn
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </Btn>
      <Btn title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="size-4" />
      </Btn>
      <Btn title="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="size-4" />
      </Btn>

      <Divider />

      {/* Alignment */}
      <Btn
        title="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().unsetTextAlign().run()}
      >
        <AlignLeft className="size-4" />
      </Btn>
      <Btn
        title="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="size-4" />
      </Btn>
      <Btn
        title="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="size-4" />
      </Btn>

      <Divider />

      {/* Text color palette toggle */}
      <Btn
        title="Text color"
        active={palette === "color"}
        onClick={() => setPalette((p) => (p === "color" ? "none" : "color"))}
      >
        <span className="text-xs font-semibold">A</span>
      </Btn>
      {/* Highlight palette toggle */}
      <Btn
        title="Highlight"
        active={palette === "highlight" || editor.isActive("highlight")}
        onClick={() => setPalette((p) => (p === "highlight" ? "none" : "highlight"))}
      >
        <Highlighter className="size-4" />
      </Btn>

      {palette === "color" && (
        <>
          <Divider />
          <Btn title="Default color" onClick={() => editor.chain().focus().unsetColor().run()}>
            <span className="text-xs font-semibold">A</span>
          </Btn>
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Text color ${c}`}
              aria-label={`Text color ${c}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setColor(c).run()}
              className="grid size-7 place-items-center rounded hover:bg-accent"
            >
              <span className="size-3.5 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: c }} />
            </button>
          ))}
        </>
      )}

      {palette === "highlight" && (
        <>
          <Divider />
          <Btn title="Remove highlight" onClick={() => editor.chain().focus().unsetHighlight().run()}>
            <span className="text-xs">✕</span>
          </Btn>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              title={`Highlight ${c.name}`}
              aria-label={`Highlight ${c.name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setHighlight({ color: c.value }).run()}
              className="grid size-7 place-items-center rounded hover:bg-accent"
            >
              <span
                className="size-3.5 rounded ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: c.value }}
              />
            </button>
          ))}
        </>
      )}

      {inTable && (
        <>
          <Divider />
          <TableBtn onClick={() => editor.chain().focus().addRowAfter().run()}>+Row</TableBtn>
          <TableBtn onClick={() => editor.chain().focus().addColumnAfter().run()}>+Col</TableBtn>
          <TableBtn onClick={() => editor.chain().focus().deleteRow().run()}>−Row</TableBtn>
          <TableBtn onClick={() => editor.chain().focus().deleteColumn().run()}>−Col</TableBtn>
          <TableBtn onClick={() => editor.chain().focus().deleteTable().run()}>Delete</TableBtn>
        </>
      )}
    </BubbleMenu>
  );
}

function TableBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
```

Key changes vs the old file: turn-into dropdown at the start; alignment buttons; text color and highlight moved behind two toggle buttons that expand an inline swatch row (keeps the bar compact); every button uses `onMouseDown preventDefault` so clicking never collapses the text selection.

- [x] **Step 6: Verify**

Run: `npx tsc --noEmit && npm test && npm run lint`.
Then `npm run dev`: select text → bubble shows Turn-into label matching the block type; convert a 3-paragraph selection to a bullet list and back; center a heading; apply each highlight color in light AND dark mode (text stays readable); remove highlight; text colors still work.
Expected: all of the above.

- [x] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/editor/turn-into.tsx src/components/editor/editor-bubble-menu.tsx src/components/editor/rich-editor.tsx src/app/globals.css
git commit -m "feat(editor): turn-into dropdown, highlight palette, and text alignment in bubble menu

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Right-click context menu

**Files:**
- Create: `src/components/editor/editor-context-menu.tsx`
- Modify: `src/components/editor/rich-editor.tsx`

**Interfaces:**
- Consumes: `TURN_INTO_OPTIONS` from `./turn-into` (Task 8); shadcn `context-menu` primitives (already in `src/components/ui/context-menu.tsx`); `toast` from sonner.
- Produces: `EditorContextMenu` component: `{ editor: Editor; editable: boolean; children: React.ReactNode }`.

- [x] **Step 1: Create `src/components/editor/editor-context-menu.tsx`**

```tsx
"use client";

import type { Editor } from "@tiptap/core";
import {
  Bold,
  ClipboardPaste,
  Code,
  Copy,
  CopyPlus,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Link2,
  Scissors,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TURN_INTO_OPTIONS } from "./turn-into";

export function EditorContextMenu({
  editor,
  editable,
  children,
}: {
  editor: Editor;
  editable: boolean;
  children: React.ReactNode;
}) {
  // Before the menu opens, make sure the selection covers the click target:
  // an empty or elsewhere selection moves to the clicked position.
  const captureSelection = (e: React.MouseEvent) => {
    if (!editable) return;
    const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (!pos) return;
    const { from, to, empty } = editor.state.selection;
    if (empty || pos.pos < from || pos.pos > to) {
      editor.chain().setTextSelection(pos.pos).run();
    }
  };

  const topBlock = () => {
    const { $from } = editor.state.selection;
    if ($from.depth < 1) return null;
    return { node: $from.node(1), from: $from.before(1), to: $from.after(1) };
  };

  const duplicateBlock = () => {
    const b = topBlock();
    if (!b) return;
    const json = b.node.toJSON() as { attrs?: Record<string, unknown> };
    json.attrs = { ...json.attrs, blockId: null };
    editor.chain().focus().insertContentAt(b.to, json).run();
  };

  const deleteBlock = () => {
    const b = topBlock();
    if (!b) return;
    editor.chain().focus().deleteRange({ from: b.from, to: b.to }).run();
  };

  const copyBlockLink = () => {
    const b = topBlock();
    const blockId = b?.node.attrs.blockId as string | null | undefined;
    if (!blockId) {
      toast.error("No link for this block yet — type something in it first");
      return;
    }
    void navigator.clipboard?.writeText(
      `${window.location.origin}${window.location.pathname}#b-${blockId}`,
    );
    toast.success("Block link copied");
  };

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const clipboard = (action: "cut" | "copy") => {
    // execCommand needs the editor focused and runs on the current selection.
    editor.chain().focus().run();
    setTimeout(() => document.execCommand(action), 0);
  };

  const paste = () => {
    void navigator.clipboard
      ?.readText()
      .then((text) => {
        if (text) editor.chain().focus().insertContent(text).run();
      })
      .catch(() => toast.error("Clipboard unavailable — use Cmd/Ctrl+V"));
  };

  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild disabled={!editable}>
        <div onContextMenuCapture={captureSelection}>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem className="gap-2" onSelect={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" /> Bold
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" /> Italic
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-4" /> Underline
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="size-4" /> Strikethrough
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={() => editor.chain().focus().toggleCode().run()}>
          <Code className="size-4" /> Inline code
        </ContextMenuItem>
        <ContextMenuItem
          className="gap-2"
          onSelect={() => editor.chain().focus().toggleHighlight({ color: "var(--hl-yellow)" }).run()}
        >
          <Highlighter className="size-4" /> Highlight
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={setLink}>
          <LinkIcon className="size-4" /> Link…
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>Turn into</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {TURN_INTO_OPTIONS.map((o) => (
              <ContextMenuItem key={o.key} className="gap-2" onSelect={() => o.run(editor)}>
                {o.icon}
                {o.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem className="gap-2" onSelect={duplicateBlock}>
          <CopyPlus className="size-4" /> Duplicate block
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={copyBlockLink}>
          <Link2 className="size-4" /> Copy link to block
        </ContextMenuItem>
        <ContextMenuItem className="gap-2 text-destructive" onSelect={deleteBlock}>
          <Trash2 className="size-4" /> Delete block
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem className="gap-2" onSelect={() => clipboard("cut")}>
          <Scissors className="size-4" /> Cut
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={() => clipboard("copy")}>
          <Copy className="size-4" /> Copy
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={paste}>
          <ClipboardPaste className="size-4" /> Paste
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
```

- [x] **Step 2: Wire into `rich-editor.tsx`**

```ts
import { EditorContextMenu } from "./editor-context-menu";
```

Replace the bare `<EditorContent editor={editor} />` line with:

```tsx
      {editor ? (
        <EditorContextMenu editor={editor} editable={editable}>
          <EditorContent editor={editor} />
        </EditorContextMenu>
      ) : (
        <EditorContent editor={editor} />
      )}
```

(`disabled` on the trigger keeps the native browser menu in read-only mode.)

- [x] **Step 3: Verify `ContextMenuTrigger` supports `disabled`**

Check `src/components/ui/context-menu.tsx` — the shadcn trigger forwards props to `ContextMenuPrimitive.Trigger`, which supports `disabled`. If this file is an older variant that doesn't forward it, add `disabled?: boolean` passthrough there.

- [x] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`.
Then `npm run dev`:
- Right-click a word with no selection → menu opens, formatting applies to the block/cursor position; Bold etc. work.
- Select 3 paragraphs → right-click → Turn into → Bullet list converts all three.
- Duplicate block, Delete block, Copy link to block (paste the link in a new tab → scrolls and flashes).
- Cut/Copy put content on the clipboard; Paste inserts clipboard text.
- Read-only page view → right-click shows the native browser menu.
Expected: all of the above.

- [x] **Step 5: Commit**

```bash
git add src/components/editor/editor-context-menu.tsx src/components/editor/rich-editor.tsx
git commit -m "feat(editor): right-click context menu with formatting, turn-into, and block actions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Full verification pass

**Files:** none created; fixes go wherever the pass finds problems.

- [x] **Step 1: Automated checks**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: all pass. Fix anything that fails before proceeding.

- [x] **Step 2: Manual checklist (`npm run dev`)**

Keyboard:
- Tab/Shift+Tab in a paragraph indents/outdents (up to 6 levels, floor 0); focus never leaves the editor even at the limits.
- Tab in a nested list sinks the item; Shift+Tab lifts; Tab on a first list item (can't sink) does NOT move focus.
- Tab in a code block inserts two spaces.
- Multi-block selection (3 paragraphs) + Tab indents all three; Shift+Tab outdents all three.
- Backspace at the start of an indented paragraph outdents instead of merging.

Blocks & slash commands:
- `/toggle`, `/columns` (2 & 3), `/table of contents`, `/date`, `/emoji`, `/duplicate` all work as specified in Tasks 4–7.
- Toggle open/close persists after reload; works in read-only view.

Selection styling:
- Bubble menu turn-into converts single and multi-block selections both ways.
- All 5 highlight colors readable in light and dark mode; remove-highlight works.
- Alignment on headings and paragraphs; markdown export unaffected.

Context menu: full pass from Task 9 Step 4.

Regression:
- Existing content (pages written before this change) still renders; old yellow highlights still show.
- Mentions (@), issue embeds, bookmarks, image paste/drop, block-link gutter all still work.
- A page's markdown export (`docToMarkdown` consumers) produces sane output for a page using every new feature.

- [x] **Step 3: Fix and commit anything found**

Each fix is its own commit: `fix(editor): <what>` + co-author trailer.

- [x] **Step 4: Mark the plan complete**

Check every box in this plan document, commit the plan file update:

```bash
git add docs/superpowers/plans/2026-07-22-markdown-editor-refinements.md
git commit -m "docs: mark editor refinements plan complete

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
