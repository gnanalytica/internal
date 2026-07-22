# Editor Polish (Notion parity, sub-project A) — Design

Date: 2026-07-23
Status: Approved (user: "implement all" / goal: full Notion UX)

## Goal

Close the daily-editing gap with Notion inside the TipTap editor. No DB changes.

## Features

### 1. Drag handles
- Packages: `@tiptap/extension-drag-handle-react@3.26.1`, `@tiptap/extension-node-range@3.26.1` (exact versions — TipTap pins peers).
- A ⋮⋮ grip (GripVertical icon) appears on block hover, positioned in the left gutter next to the existing copy-link button (grip left of link icon; both share the hover-gutter row).
- Drag reorders top-level blocks. Click opens the block menu — reuse the existing context-menu content (Turn into, Duplicate, Copy link, Delete, colors) anchored at the handle.
- Editable mode only; hidden when `editable={false}`.

### 2. Code blocks
- Replace StarterKit `codeBlock` with `@tiptap/extension-code-block-lowlight@3.26.1` + `lowlight` (v3) using the `common` grammar bundle (~37 languages).
- Node view chrome (React node view): top-right hover row with a language `<select>` (common languages + "plain") and a Copy button (clipboard.writeText + toast).
- Highlight styles: define `.tiptap pre code .hljs-*` token colors in `globals.css` using CSS variables with `.dark` overrides (no highlight.js stylesheet import).
- Markdown export: emit fenced block with language tag: ```ts etc. (`language` attr already stored by the extension).

### 3. Images
- Extend the Image extension with attrs: `width` (number | null, rendered as inline style), `align` ("left" | "center" | "right", default "center"), `caption` (string, plain text).
- React node view: selected image shows left/right edge drag handles to resize (pointer events, min 120px, max container width, store px width); alignment buttons appear in a small floating toolbar on selection (left/center/right); caption is an always-rendered input below the image (placeholder "Add a caption…"), styled muted, hidden when empty in read-only mode.
- Markdown export: `![caption](src)` (caption falls back to empty string).

### 4. Block background colors
- New `BlockBackground` extension (same pattern as `indent`): `bg` attr on `paragraph`, `heading`, rendered as `data-bg="<name>"`.
- Palette (Notion-ish, CSS vars in globals.css with dark variants): gray, brown, orange, yellow, green, blue, purple, pink, red. `data-bg` styles apply background + rounded corners + padding.
- Entry points: context menu → "Color" submenu (background swatches + "Default" to clear); bubble menu palette gets a third row toggle "Background".
- Multi-block selection applies to every paragraph/heading in range (nodesBetween, like indent).
- Markdown export: ignored (attribute only).

### 5. Keyboard shortcuts
- New `BlockShortcuts` extension: Mod-Alt-1/2/3 → heading 1/2/3; Mod-Alt-0 → paragraph; Mod-Shift-7 → ordered list; Mod-Shift-8 → bullet list; Mod-Shift-9 → task list.

### 6. Callout emoji
- `callout` node gains `emoji` attr (default "💡"), rendered via React node view: emoji button on the left, content beside it. Clicking the button opens a small popover grid of ~48 curated emojis + a filter input over the full gitHubEmojis dataset; picking one sets the attr.
- Markdown export: `> 💡 …` — prefix first line with emoji.

### 7. Word count
- Compute words from `editor.state.doc.textContent` on update (debounced 300ms in the page footer component, not the editor).
- Display "N words" bottom-right of page-view under the editor, muted, read mode included.

### 8. Collapsible headings
- Heading gains `folded` boolean attr (persisted in doc JSON; harmless in markdown export).
- Chevron button appears on heading hover (left of the text, in the block, CSS-positioned) — editable mode only.
- A ProseMirror plugin computes fold ranges: from the heading to the next heading of same-or-higher level (or doc end), and applies node decorations `data-folded-hidden` → `display: none`.
- Clicking a folded heading's chevron (rotated) unfolds. Folded heading shows a subtle "N hidden blocks" pill after its text (widget decoration).
- Guard: Backspace/delete merging into a folded region unfolds it first (onTransaction normalization: if a folded heading is deleted, its hidden blocks reappear automatically since decorations recompute).
- Risk note: if decorations prove unstable with node views inside folded ranges, fallback is scope-cut to hide only top-level blocks (accepted).

## Out of scope
- Font family/size (standing decision), synced blocks, AI blocks.

## Testing
- Unit: markdown export for code language fences, image captions, callout emoji prefix; fold-range computation (pure helper).
- Existing suites must stay green. Live browser verification pass at the end (drag, resize, fold, shortcuts, palettes).
