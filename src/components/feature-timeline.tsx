"use client";

import { RoadmapChart, type GanttGroup } from "@/components/roadmap-chart";
import { FEATURE_STATUSES } from "@/lib/departments";
import type { FeatureWithRelations } from "@/lib/types";

const statusMeta = (s: string) => FEATURE_STATUSES.find((x) => x.id === s);

function metaLine(f: FeatureWithRelations): string {
  const status = statusMeta(f.status)?.label ?? f.status;
  if (f.progress.total > 0) return `${status} · ${f.progress.done}/${f.progress.total} issues`;
  return status;
}

export function FeatureTimeline({
  features,
  nowISO,
  groupByProduct = false,
}: {
  features: FeatureWithRelations[];
  nowISO: string;
  groupByProduct?: boolean;
}) {
  const toItem = (f: FeatureWithRelations) => ({
    id: f.id,
    title: f.title,
    href: f.product ? `/products/${f.product.id}/features/${f.id}` : `/features`,
    startDate: f.startDate,
    targetDate: f.targetDate,
    color: statusMeta(f.status)?.color ?? "#94a3b8",
    progress: f.progress.total > 0 ? f.progress.pct : undefined,
    statusLabel: statusMeta(f.status)?.label,
    meta: metaLine(f),
  });

  const groups: GanttGroup[] = groupByProduct
    ? [...new Map(features.map((f) => [f.product?.id ?? "none", f.product])).values()].map(
        (prod) => ({
          key: prod?.id ?? "none",
          name: prod?.name ?? "No product",
          color: prod?.color ?? "#94a3b8",
          items: features
            .filter((f) => (f.product?.id ?? "none") === (prod?.id ?? "none"))
            .map(toItem),
        }),
      )
    : [{ key: "all", name: "", color: "", items: features.map(toItem) }];

  return (
    <RoadmapChart
      groups={groups}
      nowISO={nowISO}
      scale="quarter"
      labelHeader="Feature"
      showGroupHeaders={groupByProduct}
      legend={
        <>
          <span className="font-medium uppercase tracking-wide">Status</span>
          {FEATURE_STATUSES.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </>
      }
    />
  );
}
