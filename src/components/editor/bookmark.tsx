"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useState } from "react";

import { getLinkPreview } from "@/lib/actions";

/**
 * A Notion-style bookmark card for a URL. Stores the fetched OG metadata in the
 * node attrs; if the title is empty it lazily fetches a preview on mount.
 */
function BookmarkView({ node, updateAttributes }: NodeViewProps) {
  const url: string = node.attrs.url ?? "";
  const { title, description, image, favicon, domain } = node.attrs as {
    title: string;
    description: string;
    image: string | null;
    favicon: string | null;
    domain: string;
  };
  const [loading, setLoading] = useState(!title);

  useEffect(() => {
    if (title || !url) return;
    let cancelled = false;
    getLinkPreview(url)
      .then((p) => {
        if (cancelled) return;
        updateAttributes({
          title: p.title,
          description: p.description,
          image: p.image,
          favicon: p.favicon,
          domain: p.domain,
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url, title, updateAttributes]);

  return (
    <NodeViewWrapper className="my-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        contentEditable={false}
        className="glow hover-lift flex overflow-hidden rounded-lg border bg-background no-underline"
      >
        <div className="min-w-0 flex-1 p-3">
          <div className="truncate text-sm font-medium text-foreground">
            {title || (loading ? "Loading preview…" : domain || url)}
          </div>
          {description && (
            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {favicon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={favicon} alt="" className="size-3.5 rounded-sm" />
            )}
            <span className="truncate">{domain || url}</span>
          </div>
        </div>
        {image && (
          <div
            className="hidden w-36 shrink-0 bg-muted bg-cover bg-center sm:block"
            style={{ backgroundImage: `url("${image}")` }}
          />
        )}
      </a>
    </NodeViewWrapper>
  );
}

export const Bookmark = Node.create({
  name: "bookmark",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: null },
      title: { default: "" },
      description: { default: "" },
      image: { default: null },
      favicon: { default: null },
      domain: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-bookmark]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-bookmark": node.attrs.url ?? "" }),
      ["a", { href: node.attrs.url ?? "#" }, `${node.attrs.title || node.attrs.url || ""}`],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView);
  },
});
