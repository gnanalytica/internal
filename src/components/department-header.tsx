"use client";

import { TabIndicator } from "@/components/tab-indicator";
import { cn } from "@/lib/utils";

export type DepartmentTab<T extends string> = { id: T; label: string; count?: number };

/**
 * The tab row a department page opens with: its own views on the left (with
 * the sliding underline) and the page's actions on the right, primary action
 * last. Same shape as Sales, so every department reads the same way.
 */
export function DepartmentHeader<T extends string>({
  label,
  tabs,
  current,
  onChange,
  actions,
}: {
  /** What the views are, for screen readers ("Marketing views"). */
  label: string;
  tabs: DepartmentTab<T>[];
  current: T;
  onChange: (id: T) => void;
  actions?: React.ReactNode;
}) {
  return (
    <header className="shrink-0 border-b bg-background">
      <div className="flex items-center gap-1.5 pr-2 pl-1 sm:pr-4 sm:pl-2">
        <nav role="tablist" aria-label={label} className="no-scrollbar relative flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.id === current;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active ? "" : undefined}
                onClick={() => onChange(t.id)}
                className={cn("h-10 shrink-0 px-2.5 text-ui whitespace-nowrap transition-colors", active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {t.label}
                {t.count != null && <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{t.count.toLocaleString("en-IN")}</span>}
              </button>
            );
          })}
          <TabIndicator activeKey={current} />
        </nav>
        {actions}
      </div>
    </header>
  );
}
