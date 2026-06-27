"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Target } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { updateCompanyBets } from "@/lib/actions";
import type { PortfolioHealth, PortfolioRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTH: Record<PortfolioHealth, { label: string; cls: string }> = {
  on_track: { label: "On track", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  at_risk: { label: "At risk", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  off_track: { label: "Off track", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
  none: { label: "No update", cls: "bg-muted text-muted-foreground" },
};

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

function HealthBadge({ health }: { health: PortfolioHealth }) {
  const h = HEALTH[health];
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", h.cls)}>
      {h.label}
    </span>
  );
}

export function PortfolioView({
  rows,
  bets,
  isAdmin,
}: {
  rows: PortfolioRow[];
  bets: string[];
  isAdmin: boolean;
}) {
  const projects = rows.filter((r) => r.kind === "project");
  const operations = rows.filter((r) => r.kind === "operation");

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Overview" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
        <BetsStrip bets={bets} isAdmin={isAdmin} />

        <SectionHeading>Projects</SectionHeading>
        {projects.length === 0 ? (
          <Empty>No projects yet.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} row={p} />
            ))}
          </div>
        )}

        <SectionHeading className="mt-6">Operations</SectionHeading>
        {operations.length === 0 ? (
          <Empty>No operations yet.</Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            {operations.map((o, i) => (
              <Link
                key={o.id}
                href={`/projects/${o.id}`}
                className={cn(
                  "press flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40",
                  i > 0 && "border-t",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />
                <span className="text-sm font-medium">{o.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{o.key}</span>
                <span className="ml-auto text-xs text-muted-foreground">{o.ownerName ?? "—"}</span>
                <HealthBadge health={o.health} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ row }: { row: PortfolioRow }) {
  const pct = row.totalIssues > 0 ? Math.round((row.doneIssues / row.totalIssues) * 100) : 0;
  const target = fmtDate(row.milestoneTarget);
  return (
    <Link
      href={`/projects/${row.id}`}
      className="glow hover-lift flex flex-col gap-2.5 rounded-xl border bg-background p-4 shadow-sm hover:border-foreground/20"
    >
      <div className="flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
        <span className="truncate font-medium">{row.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{row.key}</span>
        <HealthBadge health={row.health} />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Target className="size-3.5 shrink-0 text-brand" />
        {row.milestoneName ? (
          <span className="truncate">
            {row.milestoneName}
            {target ? <span className="text-muted-foreground/70"> · {target}</span> : null}
          </span>
        ) : (
          <span className="italic">No milestone set</span>
        )}
      </div>

      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{row.ownerName ?? "Unassigned"}</span>
          <span className="tabular-nums">
            {row.totalIssues > 0 ? `${row.doneIssues}/${row.totalIssues} · ${pct}%` : "no issues"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function BetsStrip({ bets, isAdmin }: { bets: string[]; isAdmin: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [vals, setVals] = useState<string[]>([bets[0] ?? "", bets[1] ?? "", bets[2] ?? ""]);

  function save(next: string[]) {
    start(async () => {
      await updateCompanyBets(next);
      router.refresh();
    });
  }

  // Read-only for non-admins: show only the bets that exist.
  if (!isAdmin) {
    const set = bets.filter(Boolean);
    if (set.length === 0) return null;
    return (
      <div className="mb-5">
        <SectionHeading>Focus this quarter</SectionHeading>
        <div className="flex flex-wrap gap-2">
          {set.map((b, i) => (
            <span key={i} className="rounded-lg border bg-background px-3 py-1.5 text-sm">
              {b}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <SectionHeading>Focus this quarter</SectionHeading>
      <div className="grid gap-2 sm:grid-cols-3">
        {vals.map((v, i) => (
          <input
            key={i}
            value={v}
            onChange={(e) => setVals((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
            onBlur={() => save(vals)}
            placeholder={`Bet ${i + 1}…`}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
