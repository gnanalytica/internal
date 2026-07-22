"use client";

import type { Editor } from "@tiptap/core";
import {
  CheckSquare,
  ChevronRight,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
} from "lucide-react";

export type TurnIntoOption = {
  key: string;
  label: string;
  icon: React.ReactNode;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

export const HIGHLIGHT_COLORS: { name: string; value: string }[] = [
  { name: "Yellow", value: "var(--hl-yellow)" },
  { name: "Green", value: "var(--hl-green)" },
  { name: "Blue", value: "var(--hl-blue)" },
  { name: "Pink", value: "var(--hl-pink)" },
  { name: "Orange", value: "var(--hl-orange)" },
];

const heading = (level: 1 | 2 | 3, icon: React.ReactNode): TurnIntoOption => ({
  key: `h${level}`,
  label: `Heading ${level}`,
  icon,
  isActive: (e) => e.isActive("heading", { level }),
  run: (e) => e.chain().focus().setNode("heading", { level }).run(),
});

export const TURN_INTO_OPTIONS: TurnIntoOption[] = [
  {
    key: "text",
    label: "Text",
    icon: <Pilcrow className="size-4" />,
    isActive: (e) =>
      e.isActive("paragraph") &&
      !e.isActive("bulletList") &&
      !e.isActive("orderedList") &&
      !e.isActive("taskList") &&
      !e.isActive("blockquote") &&
      !e.isActive("callout") &&
      !e.isActive("details"),
    run: (e) => {
      const chain = e.chain().focus();
      if (e.isActive("bulletList")) chain.toggleBulletList();
      else if (e.isActive("orderedList")) chain.toggleOrderedList();
      else if (e.isActive("taskList")) chain.toggleTaskList();
      else if (e.isActive("blockquote")) chain.lift("blockquote");
      else if (e.isActive("callout")) chain.lift("callout");
      chain.setParagraph().run();
    },
  },
  heading(1, <Heading1 className="size-4" />),
  heading(2, <Heading2 className="size-4" />),
  heading(3, <Heading3 className="size-4" />),
  {
    key: "bullet",
    label: "Bullet list",
    icon: <List className="size-4" />,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: "ordered",
    label: "Numbered list",
    icon: <ListOrdered className="size-4" />,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: "task",
    label: "To-do list",
    icon: <CheckSquare className="size-4" />,
    isActive: (e) => e.isActive("taskList"),
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    key: "quote",
    label: "Quote",
    icon: <Quote className="size-4" />,
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: "callout",
    label: "Callout",
    icon: <Info className="size-4" />,
    isActive: (e) => e.isActive("callout"),
    run: (e) =>
      e.isActive("callout")
        ? e.chain().focus().lift("callout").run()
        : e.chain().focus().wrapIn("callout").run(),
  },
  {
    key: "toggle",
    label: "Toggle",
    icon: <ChevronRight className="size-4" />,
    isActive: (e) => e.isActive("details"),
    run: (e) => {
      if (e.isActive("details")) return;
      const { $from } = e.state.selection;
      if ($from.depth < 1) return;
      const node = $from.node(1);
      const text = node.textContent;
      const from = $from.before(1);
      const to = $from.after(1);
      e.chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, {
          type: "details",
          content: [
            {
              type: "detailsSummary",
              content: text ? [{ type: "text", text }] : [],
            },
            { type: "detailsContent", content: [{ type: "paragraph" }] },
          ],
        })
        .run();
    },
  },
];

/** Label for the block type at the current selection, for the bubble-menu trigger. */
export function currentBlockLabel(editor: Editor): string {
  const active = TURN_INTO_OPTIONS.find((o) => o.key !== "text" && o.isActive(editor));
  return active?.label ?? "Text";
}
