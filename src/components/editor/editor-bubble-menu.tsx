"use client";

import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currentBlockLabel, HIGHLIGHT_COLORS, TURN_INTO_OPTIONS } from "./turn-into";

const TEXT_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"];

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
      onMouseDown={(e) => e.preventDefault()}
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
  const [palette, setPalette] = useState<"none" | "color" | "highlight">("none");

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
      className="flex max-w-xl flex-wrap items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
    >
      {/* Turn into */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="flex h-7 items-center gap-1 rounded px-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            />
          }
        >
          {currentBlockLabel(editor)}
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {TURN_INTO_OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.key}
              onClick={() => o.run(editor)}
              className="gap-2 text-sm"
            >
              {o.icon}
              {o.label}
              {o.isActive(editor) && <Check className="ml-auto size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

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
      <Btn title="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="size-4" />
      </Btn>

      <Divider />

      {/* Alignment */}
      <Btn
        title="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().unsetTextAlign().run()}
      >
        <AlignLeft className="size-4" />
      </Btn>
      <Btn
        title="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="size-4" />
      </Btn>
      <Btn
        title="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="size-4" />
      </Btn>

      <Divider />

      {/* Text color palette toggle */}
      <Btn
        title="Text color"
        active={palette === "color"}
        onClick={() => setPalette((p) => (p === "color" ? "none" : "color"))}
      >
        <span className="text-xs font-semibold">A</span>
      </Btn>
      {/* Highlight palette toggle */}
      <Btn
        title="Highlight"
        active={palette === "highlight" || editor.isActive("highlight")}
        onClick={() => setPalette((p) => (p === "highlight" ? "none" : "highlight"))}
      >
        <Highlighter className="size-4" />
      </Btn>

      {palette === "color" && (
        <>
          <Divider />
          <Btn title="Default color" onClick={() => editor.chain().focus().unsetColor().run()}>
            <span className="text-xs font-semibold">A</span>
          </Btn>
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Text color ${c}`}
              aria-label={`Text color ${c}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setColor(c).run()}
              className="grid size-7 place-items-center rounded hover:bg-accent"
            >
              <span className="size-3.5 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: c }} />
            </button>
          ))}
        </>
      )}

      {palette === "highlight" && (
        <>
          <Divider />
          <Btn title="Remove highlight" onClick={() => editor.chain().focus().unsetHighlight().run()}>
            <span className="text-xs">✕</span>
          </Btn>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              title={`Highlight ${c.name}`}
              aria-label={`Highlight ${c.name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setHighlight({ color: c.value }).run()}
              className="grid size-7 place-items-center rounded hover:bg-accent"
            >
              <span
                className="size-3.5 rounded ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: c.value }}
              />
            </button>
          ))}
        </>
      )}

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
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
