"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { CircleDot, FileText, Folder } from "lucide-react";
import { createElement } from "react";

import { entityHref, type RefKind } from "@/lib/references";
import type { MentionItem } from "@/lib/types";
import { CommandList, type CommandItem } from "./command-list";

type Options = { itemsRef: { current: MentionItem[] } };

function kindIcon(kind: RefKind): React.ReactNode {
  const props = { className: "size-4 text-muted-foreground" };
  if (kind === "issue") return createElement(CircleDot, props);
  if (kind === "page") return createElement(FileText, props);
  return createElement(Folder, props);
}

/**
 * Inline atom node that references another entity (issue/page/project). Rendered
 * as a styled link; stored in the document JSON with { kind, id, label } attrs
 * so the reference graph can be extracted server-side.
 */
export const EntityRef = Node.create<Options>({
  name: "entityRef",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return { itemsRef: { current: [] } };
  },

  addAttributes() {
    return {
      kind: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-entity-ref"),
        renderHTML: (attrs) => ({ "data-entity-ref": attrs.kind }),
      },
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
      label: {
        default: "",
        parseHTML: (el) => el.textContent,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-entity-ref]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.kind as RefKind;
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: kind ? entityHref(kind, node.attrs.id) : "#",
        class: "entity-ref",
      }),
      `${node.attrs.label}`,
    ];
  },

  renderText({ node }) {
    return node.attrs.label as string;
  },

  addProseMirrorPlugins() {
    const itemsRef = this.options.itemsRef;
    const getItems = () => itemsRef.current;
    return [
      Suggestion<MentionItem>({
        editor: this.editor,
        pluginKey: new PluginKey("entityRefSuggestion"),
        char: "@",
        allowSpaces: true,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "entityRef",
                attrs: { kind: props.kind, id: props.id, label: props.label },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
        items: ({ query }) => {
          const q = query.toLowerCase();
          return getItems()
            .filter(
              (it) =>
                it.label.toLowerCase().includes(q) ||
                (it.hint ?? "").toLowerCase().includes(q),
            )
            .slice(0, 8);
        },
        render: () => {
          let component: ReactRenderer<{
            onKeyDown: (p: { event: KeyboardEvent }) => boolean;
          }> | null = null;
          let el: HTMLDivElement | null = null;

          const toCommandItems = (
            items: MentionItem[],
            command: (i: MentionItem) => void,
          ): CommandItem[] =>
            items.map((it) => ({
              title: it.label || "Untitled",
              description: it.hint ?? it.kind,
              icon: kindIcon(it.kind),
              command: () => command(it),
            }));

          const place = (clientRect?: (() => DOMRect | null) | null) => {
            if (!el || !clientRect) return;
            const rect = clientRect();
            if (!rect) return;
            const margin = 8;
            const maxHeight = 300;
            const top =
              rect.bottom + maxHeight > window.innerHeight
                ? rect.top - maxHeight - margin
                : rect.bottom + margin;
            el.style.left = `${rect.left}px`;
            el.style.top = `${Math.max(margin, top)}px`;
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(CommandList, {
                editor: props.editor,
                props: {
                  items: toCommandItems(props.items, (i) => props.command(i)),
                  command: (item: CommandItem) => item.command(),
                },
              });
              el = document.createElement("div");
              el.style.position = "fixed";
              el.style.zIndex = "50";
              el.appendChild(component.element);
              document.body.appendChild(el);
              place(props.clientRect);
            },
            onUpdate: (props) => {
              component?.updateProps({
                items: toCommandItems(props.items, (i) => props.command(i)),
                command: (item: CommandItem) => item.command(),
              });
              place(props.clientRect);
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
