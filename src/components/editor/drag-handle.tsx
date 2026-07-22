"use client";

import type { Editor } from "@tiptap/core";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { GripVertical } from "lucide-react";
import { useRef } from "react";

/**
 * Notion-style ⋮⋮ grip: drag to reorder blocks; click opens the block menu
 * (the existing right-click context menu, dispatched at the hovered block).
 */
export function EditorDragHandle({ editor }: { editor: Editor }) {
  const lastPos = useRef<number>(0);

  return (
    <DragHandle
      editor={editor}
      className="editor-drag-handle"
      onNodeChange={({ pos }) => {
        if (pos >= 0) lastPos.current = pos;
      }}
    >
      <button
        type="button"
        aria-label="Drag to move, click for block menu"
        title="Drag to move, click for menu"
        className="grid size-6 cursor-grab place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
        onClick={(e) => {
          // Put the caret in the hovered block, then open the context menu
          // where the grip is so the block actions apply to it.
          const dom = editor.view.nodeDOM(lastPos.current);
          const target = dom instanceof HTMLElement ? dom : editor.view.dom;
          editor.chain().focus().setTextSelection(lastPos.current + 1).run();
          target.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              clientX: e.clientX + 24,
              clientY: e.clientY,
            }),
          );
        }}
      >
        <GripVertical className="size-4" />
      </button>
    </DragHandle>
  );
}
