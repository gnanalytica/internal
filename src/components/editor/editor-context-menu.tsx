"use client";

import type { Editor } from "@tiptap/core";
import {
  Bold,
  ClipboardPaste,
  Code,
  Copy,
  CopyPlus,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Link2,
  MessageSquarePlus,
  Scissors,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { BLOCK_BG_COLORS } from "./block-background";
import { TURN_INTO_OPTIONS } from "./turn-into";

/** Right-click menu for the editor: formatting, turn-into, block actions,
 * and clipboard. Renders children bare when not editable so the browser's
 * native menu (spellcheck etc.) stays available in read-only views. */
export function EditorContextMenu({
  editor,
  editable,
  children,
}: {
  editor: Editor;
  editable: boolean;
  children: React.ReactNode;
}) {
  // Before the menu opens, make sure the selection covers the click target:
  // an empty or elsewhere selection moves to the clicked position.
  const captureSelection = (e: React.MouseEvent) => {
    const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (!pos) return;
    const { from, to, empty } = editor.state.selection;
    if (empty || pos.pos < from || pos.pos > to) {
      editor.chain().setTextSelection(pos.pos).run();
    }
  };

  const topBlock = () => {
    const { $from } = editor.state.selection;
    if ($from.depth < 1) return null;
    return { node: $from.node(1), from: $from.before(1), to: $from.after(1) };
  };

  const duplicateBlock = () => {
    const b = topBlock();
    if (!b) return;
    const json = b.node.toJSON() as { attrs?: Record<string, unknown> };
    json.attrs = { ...json.attrs, blockId: null };
    editor.chain().focus().insertContentAt(b.to, json).run();
  };

  const deleteBlock = () => {
    const b = topBlock();
    if (!b) return;
    editor.chain().focus().deleteRange({ from: b.from, to: b.to }).run();
  };

  const copyBlockLink = () => {
    const b = topBlock();
    const blockId = b?.node.attrs.blockId as string | null | undefined;
    if (!blockId) {
      toast.error("No link for this block yet — type something in it first");
      return;
    }
    void navigator.clipboard?.writeText(
      `${window.location.origin}${window.location.pathname}#b-${blockId}`,
    );
    toast.success("Block link copied");
  };

  // Ask the surrounding page to open a comment thread anchored to this block.
  // Decoupled via a DOM event so the editor stays agnostic of comments
  // (the event has no listener inside issue views, where it's a no-op).
  const commentOnBlock = () => {
    const b = topBlock();
    const blockId = (b?.node.attrs.blockId as string | null | undefined) ?? null;
    if (!blockId) {
      toast.error("Type something in this block first, then comment");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("page:comment", { detail: { blockId } }),
    );
  };

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const clipboard = (action: "cut" | "copy") => {
    // execCommand needs the editor focused and runs on the current selection.
    editor.chain().focus().run();
    setTimeout(() => document.execCommand(action), 0);
  };

  const paste = () => {
    void navigator.clipboard
      ?.readText()
      .then((text) => {
        if (text) editor.chain().focus().insertContent(text).run();
      })
      .catch(() => toast.error("Clipboard unavailable — use Cmd/Ctrl+V"));
  };

  if (!editable) return <>{children}</>;

  return (
    <ContextMenu>
      <ContextMenuTrigger onContextMenuCapture={captureSelection}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem className="gap-2" onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" /> Bold
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" /> Italic
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-4" /> Underline
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="size-4" /> Strikethrough
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code className="size-4" /> Inline code
        </ContextMenuItem>
        <ContextMenuItem
          className="gap-2"
          onClick={() => editor.chain().focus().toggleHighlight({ color: "var(--hl-yellow)" }).run()}
        >
          <Highlighter className="size-4" /> Highlight
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={setLink}>
          <LinkIcon className="size-4" /> Link…
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>Turn into</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {TURN_INTO_OPTIONS.map((o) => (
              <ContextMenuItem key={o.key} className="gap-2" onClick={() => o.run(editor)}>
                {o.icon}
                {o.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Color</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            <ContextMenuItem
              className="gap-2"
              onClick={() => editor.chain().focus().setBlockBackground(null).run()}
            >
              <span className="size-4 rounded-sm border" /> Default
            </ContextMenuItem>
            {BLOCK_BG_COLORS.map((c) => (
              <ContextMenuItem
                key={c.name}
                className="gap-2"
                onClick={() => editor.chain().focus().setBlockBackground(c.name).run()}
              >
                <span
                  className="size-4 rounded-sm ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: `var(--bg-block-${c.name})` }}
                />
                {c.label} background
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem className="gap-2" onClick={duplicateBlock}>
          <CopyPlus className="size-4" /> Duplicate block
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={copyBlockLink}>
          <Link2 className="size-4" /> Copy link to block
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={commentOnBlock}>
          <MessageSquarePlus className="size-4" /> Comment
        </ContextMenuItem>
        <ContextMenuItem className="gap-2 text-destructive" onClick={deleteBlock}>
          <Trash2 className="size-4" /> Delete block
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem className="gap-2" onClick={() => clipboard("cut")}>
          <Scissors className="size-4" /> Cut
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => clipboard("copy")}>
          <Copy className="size-4" /> Copy
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={paste}>
          <ClipboardPaste className="size-4" /> Paste
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
