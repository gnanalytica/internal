"use client";

import type { Editor } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { Bookmark as BookmarkIcon, Link2, SquarePlay } from "lucide-react";
import { toast } from "sonner";

import { uploadEditorImage } from "@/lib/actions";
import type { MentionItem } from "@/lib/types";
import { BlockBackground } from "./block-background";
import { BlockId } from "./block-id";
import { BlockShortcuts } from "./block-shortcuts";
import { Bookmark } from "./bookmark";
import { Callout } from "./callout";
import { CodeBlock } from "./code-block";
import { Column, ColumnBlock, DocWithColumns } from "./columns";
import { EditorDragHandle } from "./drag-handle";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { EditorContextMenu } from "./editor-context-menu";
import { EmojiSuggestion } from "./emoji-suggestion";
import { Embed } from "./embed";
import { EntityRef } from "./mention";
import { HeadingFold } from "./heading-fold";
import { ResizableImage } from "./image-view";
import { Indent } from "./indent";
import { IssueEmbed } from "./issue-embed";
import { SlashCommand } from "./slash-command";
import { Toc } from "./toc";
import { cn } from "@/lib/utils";

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function RichEditor({
  content,
  editable = true,
  placeholder = "Type '/' for commands…",
  onChange,
  onStats,
  className,
  mentionItems,
}: {
  content?: JSONContent | null;
  editable?: boolean;
  placeholder?: string;
  onChange?: (json: JSONContent) => void;
  /** Called (debounced) with document stats, e.g. for a word-count footer. */
  onStats?: (stats: { words: number }) => void;
  className?: string;
  mentionItems?: MentionItem[];
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStatsRef = useRef(onStats);
  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);
  // Post-paste "render as" chooser for a bare URL.
  const [linkChooser, setLinkChooser] = useState<
    { url: string; from: number; to: number; top: number; left: number } | null
  >(null);
  // Hover gutter for block-level copy-link.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [blockHover, setBlockHover] = useState<{ id: string; top: number } | null>(null);
  const editorRef = useRef<Editor | null>(null);
  // Read the latest items at suggestion time without recreating the editor.
  const itemsRef = useRef<MentionItem[]>(mentionItems ?? []);
  useEffect(() => {
    itemsRef.current = mentionItems ?? [];
  }, [mentionItems]);

  async function uploadAndInsert(files: FileList | File[]) {
    const ed = editorRef.current;
    if (!ed) return;
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    for (const file of images) {
      const fd = new FormData();
      fd.append("file", file);
      const id = toast.loading("Uploading image…");
      try {
        const url = await uploadEditorImage(fd);
        ed.chain().focus().setImage({ src: url }).run();
        toast.success("Image added", { id });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed", { id });
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        document: false,
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ResizableImage.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading";
          if (node.type.name === "detailsSummary") return "Toggle title";
          return placeholder;
        },
        includeChildren: true,
      }),
      SlashCommand,
      Indent,
      BlockBackground,
      BlockShortcuts,
      HeadingFold,
      Details.configure({ persist: true, HTMLAttributes: { class: "details" } }),
      DetailsSummary,
      DetailsContent,
      DocWithColumns,
      ColumnBlock,
      Column,
      Toc,
      EmojiSuggestion,
      CodeBlock,
      Callout,
      IssueEmbed,
      Bookmark,
      Embed,
      BlockId,
      // The ref's stable identity bridges live mention data into ProseMirror;
      // the extension only reads it inside suggestion callbacks, never in render.
      // eslint-disable-next-line react-hooks/refs
      EntityRef.configure({ itemsRef }),
    ],
    content: content ?? undefined,
    editorProps: {
      attributes: {
        class: cn("tiptap focus:outline-none", className),
      },
      handlePaste: (view, event) => {
        const files = event.clipboardData?.files;
        if (files && files.length && [...files].some((f) => f.type.startsWith("image/"))) {
          void uploadAndInsert(files);
          return true;
        }
        // Pasting a bare URL onto an empty selection: insert an inline link and
        // offer to render it as a bookmark/embed instead.
        const text = event.clipboardData?.getData("text/plain")?.trim();
        const sel = view.state.selection;
        if (text && sel.empty && /^https?:\/\/\S+$/i.test(text)) {
          const ed = editorRef.current;
          if (!ed) return false;
          const from = sel.from;
          ed.chain()
            .focus()
            .insertContent([
              { type: "text", text, marks: [{ type: "link", attrs: { href: text } }] },
              { type: "text", text: " " },
            ])
            .run();
          const coords = view.coordsAtPos(from);
          setLinkChooser({ url: text, from, to: from + text.length + 1, top: coords.bottom, left: coords.left });
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        if (files && files.length && [...files].some((f) => f.type.startsWith("image/"))) {
          event.preventDefault();
          void uploadAndInsert(files);
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor }) => {
      onStatsRef.current?.({ words: countWords(editor.state.doc.textContent) });
    },
    onUpdate: ({ editor }) => {
      if (onStatsRef.current) {
        if (statsTimer.current) clearTimeout(statsTimer.current);
        statsTimer.current = setTimeout(() => {
          onStatsRef.current?.({ words: countWords(editor.state.doc.textContent) });
        }, 300);
      }
      if (!onChange) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onChange(editor.getJSON()), 600);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Keep editable in sync if it changes.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (statsTimer.current) clearTimeout(statsTimer.current);
    };
  }, []);

  const convert = (kind: "bookmark" | "embed") => {
    const ed = editorRef.current;
    if (!ed || !linkChooser) return;
    ed.chain()
      .focus()
      .deleteRange({ from: linkChooser.from, to: linkChooser.to })
      .insertContent({ type: kind, attrs: { url: linkChooser.url } })
      .run();
    setLinkChooser(null);
  };

  // On open, if the URL targets a block (#b-<id>), scroll to it and flash it.
  useEffect(() => {
    if (!editor) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#b-")) return;
    const id = hash.slice(3);
    const t = setTimeout(() => {
      const el = wrapRef.current?.querySelector<HTMLElement>(`[data-block-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("block-flash");
      setTimeout(() => el.classList.remove("block-flash"), 1600);
    }, 300);
    return () => clearTimeout(t);
  }, [editor]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseMove={(e) => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const block = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-block-id]");
        if (!block || !wrap.contains(block)) return;
        const id = block.getAttribute("data-block-id");
        if (!id) return;
        const top = block.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
        setBlockHover((prev) =>
          prev?.id === id && Math.abs(prev.top - top) < 1 ? prev : { id, top },
        );
      }}
      onMouseLeave={() => setBlockHover(null)}
    >
      {editor && editable && <EditorBubbleMenu editor={editor} />}
      {editor && editable && <EditorDragHandle editor={editor} />}
      {blockHover && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(
              `${window.location.origin}${window.location.pathname}#b-${blockHover.id}`,
            );
            toast.success("Block link copied");
          }}
          className="absolute -left-7 z-10 grid size-6 place-items-center rounded text-muted-foreground opacity-70 hover:bg-accent hover:text-foreground hover:opacity-100"
          style={{ top: blockHover.top }}
          aria-label="Copy link to block"
          title="Copy link to this block"
        >
          <Link2 className="size-3.5" />
        </button>
      )}
      {editor ? (
        <EditorContextMenu editor={editor} editable={editable}>
          <EditorContent editor={editor} />
        </EditorContextMenu>
      ) : (
        <EditorContent editor={editor} />
      )}
      {linkChooser && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLinkChooser(null)} />
          <div
            className="fixed z-50 flex items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ top: linkChooser.top + 6, left: linkChooser.left }}
          >
            <span className="px-1.5 text-[11px] text-muted-foreground">Paste as</span>
            <button
              onClick={() => setLinkChooser(null)}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-accent"
            >
              <Link2 className="size-3.5" /> Link
            </button>
            <button
              onClick={() => convert("bookmark")}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-accent"
            >
              <BookmarkIcon className="size-3.5" /> Bookmark
            </button>
            <button
              onClick={() => convert("embed")}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-accent"
            >
              <SquarePlay className="size-3.5" /> Embed
            </button>
          </div>
        </>
      )}
    </div>
  );
}
