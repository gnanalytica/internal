"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { DealBoard } from "@/components/deal-board";
import { DealDialog } from "@/components/deal-dialog";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { ScrollTabsList } from "@/components/responsive";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { moveDeals } from "@/lib/actions";
import { DepartmentTasks } from "@/components/department-tasks";
import { ChartCard, ColumnChart, type Slice } from "@/components/charts";
import { DEAL_STAGES, OPEN_DEAL_STAGES } from "@/lib/departments";
import { formatMoney } from "@/lib/matrix-format";
import type {
  IssueWithRelations,
  DealWithRelations,
  Member,
  Project,
  TaskContext,
} from "@/lib/types";

export function SalesView({
  heading,
  scopeProjectId,
  ctx,
  projects,
  members,
  initialDeals,
  issues,
}: {
  heading: string;
  scopeProjectId: string | null;
  projects: Project[];
  members: Member[];
  initialDeals: DealWithRelations[];
  issues: IssueWithRelations[];
  ctx: TaskContext;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealWithRelations | null>(null);
  const openValue = initialDeals
    .filter((d) => OPEN_DEAL_STAGES.includes(d.stage as (typeof OPEN_DEAL_STAGES)[number]))
    .reduce((sum, d) => sum + (d.value ?? 0), 0);
  const wonValue = initialDeals
    .filter((d) => d.stage === "won")
    .reduce((s, d) => s + (d.value ?? 0), 0);
  const stageValue: Slice[] = DEAL_STAGES.map((s) => ({
    label: s.label,
    value: initialDeals
      .filter((d) => d.stage === s.id)
      .reduce((sum, d) => sum + (d.value ?? 0), 0),
    color: s.color,
  }));
  // Remount the board when the set of deals changes (create/delete) so server
  // refreshes flow in; drag (which doesn't change the id-set) keeps board state.
  const boardKey = initialDeals.map((d) => d.id).join(",");

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openDeal(d: DealWithRelations) {
    setEditing(d);
    setDialogOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <>
            <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
              Open {formatMoney(openValue)} · Won {formatMoney(wonValue)}
            </span>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="size-4" /> New deal
            </Button>
          </>
        }
      />

      <Tabs
        defaultValue="tasks"
        className="flex min-h-0 flex-1 flex-col"
      >
        <ScrollTabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline{count(initialDeals.length)}</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="tasks" className="min-h-0 flex-1 overflow-hidden">
          <DepartmentTasks
            issues={issues}
            department="sales"
            ctx={ctx}
            projectId={scopeProjectId}
            emptyLabel="No sales tasks yet."
          />
        </TabsContent>

        <TabsContent value="pipeline" className="flex min-h-0 flex-1 flex-col">
          {initialDeals.length === 0 ? (
            <Empty label="No deals yet. Create your first deal to start the pipeline." />
          ) : (
            <>
              <div className="px-3 pt-3 sm:px-4">
                <ChartCard title="Pipeline by stage" hint={`${initialDeals.length} deals`}>
                  <ColumnChart data={stageValue} format={(n) => formatMoney(n)} />
                </ChartCard>
              </div>
              <div className="min-h-0 flex-1">
                <DealBoard
                  key={boardKey}
                  deals={initialDeals}
                  showProject={!scopeProjectId}
                  persist={(changed) => startTransition(() => void moveDeals(changed))}
                  onOpen={openDeal}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deal={editing}
        projects={projects}
        members={members}
        scopeProjectId={scopeProjectId}
        onSaved={() => router.refresh()}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

/** Row count beside a tab label, so an empty tab is visibly empty from outside it. */
function count(n: number) {
  if (!n) return null;
  return <span className="ml-1.5 text-[11px] tabular-nums opacity-60">{n}</span>;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
