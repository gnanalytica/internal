"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import {
  CheckCircle2,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  List,
  ListFilter,
  ListOrdered,
  Minus,
  Quote,
  Table as TableIcon,
  Text,
  TriangleAlert,
} from "lucide-react";
import { createElement } from "react";
import { toast } from "sonner";

import { uploadEditorImage } from "@/lib/actions";

/** Open a file picker, upload the chosen image, and insert it at the cursor. */
function pickAndInsertImage(editor: Editor) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const toastId = toast.loading("Uploading image…");
    try {
      const url = await uploadEditorImage(fd);
      editor.chain().focus().setImage({ src: url }).run();
      toast.success("Image added", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId });
    }
  };
  input.click();
}

import { CommandList, type CommandItem } from "./command-list";

type Cmd = {
  title: string;
  description: string;
  icon: React.ReactNode;
  keywords: string;
  group: string;
  run: (editor: Editor, range: Range) => void;
};

const callout = (variant: "info" | "warn" | "success") => (e: Editor, r: Range) =>
  e
    .chain()
    .focus()
    .deleteRange(r)
    .insertContent({ type: "callout", attrs: { variant }, content: [{ type: "paragraph" }] })
    .run();

const COMMANDS: Cmd[] = [
  {
    title: "Text",
    description: "Plain paragraph",
    icon: createElement(Text, { className: "size-4" }),
    keywords: "text paragraph p",
    group: "Basic",
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: createElement(Heading1, { className: "size-4" }),
    keywords: "h1 title big heading",
    group: "Basic",
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: createElement(Heading2, { className: "size-4" }),
    keywords: "h2 heading",
    group: "Basic",
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: createElement(Heading3, { className: "size-4" }),
    keywords: "h3 heading subheading",
    group: "Basic",
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    description: "Unordered list",
    icon: createElement(List, { className: "size-4" }),
    keywords: "bullet unordered list ul",
    group: "Lists",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "Ordered list",
    icon: createElement(ListOrdered, { className: "size-4" }),
    keywords: "numbered ordered list ol",
    group: "Lists",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    title: "To-do list",
    description: "Track tasks with checkboxes",
    icon: createElement(CheckSquare, { className: "size-4" }),
    keywords: "todo task checkbox check",
    group: "Lists",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    title: "Table",
    description: "Insert a table with a header row",
    icon: createElement(TableIcon, { className: "size-4" }),
    keywords: "table grid rows columns",
    group: "Blocks",
    run: (e, r) =>
      e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Image",
    description: "Upload and embed an image",
    icon: createElement(ImageIcon, { className: "size-4" }),
    keywords: "image picture photo upload media",
    group: "Blocks",
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      pickAndInsertImage(e);
    },
  },
  {
    title: "Quote",
    description: "Capture a quote",
    icon: createElement(Quote, { className: "size-4" }),
    keywords: "quote blockquote",
    group: "Blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "Formatted code snippet",
    icon: createElement(Code, { className: "size-4" }),
    keywords: "code snippet pre",
    group: "Blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: createElement(Minus, { className: "size-4" }),
    keywords: "divider hr rule separator",
    group: "Blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
  {
    title: "Callout",
    description: "Highlighted info box",
    icon: createElement(Info, { className: "size-4" }),
    keywords: "callout note info tip box",
    group: "Callouts",
    run: callout("info"),
  },
  {
    title: "Warning",
    description: "Amber warning callout",
    icon: createElement(TriangleAlert, { className: "size-4" }),
    keywords: "warning warn caution callout amber",
    group: "Callouts",
    run: callout("warn"),
  },
  {
    title: "Success",
    description: "Green success callout",
    icon: createElement(CheckCircle2, { className: "size-4" }),
    keywords: "success done ok green callout",
    group: "Callouts",
    run: callout("success"),
  },
  {
    title: "Issue view",
    description: "Embed a live, filtered list of issues",
    icon: createElement(ListFilter, { className: "size-4" }),
    keywords: "issue view embed list linear tasks",
    group: "Embeds",
    run: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent({ type: "issueEmbed", attrs: { projectId: null, status: null } })
        .run(),
  },
];

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<Cmd>({
        editor: this.editor,
        pluginKey: new PluginKey("slashCommandSuggestion"),
        char: "/",
        startOfLine: false,
        command: ({ editor, range, props }) => props.run(editor, range),
        items: ({ query }) => {
          const q = query.toLowerCase();
          return COMMANDS.filter(
            (c) =>
              c.title.toLowerCase().includes(q) || c.keywords.includes(q),
          ).slice(0, 16);
        },
        render: () => {
          let component: ReactRenderer<
            { onKeyDown: (p: { event: KeyboardEvent }) => boolean }
          > | null = null;
          let el: HTMLDivElement | null = null;

          const position = (clientRect?: (() => DOMRect | null) | null) => {
            if (!el || !clientRect) return;
            const rect = clientRect();
            if (!rect) return;
            const margin = 8;
            const maxHeight = 300;
            const top =
              rect.bottom + maxHeight > window.innerHeight
                ? rect.top - maxHeight - margin
                : rect.bottom + margin;
            el.style.left = `${rect.left}px`;
            el.style.top = `${Math.max(margin, top)}px`;
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(CommandList, {
                editor: props.editor,
                props: {
                  items: props.items.map(
                    (cmd): CommandItem => ({
                      title: cmd.title,
                      description: cmd.description,
                      icon: cmd.icon,
                      group: cmd.group,
                      command: () => props.command(cmd),
                    }),
                  ),
                  command: (item: CommandItem) => item.command(),
                },
              });
              el = document.createElement("div");
              el.style.position = "fixed";
              el.style.zIndex = "50";
              el.appendChild(component.element);
              document.body.appendChild(el);
              position(props.clientRect);
            },
            onUpdate: (props) => {
              component?.updateProps({
                items: props.items.map(
                  (cmd): CommandItem => ({
                    title: cmd.title,
                    description: cmd.description,
                    icon: cmd.icon,
                    group: cmd.group,
                    command: () => props.command(cmd),
                  }),
                ),
                command: (item: CommandItem) => item.command(),
              });
              position(props.clientRect);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                el?.remove();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              el?.remove();
              el = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
