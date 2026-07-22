"use client";

import { Extension, type CommandProps } from "@tiptap/core";

// Block types that carry a background tint (same set as indent).
const TYPES = ["paragraph", "heading"];

export const BLOCK_BG_COLORS: { name: string; label: string }[] = [
  { name: "gray", label: "Gray" },
  { name: "brown", label: "Brown" },
  { name: "orange", label: "Orange" },
  { name: "yellow", label: "Yellow" },
  { name: "green", label: "Green" },
  { name: "blue", label: "Blue" },
  { name: "purple", label: "Purple" },
  { name: "pink", label: "Pink" },
  { name: "red", label: "Red" },
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockBackground: {
      /** Tint every selected paragraph/heading; null clears the tint. */
      setBlockBackground: (name: string | null) => ReturnType;
    };
  }
}

/** Notion-style block background colors, rendered as `data-bg` + CSS vars. */
export const BlockBackground = Extension.create({
  name: "blockBackground",

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          bg: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-bg"),
            renderHTML: (attrs) => (attrs.bg ? { "data-bg": attrs.bg } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockBackground:
        (name) =>
        ({ state, tr, dispatch }: CommandProps) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!TYPES.includes(node.type.name)) return;
            if ((node.attrs.bg ?? null) !== name) {
              tr.setNodeAttribute(pos, "bg", name);
              changed = true;
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});
