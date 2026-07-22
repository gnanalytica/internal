"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

/** A top-level block, as seen by the fold computation. */
export type FoldBlock = {
  heading: boolean;
  level: number;
  folded: boolean;
  from: number;
  to: number;
};

/**
 * Ranges of top-level blocks hidden by folded headings: everything after a
 * folded heading up to the next heading of the same or higher level.
 */
export function foldHiddenRanges(blocks: FoldBlock[]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.heading && b.folded) {
      let j = i + 1;
      while (j < blocks.length && !(blocks[j].heading && blocks[j].level <= b.level)) {
        out.push({ from: blocks[j].from, to: blocks[j].to });
        j++;
      }
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

function chevron(view: EditorView, pos: number, folded: boolean): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "heading-fold-chevron";
  btn.contentEditable = "false";
  btn.dataset.folded = folded ? "true" : "false";
  btn.title = folded ? "Expand section" : "Collapse section";
  btn.setAttribute("aria-label", btn.title);
  btn.textContent = "▶";
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    view.dispatch(view.state.tr.setNodeAttribute(pos, "folded", !folded));
  });
  return btn;
}

function hiddenPill(count: number): HTMLElement {
  const pill = document.createElement("span");
  pill.className = "heading-fold-pill";
  pill.contentEditable = "false";
  pill.textContent = `${count} hidden`;
  return pill;
}

/** Notion-style collapsible headings: a `folded` attr hides the section via
 * decorations, so the content stays in the doc (search/markdown unaffected). */
export const HeadingFold = Extension.create({
  name: "headingFold",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          folded: {
            default: false,
            parseHTML: (el) => el.getAttribute("data-folded") === "true",
            renderHTML: (attrs) => (attrs.folded ? { "data-folded": "true" } : {}),
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingFold"),
        props: {
          decorations(state) {
            const blocks: FoldBlock[] = [];
            state.doc.forEach((node, offset) => {
              blocks.push({
                heading: node.type.name === "heading",
                level: Number(node.attrs.level ?? 0),
                folded: Boolean(node.attrs.folded),
                from: offset,
                to: offset + node.nodeSize,
              });
            });

            const hidden = foldHiddenRanges(blocks);
            const hiddenFroms = new Set(hidden.map((r) => r.from));
            const decos: Decoration[] = hidden.map((r) =>
              Decoration.node(r.from, r.to, { class: "fold-hidden" }),
            );

            for (const b of blocks) {
              if (!b.heading || hiddenFroms.has(b.from)) continue;
              const pos = b.from;
              const folded = b.folded;
              decos.push(
                Decoration.widget(b.from + 1, (view) => chevron(view, pos, folded), {
                  side: -1,
                  key: `chevron-${pos}-${folded}`,
                }),
              );
              if (folded) {
                // Count the blocks this heading hides for the trailing pill.
                const idx = blocks.indexOf(b);
                let count = 0;
                for (
                  let j = idx + 1;
                  j < blocks.length && !(blocks[j].heading && blocks[j].level <= b.level);
                  j++
                ) {
                  count++;
                }
                if (count > 0) {
                  decos.push(
                    Decoration.widget(b.to - 1, () => hiddenPill(count), {
                      side: 1,
                      key: `pill-${pos}-${count}`,
                    }),
                  );
                }
              }
            }
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
