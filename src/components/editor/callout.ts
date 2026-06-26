import { Node, mergeAttributes } from "@tiptap/core";

/** A simple Notion-style callout: a bordered, tinted container of blocks.
 * `variant` (info | warn | success) tints it via the `data-variant` attribute. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (el) => el.getAttribute("data-variant") || "info",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-callout": "", class: "callout" }),
      0,
    ];
  },
});
