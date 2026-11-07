"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Columns3,
  ChevronDown,
  ChevronRight,
  Download,
  GanttChartSquare,
  List as ListIcon,
  ListFilter,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { StatusIcon } from "@/components/glyphs";
import { IssueBoard } from "@/components/issue-board";
import { IssueRow } from "@/components/issue-row";
import { IssueTimelineView } from "@/components/issue-timeline-view";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { Topbar } from "@/components/topbar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/glyphs";
import {
  createSavedView,
  deleteIssue,
  deleteSavedView,
  setIssueAssignees,
  updateIssue,
} from "@/lib/actions";
import { issuesToCsv } from "@/lib/csv";
import { downloadText } from "@/lib/download";
import { ISSUE_TYPES, PRIORITIES, STATUSES, type StatusId } from "@/lib/constants";
import {
  GROUP_BYS,
  SORTS,
  filterIssues,
  groupIssues,
  issueComparator,
  type GroupBy,
  type SortId,
} from "@/lib/issue-filters";
import { cycleSubtitle } from "@/lib/cycle-format";
import { FIRST_PAINT_ROWS, GROUP_PAGE, nestGroup, pageGroups, subIssueProgress } from "@/lib/issue-tree";
import { issueIdentifier } from "@/lib/types";
import type {
  Cycle,
  IssueListItem,
  Label,
  Member,
  Milestone,
  Project,
  SavedView,
  SavedViewConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "list" | "board" | "timeline";

/**
 * Status groups in a list read started-first — what's moving, then what's
 * next, then the parked and the closed. The board keeps workflow order
 * (backlog → done) because there the columns are the workflow.
 */
const LIST_STATUS_ORDER = ["in_progress", "in_review", "todo", "backlog", "done", "canceled"];

type FilterOption = { value: string; label: string; color?: string; hint?: string };
type FilterCategory = {
  key: string;
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
};

// False for the server render and hydration, true from then on (and on every
// client-side render), without a mount effect.
const subscribeNothing = () => () => {};
const useIsLive = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

/** Distinct non-null refs in first-seen order, for menus built from the tasks. */
function dedupeBy(refs: ({ id: string; name: string } | null)[]) {
  const seen = new Map<string, { id: string; name: string }>();
  for (const r of refs) if (r && !seen.has(r.id)) seen.set(r.id, { id: r.id, name: r.name });
  return [...seen.values()];
}

export function IssuesView({
  initialIssues,
  projects,
  members,
  labels,
  heading = "All tasks",
  defaultProjectId = null,
  savedViews = [],
  cycles = [],
  milestones = [],
  blockedIds = [],
  defaultGroupBy = "status",
  embedded = false,
  storageScope,
}: {
  initialIssues: IssueListItem[];
  projects: Project[];
  members: Member[];
  labels: Label[];
  heading?: string;
  defaultProjectId?: string | null;
  savedViews?: SavedView[];
  /**
   * Cycles and milestones for the filter menus and group ordering. Optional:
   * when omitted, both are derived from the tasks in view, which loses only the
   * chronological ordering and the ability to pick an empty cycle/gate.
   */
  cycles?: Cycle[];
  milestones?: Milestone[];
  /**
   * Ids of tasks something unfinished is blocking (see `getBlockedIssueIds`).
   * Optional: without it nothing reads as blocked and the filter stays hidden,
   * rather than every task quietly claiming to be unblocked in a UI that
   * offers to filter on it.
   */
  blockedIds?: string[];
  /**
   * Opening grouping for surfaces where one dimension is the point — the
   * roadmap groups by milestone. A stored preference still wins: this is the
   * starting point, not a lock.
   */
  defaultGroupBy?: GroupBy;
  /** Hide the page Topbar when rendered inside another tabbed surface. */
  embedded?: boolean;
  /**
   * Distinguishes the persisted filter/sort/view state when the same project is
   * shown on more than one surface. Without it, changing the view on the
   * project overview would silently change the Tasks tab too.
   */
  storageScope?: string;
}) {
  const router = useRouter();
  const [issues, setIssues] = useState(initialIssues);
  const [view, setView] = useState<View>("list");
  const [, startTransition] = useTransition();
  const lastInitial = useRef(initialIssues);

  // Filters & sort
  const [fStatus, setFStatus] = useState<Set<string>>(new Set());
  const [fPriority, setFPriority] = useState<Set<string>>(new Set());
  const [fType, setFType] = useState<Set<string>>(new Set());
  const [fAssignee, setFAssignee] = useState<Set<string>>(new Set());
  const [fLabel, setFLabel] = useState<Set<string>>(new Set());
  const [fCycle, setFCycle] = useState<Set<string>>(new Set());
  const [fMilestone, setFMilestone] = useState<Set<string>>(new Set());
  const [fBlocked, setFBlocked] = useState<Set<string>>(new Set());
  // Deliberately not persisted or saved into a view: search is how you find one
  // task now, not how you define a view you come back to.
  const [query, setQuery] = useState("");
  // One clock for the whole view — cycle timings that disagree row to row read
  // as a bug.
  const [now] = useState(() => new Date());
  const [sort, setSort] = useState<SortId>("manual");
  const [groupBy, setGroupBy] = useState<GroupBy>(defaultGroupBy);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // List groups folded shut. Closed work starts folded: it's there to find,
  // not to scroll past every time.
  const [foldedGroups, setFoldedGroups] = useState<Set<string>>(() => new Set(["done", "canceled"]));
  const toggleGroup = (key: string) =>
    setFoldedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Top-level rows shown per list group, after "Show more"; GROUP_PAGE otherwise.
  const [shown, setShown] = useState<Record<string, number>>({});
  const showMore = (key: string) =>
    setShown((prev) => ({ ...prev, [key]: (prev[key] ?? GROUP_PAGE) + GROUP_PAGE }));
  const live = useIsLive();
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkApply(fn: (id: string) => Promise<unknown>) {
    const ids = [...selected];
    startTransition(async () => {
      await Promise.all(ids.map(fn));
      setSelected(new Set());
      router.refresh();
    });
  }

  function currentConfig(): SavedViewConfig {
    return {
      status: [...fStatus],
      priority: [...fPriority],
      type: [...fType],
      assignee: [...fAssignee],
      label: [...fLabel],
      cycle: [...fCycle],
      milestone: [...fMilestone],
      blocked: [...fBlocked],
      sort,
      groupBy,
      view,
    };
  }

  function applyView(config: SavedViewConfig) {
    setFStatus(new Set(config.status ?? []));
    setFPriority(new Set(config.priority ?? []));
    setFType(new Set(config.type ?? []));
    setFAssignee(new Set(config.assignee ?? []));
    setFLabel(new Set(config.label ?? []));
    setFCycle(new Set(config.cycle ?? []));
    setFMilestone(new Set(config.milestone ?? []));
    setFBlocked(new Set(config.blocked ?? []));
    if (config.sort) setSort(config.sort as SortId);
    if (config.groupBy) setGroupBy(config.groupBy as GroupBy);
    if (config.view === "list" || config.view === "board" || config.view === "timeline")
      setView(config.view);
  }

  function saveView() {
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    startTransition(async () => {
      await createSavedView(name.trim(), currentConfig());
      router.refresh();
    });
  }

  function removeView(id: string) {
    startTransition(async () => {
      await deleteSavedView(id);
      router.refresh();
    });
  }

  // Persist filter/sort/view per project scope so it survives reloads.
  const storageKey = `issues-view:${defaultProjectId ?? "all"}${storageScope ? `:${storageScope}` : ""}`;
  const loaded = useRef(false);
  const skipSave = useRef(true);

  // Re-sync local state when the server sends a fresh list (e.g. after refresh).
  useEffect(() => {
    if (lastInitial.current !== initialIssues) {
      lastInitial.current = initialIssues;
      setIssues(initialIssues);
    }
  }, [initialIssues]);

  // Load saved view once on mount. Restoring persisted UI state from
  // localStorage is a valid one-time effect; the lint rule guards against
  // cascading render loops, which the `loaded` ref prevents here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      try {
        const raw = localStorage.getItem(storageKey);
        const s = raw ? JSON.parse(raw) : null;
        if (s) {
          if (Array.isArray(s.status)) setFStatus(new Set(s.status));
          if (Array.isArray(s.priority)) setFPriority(new Set(s.priority));
          if (Array.isArray(s.type)) setFType(new Set(s.type));
          if (Array.isArray(s.assignee)) setFAssignee(new Set(s.assignee));
          if (Array.isArray(s.label)) setFLabel(new Set(s.label));
          if (Array.isArray(s.cycle)) setFCycle(new Set(s.cycle));
          if (Array.isArray(s.milestone)) setFMilestone(new Set(s.milestone));
          if (Array.isArray(s.blocked)) setFBlocked(new Set(s.blocked));
          if (typeof s.sort === "string") setSort(s.sort as SortId);
          if (typeof s.groupBy === "string") setGroupBy(s.groupBy as GroupBy);
          if (s.view === "list" || s.view === "board" || s.view === "timeline")
            setView(s.view);
        }
      } catch {
        // Ignore malformed storage.
      }
    }
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Save on change (skipping the very first run so we don't clobber the load).
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          status: [...fStatus],
          priority: [...fPriority],
          type: [...fType],
          assignee: [...fAssignee],
          label: [...fLabel],
          cycle: [...fCycle],
          milestone: [...fMilestone],
          blocked: [...fBlocked],
          sort,
          groupBy,
          view,
        }),
      );
    } catch {
      // Storage may be unavailable (private mode); ignore.
    }
  }, [
    storageKey,
    fStatus,
    fPriority,
    fType,
    fAssignee,
    fLabel,
    fCycle,
    fMilestone,
    fBlocked,
    sort,
    groupBy,
    view,
  ]);

  function persist(changed: { id: string; status: StatusId; sortKey: string }[]) {
    startTransition(async () => {
      await Promise.all(
        changed.map((c) => updateIssue(c.id, { status: c.status, sortKey: c.sortKey })),
      );
      router.refresh();
    });
  }

  // Merge board drag results back into the full set (preserve filtered-out issues).
  function onBoardChange(next: IssueListItem[]) {
    setIssues((prev) => {
      const map = new Map(next.map((i) => [i.id, i]));
      return prev.map((i) => map.get(i.id) ?? i);
    });
  }

  const activeFilterCount =
    fStatus.size +
    fPriority.size +
    fType.size +
    fAssignee.size +
    fLabel.size +
    fCycle.size +
    fMilestone.size +
    fBlocked.size;

  // Cycles and milestones are project-scoped, so a project surface offers only
  // its own; the cross-project board offers all of them. Falling back to what
  // the tasks in view carry keeps the menus working on surfaces that don't
  // load the lists.
  const cycleOptions = useMemo(() => {
    const scoped = defaultProjectId
      ? cycles.filter((c) => c.projectId === defaultProjectId)
      : cycles;
    // Dates come along when we have the real rows. Falling back to what the
    // tasks carry still names the cycle, just without its dates.
    if (scoped.length > 0) {
      return scoped.map((c) => ({
        id: c.id,
        name: c.name,
        hint: cycleSubtitle(c, now),
      }));
    }
    return dedupeBy(issues.map((i) => i.cycle)).map((c) => ({ ...c, hint: undefined }));
  }, [cycles, defaultProjectId, issues, now]);

  const milestoneOptions = useMemo(() => {
    const scoped = defaultProjectId
      ? milestones.filter((m) => m.projectId === defaultProjectId)
      : milestones;
    if (scoped.length > 0) return scoped.map((m) => ({ id: m.id, name: m.name }));
    return dedupeBy(issues.map((i) => i.milestone));
  }, [milestones, defaultProjectId, issues]);

  // Stamp the blocked count once so the filter, the row badge and the board
  // card all read one field rather than each closing over the id set.
  const blocked = useMemo(() => new Set(blockedIds), [blockedIds]);
  const stamped = useMemo(
    () => (blocked.size === 0 ? issues : issues.map((i) => (blocked.has(i.id) ? { ...i, blockedBy: 1 } : i))),
    [issues, blocked],
  );

  // Every filter dimension in one place: the Filter menu lists them, and the
  // chip row under the toolbar says which are on.
  const filterCategories: FilterCategory[] = [
    {
      key: "status",
      label: "Status",
      options: STATUSES.map((x) => ({ value: x.id, label: x.label, color: x.color })),
      selected: fStatus,
      onChange: setFStatus,
    },
    {
      key: "priority",
      label: "Priority",
      options: PRIORITIES.map((x) => ({ value: x.id, label: x.label })),
      selected: fPriority,
      onChange: setFPriority,
    },
    {
      key: "assignee",
      label: "Assignee",
      options: [
        { value: "none", label: "Unassigned" },
        ...members.map((m) => ({ value: m.id, label: m.name, color: m.avatarColor })),
      ],
      selected: fAssignee,
      onChange: setFAssignee,
    },
    {
      key: "type",
      label: "Type",
      options: ISSUE_TYPES.map((x) => ({ value: x.id, label: x.label, color: x.color })),
      selected: fType,
      onChange: setFType,
    },
    ...(labels.length > 0
      ? [
          {
            key: "label",
            label: "Label",
            options: labels.map((l) => ({ value: l.id, label: l.name, color: l.color })),
            selected: fLabel,
            onChange: setFLabel,
          },
        ]
      : []),
    ...(cycleOptions.length > 0
      ? [
          {
            key: "cycle",
            label: "Cycle",
            options: [
              { value: "none", label: "No cycle" },
              ...cycleOptions.map((c) => ({ value: c.id, label: c.name, hint: c.hint })),
            ],
            selected: fCycle,
            onChange: setFCycle,
          },
        ]
      : []),
    ...(milestoneOptions.length > 0
      ? [
          {
            key: "milestone",
            label: "Milestone",
            options: [
              { value: "none", label: "No milestone" },
              ...milestoneOptions.map((m) => ({ value: m.id, label: m.name })),
            ],
            selected: fMilestone,
            onChange: setFMilestone,
          },
        ]
      : []),
    ...(blocked.size > 0
      ? [
          {
            key: "blocked",
            label: "Blocked",
            options: [
              { value: "blocked", label: "Blocked" },
              { value: "unblocked", label: "Not blocked" },
            ],
            selected: fBlocked,
            onChange: setFBlocked,
          },
        ]
      : []),
  ];

  const visible = useMemo(() => {
    const matched = filterIssues(stamped, {
      status: fStatus,
      priority: fPriority,
      type: fType,
      assignee: fAssignee,
      label: fLabel,
      cycle: fCycle,
      milestone: fMilestone,
      blocked: fBlocked,
    });
    const needle = query.trim().toLowerCase();
    if (!needle) return matched;
    return matched.filter(
      (i) =>
        i.title.toLowerCase().includes(needle) ||
        issueIdentifier(i).toLowerCase().includes(needle) ||
        i.assignee?.name.toLowerCase().includes(needle) ||
        i.milestone?.name.toLowerCase().includes(needle),
    );
  }, [stamped, fStatus, fPriority, fType, fAssignee, fLabel, fCycle, fMilestone, fBlocked, query]);

  const compare = useMemo(() => issueComparator(sort), [sort]);

  const rawGroups = groupIssues(visible, groupBy, {
    members,
    projects,
    cycles: cycleOptions,
    milestones: milestoneOptions,
  });
  const grouped = (
    groupBy === "status" && view === "list"
      ? rawGroups
          .slice()
          .sort((a, b) => LIST_STATUS_ORDER.indexOf(a.key) - LIST_STATUS_ORDER.indexOf(b.key))
      : rawGroups
  ).map((g) => ({
    ...g,
    items: g.items.slice().sort(compare),
  }));

  // The list renders a page of each group, and the server's HTML only the
  // first screen of rows: every task is already here, so the rest render in
  // the browser once the list is live. Filters, search and grouping work on
  // the whole set either way.
  const listGroups = grouped.map((g) => ({ ...g, rows: nestGroup(g.items).rows }));
  const pages = pageGroups(
    listGroups.map((g) => ({
      key: g.key,
      sizes: g.rows.map((r) => 1 + (collapsed.has(r.issue.id) ? 0 : r.children.length)),
    })),
    shown,
    live ? Infinity : FIRST_PAINT_ROWS,
  );

  function clearFilters() {
    setFStatus(new Set());
    setFPriority(new Set());
    setFType(new Set());
    setFAssignee(new Set());
    setFLabel(new Set());
    setFCycle(new Set());
    setFMilestone(new Set());
    setFBlocked(new Set());
    setQuery("");
  }

  return (
    <div className="flex h-full flex-col">
      {!embedded && (
        <Topbar
          breadcrumb={[{ label: "Tasks", href: "/issues" }, { label: heading }]}
          actions={
            <NewIssueDialog
              projects={projects}
              members={members}
              labels={labels}
              defaultProjectId={defaultProjectId}
              trigger={
                <Button size="sm" className="h-7 gap-1.5">
                  <Plus className="size-4" /> New task
                </Button>
              }
            />
          }
        />
      )}

      {/* Toolbar: find, filter, then how to show it — one line at every width. */}
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3 sm:px-4">
        {embedded && <span className="mr-1 hidden text-ui font-medium sm:inline">{heading}</span>}
        <span className="mr-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {visible.length === issues.length ? visible.length : `${visible.length} of ${issues.length}`}
          <span className="hidden sm:inline"> {issues.length === 1 ? "task" : "tasks"}</span>
        </span>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search tasks"
            className="h-7 w-28 rounded-md border bg-background pl-7 pr-2 text-ui placeholder:text-muted-foreground focus:w-44 focus:outline-none focus:ring-2 focus:ring-ring/40 sm:w-40 sm:focus:w-56 transition-[width] duration-150"
          />
        </div>

        <FilterMenu
          categories={filterCategories}
          activeCount={activeFilterCount}
        />

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-ui text-muted-foreground hover:text-foreground" />}
              aria-label="Saved views"
            >
              <Bookmark className="size-3.5" />
              <span className="hidden md:inline">Views</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Saved views</DropdownMenuLabel>
                {savedViews.length === 0 ? (
                  <div className="px-1.5 py-1 text-ui text-muted-foreground">None yet</div>
                ) : (
                  savedViews.map((v) => (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => applyView(v.config)}
                      className="group/v gap-2"
                    >
                      <Bookmark className="size-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{v.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeView(v.id);
                        }}
                        className="text-muted-foreground opacity-0 hover:text-destructive group-hover/v:opacity-100"
                        aria-label={`Delete view ${v.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={saveView} className="gap-2">
                <Plus className="size-3.5" /> Save current view…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-ui text-muted-foreground hover:text-foreground" />}
              aria-label="Display options"
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden md:inline">Display</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Group by</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  {GROUP_BYS.map((g) => (
                    <DropdownMenuRadioItem key={g.id} value={g.id}>
                      {g.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Order by</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortId)}>
                  {SORTS.map((o) => (
                    <DropdownMenuRadioItem key={o.id} value={o.id}>
                      {o.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2"
                onClick={() =>
                  downloadText(`issues-${heading.toLowerCase().replace(/\s+/g, "-")}.csv`, issuesToCsv(visible), "text/csv")
                }
              >
                <Download className="size-3.5" /> Export {visible.length} to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div role="radiogroup" aria-label="Layout" className="flex items-center rounded-md border p-0.5">
            <ViewButton active={view === "list"} onClick={() => setView("list")} label="List">
              <ListIcon className="size-3.5" />
            </ViewButton>
            <ViewButton active={view === "board"} onClick={() => setView("board")} label="Board">
              <Columns3 className="size-3.5" />
            </ViewButton>
            <ViewButton active={view === "timeline"} onClick={() => setView("timeline")} label="Timeline">
              <GanttChartSquare className="size-3.5" />
            </ViewButton>
          </div>
          {embedded && (
            <NewIssueDialog
              projects={projects}
              members={members}
              labels={labels}
              defaultProjectId={defaultProjectId}
              trigger={
                <Button size="sm" className="ml-1 h-7 gap-1.5">
                  <Plus className="size-4" /> <span className="hidden sm:inline">New</span>
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* What's filtered, said once, each removable. */}
      {(activeFilterCount > 0 || query) && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-1.5 sm:px-4">
          {filterCategories
            .filter((c) => c.selected.size > 0)
            .map((c) => (
              <span
                key={c.key}
                className="inline-flex h-6 items-center gap-1 rounded-md border bg-background pl-2 text-xs"
              >
                <span className="text-muted-foreground">{c.label}</span>
                <span className="max-w-48 truncate font-medium">
                  {c.options
                    .filter((o) => c.selected.has(o.value))
                    .map((o) => o.label)
                    .join(", ")}
                </span>
                <button
                  onClick={() => c.onChange(new Set())}
                  className="grid size-6 place-items-center rounded-r-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Clear ${c.label} filter`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          <button
            onClick={clearFilters}
            className="h-6 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {issues.length === 0 ? (
        <EmptyState
          projects={projects}
          members={members}
          labels={labels}
          defaultProjectId={defaultProjectId}
        />
      ) : visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium">No matching tasks</p>
          <button
            onClick={clearFilters}
            className="text-xs text-brand hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : view === "list" ? (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {listGroups.map((g, gi) => (
            <div key={g.key}>
              <button
                type="button"
                onClick={() => toggleGroup(g.key)}
                aria-expanded={!foldedGroups.has(g.key)}
                className="sticky top-0 z-10 flex h-8 w-full items-center gap-2 border-b border-border-subtle bg-surface/95 px-3 text-left backdrop-blur sm:px-4"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                    !foldedGroups.has(g.key) && "rotate-90",
                  )}
                />
                {groupBy === "status" ? (
                  <StatusIcon status={g.key as StatusId} />
                ) : g.color ? (
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                ) : null}
                <span className="text-ui font-medium">{g.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{g.items.length}</span>
                {g.hint && (
                  <span className="truncate text-xs text-muted-foreground">{g.hint}</span>
                )}
              </button>
              {!foldedGroups.has(g.key) && g.rows.slice(0, pages[gi]).map(({ issue, children }) => {
                const isCollapsed = collapsed.has(issue.id);
                return (
                  <div key={issue.id}>
                    <IssueRow
                      issue={issue}
                      members={members}
                      selected={selected.has(issue.id)}
                      onToggleSelect={() => toggleSelect(issue.id)}
                      selecting={selected.size > 0}
                      now={now}
                      showProject={!defaultProjectId}
                      showCreated={sort === "created" || sort === "updated"}
                      subProgress={subIssueProgress(issue.id, issues)}
                      expandToggle={
                        children.length > 0 ? (
                          <button
                            onClick={() => toggleCollapse(issue.id)}
                            className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label={isCollapsed ? "Expand sub-tasks" : "Collapse sub-tasks"}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )}
                          </button>
                        ) : undefined
                      }
                    />
                    {!isCollapsed &&
                      children.map((child) => (
                        <IssueRow
                          key={child.id}
                          issue={child}
                          members={members}
                          selected={selected.has(child.id)}
                          onToggleSelect={() => toggleSelect(child.id)}
                          selecting={selected.size > 0}
                          now={now}
                          showProject={!defaultProjectId}
                          showCreated={sort === "created" || sort === "updated"}
                          depth={1}
                          subProgress={subIssueProgress(child.id, issues)}
                        />
                      ))}
                  </div>
                );
              })}
              {live && !foldedGroups.has(g.key) && g.rows.length > pages[gi] && (
                <button
                  onClick={() => showMore(g.key)}
                  className="h-8 w-full border-b border-border-subtle px-4 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:pl-12"
                >
                  Show {Math.min(GROUP_PAGE, g.rows.length - pages[gi])} more
                </button>
              )}
            </div>
          ))}
        </div>
      ) : view === "timeline" ? (
        <div className="min-h-0 flex-1">
          <IssueTimelineView issues={visible} members={members} />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <IssueBoard
            issues={visible}
            members={members}
            onChange={onBoardChange}
            persist={persist}
          />
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border bg-popover px-2 py-1.5 shadow-lg">
            <span className="px-1.5 text-xs font-medium">{selected.size} selected</span>
            <div className="mx-1 h-4 w-px bg-border" />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" />}
              >
                <StatusIcon status="todo" /> Status
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => bulkApply((id) => updateIssue(id, { status: s.id }))}
                    className="gap-2"
                  >
                    <StatusIcon status={s.id} />
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" />}
              >
                Assignee
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => bulkApply((id) => setIssueAssignees(id, []))}
                  className="gap-2 text-xs text-muted-foreground"
                >
                  Unassign
                </DropdownMenuItem>
                {members.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => bulkApply((id) => setIssueAssignees(id, [m.id]))}
                    className="gap-2"
                  >
                    <UserAvatar name={m.name} color={m.avatarColor} className="size-4 text-[8px]" />
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
              onClick={() => bulkApply((id) => deleteIssue(id))}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One Filter button for every dimension. The first level lists the
 * dimensions (with how many of each are on); picking one opens its values,
 * searchable, multi-select. The chips under the toolbar show what's applied.
 */
