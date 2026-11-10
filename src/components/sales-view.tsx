"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { DealBoard } from "@/components/deal-board";
import { DealDialog } from "@/components/deal-dialog";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { moveDeals } from "@/lib/actions";
import { ChartCard, ColumnChart, type Slice } from "@/components/charts";
import { DEAL_STAGES, OPEN_DEAL_STAGES } from "@/lib/departments";
import { formatMoney } from "@/lib/matrix-format";
import type { DealWithRelations, Member, Project } from "@/lib/types";

/**
 * Sales for a product without a prospects sheet: the deal board, with the
 * pipeline's value by stage above it. Only Product and Engineering keep
 * tasks, so there is no tasks view here; an old `?tab=tasks` link lands on
 * the board like any other.
 */
export function SalesView({
  heading,
  scopeProjectId,
  projects,
  members,
  initialDeals,
}: {
  heading: string;
  scopeProjectId: string | null;
  projects: Project[];
  members: Member[];
  initialDeals: DealWithRelations[];
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

      <div className="flex min-h-0 flex-1 flex-col">
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
      </div>

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

function Empty({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
