"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  CircleDot,
  Compass,
  Folder,
  LifeBuoy,
  Loader2,
  Megaphone,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/actions";
import { enabledDepartments, type DepartmentSlug } from "@/lib/departments";
import { formatMoney } from "@/lib/matrix-format";
import type { ProjectSummary, ProjectWithIssueCount } from "@/lib/types";

const DEPT_ICONS: Record<DepartmentSlug, React.ReactNode> = {
  engineering: <CircleDot className="size-3.5" />,
  sales: <TrendingUp className="size-3.5" />,
  marketing: <Megaphone className="size-3.5" />,
  finance: <Wallet className="size-3.5" />,
  support: <LifeBuoy className="size-3.5" />,
  features: <Compass className="size-3.5" />,
};

export function ProjectsView({
  projects,
  ops,
}: {
  projects: ProjectSummary[];
  ops: ProjectWithIssueCount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newProject() {
    startTransition(async () => {
      const p = await createProject({ name: "New project" });
      router.push(`/projects/${p.id}`);
      router.refresh();
    });
  }

  const empty = projects.length === 0 && ops.length === 0;

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Projects" }]}
        actions={
          <Button size="sm" className="h-7 gap-1.5" onClick={newProject} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New
            project
          </Button>
        }
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
          {empty ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
                <Folder className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No projects yet</p>
                <p className="text-xs text-muted-foreground">
                  Create a project to track work across its departments.
                </p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={newProject} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New
                project
              </Button>
            </div>
          ) : (
            <>
              {projects.length > 0 && (
                <section className="space-y-2">
                  <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Projects
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {projects.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border bg-background p-4 shadow-sm transition-colors hover:border-foreground/20"
                      >
                        <Link
                          href={`/projects/${p.id}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="font-semibold">{p.name}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {p.key}
                          </span>
                        </Link>
                        {p.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {p.description}
                          </p>
                        )}
                        <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                          <Stat value={String(p.openIssues)} label="Issues" />
                          <Stat value={formatMoney(p.pipelineValue)} label={`${p.openDeals} deals`} />
                          <Stat value={String(p.activeCampaigns)} label="Campaigns" />
                          <Stat value={formatMoney(p.revenue)} label="Revenue" />
                          <Stat value={String(p.openTickets)} label="Tickets" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {enabledDepartments(p.enabledDepartments).map((d) => (
                            <DeptLink
                              key={d.slug}
                              href={`/projects/${p.id}/${d.slug}`}
                              icon={DEPT_ICONS[d.slug]}
                              label={d.label}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {ops.length > 0 && (
                <section className="space-y-2">
                  <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Operations
                  </h2>
                  {ops.map((p) => {
                    const pct = p.issueCount ? Math.round((p.doneCount / p.issueCount) * 100) : 0;
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                      >
                        <span
                          className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                          style={{ backgroundColor: p.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{p.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
                          </div>
                          {p.description && (
                            <div className="truncate text-xs text-muted-foreground">
                              {p.description}
                            </div>
                          )}
                        </div>
                        <div className="flex w-32 shrink-0 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-16 text-right text-xs text-muted-foreground">
                            {p.doneCount}/{p.issueCount}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function DeptLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}
