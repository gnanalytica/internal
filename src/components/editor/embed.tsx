"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

/** Map a known provider URL to its iframe embed src + aspect ratio. */
function embedSrc(raw: string): { src: string; aspect: number } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  // YouTube
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    if (id) return { src: `https://www.youtube.com/embed/${id}`, aspect: 16 / 9 };
  }
  if (host.endsWith("youtube.com")) {
    const id = u.searchParams.get("v") || u.pathname.split("/").pop();
    if (id) return { src: `https://www.youtube.com/embed/${id}`, aspect: 16 / 9 };
  }
  // Vimeo
  if (host.endsWith("vimeo.com")) {
    const id = u.pathname.split("/").filter(Boolean).pop();
    if (id && /^\d+$/.test(id)) return { src: `https://player.vimeo.com/video/${id}`, aspect: 16 / 9 };
  }
  // Loom
  if (host.endsWith("loom.com")) {
    const id = u.pathname.split("/").pop();
    if (id) return { src: `https://www.loom.com/embed/${id}`, aspect: 16 / 9 };
  }
  // Figma
  if (host.endsWith("figma.com")) {
    return {
      src: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(raw)}`,
      aspect: 16 / 10,
    };
  }
  // Google Docs/Sheets/Slides
  if (host === "docs.google.com") {
    return { src: raw.replace(/\/edit.*$/, "/preview"), aspect: 4 / 3 };
  }
  // Google Drive files
  if (host === "drive.google.com") {
    const m = raw.match(/\/file\/d\/([^/]+)/);
    if (m) return { src: `https://drive.google.com/file/d/${m[1]}/preview`, aspect: 4 / 3 };
  }
  return null;
}

function EmbedView({ node }: NodeViewProps) {
  const url: string = node.attrs.url ?? "";
  const embed = embedSrc(url);

  return (
    <NodeViewWrapper className="my-2">
      <div contentEditable={false}>
        {embed ? (
          <div
            className="relative w-full overflow-hidden rounded-lg border bg-muted"
            style={{ aspectRatio: String(embed.aspect) }}
          >
            <iframe
              src={embed.src}
              className="absolute inset-0 size-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              title="Embed"
            />
          </div>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground no-underline hover:border-foreground/20"
          >
            Can&apos;t embed this link — open {url} ↗
          </a>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return { url: { default: null } };
  },

  parseHTML() {
    return [{ tag: "div[data-embed]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-embed": node.attrs.url ?? "" }),
      ["a", { href: node.attrs.url ?? "#" }, `${node.attrs.url ?? ""}`],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },
});
