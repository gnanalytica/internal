"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { TypeChip } from "@/components/pickers";
import { Topbar } from "@/components/topbar";
import { updateMilestone } from "@/lib/actions";
import { STATUS_MAP, type StatusId } from "@/lib/constants";
import { FEATURE_STATUSES } from "@/lib/departments";
import { issueIdentifier, type MilestoneDetail } from "@/lib/types";

const statusMeta = (s: string) => FEATURE_STATUSES.find((x) => x.id === s);
const toDateInput = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export function MilestoneDetailView({ milestone }: { milestone: MilestoneDetail }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [name, setName] = useState(milestone.name);
  const projectId = milestone.project?.id ?? milestone.projectId;

  const save = (patch: Parameters<typeof updateMilestone>[1]) =>
    start(async () => {
      await updateMilestone(milestone.id, patch);
      router.refresh();
    });

  const { done, total, pct } = milestone.progress;

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          { label: milestone.project?.name ?? "Project", href: `/projects/${projectId}/product` },
          { label: name },
        ]}
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const v = name.trim();
              if (v && v !== milestone.name) save({ name: v });
            }}
            className="w-full bg-transparent text-2xl font-bold outline-none"
            aria-label="Milestone name"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Target
              <input
                type="date"
                defaultValue={toDateInput(milestone.targetDate)}
                onChange={(e) => save({ targetDate: e.target.value || null })}
                className="rounded border bg-transparent px-1.5 py-1"
              />
            </label>
            <span className="text-xs text-muted-foreground">
              {milestone.featureCount} feature{milestone.featureCount === 1 ? "" : "s"}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {total > 0 ? `${done}/${total} tasks · ${pct}%` : "no tasks yet"}
            </span>
          </div>

          {/* Progress */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>

          {/* Description */}
          <textarea
            defaultValue={milestone.description ?? ""}
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (milestone.description ?? "")) save({ description: v || null });
            }}
            placeholder="Add a description for this milestone…"
            rows={2}
            className="mt-4 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand"
          />

          {/* Features in this milestone */}
          <h3 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Features
          </h3>
          {milestone.features.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No features assigned yet. Assign a feature to this milestone from its detail page.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {milestone.features.map((f, i) => {
                const sm = statusMeta(f.status);
                const fp = f.progress;
                return (
                  <Link
                    key={f.id}
                    href={`/projects/${projectId}/product/${f.id}`}
                    className={`press flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40 ${i > 0 ? "border-t" : ""}`}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: sm?.color ?? "#94a3b8" }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{sm?.label ?? f.status}</span>
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {fp.total > 0 ? `${fp.done}/${fp.total} · ${fp.pct}%` : "—"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Tasks attached directly to this milestone (no feature) */}
          {milestone.directIssues.length > 0 && (
            <>
              <h3 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tasks
              </h3>
              <div className="overflow-hidden rounded-xl border">
                {milestone.directIssues.map((it, i) => {
                  const sm = STATUS_MAP[it.status as StatusId];
                  return (
                    <Link
                      key={it.id}
                      href={`/issues/${it.id}`}
                      className={`press flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40 ${i > 0 ? "border-t" : ""}`}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: sm?.color ?? "#94a3b8" }}
                      />
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                        {issueIdentifier(it)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.title}</span>
                      {it.type !== "engineering" && <TypeChip type={it.type} />}
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {sm?.label ?? it.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
