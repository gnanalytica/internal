"use client";

import { useTransition } from "react";

import { PAGE_TEMPLATES, type PageTemplate } from "@/lib/page-templates";

/**
 * Template starters, offered on an empty page.
 *
 * Deliberately here rather than in a "new page" dialog: pages get created from
 * the sidebar, the Docs tab and the command palette, and a dialog would have to
 * be bolted onto all three. Meeting the user on the blank page catches every
 * route, and costs nothing when they'd rather just type — the strip disappears
 * the moment there is anything to lose.
 */
export function PageTemplateStrip({
  onPick,
}: {
  /** Applies the template's title and body to the current page. */
  onPick: (template: PageTemplate) => void | Promise<void>;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs text-muted-foreground">
        Start from a template, or just write.
      </p>
      <div className="flex flex-wrap gap-2">
        {PAGE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={pending}
            onClick={() => start(() => void onPick(t))}
            className="group/t flex max-w-64 items-start gap-2 rounded-lg border bg-background px-2.5 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-accent/40 disabled:opacity-60"
          >
            <span aria-hidden className="text-base leading-none">
              {t.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium">{t.name}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                {t.hint}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
