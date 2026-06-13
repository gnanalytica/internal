import Link from "next/link";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string; icon?: React.ReactNode };

export function Topbar({
  breadcrumb,
  actions,
  className,
}: {
  breadcrumb: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 border-b px-4",
        className,
      )}
    >
      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        {breadcrumb.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            {c.href ? (
              <Link
                href={c.href}
                className="flex items-center gap-1.5 truncate text-muted-foreground hover:text-foreground"
              >
                {c.icon}
                {c.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "flex items-center gap-1.5 truncate",
                  i === breadcrumb.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {c.icon}
                {c.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1.5">{actions}</div>
    </header>
  );
}
