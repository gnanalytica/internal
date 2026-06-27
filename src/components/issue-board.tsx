"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CalendarClock } from "lucide-react";

import { PriorityIcon, StatusIcon } from "@/components/glyphs";
import { IssueContextMenu } from "@/components/issue-context-menu";
import { AvatarStack } from "@/components/pickers";
import { STATUSES, type StatusId, type PriorityId } from "@/lib/constants";
import { formatDue, isOverdue } from "@/lib/issue-dates";
import type { IssueWithRelations, Member } from "@/lib/types";
import { issueIdentifier } from "@/lib/types";
import { cn } from "@/lib/utils";

type Changed = { id: string; status: StatusId; sortKey: string };

export function IssueBoard({
  issues,
  members,
  onChange,
  persist,
}: {
  issues: IssueWithRelations[];
  members: Member[];
  onChange: (next: IssueWithRelations[]) => void;
  persist: (changed: Changed[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columns = useMemo(() => {
    const map: Record<string, IssueWithRelations[]> = {};
    for (const s of STATUSES) map[s.id] = [];
    for (const it of issues) (map[it.status] ??= []).push(it);
    for (const k of Object.keys(map))
      map[k].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return map;
  }, [issues]);

  const activeIssue = issues.find((i) => i.id === activeId) ?? null;

  function findStatus(id: string): StatusId | null {
    if (STATUSES.some((s) => s.id === id)) return id as StatusId;
    const it = issues.find((i) => i.id === id);
    return (it?.status as StatusId) ?? null;
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeStatus = findStatus(active.id as string);
    const overStatus = findStatus(over.id as string);
    if (!activeStatus || !overStatus) return;

    // Build a working copy of columns.
    const cols: Record<string, IssueWithRelations[]> = {};
    for (const s of STATUSES) cols[s.id] = [...columns[s.id]];

    const fromIdx = cols[activeStatus].findIndex((i) => i.id === active.id);
    if (fromIdx < 0) return;
    const [moved] = cols[activeStatus].splice(fromIdx, 1);

    let insertAt = cols[overStatus].findIndex((i) => i.id === over.id);
    if (insertAt < 0) insertAt = cols[overStatus].length;
    const movedUpdated = { ...moved, status: overStatus };
    cols[overStatus].splice(insertAt, 0, movedUpdated);

    // Recompute sort keys for affected columns and collect changes.
    const changed: Changed[] = [];
    const nextIssues: IssueWithRelations[] = [];
    for (const s of STATUSES) {
      cols[s.id].forEach((it, i) => {
        const sortKey = String(i).padStart(6, "0");
        const updated = { ...it, status: s.id, sortKey };
        nextIssues.push(updated);
        const original = issues.find((o) => o.id === it.id)!;
        if (original.status !== s.id || original.sortKey !== sortKey) {
          changed.push({ id: it.id, status: s.id, sortKey });
        }
      });
    }

    onChange(nextIssues);
    if (changed.length) persist(changed);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="scrollbar-thin flex h-full gap-3 overflow-x-auto px-4 py-4">
        {STATUSES.map((s) => (
          <BoardColumn
            key={s.id}
            status={s.id}
            label={s.label}
            items={columns[s.id]}
            members={members}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? (
          <BoardCard issue={activeIssue} members={members} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status,
  label,
  items,
  members,
}: {
  status: StatusId;
  label: string;
  items: IssueWithRelations[];
  members: Member[];
}) {
  const { setNodeRef } = useSortable({ id: status, data: { type: "column" } });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <StatusIcon status={status} />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="scrollbar-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted/40 p-2"
        >
          {items.map((issue) => (
            <SortableCard key={issue.id} issue={issue} members={members} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({
  issue,
  members,
}: {
  issue: IssueWithRelations;
  members: Member[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: issue.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <BoardCard issue={issue} members={members} />
    </div>
  );
}

function BoardCard({
  issue,
  members,
  overlay,
}: {
  issue: IssueWithRelations;
  members: Member[];
  overlay?: boolean;
}) {
  const card = (
    <div
      className={cn(
        "rounded-lg border bg-background p-2.5 shadow-sm",
        overlay ? "rotate-2 cursor-grabbing shadow-lg" : "cursor-grab hover:border-foreground/20",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">
          {issueIdentifier(issue)}
        </span>
        <PriorityIcon priority={issue.priority as PriorityId} className="ml-auto" />
        {issue.assignees.length > 0 && <AvatarStack members={issue.assignees} max={3} />}
      </div>
      <Link
        href={`/issues/${issue.id}`}
        onClick={(e) => e.stopPropagation()}
        className="line-clamp-2 text-sm leading-snug hover:underline"
      >
        {issue.title}
      </Link>
      {issue.dueDate && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {issue.dueDate && (
            <span
              className={cn(
                "ml-auto flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px]",
                isOverdue(issue.dueDate, issue.status)
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground",
              )}
            >
              <CalendarClock className="size-3" />
              {formatDue(issue.dueDate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
  if (overlay) return card;
  return (
    <IssueContextMenu issue={issue} members={members}>
      {card}
    </IssueContextMenu>
  );
}
