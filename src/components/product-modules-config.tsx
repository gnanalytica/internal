"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setProductDepartments } from "@/lib/actions";
import { ALL_DEPARTMENT_SLUGS, DEPARTMENTS } from "@/lib/departments";
import { cn } from "@/lib/utils";

/**
 * Per-product module toggles. Engineering is always available (it's the issues
 * module); the rest can be turned off for a product. All-on is stored as null,
 * preserving the auto-spawn default.
 */
export function ProductModulesConfig({
  productId,
  enabled,
}: {
  productId: string;
  enabled: string[] | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isOn = (slug: string) => enabled == null || enabled.includes(slug);

  function toggle(slug: string, on: boolean) {
    const current = enabled == null ? [...ALL_DEPARTMENT_SLUGS] : [...enabled];
    const next = on
      ? Array.from(new Set([...current, slug]))
      : current.filter((s) => s !== slug);
    start(async () => {
      await setProductDepartments(productId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Modules
      </span>
      {DEPARTMENTS.map((d) => {
        const on = isOn(d.slug);
        return (
          <button
            key={d.slug}
            type="button"
            disabled={pending}
            onClick={() => toggle(d.slug, !on)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors disabled:opacity-50",
              on
                ? "border-transparent bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
            title={on ? `Disable ${d.label}` : `Enable ${d.label}`}
          >
            <span>{d.icon}</span>
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
