"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { enabledDepartments } from "@/lib/departments";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

/** Tab strip shown at the top of every product's department pages. */
export function ProductTabs({ product }: { product: Project }) {
  const pathname = usePathname();
  const base = `/products/${product.id}`;
  const tabs = [
    { href: base, label: "Overview" },
    ...enabledDepartments(product.enabledDepartments).map((d) => ({
      href: `${base}/${d.slug}`,
      label: d.label,
    })),
  ];
  return (
    <div className="flex items-center gap-1 border-b px-4 pt-2.5">
      <div className="mr-3 flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ backgroundColor: product.color }} />
        <span className="text-sm font-semibold">{product.name}</span>
      </div>
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-brand font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
