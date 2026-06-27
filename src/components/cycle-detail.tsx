"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { MoreHorizontal, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StatusIcon } from "@/components/glyphs";
import { IssueRow } from "@/components/issue-row";
import { Topbar } from "@/components/topbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { deleteCycle, updateCycle } from "@/lib/actions";
import { STATUSES } from "@/lib/constants";
import type { Cycle, IssueWithRelations, Member } from "@/lib/types";
import { cycleStatus } from "@/lib/types";

export function CycleDetail({
  cycle,
  members,
}: {
  cycle: Cycle & { issues: IssueWithRelations[] };
  members: Member[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(cycle.name);
  const now = new Date();

  const persist = (patch: Parameters<typeof updateCycle>[1]) =>
    startTransition(async () => {
      await updateCycle(cycle.id, patch);
      router.refresh();
    });
  const toInputDate = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");
  const status = cycleStatus(cycle, now);
  const done = cycle.issues.filter((i) => i.status === "done").length;
  const pct = cycle.issues.length ? Math.round((done / cycle.issues.length) * 100) : 0;

  const grouped = STATUSES.map((s) => ({
    status: s,
    items: cycle.issues.filter((i) => i.status === s.id),
  })).filter((g) => g.items.length > 0);

  function onDelete() {
    startTransition(async () => {
      await deleteCycle(cycle.id);
      toast.success("Cycle deleted");
      router.push("/weekly");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Cycles", href: "/cycles" }, { label: cycle.name }]}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-7" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Delete cycle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Timer className="size-5 shrink-0 text-muted-foreground" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim() || cycle.name;
              if (trimmed !== cycle.name) persist({ name: trimmed });
            }}
            className="min-w-0 flex-1 rounded-md bg-transparent text-lg font-semibold focus:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring/40"
            aria-label="Cycle name"
          />
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
            {status}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="date"
            defaultValue={toInputDate(cycle.startDate)}
            onChange={(e) => e.target.value && persist({ startDate: e.target.value })}
            className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
            aria-label="Start date"
          />
          <span>–</span>
          <input
            type="date"
            defaultValue={toInputDate(cycle.endDate)}
            onChange={(e) => e.target.value && persist({ endDate: e.target.value })}
            className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
            aria-label="End date"
          />
        </div>
        <div className="mt-3 flex max-w-md items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {done}/{cycle.issues.length} done
          </span>
        </div>
      </div>

      {/* Issues */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {cycle.issues.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <p className="text-sm font-medium">No issues in this cycle</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Add issues by opening an issue and setting its <strong>Cycle</strong> property.
            </p>
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.status.id}>
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-muted/60 px-6 py-1.5 backdrop-blur">
                <StatusIcon status={g.status.id} />
                <span className="text-xs font-semibold">{g.status.label}</span>
                <span className="text-xs text-muted-foreground">{g.items.length}</span>
              </div>
              {g.items.map((issue) => (
                <IssueRow key={issue.id} issue={issue} members={members} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
