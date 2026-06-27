"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// Top-level block types that get a stable id (for block-level anchor links).
const TARGET = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
];
const TARGET_SET = new Set(TARGET);

/**
 * Gives each top-level block a stable `blockId` (rendered as `data-block-id`)
 * so the UI can build "copy link to this block" anchors that scroll on open.
 * Ids are assigned lazily and persist in the document JSON.
 */
export const BlockId = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: TARGET,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-block-id"),
            renderHTML: (attrs) =>
              attrs.blockId ? { "data-block-id": attrs.blockId } : {},
            keepOnSplit: false,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockId"),
        appendTransaction: (txns, _oldState, newState) => {
          if (!txns.some((t) => t.docChanged)) return null;
          const seen = new Set<string>();
          let tr = newState.tr;
          let modified = false;
          newState.doc.forEach((node, pos) => {
            if (!TARGET_SET.has(node.type.name)) return;
            const id: string | null = node.attrs.blockId;
            if (!id || seen.has(id)) {
              const next = crypto.randomUUID().slice(0, 8);
              tr = tr.setNodeAttribute(pos, "blockId", next);
              seen.add(next);
              modified = true;
            } else {
              seen.add(id);
            }
          });
          return modified ? tr : null;
        },
      }),
    ];
  },
});
