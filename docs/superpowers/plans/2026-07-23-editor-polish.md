# Editor Polish (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notion-parity editing polish: drag handles, highlighted code blocks, resizable captioned images, block backgrounds, block-type shortcuts, callout emoji, word count, collapsible headings.

**Architecture:** Everything is TipTap extensions + React node views inside `src/components/editor/`, styling in `globals.css` with CSS variables for dark mode, markdown fallbacks in `src/lib/markdown.ts`. No DB changes.

**Tech Stack:** TipTap 3.26.1 (exact pins), lowlight v3, React node views, Tailwind v4 CSS variables.

## Global Constraints

- New @tiptap packages MUST be installed at exactly `3.26.1` (`npm install @tiptap/extension-X@3.26.1`) — `^3` fails with ERESOLVE.
- shadcn components are Base UI: triggers use `render={<el/>}`, items use `onClick` (never `asChild`/`onSelect`).
- Dark mode via `.dark` class overrides of CSS variables in `globals.css`.
- Gates per task: `npx tsc --noEmit`, `npm run lint`, `npm test`; `npm run build` at the end.
- Commit after each task.

---

### Task 1: Code blocks — lowlight, language picker, copy button

**Files:**
- Create: `src/components/editor/code-block.tsx` (extension config + node view)
- Modify: `src/components/editor/rich-editor.tsx` (StarterKit `codeBlock: false`, add extension)
- Modify: `src/lib/markdown.ts` (language fence), `src/lib/markdown.test.ts`
- Modify: `src/app/globals.css` (hljs token colors, chrome styles)

**Interfaces:**
- Produces: `CodeBlock` extension (named export) configured with lowlight `common`; node view renders `<select>` of `common` languages + "plain", Copy button using `navigator.clipboard.writeText(node.textContent)` + sonner toast.

- [ ] Install: `npm install @tiptap/extension-code-block-lowlight@3.26.1 lowlight`
- [ ] Test first in `markdown.test.ts`:

```ts
it("renders code block language fences", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const a = 1;" }] },
    ],
  };
  expect(docToMarkdown(doc)).toBe("```ts\nconst a = 1;\n```");
});
```

- [ ] Update `markdown.ts` codeBlock case: `` return `\`\`\`${node.attrs?.language ?? ""}\n${inline(node.content)}\n\`\`\``; ``
- [ ] `code-block.tsx`: `CodeBlockLowlight.extend({ addNodeView: () => ReactNodeViewRenderer(CodeBlockView) }).configure({ lowlight: createLowlight(common) })`; view = `<NodeViewWrapper className="code-block-wrap">` with absolute top-right hover row (select onChange `updateAttributes({ language })`, copy button) + `<pre><code><NodeViewContent /></code></pre>`.
- [ ] Wire into rich-editor (`StarterKit.configure({ codeBlock: false, ... })`), token colors in globals.css (`.hljs-keyword`, `-string`, `-comment`, `-number`, `-title`, `-attr`, `-built_in` etc.) with `.dark` overrides.
- [ ] Gates + commit `feat(editor): syntax-highlighted code blocks with language picker and copy`

### Task 2: Block backgrounds

**Files:**
- Create: `src/components/editor/block-background.ts`
- Modify: `editor-bubble-menu.tsx` (Background palette row), `editor-context-menu.tsx` (Color submenu), `globals.css`

**Interfaces:**
- Produces: `BlockBackground` extension adding `bg` attr (string|null → `data-bg`) to paragraph+heading; commands `setBlockBackground(name: string | null)` applying over `nodesBetween` like `indent.ts`; `BLOCK_BG_COLORS: {name,label}[]` export (gray, brown, orange, yellow, green, blue, purple, pink, red).

- [ ] Extension modeled on `indent.ts` (global attributes for ["paragraph","heading"], command mirrors `applyIndent` but sets/clears `bg`).
- [ ] globals.css: `--bg-block-gray: #f1f0ef` … + `.dark` variants; `.tiptap [data-bg] { border-radius: .25rem; padding: .125rem .375rem; }` + one rule per color `[data-bg="gray"] { background: var(--bg-block-gray); }`.
- [ ] Bubble menu: third palette mode "bg" alongside "color"/"highlight" reusing the swatch-row pattern; context menu: "Color" submenu with Default + 9 swatches calling `setBlockBackground`.
- [ ] Gates + commit `feat(editor): block background colors`

### Task 3: Keyboard shortcuts for block types

**Files:**
- Create: `src/components/editor/block-shortcuts.ts`
- Modify: `rich-editor.tsx`

- [ ] Extension with `addKeyboardShortcuts`: `Mod-Alt-1/2/3` → `setNode("heading",{level})`, `Mod-Alt-0` → `setParagraph`, `Mod-Shift-7` → `toggleOrderedList`, `Mod-Shift-8` → `toggleBulletList`, `Mod-Shift-9` → `toggleTaskList`.
- [ ] Gates + commit `feat(editor): block-type keyboard shortcuts`

