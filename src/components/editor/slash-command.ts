"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import {
  Bookmark,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Code,
  Columns2,
  Columns3,
  CopyPlus,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  List,
  ListFilter,
  ListTree,
  ListOrdered,
  Minus,
  Quote,
  Smile,
  SquarePlay,
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

const columns = (count: 2 | 3) => (e: Editor, r: Range) =>
  e
    .chain()
    .focus()
    .deleteRange(r)
    .insertContent({
      type: "columnBlock",
      content: Array.from({ length: count }, () => ({
        type: "column",
        content: [{ type: "paragraph" }],
      })),
    })
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
    title: "Date",
    description: "Insert today's date",
    icon: createElement(CalendarDays, { className: "size-4" }),
    keywords: "date today calendar timestamp",
    group: "Basic",
    run: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent(
          `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} `,
        )
        .run(),
  },
  {
    title: "Emoji",
    description: "Search and insert an emoji",
    icon: createElement(Smile, { className: "size-4" }),
    keywords: "emoji smiley reaction icon",
    group: "Basic",
    run: (e, r) => e.chain().focus().deleteRange(r).insertContent(":").run(),
  },
  {
    title: "Duplicate block",
    description: "Copy the current block below",
    icon: createElement(CopyPlus, { className: "size-4" }),
    keywords: "duplicate copy clone repeat block",
    group: "Basic",
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      const { $from } = e.state.selection;
      if ($from.depth < 1) return;
      const node = $from.node(1);
      const json = node.toJSON() as { attrs?: Record<string, unknown> };
      json.attrs = { ...json.attrs, blockId: null };
      e.chain().insertContentAt($from.after(1), json).run();
    },
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
    title: "Table of contents",
    description: "Live index of this page's headings",
    icon: createElement(ListTree, { className: "size-4" }),
    keywords: "toc table of contents outline index headings",
    group: "Blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: "toc" }).run(),
  },
  {
    title: "Columns (2)",
    description: "Two columns side by side",
    icon: createElement(Columns2, { className: "size-4" }),
    keywords: "columns two layout side",
    group: "Blocks",
    run: columns(2),
  },
  {
    title: "Columns (3)",
    description: "Three columns side by side",
    icon: createElement(Columns3, { className: "size-4" }),
    keywords: "columns three layout side",
    group: "Blocks",
    run: columns(3),
  },
  {
    title: "Toggle",
    description: "Collapsible block with a summary",
    icon: createElement(ChevronRight, { className: "size-4" }),
    keywords: "toggle collapse details expand accordion",
    group: "Blocks",
    run: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent({
          type: "details",
          content: [
            { type: "detailsSummary" },
            { type: "detailsContent", content: [{ type: "paragraph" }] },
          ],
        })
        .run(),
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
    title: "Task view",
    description: "Embed a live, filtered list of tasks",
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
  {
    title: "Bookmark",
    description: "Visual card for a link",
    icon: createElement(Bookmark, { className: "size-4" }),
    keywords: "bookmark link card url preview",
    group: "Embeds",
    run: (e, r) => {
      const url = window.prompt("Paste a URL to bookmark")?.trim();
      if (!url) return e.chain().focus().deleteRange(r).run();
      return e.chain().focus().deleteRange(r).insertContent({ type: "bookmark", attrs: { url } }).run();
    },
  },
  {
    title: "Embed",
    description: "Embed a video, Figma, doc…",
    icon: createElement(SquarePlay, { className: "size-4" }),
    keywords: "embed iframe video youtube figma loom",
    group: "Embeds",
    run: (e, r) => {
      const url = window.prompt("Paste a URL to embed")?.trim();
      if (!url) return e.chain().focus().deleteRange(r).run();
      return e.chain().focus().deleteRange(r).insertContent({ type: "embed", attrs: { url } }).run();
    },
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
