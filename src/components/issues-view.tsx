"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Check,
  Columns3,
  ChevronDown,
  ChevronRight,
  Download,
  GanttChartSquare,
  Link2,
  List as ListIcon,
  ListFilter,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { BulkActionBar, type BulkMenu, type BulkPatch } from "@/components/bulk-action-bar";
import { StatusIcon } from "@/components/glyphs";
import { IssueBoard } from "@/components/issue-board";
import { IssueCalendar } from "@/components/issue-calendar";
import { IssuePeek } from "@/components/issue-peek";
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
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  bulkDeleteIssues,
  bulkUpdateIssues,
  createSavedView,
  deleteSavedView,
  updateIssue,
} from "@/lib/actions";
import { useRangeSelect } from "@/lib/use-range-select";
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
import { cycleStatus, issueIdentifier } from "@/lib/types";
import { istDay } from "@/lib/scorecard";
import { readViewFromUrl, writeViewToUrl } from "@/lib/view-url";

/** Row columns the Display menu can hide. */
const COLUMNS = [
  { id: "labels", label: "Labels" },
  { id: "estimate", label: "Points" },
  { id: "due", label: "Due date" },
  { id: "project", label: "Project" },
  { id: "assignees", label: "Assignees" },
];
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

type View = "list" | "board" | "timeline" | "calendar";

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
  const [bulkPending, startBulk] = useTransition();
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
  /** Columns switched off in Display → Show. */
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<SortId>("manual");
  const [groupBy, setGroupBy] = useState<GroupBy>(defaultGroupBy);
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
    if (config.view === "list" || config.view === "board" || config.view === "timeline" || config.view === "calendar")
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
          if (s.view === "list" || s.view === "board" || s.view === "timeline" || s.view === "calendar")
            setView(s.view);
          if (Array.isArray(s.hidden)) setHidden(new Set(s.hidden));
        }
        // A shared link wins over what this browser remembered.
        const u = embedded ? null : readViewFromUrl(window.location.search);
        if (u) {
          setFStatus(new Set(u.status));
          setFPriority(new Set(u.priority));
          setFType(new Set(u.type));
          setFAssignee(new Set(u.assignee));
          setFLabel(new Set(u.label));
          setFCycle(new Set(u.cycle));
          setFMilestone(new Set(u.milestone));
          setFBlocked(new Set(u.blocked));
          if (u.sort) setSort(u.sort as SortId);
          if (u.group) setGroupBy(u.group as GroupBy);
          if (u.view === "list" || u.view === "board" || u.view === "timeline" || u.view === "calendar") setView(u.view);
        }
      } catch {
        // Ignore malformed storage.
      }
    }
  }, [storageKey, embedded]);
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
          hidden: [...hidden],
        }),
      );
    } catch {
      // Storage may be unavailable (private mode); ignore.
    }
    // Keep the address bar in step, so the URL is always a link to this view.
    // replaceState, not the router: no navigation, no server round trip.
    if (!embedded) {
      const next = writeViewToUrl(window.location.search, {
        status: [...fStatus],
        priority: [...fPriority],
        type: [...fType],
        assignee: [...fAssignee],
        label: [...fLabel],
        cycle: [...fCycle],
        milestone: [...fMilestone],
        blocked: [...fBlocked],
        sort: sort === "manual" ? "" : sort,
        group: groupBy === defaultGroupBy ? "" : groupBy,
        view: view === "list" ? "" : view,
      });
      if (next !== window.location.search.replace(/^\?/, "")) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
      }
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
    hidden,
    embedded,
    defaultGroupBy,
  ]);

  function persist(changed: { id: string; status: StatusId; sortKey: string }[]) {
    startTransition(async () => {
      await Promise.all(
        changed.map((c) => updateIssue(c.id, { status: c.status, sortKey: c.sortKey })),
      );
      router.refresh();
    });
  }

  // A calendar drag: show the new day at once, then save it.
  function moveDue(id: string, day: string) {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, dueDate: new Date(`${day}T00:00:00Z`) } : i)));
    startTransition(async () => {
      try {
        await updateIssue(id, { dueDate: day });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't change the due date");
      }
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
    labels: labels.length ? [...labels].sort((a, b) => a.name.localeCompare(b.name)) : undefined,
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

  // Rows top to bottom exactly as the list draws them — folded groups, paged
  // groups and collapsed sub-tasks left out — so a drag or shift-click range
  // takes what you can see between the two rows and nothing hidden.
  const rowOrder = useMemo(() => {
    if (view !== "list") return [];
    const out: string[] = [];
    listGroups.forEach((g, gi) => {
      if (foldedGroups.has(g.key)) return;
      for (const { issue, children } of g.rows.slice(0, pages[gi])) {
        out.push(issue.id);
        if (!collapsed.has(issue.id)) for (const c of children) out.push(c.id);
      }
    });
    return out;
    // listGroups/pages are rebuilt each render; key on what they derive from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, visible, groupBy, sort, foldedGroups, collapsed, shown, live]);

  const listRef = useRef<HTMLDivElement>(null);
  const {
    selected,
    toggle: toggleSelect,
    pointerDown: selectPointerDown,
    clear: clearSelection,
    selectAll,
  } = useRangeSelect(rowOrder, listRef);

  // Linear-style triage from the keyboard. J/K (or arrows) move a focus ring,
  // X ticks the focused task, Enter opens it, and S / P / A / L open the bulk
  // bar's status, priority, assignee or label menu for the selection — or for
  // the focused task when nothing is ticked. Esc clears; Cmd/Ctrl+A takes
  // every visible row. All of it stands down while you're typing or a menu or
  // dialog is open, and a key straight after G is left to the app's "go to".
  const [focusId, setFocusId] = useState<string | null>(null);
  const [bulkMenu, setBulkMenu] = useState<BulkMenu | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const lastG = useRef(0);
  const focus = focusId && rowOrder.includes(focusId) ? focusId : null;
  useEffect(() => {
    if (view !== "list") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
        if (!(t instanceof HTMLInputElement && t.type === "checkbox")) return;
      }
      if (document.querySelector("[role=dialog],[role=menu],[data-popup-open]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && rowOrder.length > 0) {
        e.preventDefault();
        selectAll();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (peekId) setPeekId(null);
        else if (selected.size > 0) clearSelection();
        else setFocusId(null);
        return;
      }
      // Space peeks at the focused task (or closes the peek).
      if (e.key === " " && !e.shiftKey) {
        if (peekId) {
          e.preventDefault();
          setPeekId(null);
        } else if (focus) {
          e.preventDefault();
          setPeekId(focus);
        }
        return;
      }
      // Shift+C is "move to cycle"; plain C stays the app's create-task key.
      if (e.shiftKey && e.key.toLowerCase() === "c") {
        if (selected.size > 0 || focus) {
          e.preventDefault();
          if (selected.size === 0 && focus) toggleSelect(focus);
          setBulkMenu("cycle");
        }
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "g") {
        lastG.current = Date.now();
        return;
      }
      if (Date.now() - lastG.current < 1200) {
        lastG.current = 0;
        return;
      }
      const move = (step: number) => {
        if (!rowOrder.length) return;
        e.preventDefault();
        const i = focus ? rowOrder.indexOf(focus) : -1;
        const next = rowOrder[i < 0 ? (step > 0 ? 0 : rowOrder.length - 1) : Math.min(rowOrder.length - 1, Math.max(0, i + step))];
        setFocusId(next);
        // An open peek follows the focus, as in Linear.
        if (peekId) setPeekId(next);
        document.querySelector(`[data-select-id="${CSS.escape(next)}"]`)?.scrollIntoView({ block: "nearest" });
      };
      if (key === "j" || key === "ArrowDown") return move(1);
      if (key === "k" || key === "ArrowUp") return move(-1);
      if (key === "x" && focus) {
        e.preventDefault();
        toggleSelect(focus);
        return;
      }
      // Enter on a focused button or link is that control's own business.
      if (key === "Enter" && t?.closest("a,button,[role=button],[role=menuitem]")) return;
      if ((key === "Enter" || key === "o") && focus) {
        e.preventDefault();
        router.push(`/issues/${focus}`);
        return;
      }
      const menus: Record<string, BulkMenu> = { s: "status", p: "priority", a: "assignee", l: "label", d: "due", e: "estimate" };
      if (menus[key] && (selected.size > 0 || focus)) {
        e.preventDefault();
        if (selected.size === 0 && focus) toggleSelect(focus);
        setBulkMenu(menus[key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, selected.size, rowOrder, focus, peekId, clearSelection, selectAll, toggleSelect, router]);

  // Leaving the list for the board or timeline drops the selection: neither
  // shows it, and acting on rows you can't see is how things go wrong.
  useEffect(() => {
    if (view !== "list") clearSelection();
  }, [view, clearSelection]);

  // Cycles the selection can move into: open cycles of the one project every
  // selected task shares, or null when the selection spans projects.
  const bulkCycleChoices = useMemo(() => {
    const projectIds = new Set(issues.filter((i) => selected.has(i.id)).map((i) => i.projectId));
    if (projectIds.size !== 1) return null;
    const [pid] = [...projectIds];
    if (!pid) return null;
    return cycles
      .filter((c) => c.projectId === pid && cycleStatus(c, now) !== "completed")
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .map((c) => ({ id: c.id, name: c.name, hint: cycleSubtitle(c, now) }));
  }, [issues, selected, cycles, now]);

  function applyBulk(patch: BulkPatch, done: string) {
    const ids = [...selected];
    startBulk(async () => {
      try {
        const res = await bulkUpdateIssues(ids, patch);
        if (res.skipped) toast.warning(`${done.replace(/\d+ tasks?/, `${res.updated} of ${ids.length}`)} — ${res.skipped} from other projects were left as they were`);
        else toast.success(done);
        clearSelection();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update the tasks");
      }
      router.refresh();
    });
  }

  function deleteSelected() {
    const ids = [...selected];
    startBulk(async () => {
      try {
        const { deleted } = await bulkDeleteIssues(ids);
        toast.success(`Deleted ${deleted} ${deleted === 1 ? "task" : "tasks"}`);
        clearSelection();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete the tasks");
      }
      router.refresh();
    });
  }

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
              {!embedded && (
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() =>
                    navigator.clipboard.writeText(window.location.href).then(
                      () => toast.success("Link to this view copied"),
                      () => toast.error("Couldn't copy the link"),
                    )
                  }
                >
                  <Link2 className="size-3.5" /> Copy link to this view
                </DropdownMenuItem>
              )}
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
              <DropdownMenuGroup>
                <DropdownMenuLabel>Show</DropdownMenuLabel>
                {COLUMNS.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={!hidden.has(c.id)}
                    closeOnClick={false}
                    onCheckedChange={(on) =>
                      setHidden((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })
                    }
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
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
            <ViewButton active={view === "calendar"} onClick={() => setView("calendar")} label="Calendar">
              <CalendarDays className="size-3.5" />
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
        <div ref={listRef} className="scrollbar-thin flex-1 overflow-y-auto pb-20">
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
                      focused={focus === issue.id}
                      hidden={hidden}
                      onToggleSelect={() => toggleSelect(issue.id)}
                      onSelectPointerDown={(e) => selectPointerDown(issue.id, e)}
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
                          focused={focus === child.id}
                          hidden={hidden}
                          onToggleSelect={() => toggleSelect(child.id)}
                          onSelectPointerDown={(e) => selectPointerDown(child.id, e)}
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
      ) : view === "calendar" ? (
        <div className="min-h-0 flex-1">
          <IssueCalendar issues={visible} now={now} onMove={moveDue} />
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

      {peekId && issues.find((i) => i.id === peekId) && (
        <IssuePeek issue={issues.find((i) => i.id === peekId)!} now={now} onClose={() => setPeekId(null)} />
      )}

      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          total={rowOrder.length}
          members={members}
          projects={projects}
          pending={bulkPending}
          onApply={applyBulk}
          onDelete={deleteSelected}
          onSelectAll={selectAll}
          onClear={clearSelection}
          labels={labels}
          menu={bulkMenu}
          onMenu={setBulkMenu}
          today={istDay(now)}
          cycleChoices={bulkCycleChoices}
        />
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
