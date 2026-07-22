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
