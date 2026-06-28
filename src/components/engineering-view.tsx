"use client";

import { CyclesView } from "@/components/cycles-view";
import { IssuesView } from "@/components/issues-view";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CycleWithCount,
  IssueWithRelations,
  Label,
  Member,
  Project,
  SavedView,
} from "@/lib/types";

/**
 * A project's Engineering surface: Tasks (the board) + Cycles (this project's
 * sprints). Planning and daily standups happen per project, so cycles live
 * here; the company-wide "Weekly" is a separate rollup.
 */
export function EngineeringView({
  heading,
  projectId,
  issues,
  projects,
  members,
  labels,
  savedViews,
  cycles,
}: {
  heading: string;
  projectId: string;
  issues: IssueWithRelations[];
  projects: Project[];
  members: Member[];
  labels: Label[];
  savedViews: SavedView[];
  cycles: CycleWithCount[];
}) {
  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: heading }]} />
      <Tabs defaultValue="issues" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="issues">Tasks</TabsTrigger>
          <TabsTrigger value="cycles">
            Cycles{cycles.length > 0 ? ` · ${cycles.length}` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="issues" className="min-h-0 flex-1 overflow-hidden">
          <IssuesView
            initialIssues={issues}
            projects={projects}
            members={members}
            labels={labels}
            heading={heading}
            defaultProjectId={projectId}
            savedViews={savedViews}
            embedded
          />
        </TabsContent>
        <TabsContent value="cycles" className="min-h-0 flex-1 overflow-hidden">
          <CyclesView cycles={cycles} projectId={projectId} embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
