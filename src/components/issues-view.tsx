"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowUpDown,
  Bookmark,
  Check,
  Columns3,
  Download,
  Layers,
  List as ListIcon,
  ListFilter,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { StatusIcon } from "@/components/glyphs";
import { IssueBoard } from "@/components/issue-board";
import { IssueRow } from "@/components/issue-row";
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/glyphs";
import {
  createSavedView,
  deleteIssue,
  deleteSavedView,
  updateIssue,
} from "@/lib/actions";
import { issuesToCsv } from "@/lib/csv";
import { downloadText } from "@/lib/download";
import { PRIORITIES, STATUSES, type StatusId } from "@/lib/constants";
import {
  GROUP_BYS,
  SORTS,
  filterIssues,
  groupIssues,
  issueComparator,
  type GroupBy,
  type SortId,
} from "@/lib/issue-filters";
import type {
  IssueWithRelations,
  Label,
  Member,
  Project,
  SavedView,
  SavedViewConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "list" | "board";

export function IssuesView({
  initialIssues,
  projects,
  members,
  labels,
  heading = "All issues",
  defaultProjectId = null,
  savedViews = [],
  embedded = false,
}: {
  initialIssues: IssueWithRelations[];
  projects: Project[];
  members: Member[];
  labels: Label[];
  heading?: string;
  defaultProjectId?: string | null;
  savedViews?: SavedView[];
  /** Hide the page Topbar when rendered inside another tabbed surface. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [issues, setIssues] = useState(initialIssues);
  const [view, setView] = useState<View>("list");
  const [, startTransition] = useTransition();
  const lastInitial = useRef(initialIssues);

  // Filters & sort
  const [fStatus, setFStatus] = useState<Set<string>>(new Set());
  const [fPriority, setFPriority] = useState<Set<string>>(new Set());
  const [fAssignee, setFAssignee] = useState<Set<string>>(new Set());
  const [fLabel, setFLabel] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortId>("manual");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      assignee: [...fAssignee],
      label: [...fLabel],
      sort,
      groupBy,
      view,
    };
  }

  function applyView(config: SavedViewConfig) {
    setFStatus(new Set(config.status ?? []));
    setFPriority(new Set(config.priority ?? []));
    setFAssignee(new Set(config.assignee ?? []));
    setFLabel(new Set(config.label ?? []));
    if (config.sort) setSort(config.sort as SortId);
    if (config.groupBy) setGroupBy(config.groupBy as GroupBy);
    if (config.view === "list" || config.view === "board") setView(config.view);
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
  const storageKey = `issues-view:${defaultProjectId ?? "all"}`;
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
          if (Array.isArray(s.assignee)) setFAssignee(new Set(s.assignee));
          if (Array.isArray(s.label)) setFLabel(new Set(s.label));
          if (typeof s.sort === "string") setSort(s.sort as SortId);
          if (typeof s.groupBy === "string") setGroupBy(s.groupBy as GroupBy);
          if (s.view === "list" || s.view === "board") setView(s.view);
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
          assignee: [...fAssignee],
          label: [...fLabel],
          sort,
          groupBy,
          view,
        }),
      );
    } catch {
      // Storage may be unavailable (private mode); ignore.
    }
  }, [storageKey, fStatus, fPriority, fAssignee, fLabel, sort, groupBy, view]);

  function persist(changed: { id: string; status: StatusId; sortKey: string }[]) {
    startTransition(async () => {
      await Promise.all(
        changed.map((c) => updateIssue(c.id, { status: c.status, sortKey: c.sortKey })),
      );
      router.refresh();
    });
  }

  // Merge board drag results back into the full set (preserve filtered-out issues).
  function onBoardChange(next: IssueWithRelations[]) {
    setIssues((prev) => {
      const map = new Map(next.map((i) => [i.id, i]));
      return prev.map((i) => map.get(i.id) ?? i);
    });
  }

  const activeFilterCount =
    fStatus.size + fPriority.size + fAssignee.size + fLabel.size;

  const visible = useMemo(
    () =>
      filterIssues(issues, {
        status: fStatus,
        priority: fPriority,
        assignee: fAssignee,
        label: fLabel,
      }),
    [issues, fStatus, fPriority, fAssignee, fLabel],
  );

  const compare = useMemo(() => issueComparator(sort), [sort]);

  const grouped = groupIssues(visible, groupBy, { members, projects }).map((g) => ({
    ...g,
    items: g.items.slice().sort(compare),
  }));

  function clearFilters() {
    setFStatus(new Set());
    setFPriority(new Set());
    setFAssignee(new Set());
    setFLabel(new Set());
  }

  return (
    <div className="flex h-full flex-col">
      {!embedded && (
        <Topbar
          breadcrumb={[{ label: "Issues", href: "/issues" }, { label: heading }]}
          actions={
            <NewIssueDialog
              projects={projects}
              members={members}
              labels={labels}
              defaultProjectId={defaultProjectId}
              trigger={
                <Button size="sm" className="h-7 gap-1.5">
                  <Plus className="size-4" /> New
                </Button>
              }
            />
          }
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-1.5">
        <span className="text-sm font-medium">{heading}</span>
        <span className="text-xs text-muted-foreground">{visible.length}</span>

        <FilterMenu
          label="Status"
          options={STATUSES.map((s) => ({ value: s.id, label: s.label, color: s.color }))}
          selected={fStatus}
          onChange={setFStatus}
        />
        <FilterMenu
          label="Priority"
          options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))}
          selected={fPriority}
          onChange={setFPriority}
        />
        <FilterMenu
          label="Assignee"
          options={[
            { value: "none", label: "Unassigned" },
            ...members.map((m) => ({ value: m.id, label: m.name, color: m.avatarColor })),
          ]}
          selected={fAssignee}
          onChange={setFAssignee}
        />
        {labels.length > 0 && (
          <FilterMenu
            label="Label"
            options={labels.map((l) => ({ value: l.id, label: l.name, color: l.color }))}
            selected={fLabel}
            onChange={setFLabel}
          />
        )}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" /> Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" />}
            >
              <Bookmark className="size-3.5" />
              Views
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {savedViews.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved views</div>
              ) : (
                savedViews.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => applyView(v.config)}
                    className="group/v gap-2 text-xs"
                  >
                    <Bookmark className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{v.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeView(v.id);
                      }}
                      className="text-muted-foreground opacity-0 hover:text-destructive group-hover/v:opacity-100"
                      aria-label="Delete view"
                    >
                      <X className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuItem onClick={saveView} className="gap-2 text-xs text-brand">
                <Plus className="size-3.5" /> Save current view…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" />}
            >
              <Layers className="size-3.5" />
              {GROUP_BYS.find((g) => g.id === groupBy)?.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {GROUP_BYS.map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  onClick={() => setGroupBy(g.id)}
                  className="gap-2 text-xs"
                >
                  <span className="flex-1">{g.label}</span>
                  {groupBy === g.id && <Check className="size-3.5 opacity-70" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" />}
            >
              <ArrowUpDown className="size-3.5" />
              {SORTS.find((s) => s.id === sort)?.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORTS.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className="gap-2 text-xs"
                >
                  <span className="flex-1">{s.label}</span>
                  {sort === s.id && <Check className="size-3.5 opacity-70" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              downloadText(`issues-${heading.toLowerCase().replace(/\s+/g, "-")}.csv`, issuesToCsv(visible), "text/csv")
            }
            title="Export visible issues to CSV"
          >
            <Download className="size-3.5" /> Export
          </Button>
          <div className="flex items-center rounded-md border p-0.5">
            <ViewButton active={view === "list"} onClick={() => setView("list")}>
              <ListIcon className="size-3.5" /> List
            </ViewButton>
            <ViewButton active={view === "board"} onClick={() => setView("board")}>
              <Columns3 className="size-3.5" /> Board
            </ViewButton>
          </div>
        </div>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          projects={projects}
          members={members}
          labels={labels}
          defaultProjectId={defaultProjectId}
        />
      ) : visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium">No matching issues</p>
          <button
            onClick={clearFilters}
            className="text-xs text-brand hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : view === "list" ? (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {grouped.map((g) => (
            <div key={g.key}>
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-muted/60 px-4 py-1.5 backdrop-blur">
                {groupBy === "status" ? (
                  <StatusIcon status={g.key as StatusId} />
                ) : g.color ? (
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                ) : null}
                <span className="text-xs font-semibold">{g.label}</span>
                <span className="text-xs text-muted-foreground">{g.items.length}</span>
              </div>
              {g.items.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  members={members}
                  selected={selected.has(issue.id)}
                  onToggleSelect={() => toggleSelect(issue.id)}
                />
              ))}
            </div>
          ))}
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
                    className="gap-2 text-xs"
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
                  onClick={() => bulkApply((id) => updateIssue(id, { assigneeId: null }))}
                  className="gap-2 text-xs text-muted-foreground"
                >
                  Unassign
                </DropdownMenuItem>
                {members.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => bulkApply((id) => updateIssue(id, { assigneeId: m.id }))}
                    className="gap-2 text-xs"
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

function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = options.filter((o) => selected.has(o.value)).length;

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant={count > 0 ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
          />
        }
      >
        <ListFilter className="size-3.5" />
        {label}
        {count > 0 && (
          <span className="rounded bg-brand/15 px-1 text-[10px] font-semibold text-brand">
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder={`Filter ${label.toLowerCase()}…`} className="h-9" />
          <CommandList>
            <CommandEmpty>None found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const checked = selected.has(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                    className="gap-2"
                  >
                    {o.color && (
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: o.color }}
                      />
                    )}
                    <span className="flex-1 truncate">{o.label}</span>
                    {checked && <Check className="size-3.5 opacity-70" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
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
        <p className="text-sm font-medium">No issues yet</p>
        <p className="text-xs text-muted-foreground">Create your first issue to get started.</p>
      </div>
      <NewIssueDialog
        projects={projects}
        members={members}
        labels={labels}
        defaultProjectId={defaultProjectId}
        trigger={
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" /> New issue
          </Button>
        }
      />
    </div>
  );
}
