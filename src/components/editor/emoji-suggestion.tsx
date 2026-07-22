"use client";

import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { gitHubEmojis } from "@tiptap/extension-emoji";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type EmojiEntry = { name: string; emoji: string; shortcodes: string[]; tags: string[] };

// Only entries with a real unicode char (skips custom-image emojis).
const EMOJIS: EmojiEntry[] = (
  gitHubEmojis as { name: string; emoji?: string; shortcodes: string[]; tags: string[] }[]
)
  .filter((e): e is EmojiEntry => Boolean(e.emoji))
  .map((e) => ({ name: e.name, emoji: e.emoji, shortcodes: e.shortcodes, tags: e.tags }));

const EmojiList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  { items: EmojiEntry[]; command: (item: EmojiEntry) => void }
>(function EmojiList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => setSelected(0), [items]);
  useEffect(() => {
    itemRefs.current[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selected]) command(items[selected]);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div className="scrollbar-thin max-h-64 w-56 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
      {items.map((item, i) => (
        <button
          key={item.name}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          onMouseEnter={() => setSelected(i)}
          onClick={() => command(item)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${
            i === selected ? "bg-accent" : ""
          }`}
        >
          <span className="text-base leading-none">{item.emoji}</span>
          <span className="truncate text-xs text-muted-foreground">:{item.shortcodes[0]}:</span>
        </button>
      ))}
    </div>
  );
});

/** `:` suggestion popup that inserts plain unicode emoji text. */
export const EmojiSuggestion = Extension.create({
  name: "emojiSuggestion",

  addProseMirrorPlugins() {
    return [
      Suggestion<EmojiEntry>({
        editor: this.editor,
        pluginKey: new PluginKey("emojiSuggestion"),
        char: ":",
        startOfLine: false,
        command: ({ editor, range, props }) =>
          editor.chain().focus().deleteRange(range).insertContent(`${props.emoji} `).run(),
        items: ({ query }) => {
          const q = query.toLowerCase();
          if (q.length < 2) return [];
          return EMOJIS.filter(
            (e) =>
              e.name.toLowerCase().includes(q) ||
              e.shortcodes.some((s) => s.includes(q)) ||
              e.tags.some((t) => t.includes(q)),
          ).slice(0, 10);
        },
        render: () => {
          let component: ReactRenderer<
            { onKeyDown: (p: { event: KeyboardEvent }) => boolean }
          > | null = null;
          let el: HTMLDivElement | null = null;

          const position = (clientRect?: (() => DOMRect | null) | null) => {
            if (!el || !clientRect) return;
            const rect = clientRect();
            if (!rect) return;
            const margin = 8;
            const maxHeight = 260;
            const top =
              rect.bottom + maxHeight > window.innerHeight
                ? rect.top - maxHeight - margin
                : rect.bottom + margin;
            el.style.left = `${rect.left}px`;
            el.style.top = `${Math.max(margin, top)}px`;
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(EmojiList, {
                editor: props.editor,
                props: {
                  items: props.items,
                  command: (item: EmojiEntry) => props.command(item),
                },
              });
              el = document.createElement("div");
              el.style.position = "fixed";
              el.style.zIndex = "50";
              el.appendChild(component.element);
              document.body.appendChild(el);
              position(props.clientRect);
            },
            onUpdate: (props) => {
              component?.updateProps({
                items: props.items,
                command: (item: EmojiEntry) => props.command(item),
              });
              position(props.clientRect);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                el?.remove();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              el?.remove();
              el = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
