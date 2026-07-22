# Markdown Editor Refinements — Design

**Date:** 2026-07-22
**Status:** Approved pending review
**Scope:** `src/components/editor/*`, `src/app/globals.css`, `src/lib/markdown.ts`, `src/components/page-view.tsx`

## Goal

Bring the TipTap-based rich editor closer to Notion-level editing: Tab indentation,
multi-level list styling, a larger slash-command set, a right-click context menu,
and richer selection styling (highlight palette, alignment, turn-into). All content
continues to serialize into the existing TipTap JSON `content` column — no DB or
schema changes.

## Approach

Use official MIT-licensed TipTap v3 extensions where they exist, and build small
custom pieces where they don't. All existing custom extensions (Callout, IssueEmbed,
Bookmark, Embed, BlockId, EntityRef, SlashCommand) stay untouched.

New dependencies (all `@tiptap/*` v3, MIT):

| Package | Provides |
|---|---|
| `@tiptap/extension-details` | Toggle / collapsible block |
| `@tiptap/extension-emoji` | `:` emoji suggestion + insertion |
| `@tiptap/extension-table-of-contents` | Heading index for the TOC block |
| `@tiptap/extension-text-align` | Left/center/right alignment on paragraphs & headings |

New custom pieces:

| File | Provides |
|---|---|
| `src/components/editor/indent.ts` | Tab/Shift+Tab block indentation |
| `src/components/editor/columns.ts` | `columnBlock` / `column` nodes |
| `src/components/editor/toc.tsx` | TOC block node view |
| `src/components/editor/editor-context-menu.tsx` | Right-click menu |
| `src/components/editor/turn-into.tsx` | Shared "Turn into" menu items (used by bubble menu + context menu) |

## 1. Tabs & indentation (`indent.ts`)

- Adds an `indent` attribute (integer 0–6, default 0) to `paragraph` and `heading`.
- Rendered as `data-indent="n"`; CSS applies `padding-left: calc(n * 1.5rem)`.
- **Tab** increments indent, **Shift+Tab** decrements, clamped to 0–6.
- Precedence rules for the Tab key:
  1. Selection entirely inside a list → defer to TipTap's native sink/lift
     (`sinkListItem` / `liftListItem`), which already handles per-item nesting.
  2. Selection entirely inside a single code block → insert two spaces.
  3. Otherwise → apply indent/outdent to **every** paragraph/heading the
     selection touches (multi-block aware).
- Tab never moves browser focus while the editor has focus.
- Backspace at the start of an indented block outdents one level before deleting.
- `indent` is ignored by the markdown converter (structural indentation is not
  representable in plain markdown; content is preserved, indentation dropped).

## 2. Multi-level list styles (CSS only)

In `globals.css` under `.tiptap`:

- Nested `ul` markers cycle **disc → circle → square** (repeat for deeper levels).
- Nested `ol` numbering cycles **1. → a. → i.** (repeat).
- Nested task lists already work (`TaskItem.configure({ nested: true })`); add
  consistent left padding so all three list types align.

## 3. New slash commands

Added to `COMMANDS` in `slash-command.ts`, in existing groups or new ones:

| Command | Group | Behavior |
|---|---|---|
| Toggle | Blocks | Inserts a Details block (summary + collapsible content). Styled chevron via CSS. |
| Columns (2) / Columns (3) | Blocks | Inserts a `columnBlock` with 2 or 3 `column` children, each starting with an empty paragraph. |
| Table of contents | Blocks | Inserts a `toc` node whose React node view lists the page's headings as anchor links, live-updated via the TableOfContents extension. |
| Date | Basic | Inserts today's date as plain text, formatted `MMM d, yyyy` (e.g. "Jul 22, 2026"). |
| Emoji | Basic | Inserts `:` to open the emoji suggestion popup. The Emoji extension also enables `:shortcode:` typing anywhere. |
| Duplicate block | Basic | Duplicates the current top-level block below itself. |

Constraints:

- Columns are **top-level only**: no columns inside columns, callouts, toggles, or
  tables (enforced via schema `content`/`group` rules). Each column accepts
  ordinary block content.
- Toggle summary is a single line; content accepts ordinary block content.
- Existing `window.prompt` flows (link, bookmark, embed) are unchanged in this
  iteration.

## 4. Right-click context menu (`editor-context-menu.tsx`)

Built on the existing shadcn ContextMenu primitives, wrapping `EditorContent`.
Shown only when `editable`. Right-click without a selection targets the block
under the cursor (selection is moved there first).

Sections:

1. **Formatting** — Bold, Italic, Underline, Strikethrough, Inline code,
   Highlight (default color), Link (reuses existing prompt flow).
2. **Turn into ▸** — Text, H1, H2, H3, Bullet list, Numbered list, To-do list,
   Quote, Callout, Toggle. Applies to every block the selection touches.
3. **Block** — Duplicate, Delete, Copy link to block (reuses BlockId gutter logic).
4. **Clipboard** — Cut, Copy, Paste (via `document.execCommand` fallbacks /
   navigator.clipboard where available).

Trade-off accepted: the custom menu hides native spellcheck suggestions on
right-click; users can still use OS-level spellcheck via keyboard or by
Ctrl/Cmd-right-click depending on browser.

## 5. Bubble menu & styling options

- **Highlight palette** replaces the single yellow button: 5 swatches + "remove
  highlight". Colors defined as CSS variables so they stay legible in dark mode
  (mark background uses color-mix with the theme background).
- **Text color** row stays as-is.
- **Alignment**: left / center / right buttons for paragraphs and headings
  (TextAlign extension; left is default and stored as absence of the attr).
- **Turn into** dropdown at the start of the bubble menu showing the current
  block type, sharing its item list with the context menu (`turn-into.tsx`).

## 6. Multi-block selection behavior

- **Lists:** `toggleBulletList` / `toggleOrderedList` / `toggleTaskList` on a
  multi-paragraph selection wraps all selected blocks into one list (native).
- **Indent:** Tab/Shift+Tab applies to every paragraph/heading in the selection.
- **Marks:** bold/highlight/color apply to the exact selected range across block
  boundaries (native).
- **Alignment / Turn into:** applies to every block the selection touches.
- **Code-block guard:** the "Tab inserts spaces" rule fires only when the entire
  selection is inside a single code block.

## Rendering & serialization

- Read-only rendering (`page-view.tsx` / `RichEditor editable={false}`) renders
  all new nodes; toggles are interactive (open/close) even in read-only mode.
- `markdown.ts` conversions:
  - Toggle → summary as bold paragraph followed by its content (markdown has no
    native details).
  - Columns → columns flattened sequentially in document order.
  - TOC → omitted.
  - Indent attr → ignored.
  - Alignment → ignored.
- No changes to the pages API or DB.

## Error handling

- Indent/turn-into commands are no-ops (not errors) when the target block type
  doesn't support them.
- TOC renders an empty-state hint ("Add headings to build a table of contents")
  when the page has no headings.
- Context menu actions check `editor.isEditable` before running.

## Testing

- Unit tests in `src/lib/markdown.test.ts` for toggle, columns, TOC, and
  indented-paragraph conversions.
- Manual verification pass: Tab/Shift+Tab in paragraphs, nested lists, code
  blocks; multi-block selection indent + turn-into; context menu on selection
  and on hover-block; highlight palette in light/dark; slash commands insert and
  render in read-only view.

## Out of scope

- Font family / font size / line-height controls.
- Drag-handle block reordering.
- Replacing `window.prompt` link/bookmark/embed flows.
- Real-time collaboration concerns.
