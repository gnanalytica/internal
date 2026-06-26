"use client";

import type { Editor } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { uploadEditorImage } from "@/lib/actions";
import type { MentionItem } from "@/lib/types";
import { Callout } from "./callout";
import { EditorBubbleMenu } from "./editor-bubble-menu";
import { EntityRef } from "./mention";
import { IssueEmbed } from "./issue-embed";
import { SlashCommand } from "./slash-command";
import { cn } from "@/lib/utils";

export function RichEditor({
  content,
  editable = true,
  placeholder = "Type '/' for commands…",
  onChange,
  className,
  mentionItems,
}: {
  content?: JSONContent | null;
  editable?: boolean;
  placeholder?: string;
  onChange?: (json: JSONContent) => void;
  className?: string;
  mentionItems?: MentionItem[];
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading" : placeholder,
        includeChildren: true,
      }),
      SlashCommand,
      Callout,
      IssueEmbed,
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
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (files && files.length && [...files].some((f) => f.type.startsWith("image/"))) {
          void uploadAndInsert(files);
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
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onChange(editor.getJSON()), 600);
    },
  });

  editorRef.current = editor;

  // Keep editable in sync if it changes.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <>
      {editor && editable && <EditorBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
}
