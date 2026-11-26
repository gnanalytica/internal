"use client";

import { useState } from "react";
import { CalendarClock, Check, ChevronDown, Folder, Gauge, Loader2, Tag, Timer, Trash2, UserRound, X } from "lucide-react";

import { PriorityIcon, StatusIcon, UserAvatar } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
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
import { PRIORITIES, STATUSES, type PriorityId, type StatusId } from "@/lib/constants";
import type { Label, Member, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BulkPatch = {
  status?: string;
  priority?: string;
  projectId?: string | null;
  assigneeIds?: string[];
  addLabelIds?: string[];
  dueDate?: string | null;
  estimate?: number | null;
  cycleId?: string | null;
};

/** Story points on offer, Fibonacci-ish as most teams size. */
const POINTS = [1, 2, 3, 5, 8, 13];

/** yyyy-mm-dd plus `days`. */
const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Which of the bar's menus is open; the list's S / P / A / L keys open them. */
export type BulkMenu = "status" | "priority" | "assignee" | "label" | "project" | "due" | "estimate" | "cycle";

function Key({ k }: { k: string }) {
  return <kbd className="ml-0.5 hidden rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground sm:inline">{k}</kbd>;
}

const trigger =
  "h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground/90 hover:bg-accent data-[popup-open]:bg-accent";

/**
 * The bar that rises from the bottom while tasks are selected. Count and the
 * select-all / clear controls on the left, then one control per property, and
 * delete set apart on the right because it's the one you can't take back.
 */
export function BulkActionBar({
  count,
  total,
  members,
  projects,
  labels,
  pending,
  onApply,
  onDelete,
  onSelectAll,
  onClear,
  menu,
  onMenu,
  today,
  cycleChoices,
}: {
  count: number;
  /** Rows in view, so "Select all" knows whether there's anything left to add. */
  total: number;
  members: Member[];
  projects: Project[];
  labels: Label[];
  pending: boolean;
  onApply: (patch: BulkPatch, done: string) => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  /** The open menu, held by the list so a key can open one. */
  menu: BulkMenu | null;
  onMenu: (m: BulkMenu | null) => void;
  /** Today in India time, yyyy-mm-dd, for the quick due dates. */
  today: string;
  /** Open cycles of the project every selected task shares; null when the selection spans projects. */
  cycleChoices: { id: string; name: string; hint?: string }[] | null;
}) {
  // Armed for one selection size: change the selection and it disarms, since
  // confirming then would be confirming the wrong thing.
  const [confirmFor, setConfirmFor] = useState<number | null>(null);
  const confirmDelete = confirmFor === count;
  const openFor = (m: BulkMenu) => ({ open: menu === m, onOpenChange: (o: boolean) => onMenu(o ? m : menu === m ? null : menu) });
  const setAssigneeOpen = (o: boolean) => onMenu(o ? "assignee" : null);
  const setProjectOpen = (o: boolean) => onMenu(o ? "project" : null);
  const setLabelOpen = (o: boolean) => onMenu(o ? "label" : null);
  const setDueOpen = (o: boolean) => onMenu(o ? "due" : null);
  const setCycleOpen = (o: boolean) => onMenu(o ? "cycle" : null);
  const due = (iso: string | null, what: string) => {
    setDueOpen(false);
    onApply({ dueDate: iso }, iso ? `Set ${tasks(count)} due ${what}` : `Cleared the due date on ${tasks(count)}`);
  };
  const tasks = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-3">
      <div
        role="toolbar"
        aria-label={`Bulk actions for ${tasks(count)}`}
        className={cn(
          "pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border bg-popover/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur",
          "animate-in fade-in slide-in-from-bottom-3 duration-200",
        )}
      >
        {/* Count + selection controls */}
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-brand/10 py-1 pl-2.5 pr-1">
          {pending ? (
            <Loader2 className="size-3.5 animate-spin text-brand" />
          ) : (
            <span className="grid size-4 place-items-center rounded-[4px] bg-brand text-[10px] text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>
          )}
          <span className="px-1 text-xs font-semibold tabular-nums text-brand" aria-live="polite">
            {count} selected
          </span>
          {count < total && (
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand/80 hover:bg-brand/10 hover:text-brand"
            >
              Select all {total}
            </button>
          )}
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection (Esc)"
            title="Clear selection (Esc)"
            className="grid size-6 place-items-center rounded-md text-brand/70 hover:bg-brand/10 hover:text-brand"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        {/* Status */}
        <DropdownMenu {...openFor("status")}>
          <DropdownMenuTrigger
            disabled={pending}
            render={<Button variant="ghost" size="sm" className={trigger} />}
          >
            <StatusIcon status="in_progress" /> Status
            <Key k="S" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-44">
            {STATUSES.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => onApply({ status: s.id }, `Set ${tasks(count)} to ${s.label}`)}
                className="gap-2"
              >
                <StatusIcon status={s.id as StatusId} />
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority */}
        <DropdownMenu {...openFor("priority")}>
          <DropdownMenuTrigger
            disabled={pending}
            render={<Button variant="ghost" size="sm" className={trigger} />}
          >
            <PriorityIcon priority="high" /> Priority
            <Key k="P" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-40">
            {PRIORITIES.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() =>
                  onApply({ priority: p.id }, `Set ${tasks(count)} to ${p.label} priority`)
                }
                className="gap-2"
              >
                <PriorityIcon priority={p.id as PriorityId} />
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assignee — searchable, teams outgrow a plain menu fast */}
        <Popover open={menu === "assignee"} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger
            disabled={pending}
            render={<Button variant="ghost" size="sm" className={trigger} />}
          >
            <UserRound className="size-3.5 text-muted-foreground" /> Assignee
            <Key k="A" />
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-60 p-0">
            <Command>
              <CommandInput placeholder="Assign to…" className="h-9" />
              <CommandList>
                <CommandEmpty>No one found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__unassign"
                    keywords={["unassign", "no one", "none"]}
                    onSelect={() => {
                      setAssigneeOpen(false);
                      onApply({ assigneeIds: [] }, `Unassigned ${tasks(count)}`);
                    }}
                    className="gap-2 text-muted-foreground"
                  >
                    <span className="size-4 rounded-full border border-dashed border-muted-foreground/60" />
                    No assignee
                  </CommandItem>
                  {members.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.id}
                      keywords={[m.name]}
                      onSelect={() => {
                        setAssigneeOpen(false);
                        onApply({ assigneeIds: [m.id] }, `Assigned ${tasks(count)} to ${m.name}`);
                      }}
                      className="gap-2"
                    >
                      <UserAvatar name={m.name} color={m.avatarColor} className="size-4 text-[8px]" />
                      <span className="truncate">{m.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Label: adds to what each task has */}
        <Popover open={menu === "label"} onOpenChange={setLabelOpen}>
          <PopoverTrigger
            disabled={pending || labels.length === 0}
            render={<Button variant="ghost" size="sm" className={trigger} />}
          >
            <Tag className="size-3.5 text-muted-foreground" /> Label
            <Key k="L" />
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-56 p-0">
            <Command>
              <CommandInput placeholder="Add label…" className="h-9" />
              <CommandList>
                <CommandEmpty>No label found.</CommandEmpty>
                <CommandGroup>
                  {labels.map((l) => (
                    <CommandItem
                      key={l.id}
                      value={l.id}
                      keywords={[l.name]}
                      onSelect={() => {
                        setLabelOpen(false);
                        onApply({ addLabelIds: [l.id] }, `Labelled ${tasks(count)} ${l.name}`);
                      }}
                      className="gap-2"
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="truncate">{l.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Due date */}
        <Popover open={menu === "due"} onOpenChange={setDueOpen}>
          <PopoverTrigger disabled={pending} render={<Button variant="ghost" size="sm" className={trigger} />}>
            <CalendarClock className="size-3.5 text-muted-foreground" /> Due
            <Key k="D" />
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-56 p-1">
            {[
              { label: "Today", days: 0 },
              { label: "Tomorrow", days: 1 },
              { label: "In 3 days", days: 3 },
              { label: "Next week", days: 7 },
              { label: "In 2 weeks", days: 14 },
            ].map((q) => (
              <button key={q.label} type="button" onClick={() => due(plusDays(today, q.days), q.label.toLowerCase())} className="flex h-8 w-full items-center justify-between rounded-md px-2 text-left text-sm hover:bg-accent">
                {q.label}
                <span className="font-mono text-[11px] text-muted-foreground">{plusDays(today, q.days).slice(5)}</span>
              </button>
            ))}
            <label className="flex h-9 items-center gap-2 px-2 text-sm">
              <span className="text-muted-foreground">On</span>
              <input
                type="date"
                aria-label="Due date"
                onChange={(e) => e.target.value && due(e.target.value, e.target.value)}
                className="h-7 flex-1 rounded-md border bg-background px-1.5 text-xs"
              />
            </label>
            <div className="my-1 h-px bg-border" />
            <button type="button" onClick={() => due(null, "")} className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-accent">
              No due date
            </button>
          </PopoverContent>
        </Popover>

        {/* Points */}
        <DropdownMenu {...openFor("estimate")}>
          <DropdownMenuTrigger disabled={pending} render={<Button variant="ghost" size="sm" className={trigger} />}>
            <Gauge className="size-3.5 text-muted-foreground" /> Points
            <Key k="E" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-36">
            {POINTS.map((n) => (
              <DropdownMenuItem key={n} onClick={() => onApply({ estimate: n }, `Set ${tasks(count)} to ${n} point${n === 1 ? "" : "s"}`)} className="gap-2 tabular-nums">
                {n} {n === 1 ? "point" : "points"}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => onApply({ estimate: null }, `Cleared points on ${tasks(count)}`)} className="text-muted-foreground">
              No estimate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Cycle: only within one project, since a cycle belongs to one */}
        <Popover open={menu === "cycle"} onOpenChange={setCycleOpen}>
          <PopoverTrigger
            disabled={pending}
            render={<Button variant="ghost" size="sm" className={trigger} />}
          >
            <Timer className="size-3.5 text-muted-foreground" /> Cycle
            <Key k="⇧C" />
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-64 p-0">
            {cycleChoices === null ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">These tasks are in different projects. A cycle belongs to one project, so select tasks from one project to set it.</p>
            ) : (
              <Command>
                <CommandInput placeholder="Move to cycle…" className="h-9" />
                <CommandList>
                  <CommandEmpty>No open cycle in this project.</CommandEmpty>
                  <CommandGroup>
                    {cycleChoices.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        keywords={[c.name]}
                        onSelect={() => {
                          setCycleOpen(false);
                          onApply({ cycleId: c.id }, `Moved ${tasks(count)} to ${c.name}`);
                        }}
                        className="gap-2"
                      >
                        <Timer className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{c.name}</span>
                        {c.hint && <span className="text-[10px] text-muted-foreground">{c.hint}</span>}
                      </CommandItem>
                    ))}
                    <CommandItem
                      value="__none"
                      keywords={["no cycle", "none", "remove"]}
                      onSelect={() => {
                        setCycleOpen(false);
                        onApply({ cycleId: null }, `Took ${tasks(count)} out of their cycle`);
                      }}
                      className="gap-2 text-muted-foreground"
                    >
                      No cycle
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </PopoverContent>
        </Popover>

        {/* Project */}
        <Popover open={menu === "project"} onOpenChange={setProjectOpen}>
          <PopoverTrigger
            disabled={pending}
            render={<Button variant="ghost" size="sm" className={trigger} />}
          >
            <Folder className="size-3.5 text-muted-foreground" /> Project
            <ChevronDown className="size-3 opacity-50" />
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-64 p-0">
            <Command>
              <CommandInput placeholder="Move to project…" className="h-9" />
              <CommandList>
                <CommandEmpty>No project found.</CommandEmpty>
                <CommandGroup heading="Moving renumbers tasks in the new project">
                  {projects.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      keywords={[p.name, p.key]}
                      onSelect={() => {
                        setProjectOpen(false);
                        onApply({ projectId: p.id }, `Moved ${tasks(count)} to ${p.name}`);
                      }}
                      className="gap-2"
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
                    </CommandItem>
                  ))}
                  <CommandItem
                    value="__none"
                    keywords={["no project", "none", "remove"]}
                    onSelect={() => {
                      setProjectOpen(false);
                      onApply({ projectId: null }, `Removed ${tasks(count)} from their project`);
                    }}
                    className="gap-2 text-muted-foreground"
                  >
                    <span className="size-2.5 rounded-full border border-dashed border-muted-foreground/60" />
                    No project
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        {/* Delete: two steps, inline — no browser dialog */}
        {confirmDelete ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
              onClick={() => {
                setConfirmFor(null);
                onDelete();
              }}
            >
              <Trash2 className="size-3.5" /> Delete {tasks(count)}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg px-2 text-xs"
              onClick={() => setConfirmFor(null)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label="Delete selected"
            title="Delete selected"
            className="h-8 shrink-0 rounded-lg px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmFor(count)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
