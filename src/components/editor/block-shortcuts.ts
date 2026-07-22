"use client";

import { Extension } from "@tiptap/core";

/** Notion muscle-memory shortcuts for switching block types. */
export const BlockShortcuts = Extension.create({
  name: "blockShortcuts",

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-0": () => this.editor.chain().focus().setParagraph().run(),
      "Mod-Alt-1": () => this.editor.chain().focus().setNode("heading", { level: 1 }).run(),
      "Mod-Alt-2": () => this.editor.chain().focus().setNode("heading", { level: 2 }).run(),
      "Mod-Alt-3": () => this.editor.chain().focus().setNode("heading", { level: 3 }).run(),
      "Mod-Shift-7": () => this.editor.chain().focus().toggleOrderedList().run(),
      "Mod-Shift-8": () => this.editor.chain().focus().toggleBulletList().run(),
      "Mod-Shift-9": () => this.editor.chain().focus().toggleTaskList().run(),
    };
  },
});
