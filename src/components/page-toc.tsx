"use client";

import type { Heading } from "@/lib/toc";
import { cn } from "@/lib/utils";

/** A floating table of contents that scrolls to the Nth heading in the editor. */
export function PageToc({ headings }: { headings: Heading[] }) {
  if (headings.length < 2) return null;

  function scrollTo(index: number) {
    const els = document.querySelectorAll<HTMLElement>(
      ".tiptap h1, .tiptap h2, .tiptap h3",
    );
    els[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className="fixed right-6 top-24 hidden w-48 xl:block">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        On this page
      </div>
      <div className="space-y-0.5 border-l">
        {headings.map((h, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            style={{ paddingLeft: `${(h.level - 1) * 10 + 10}px` }}
            className={cn(
              "block w-full truncate border-l-2 border-transparent py-0.5 text-left text-xs text-muted-foreground transition-colors hover:border-brand hover:text-foreground",
            )}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </div>
    </nav>
  );
}