function FilterMenu({
  categories,
  activeCount,
}: {
  categories: FilterCategory[];
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [catKey, setCatKey] = useState<string | null>(null);
  const cat = categories.find((c) => c.key === catKey) ?? null;
  const hasHints = cat?.options.some((o) => o.hint) ?? false;

  function toggle(c: FilterCategory, value: string) {
    const next = new Set(c.selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    c.onChange(next);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setCatKey(null);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant={activeCount > 0 ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2 text-ui text-muted-foreground hover:text-foreground data-[popup-open]:text-foreground"
          />
        }
      >
        <ListFilter className="size-3.5" />
        <span className="hidden sm:inline">Filter</span>
        {activeCount > 0 && (
          <span className="rounded bg-brand/15 px-1 text-[10px] font-semibold tabular-nums text-brand">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("p-0", hasHints ? "w-72" : "w-60")}>
        {cat ? (
          <Command key={cat.key}>
            <div className="flex items-center gap-1 border-b px-1 py-1">
              <button
                onClick={() => setCatKey(null)}
                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Back to filters"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <span className="text-ui font-medium">{cat.label}</span>
              {cat.selected.size > 0 && (
                <button
                  onClick={() => cat.onChange(new Set())}
                  className="ml-auto rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <CommandInput placeholder={`Filter by ${cat.label.toLowerCase()}…`} className="h-9" />
            <CommandList>
              <CommandEmpty>None found.</CommandEmpty>
              <CommandGroup>
                {cat.options.map((o) => {
                  const checked = cat.selected.has(o.value);
                  return (
                    <CommandItem
                      key={o.value}
                      // Searching a cycle by its dates should find it too.
                      value={o.hint ? `${o.label} ${o.hint}` : o.label}
                      onSelect={() => toggle(cat, o.value)}
                      className="items-start gap-2"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-[4px] border",
                          checked ? "border-brand bg-brand text-brand-foreground" : "border-input",
                        )}
                      >
                        {checked && <Check className="size-2.5" />}
                      </span>
                      {o.color && (
                        <span
                          className="mt-1 size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: o.color }}
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{o.label}</span>
                        {o.hint && (
                          <span className="truncate text-[11px] text-muted-foreground">{o.hint}</span>
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <Command>
            <CommandInput placeholder="Filter by…" className="h-9" />
            <CommandList>
              <CommandEmpty>None found.</CommandEmpty>
              <CommandGroup>
                {categories.map((c) => (
                  <CommandItem key={c.key} value={c.label} onSelect={() => setCatKey(c.key)} className="gap-2">
                    <span className="flex-1">{c.label}</span>
                    {c.selected.size > 0 && (
                      <span className="rounded bg-brand/15 px-1 text-[10px] font-semibold tabular-nums text-brand">
                        {c.selected.size}
                      </span>
                    )}
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-6 place-items-center rounded-[4px] transition-colors",
        active ? "bg-accent text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  projects,
  members,
  labels,
  defaultProjectId,
}: {
  projects: Project[];
  members: Member[];
  labels: Label[];
  defaultProjectId: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
        <StatusIcon status="todo" className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">No tasks yet</p>
        <p className="text-xs text-muted-foreground">Create your first task to get started.</p>
      </div>
      <NewIssueDialog
        projects={projects}
        members={members}
        labels={labels}
        defaultProjectId={defaultProjectId}
        trigger={
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" /> New task
          </Button>
        }
      />
    </div>
  );
}
