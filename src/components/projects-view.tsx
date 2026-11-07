"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BarChart3,
  CircleDot,
  Compass,
  FileText,
  Folder,
  LifeBuoy,
  ListChecks,
  Loader2,
  Lock,
  Megaphone,
  Plus,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { HEALTH_META } from "@/components/my-work-view";
import { RoadmapView } from "@/components/roadmap-view";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { WeeklyView } from "@/components/weekly-view";
import { createProject, updateCompanyBets } from "@/lib/actions";
import type { RoadmapProject } from "@/lib/data";
import { enabledDepartments, isConfidentialDepartment, type DepartmentSlug } from "@/lib/departments";
import type { CycleWithCount, PortfolioHealth, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEPT_ICONS: Record<DepartmentSlug, React.ReactNode> = {
  product: <Compass className="size-3.5" />,
  engineering: <CircleDot className="size-3.5" />,
  analytics: <BarChart3 className="size-3.5" />,
  marketing: <Megaphone className="size-3.5" />,
  sales: <TrendingUp className="size-3.5" />,
  "customer-success": <LifeBuoy className="size-3.5" />,
  finance: <Wallet className="size-3.5" />,
  strategy: <Target className="size-3.5" />,
};

export type ProjectsTab = "list" | "timeline" | "week";

const TABS: { id: ProjectsTab; label: string }[] = [
  { id: "list", label: "All projects" },
  { id: "timeline", label: "Timeline" },
  { id: "week", label: "This week" },
];

/** One line of the unified projects table — a product or a back-office area. */
export type ProjectTableRow = {
  id: string;
  name: string;
  key: string;
  color: string;
  kind: "project" | "operation";
  description: string | null;
  confidential: boolean;
  enabledDepartments: string[] | null;
  health: PortfolioHealth;
  lead: { name: string; avatarColor: string } | null;
  milestone: { name: string; target: string | null } | null;
  done: number;
  total: number;
  open: number;
};

const fmtTarget = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(
        new Date(iso),
      )
    : null;

/**
 * Every project in one place. "All projects" is the portfolio: the company's
 * focus, a health summary that doubles as a filter, then one table — products
 * first, back office after — with the same columns for both. The timeline and
 * this week's cycle rollup are the other two lenses on the same set.
 */
export function ProjectsView({
  rows,
  bets,
  isAdmin,
  roadmapProjects,
  weeklyProjects,
  cycles,
  nowISO,
  initialTab = "list",
}: {
  rows: ProjectTableRow[];
  bets: string[];
  isAdmin: boolean;
  roadmapProjects: RoadmapProject[];
  weeklyProjects: Project[];
  cycles: CycleWithCount[];
  nowISO: string;
  /** The tab to open on — `?tab=timeline` and `?tab=week` link straight to those. */
  initialTab?: ProjectsTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<ProjectsTab>(initialTab);
  const [health, setHealth] = useState<PortfolioHealth | null>(null);

  function newProject() {
    startTransition(async () => {
      const p = await createProject({ name: "New project" });
      router.push(`/projects/${p.id}`);
      router.refresh();
    });
  }

  // The tab lives in the URL, so a link or a reload lands on the same lens.
  function switchTab(next: ProjectsTab) {
    setTab(next);
    router.replace(next === "list" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  }

  const counts = (["on_track", "at_risk", "off_track", "none"] as const).map((h) => ({
    id: h,
    n: rows.filter((r) => r.health === h).length,
  }));
  const shown = health ? rows.filter((r) => r.health === health) : rows;
  const products = shown.filter((r) => r.kind === "project");
  const operations = shown.filter((r) => r.kind === "operation");

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Projects", icon: <Folder className="size-3.5" /> }]}
        actions={
          <Button size="sm" className="h-7 gap-1.5" onClick={newProject} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New project
          </Button>
        }
      />
      <nav
        role="tablist"
        aria-label="Project views"
        className="no-scrollbar flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b px-3 sm:px-4"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => switchTab(t.id)}
            className={cn(
              "relative h-10 shrink-0 px-2 text-ui whitespace-nowrap transition-colors",
              tab === t.id
                ? "font-medium text-foreground after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "list" && (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-20 text-center">
                <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Folder className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">No projects yet</p>
                  <p className="mt-0.5 text-ui text-muted-foreground">
                    A project holds a product&apos;s work across its departments.
                  </p>
                </div>
                <Button size="sm" className="gap-1.5" onClick={newProject} disabled={pending}>
                  <Plus className="size-4" /> New project
                </Button>
              </div>
            ) : (
              <>
                <FocusCard bets={bets} isAdmin={isAdmin} />

                <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by health">
                  <span className="mr-1 text-ui text-muted-foreground">Health</span>
                  {counts.map(({ id, n }) => {
                    const h = HEALTH_META[id];
                    const on = health === id;
                    return (
                      <button
                        key={id}
                        aria-pressed={on}
                        disabled={n === 0 && !on}
                        onClick={() => setHealth(on ? null : id)}
                        className={cn(
                          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-ui transition-colors disabled:opacity-50",
                          on ? "border-brand/40 bg-selected" : "enabled:hover:bg-muted/60",
                        )}
                      >
                        <span className={cn("size-2 rounded-full", h.dot)} />
                        {h.label}
                        <span className="tabular-nums text-muted-foreground">{n}</span>
                      </button>
                    );
                  })}
                  {health && (
                    <button
                      onClick={() => setHealth(null)}
                      className="h-7 rounded-md px-2 text-ui text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    >
                      Show all
                    </button>
                  )}
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="hidden h-8 items-center gap-4 border-b bg-surface px-4 text-xs text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.6fr)_104px_minmax(170px,1fr)_124px_minmax(0,1fr)_auto]">
                    <span>Name</span>
                    <span>Health</span>
                    <span>Progress</span>
                    <span>Lead</span>
                    <span>Milestone</span>
                    <span className="w-[164px] text-right" aria-hidden />
                  </div>
                  {products.length > 0 && (
                    <Group label="Products" count={products.length}>
                      {products.map((r) => (
                        <Row key={r.id} row={r} isAdmin={isAdmin} />
                      ))}
                    </Group>
                  )}
                  {operations.length > 0 && (
                    <Group label="Back office" count={operations.length} first={products.length === 0}>
                      {operations.map((r) => (
                        <Row key={r.id} row={r} isAdmin={isAdmin} />
                      ))}
                    </Group>
                  )}
                  {shown.length === 0 && (
                    <p className="px-4 py-10 text-center text-ui text-muted-foreground">
                      No project is {HEALTH_META[health!].label.toLowerCase()}.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {tab === "timeline" && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <RoadmapView projects={roadmapProjects} nowISO={nowISO} embedded />
        </div>
      )}
      {tab === "week" && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <WeeklyView projects={weeklyProjects} cycles={cycles} nowISO={nowISO} embedded />
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  count,
  first = false,
  children,
}: {
  label: string;
  count: number;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div role="rowgroup" aria-label={label}>
      <div
        className={cn(
          "flex h-8 items-center gap-2 border-b border-border-subtle bg-surface px-4 text-ui font-medium",
          !first && "border-t lg:border-t-0",
        )}
      >
        {label}
        <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ row: r, isAdmin }: { row: ProjectTableRow; isAdmin: boolean }) {
  const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
  const h = HEALTH_META[r.health];
  const base = `/projects/${r.id}`;
  const locked = r.confidential && !isAdmin;
  const shortcuts =
    r.kind === "project"
      ? enabledDepartments(r.enabledDepartments)
          .filter((d) => isAdmin || !isConfidentialDepartment(d.slug))
          .map((d) => ({ href: `${base}/${d.slug}`, label: d.label, icon: DEPT_ICONS[d.slug] }))
      : [
          { href: `${base}/tasks`, label: "Tasks", icon: <ListChecks className="size-3.5" /> },
          { href: `${base}/docs`, label: "Docs", icon: <FileText className="size-3.5" /> },
        ];
  const target = fmtTarget(r.milestone?.target ?? null);

  return (
    <div
      role="row"
      className="group/row relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3 last:border-b-0 hover:bg-muted/50 lg:grid-cols-[minmax(0,1.6fr)_104px_minmax(170px,1fr)_124px_minmax(0,1fr)_auto] lg:py-2.5"
    >
      {/* Whole-row target; the shortcuts on the right sit above it. */}
      <Link href={base} aria-hidden tabIndex={-1} className="absolute inset-0" />

      <div className="min-w-0">
        <Link href={base} className="relative flex items-center gap-2 rounded-sm">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
          <span className="truncate text-sm font-medium">{r.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{r.key}</span>
          {r.confidential && (
            <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Founders only" />
          )}
        </Link>
        {r.description && (
          <p className="mt-0.5 truncate pl-[18px] text-xs text-muted-foreground">{r.description}</p>
        )}
      </div>

      <span className={cn("flex items-center gap-1.5 text-ui", h.text)}>
        <span className={cn("size-2 shrink-0 rounded-full", h.dot)} />
        {h.label}
      </span>

      <div className="col-span-2 flex items-center gap-2.5 lg:col-span-1">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-24 shrink-0 text-right text-xs whitespace-nowrap tabular-nums text-muted-foreground">
          {r.total > 0 ? (
            <>
              <span className="text-foreground">{pct}%</span> · {r.done}/{r.total}
            </>
          ) : (
            "No tasks"
          )}
        </span>
      </div>

      <span className="hidden min-w-0 items-center gap-1.5 text-ui lg:flex">
        {r.lead ? (
          <>
            <UserAvatar name={r.lead.name} color={r.lead.avatarColor} className="size-5 shrink-0" />
            <span className="truncate">{r.lead.name}</span>
          </>
        ) : (
          <span className="text-faint-foreground" title="No lead">—</span>
        )}
      </span>

      <span className="hidden min-w-0 text-ui lg:block">
        {r.milestone ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Target className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{r.milestone.name}</span>
            {target && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{target}</span>}
          </span>
        ) : (
          <span className="text-faint-foreground" title="No milestone">—</span>
        )}
      </span>

      <div className="relative col-span-2 flex flex-wrap items-center gap-0.5 lg:col-span-1 lg:w-[164px] lg:flex-nowrap lg:justify-end lg:opacity-0 lg:transition-opacity lg:group-hover/row:opacity-100 lg:focus-within:opacity-100">
        {!locked &&
          shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              title={s.label}
              aria-label={`${r.name} ${s.label}`}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {s.icon}
            </Link>
          ))}
        {r.open > 0 && (
          <span className="ml-1 text-xs tabular-nums text-muted-foreground lg:hidden">{r.open} open</span>
        )}
      </div>
    </div>
  );
}

/** The quarter's company bets — read-only for members, edited in place by admins. */
function FocusCard({ bets, isAdmin }: { bets: string[]; isAdmin: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [vals, setVals] = useState<string[]>([bets[0] ?? "", bets[1] ?? "", bets[2] ?? ""]);
  const set = bets.filter(Boolean);
  if (!isAdmin && set.length === 0) return null;

  function save(next: string[]) {
    start(async () => {
      await updateCompanyBets(next);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="focus-title" className="rounded-lg border">
      <header className="flex h-9 items-center border-b bg-surface px-4">
        <h2 id="focus-title" className="text-ui font-medium">
          Focus this quarter
        </h2>
        {isAdmin && <span className="ml-auto text-xs text-muted-foreground">Click to edit</span>}
      </header>
      <ol className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {(isAdmin ? vals : set).map((b, i) => (
          <li key={i} className="flex items-start gap-2.5 px-4 py-3">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            {isAdmin ? (
              <textarea
                value={b}
                rows={2}
                onChange={(e) => setVals((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                onBlur={() => save(vals)}
                placeholder={`Focus ${i + 1}…`}
                aria-label={`Quarter focus ${i + 1}`}
                className="w-full resize-none rounded-sm bg-transparent text-ui leading-snug outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            ) : (
              <span className="text-ui leading-snug">{b}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