### Task 4: Callout emoji

**Files:**
- Create: `src/components/editor/callout-view.tsx`
- Modify: `callout.ts` (emoji attr + node view), `markdown.ts` + test (emoji prefix), `globals.css` (layout for emoji button)

**Interfaces:**
- Produces: callout `emoji` attr (default "💡", rendered `data-emoji`); markdown: first line of callout becomes `> 💡 …`.

- [ ] Test: callout `{emoji:"🔥"}` with paragraph "Note" → `"> 🔥 Note"`; legacy callouts without emoji → `"> 💡 Note"`. Implementation: in `markdown.ts` callout case, prefix `${node.attrs?.emoji ?? "💡"} ` to the first content line only.
- [ ] Node view: emoji `<button contentEditable={false}>` opening popover (fixed-position card): 48 curated emoji grid + text input filtering `gitHubEmojis` (reuse import from emoji-suggestion), click → `updateAttributes({ emoji })`.
- [ ] Gates + commit `feat(editor): callout emoji picker`

### Task 5: Images — resize, caption, alignment

**Files:**
- Create: `src/components/editor/image-view.tsx`
- Modify: `rich-editor.tsx` (Image.extend with attrs + node view), `markdown.ts` + test, `globals.css`

**Interfaces:**
- Produces: image attrs `width: number|null`, `align: "left"|"center"|"right"` (default center), `caption: string` (default ""). Markdown: `![<caption>](<src>)`.

- [ ] Test: image `{src:"/x.png", caption:"Diagram"}` → `![Diagram](/x.png)`; no caption → `![](/x.png)`. Implementation: add `case "image"` in `block()`.
- [ ] Node view: wrapper div with `data-align`; img with inline width; when selected+editable show two side handles (pointerdown → track movementX, clamp 120..container width, `updateAttributes({width})` on pointerup, live via local state) and floating align toolbar (3 buttons); caption `<input>` below (muted, placeholder "Add a caption…"), hidden in read mode when empty.
- [ ] globals.css: `[data-align]` margins (left: mr-auto, center: mx-auto, right: ml-auto), handle styles.
- [ ] Gates + commit `feat(editor): image resize, captions, alignment`

### Task 6: Word count

**Files:**
- Modify: `rich-editor.tsx` (optional `onStats` callback: `{ words: number }` computed debounced 300ms from `doc.textContent`), `page-view.tsx` (muted "N words" under editor)

- [ ] `const words = text.trim() ? text.trim().split(/\s+/).length : 0` — count on update + initial.
- [ ] Gates + commit `feat(editor): word count`

### Task 7: Collapsible headings

**Files:**
- Create: `src/components/editor/heading-fold.ts` (+ pure helper `foldRanges(doc): {from,to}[]` exported for tests)
- Create: `src/components/editor/heading-fold.test.ts`
- Modify: `rich-editor.tsx`, `globals.css`

**Interfaces:**
- Produces: heading `folded` boolean attr (rendered `data-folded`); plugin hides sibling blocks after a folded heading until next heading with `level <=` via node decorations (class `fold-hidden`); chevron button rendered as widget decoration before heading text (editable only), toggles attr via `tr.setNodeAttribute`; widget pill "N blocks hidden" after folded heading text.

- [ ] Test `foldRanges` (pure, operates on ProseMirror JSON-like array of `{type, attrs}` blocks + positions): folded H2 hides following paragraphs and H3s but stops at next H2/H1; unfolded heading contributes nothing; folded heading at doc end hides to end.
- [ ] Plugin: decorations recomputed per doc change; `fold-hidden { display: none; }`; chevron rotates when folded.
- [ ] Gates + commit `feat(editor): collapsible headings`

### Task 8: Drag handles

**Files:**
- Create: `src/components/editor/drag-handle.tsx` (React component using `@tiptap/extension-drag-handle-react`)
- Modify: `rich-editor.tsx` (render `<EditorDragHandle editor={editor}/>` when editable; shift copy-link gutter left to make room), `globals.css`

- [ ] Install: `npm install @tiptap/extension-drag-handle-react@3.26.1 @tiptap/extension-drag-handle@3.26.1 @tiptap/extension-node-range@3.26.1`
- [ ] `<DragHandle editor={editor}>` rendering a GripVertical button; click dispatches a `contextmenu` MouseEvent on the hovered block element so the existing EditorContextMenu opens at the handle.
- [ ] Gates + commit `feat(editor): drag handles for block reordering`

### Task 9: Build + live browser verification

- [ ] `npm run build` passes.
- [ ] Dev server + claude-in-chrome pass over a scratch page: drag-reorder, code language+copy, image resize/caption/align, bg colors from both menus, all 6 shortcuts, callout emoji swap, fold/unfold with counts, word count updates. Fix and commit anything found.
