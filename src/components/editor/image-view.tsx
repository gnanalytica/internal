"use client";

import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { useState } from "react";

const MIN_WIDTH = 120;

function ImageView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  // Live width while dragging a handle; attr is committed on pointerup.
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const width = dragWidth ?? (node.attrs.width as number | null);
  const align = (node.attrs.align as string) ?? "center";
  const caption = (node.attrs.caption as string) ?? "";
  const editable = editor.isEditable;
  const showChrome = editable && selected;

  const startResize = (side: "left" | "right") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Walk the DOM from the handle itself so render never touches a ref.
    const frame = (e.currentTarget as HTMLElement).closest(".image-view-frame");
    const img = frame?.querySelector("img");
    const container = frame?.parentElement?.parentElement;
    if (!img || !container) return;
    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const maxWidth = container.getBoundingClientRect().width;
    let next = startWidth;

    const onMove = (ev: PointerEvent) => {
      // Dragging the left handle outward also grows the image.
      const delta = side === "right" ? ev.clientX - startX : startX - ev.clientX;
      next = Math.round(Math.max(MIN_WIDTH, Math.min(maxWidth, startWidth + delta)));
      setDragWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragWidth(null);
      updateAttributes({ width: next });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper className="image-view" data-align={align}>
      <div
        className={"image-view-frame relative inline-block" + (selected && editable ? " ring-2 ring-[var(--brand)]" : "")}
        contentEditable={false}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={node.attrs.src as string}
          alt={caption}
          style={width ? { width } : undefined}
          className="rounded"
          draggable={false}
        />
        {showChrome && (
          <>
            <span
              onPointerDown={startResize("left")}
              className="image-resize-handle absolute left-1 top-1/2 -translate-y-1/2 cursor-ew-resize"
            />
            <span
              onPointerDown={startResize("right")}
              className="image-resize-handle absolute right-1 top-1/2 -translate-y-1/2 cursor-ew-resize"
            />
            <div className="absolute -top-9 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md">
              {(
                [
                  ["left", AlignLeft],
                  ["center", AlignCenter],
                  ["right", AlignRight],
                ] as const
              ).map(([a, Icon]) => (
                <button
                  key={a}
                  type="button"
                  title={`Align ${a}`}
                  aria-label={`Align ${a}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateAttributes({ align: a })}
                  className={
                    "grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" +
                    (align === a ? " bg-accent text-foreground" : "")
                  }
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {(editable || caption) && (
        <input
          value={caption}
          readOnly={!editable}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          placeholder="Add a caption…"
          contentEditable={false}
          className="image-caption mt-1 w-full bg-transparent text-center text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          style={width ? { maxWidth: width, marginInline: "auto" } : undefined}
        />
      )}
    </NodeViewWrapper>
  );
}

/** Image with Notion-style resize, caption, and alignment. */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute("data-width");
          return w ? Number(w) : null;
        },
        renderHTML: (attrs) => (attrs.width ? { "data-width": attrs.width } : {}),
      },
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") || "",
        renderHTML: (attrs) => (attrs.caption ? { "data-caption": attrs.caption } : {}),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
