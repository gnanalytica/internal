"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { ListTree } from "lucide-react";
import { useEffect, useState } from "react";

type HeadingRef = { level: number; text: string; blockId: string | null };

function readHeadings(editor: NodeViewProps["editor"]): HeadingRef[] {
  const out: HeadingRef[] = [];
  editor.state.doc.forEach((node) => {
    if (node.type.name !== "heading") return;
    out.push({
      level: Number(node.attrs.level ?? 1),
      text: node.textContent,
      blockId: (node.attrs.blockId as string | null) ?? null,
    });
  });
  return out;
}

function TocView({ editor }: NodeViewProps) {
  const [headings, setHeadings] = useState<HeadingRef[]>(() => readHeadings(editor));

  useEffect(() => {
    const update = () => setHeadings(readHeadings(editor));
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const jump = (blockId: string | null) => {
    if (!blockId) return;
    const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("block-flash");
    setTimeout(() => el.classList.remove("block-flash"), 1600);
  };

  return (
    <NodeViewWrapper
      className="my-2 rounded-lg border bg-muted/30 px-3 py-2"
      data-type="toc"
      contentEditable={false}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ListTree className="size-3" /> Contents
      </div>
      {headings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add headings to build a table of contents.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {headings.map((h, i) => (
            <li key={i} style={{ paddingLeft: `${(h.level - 1) * 0.85}rem` }}>
              <button
                type="button"
                onClick={() => jump(h.blockId)}
                className="text-left text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {h.text || "Untitled"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </NodeViewWrapper>
  );
}

/** Atom block that renders a live table of contents from the page's headings. */
export const Toc = Node.create({
  name: "toc",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "toc" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocView);
  },
});
