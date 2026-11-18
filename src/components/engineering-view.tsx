"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { CyclesView, useNewCycle } from "@/components/cycles-view";
import { DepartmentHeader } from "@/components/department-header";
import { IssuesView } from "@/components/issues-view";
import { Button } from "@/components/ui/button";
import type { CycleCadence } from "@/lib/cycle-cadence";
import type { CycleWithCount, IssueListItem, TaskContext } from "@/lib/types";

const TABS = ["tasks", "cycles"] as const;
type Tab = (typeof TABS)[number];

const engineeringTabFrom = (v: string | undefined): Tab => ((TABS as readonly string[]).includes(v ?? "") ? (v as Tab) : "tasks");

/**
 * A project's Engineering surface: the build board (Tasks) and the project's
 * sprints (Cycles). The tab lives in the URL (?tab=cycles) so either view can
 * be shared as a link; `/projects/[id]/cycles` lands on the Cycles tab.
 */
export function EngineeringView({
  heading,
  projectId,
  issues,
  ctx,
  cycles,
  cadence,
  outstandingPoints,
  nowISO,
  initialTab,
}: {
  heading: string;
  projectId: string;
  issues: IssueListItem[];
  ctx: TaskContext;
  cycles: CycleWithCount[];
  cadence: CycleCadence | null;
  /** Open points on this project, for the velocity projection. */
  outstandingPoints: number;
  /** Server-rendered "now", so velocity doesn't shift between server and client. */
  nowISO: string;
  initialTab?: string;
}) {
  const [tab, setTabState] = useState<Tab>(engineeringTabFrom(initialTab));
  const { newCycle, pending: creating } = useNewCycle(projectId);

  const setTab = (t: Tab) => {
    setTabState(t);
    // Mirror the tab into the URL without a server round trip.
    const next = new URLSearchParams(window.location.search);
    if (t === "tasks") next.delete("tab");
    else next.set("tab", t);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  return (
    <div className="flex h-full flex-col">
      <DepartmentHeader
        label="Engineering views"
        tabs={[
          { id: "tasks", label: "Tasks", count: issues.length },
          { id: "cycles", label: "Cycles", count: cycles.length },
        ]}
        current={tab}
        onChange={setTab}
        actions={
          tab === "cycles" ? (
            <Button size="sm" className="h-8 shrink-0 max-sm:px-2.5" onClick={newCycle} disabled={creating}>
              <Plus /> New<span className="max-sm:hidden">&nbsp;cycle</span>
            </Button>
          ) : undefined
        }
      />
      <div key={tab} className="animate-enter min-h-0 flex-1">
        {tab === "tasks" ? (
          <IssuesView
            initialIssues={issues}
            projects={ctx.projects}
            members={ctx.members}
            labels={ctx.labels}
            heading={heading}
            defaultProjectId={projectId}
            savedViews={ctx.savedViews}
            cycles={ctx.cycles}
            milestones={ctx.milestones}
            blockedIds={ctx.blockedIds}
            embedded
          />
        ) : (
          <CyclesView cycles={cycles} projectId={projectId} cadence={cadence} outstandingPoints={outstandingPoints} nowISO={nowISO} hideCreate />
        )}
      </div>
    </div>
  );
}
