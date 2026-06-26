"use client";

import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";

const TEXT_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"];
const HIGHLIGHT = "#fef08a";

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={
        "grid size-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground " +
        (active ? "bg-accent text-foreground" : "")
      }
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-border" />;

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const inTable = editor.isActive("table");

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) => {
        if (!ed.isEditable) return false;
        if (ed.isActive("codeBlock")) return false;
        if (ed.isActive("image")) return false;
        if (ed.isActive("table")) return true;
        return !ed.state.selection.empty;
      }}
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
    >
      <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </Btn>
      <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </Btn>
      <Btn
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </Btn>
      <Btn
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </Btn>
      <Btn title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="size-4" />
      </Btn>
      <Btn
        title="Highlight"
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight({ color: HIGHLIGHT }).run()}
      >
        <Highlighter className="size-4" />
      </Btn>
      <Btn title="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="size-4" />
      </Btn>

      <Divider />

      {/* Text color swatches */}
      <button
        type="button"
        title="Default color"
        aria-label="Default color"
        onClick={() => editor.chain().focus().unsetColor().run()}
        className="grid size-7 place-items-center rounded text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        A
      </button>
      {TEXT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={`Color ${c}`}
          aria-label={`Text color ${c}`}
          onClick={() => editor.chain().focus().setColor(c).run()}
          className="grid size-7 place-items-center rounded hover:bg-accent"
        >
          <span className="size-3.5 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: c }} />
        </button>
      ))}

      {inTable && (
        <>
          <Divider />
          <TableBtn onClick={() => editor.chain().focus().addRowAfter().run()}>+Row</TableBtn>
          <TableBtn onClick={() => editor.chain().focus().addColumnAfter().run()}>+Col</TableBtn>
          <TableBtn onClick={() => editor.chain().focus().deleteRow().run()}>−Row</TableBtn>
          <TableBtn onClick={() => editor.chain().focus().deleteColumn().run()}>−Col</TableBtn>
          <TableBtn onClick={() => editor.chain().focus().deleteTable().run()}>Delete</TableBtn>
        </>
      )}
    </BubbleMenu>
  );
}

function TableBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
