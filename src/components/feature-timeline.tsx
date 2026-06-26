"use client";

import Link from "next/link";

import { FEATURE_STATUSES } from "@/lib/departments";
import { barMetrics, computeRange, quartersForRange, todayOffset } from "@/lib/roadmap";
import type { FeatureWithRelations } from "@/lib/types";

const NAME_W = 220; // px, left label column
const statusColor = (s: string) =>
  FEATURE_STATUSES.find((x) => x.id === s)?.color ?? "#94a3b8";

export function FeatureTimeline({
  features,
  nowISO,
  groupByProduct = false,
}: {
  features: FeatureWithRelations[];
  nowISO: string;
  groupByProduct?: boolean;
}) {
  const now = new Date(nowISO);
  const scheduled = features.filter((f) => f.startDate || f.targetDate);
  const unscheduled = features.filter((f) => !f.startDate && !f.targetDate);
  const range = computeRange(scheduled, now);
  const quarters = quartersForRange(range);
  const todayFrac = todayOffset(range, now);

  const groups = groupByProduct
    ? [...new Map(features.map((f) => [f.product?.id ?? "none", f.product])).values()].map(
        (prod) => ({
          key: prod?.id ?? "none",
          name: prod?.name ?? "No product",
          color: prod?.color ?? "#94a3b8",
          items: scheduled.filter((f) => (f.product?.id ?? "none") === (prod?.id ?? "none")),
        }),
      )
    : [{ key: "all", name: "", color: "", items: scheduled }];

  const href = (f: FeatureWithRelations) =>
    f.product ? `/products/${f.product.id}/features/${f.id}` : `/features`;

  return (
    <div className="scrollbar-thin h-full overflow-auto">
      <div className="relative min-w-full">
        {/* Quarter header */}
        <div className="sticky top-0 z-10 flex border-b bg-background/95 backdrop-blur">
          <div
            className="shrink-0 px-4 py-2 text-xs font-semibold text-muted-foreground"
            style={{ width: NAME_W }}
          >
            Feature
          </div>
          <div className="relative h-8 flex-1">
            {quarters.map((q, i) => (
              <div
                key={i}
                className="absolute top-0 border-l px-2 py-2 text-[11px] font-medium text-muted-foreground"
                style={{ left: `${q.leftPct}%`, width: `${q.widthPct}%` }}
              >
                {q.label}
              </div>
            ))}
          </div>
        </div>

        {todayFrac !== null && (
          <div
            className="pointer-events-none absolute bottom-0 top-8 z-0 w-px bg-brand/50"
            style={{ left: `calc(${NAME_W}px + ${todayFrac} * (100% - ${NAME_W}px))` }}
          />
        )}

        {groups.map((g) => (
          <div key={g.key}>
            {groupByProduct && (
              <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="text-xs font-semibold">{g.name}</span>
                <span className="text-xs text-muted-foreground">{g.items.length}</span>
              </div>
            )}
            {g.items.map((f) => {
              const bar = barMetrics(f, range);
              return (
                <div key={f.id} className="flex items-center border-b hover:bg-accent/30">
                  <div className="shrink-0 px-4 py-2" style={{ width: NAME_W }}>
                    <Link href={href(f)} className="truncate text-sm hover:underline">
                      {f.title}
                    </Link>
                  </div>
                  <div className="relative h-9 flex-1">
                    {bar && (
                      <Link
                        href={href(f)}
                        className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm hover:opacity-90"
                        style={{
                          left: `${bar.leftPct}%`,
                          width: `${bar.widthPct}%`,
                          backgroundColor: statusColor(f.status),
                        }}
                        title={f.title}
                      >
                        <span className="truncate">{f.title}</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {unscheduled.length > 0 && (
          <div className="border-t">
            <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">
              Unscheduled
            </div>
            {unscheduled.map((f) => (
              <Link
                key={f.id}
                href={href(f)}
                className="flex items-center gap-2 border-b px-4 py-2 text-sm hover:bg-accent/30"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: statusColor(f.status) }}
                />
                <span className="truncate">{f.title}</span>
                <span className="text-xs text-muted-foreground">set start &amp; target dates</span>
              </Link>
            ))}
          </div>
        )}

        {features.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            No features yet. Create one to start the roadmap.
          </div>
        )}
      </div>
    </div>
  );
}
