import Link from "next/link";

import { cn } from "@/lib/utils";

export type DepartmentStat = {
  href: string;
  icon: React.ReactNode;
  label: string;
  /** The headline number, read first. */
  value: string;
  /** What the number counts ("open tickets"). */
  unit: string;
  /** A second, smaller fact, when the department has one. */
  extra?: string;
};

/**
 * A project's departments as one strip: each cell a number first, what it
 * counts under it, and the department it opens. Replaces a grid of cards that
 * spelled every figure out as a sentence.
 */
export function DepartmentStrip({ stats }: { stats: DepartmentStat[] }) {
  if (stats.length === 0) return null;
  return (
    <nav
      aria-label="Departments"
      className={cn(
        "grid overflow-hidden rounded-lg border",
        "grid-cols-2 sm:grid-cols-3",
        stats.length >= 6 ? "xl:grid-cols-6" : stats.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4",
      )}
    >
      {stats.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="group -mt-px -ml-px flex flex-col gap-2 border-t border-l px-4 py-3.5 transition-colors hover:bg-muted/60"
        >
          <span className="flex items-center gap-1.5 text-ui text-muted-foreground group-hover:text-foreground">
            {s.icon}
            {s.label}
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{s.value}</span>
            <span className="truncate text-xs text-muted-foreground">{s.unit}</span>
          </span>
          {s.extra && <span className="-mt-1 truncate text-xs text-muted-foreground">{s.extra}</span>}
        </Link>
      ))}
    </nav>
  );
}
