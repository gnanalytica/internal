"use client";

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

import { EMOJIS } from "./emoji-suggestion";

// A hand-picked starter grid; the filter input searches the full dataset.
const CURATED = [
  "💡", "📌", "⚠️", "🚨", "✅", "❌", "❓", "❗",
  "📝", "📚", "🔍", "🔑", "🎯", "🚀", "🔥", "⭐",
  "💰", "📈", "📉", "🧠", "💬", "👀", "🛠️", "🐛",
  "⏰", "📅", "🗂️", "✨", "🎉", "🙏", "👍", "🤝",
  "🧪", "🔒", "🌱", "🏆", "💪", "🧭", "🗺️", "📣",
  "🍀", "☕", "🧊", "🌈", "🔔", "🪄", "🧩", "🏗️",
];

function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const results = q
    ? EMOJIS.filter(
        (e) =>
          e.name.includes(q) ||
          e.shortcodes.some((s) => s.includes(q)) ||
          e.tags.some((t) => t.includes(q)),
      )
        .slice(0, 48)
        .map((e) => e.emoji)
    : CURATED;

  return (
    <div
      ref={ref}
      contentEditable={false}
      className="absolute left-0 top-8 z-30 w-64 rounded-lg border bg-popover p-2 shadow-md"
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search emoji…"
        className="mb-2 h-7 w-full rounded border bg-background px-2 text-xs focus:outline-none"
      />
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
        {results.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => onPick(emoji)}
            className="grid size-7 place-items-center rounded text-base hover:bg-accent"
          >
            {emoji}
          </button>
        ))}
        {results.length === 0 && (
          <p className="col-span-8 py-2 text-center text-xs text-muted-foreground">
            No matches
          </p>
        )}
      </div>
    </div>
  );
}

export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const emoji = (node.attrs.emoji as string) || "💡";

  return (
    <NodeViewWrapper
      className="callout callout-view"
      data-variant={node.attrs.variant as string}
      data-callout=""
    >
      <div className="relative" contentEditable={false}>
        <button
          type="button"
          disabled={!editor.isEditable}
          onClick={() => setOpen((o) => !o)}
          className="grid size-6 place-items-center rounded text-base leading-none hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Change callout emoji"
          title="Change emoji"
        >
          {emoji}
        </button>
        {open && (
          <EmojiPicker
            onPick={(e) => {
              updateAttributes({ emoji: e });
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
      <NodeViewContent className="callout-content" />
    </NodeViewWrapper>
  );
}
