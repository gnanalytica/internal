"use client";

import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

import type { MentionItem } from "@/lib/types";
import { Callout } from "./callout";
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
  // Read the latest items at suggestion time without recreating the editor.
  const itemsRef = useRef<MentionItem[]>(mentionItems ?? []);
  useEffect(() => {
    itemsRef.current = mentionItems ?? [];
  }, [mentionItems]);

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
    },
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onChange(editor.getJSON()), 600);
    },
  });

  // Keep editable in sync if it changes.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return <EditorContent editor={editor} />;
}
