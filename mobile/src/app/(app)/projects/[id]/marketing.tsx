import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";

import { MarketingWorkspace, marketingTabFrom, type MarketingTab } from "@/features/business/marketing/workspace";
import { DeptScaffold } from "@/features/business/scaffold";
import { projectQuery } from "@/features/projects/api";
import { PROSPECTS_PRODUCT_KEY } from "@/features/projects/departments";

/**
 * A project's Marketing, as on the web: it plans by content piece — the
 * Calendar (the week, pace against plan, overdue pieces, ideas and channels)
 * and All pieces. Campaigns and marketing tasks are not part of it any more;
 * `?tab=pieces` and `?piece=<id>` links open where the web's would.
 */
export default function MarketingScreen() {
  const { id, tab, piece } = useLocalSearchParams<{ id: string; tab?: string; piece?: string }>();
  const [segment, setSegment] = useState<MarketingTab>(() => marketingTabFrom(tab));
  const p = useQuery(projectQuery(id)).data;
  // Leads from marketing land in Sales: Valytica's prospects list, or the deal board elsewhere.
  const salesHref: Href | null = p?.visibleDepartments.some((d) => d.slug === "sales")
    ? { pathname: "/projects/[id]/sales", params: p.key === PROSPECTS_PRODUCT_KEY ? { id, tab: "list" } : { id } }
    : null;
  return (
    <DeptScaffold
      title="Marketing"
      projectId={id}
      value={segment}
      onChange={setSegment}
      segments={[
        { value: "calendar", label: "Calendar" },
        { value: "pieces", label: "All pieces" },
      ]}
    >
      <MarketingWorkspace projectId={id} tab={segment} initialPiece={piece} salesHref={salesHref} />
    </DeptScaffold>
  );
}
