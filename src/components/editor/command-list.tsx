"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type CommandItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
  group?: string;
  command: () => void;
};

export const CommandList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  { items: CommandItem[]; command: (item: CommandItem) => void }
>(function CommandList({ items, command }, ref) {
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

  if (!items.length) {
    return (
      <div className="rounded-lg border bg-popover p-2 text-xs text-muted-foreground shadow-md">
        No results
      </div>
    );
  }

  return (
    <div className="scrollbar-thin max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
      {items.map((item, i) => {
        const newGroup = item.group && (i === 0 || items[i - 1].group !== item.group);
        return (
          <div key={item.title}>
            {newGroup && (
              <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-1">
                {item.group}
              </div>
            )}
            <button
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              onMouseEnter={() => setSelected(i)}
              onClick={() => command(item)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                i === selected ? "bg-accent" : ""
              }`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});
