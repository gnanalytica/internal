import { Node, mergeAttributes } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";

/**
 * Document override that admits `columnBlock` at the top level only.
 * `columnBlock` deliberately has NO group, so no other container
 * (toggles, callouts, columns, table cells) can accept it.
 */
export const DocWithColumns = Document.extend({
  content: "(block | columnBlock)+",
});

/**
 * Side-by-side column layout. `columnBlock` holds 2–3 `column` children.
 * A column's content expression is an explicit whitelist: no nested columns,
 * tables, or toggles (per spec), everything else ordinary.
 */
export const ColumnBlock = Node.create({
  name: "columnBlock",
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
