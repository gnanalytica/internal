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
import { useMemo, useState } from "react";

import { UserAvatar } from "@/components/glyphs";
import { DEAL_STAGES, type DealStageId } from "@/lib/departments";
import { formatMoney } from "@/lib/matrix-format";
import type { DealWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

type Changed = { id: string; stage: string; sortKey: string };

/**
 * Apollo/HubSpot-style sales pipeline. Columns are the deal stages; drag a deal
 * across stages and the change is persisted via `persist`. Clicking a card
 * opens it through `onOpen`. Shows the project when not already project-scoped.
 *
 * The board owns its optimistic state (seeded from `deals`). Parents remount it
 * via a `key` derived from the deal id-set whenever deals are added/removed, so
 * server refreshes flow in without the board needing to resync from props.
 */
export function DealBoard({
  deals,
  showProject = false,
  persist,
  onOpen,
}: {
  deals: DealWithRelations[];
  showProject?: boolean;
  persist: (changed: Changed[]) => void;
  onOpen: (deal: DealWithRelations) => void;
}) {
  const [local, setLocal] = useState(deals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columns = useMemo(() => {
    const map: Record<string, DealWithRelations[]> = {};
    for (const s of DEAL_STAGES) map[s.id] = [];
    for (const d of local) (map[d.stage] ??= []).push(d);
    for (const k of Object.keys(map))
      map[k].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return map;
  }, [local]);

  const activeDeal = local.find((d) => d.id === activeId) ?? null;

  function findStage(id: string): DealStageId | null {
    if (DEAL_STAGES.some((s) => s.id === id)) return id as DealStageId;
    const d = local.find((x) => x.id === id);
    return (d?.stage as DealStageId) ?? null;
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeStage = findStage(active.id as string);
    const overStage = findStage(over.id as string);
    if (!activeStage || !overStage) return;

    const cols: Record<string, DealWithRelations[]> = {};
    for (const s of DEAL_STAGES) cols[s.id] = [...columns[s.id]];

    const fromIdx = cols[activeStage].findIndex((d) => d.id === active.id);
    if (fromIdx < 0) return;
    const [moved] = cols[activeStage].splice(fromIdx, 1);

    let insertAt = cols[overStage].findIndex((d) => d.id === over.id);
    if (insertAt < 0) insertAt = cols[overStage].length;
    cols[overStage].splice(insertAt, 0, { ...moved, stage: overStage });

    const changed: Changed[] = [];
    const next: DealWithRelations[] = [];
    for (const s of DEAL_STAGES) {
      cols[s.id].forEach((d, i) => {
        const sortKey = String(i).padStart(6, "0");
        next.push({ ...d, stage: s.id, sortKey });
        const original = local.find((o) => o.id === d.id)!;
        if (original.stage !== s.id || original.sortKey !== sortKey)
          changed.push({ id: d.id, stage: s.id, sortKey });
      });
    }
    setLocal(next);
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
        {DEAL_STAGES.map((s) => {
          const items = columns[s.id] ?? [];
          const total = items.reduce((sum, d) => sum + (d.value ?? 0), 0);
          return (
            <Column
              key={s.id}
              stage={s.id}
              label={s.label}
              color={s.color}
              total={total}
              items={items}
              showProject={showProject}
              onOpen={onOpen}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeDeal ? <Card deal={activeDeal} showProject={showProject} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  label,
  color,
  total,
  items,
  showProject,
  onOpen,
}: {
  stage: DealStageId;
  label: string;
  color: string;
  total: number;
  items: DealWithRelations[];
  showProject: boolean;
  onOpen: (d: DealWithRelations) => void;
}) {
  const { setNodeRef } = useSortable({ id: stage, data: { type: "column" } });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
        <span className="ml-auto text-xs text-muted-foreground">{formatMoney(total)}</span>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="scrollbar-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted/40 p-2"
        >
          {items.map((deal) => (
            <SortableCard key={deal.id} deal={deal} showProject={showProject} onOpen={onOpen} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({
  deal,
  showProject,
  onOpen,
}: {
  deal: DealWithRelations;
  showProject: boolean;
  onOpen: (d: DealWithRelations) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <Card deal={deal} showProject={showProject} onOpen={onOpen} />
    </div>
  );
}

function Card({
  deal,
  showProject,
  overlay,
  onOpen,
}: {
  deal: DealWithRelations;
  showProject: boolean;
  overlay?: boolean;
  onOpen?: (d: DealWithRelations) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(deal)}
      className={cn(
        "w-full rounded-lg border bg-background p-2.5 text-left shadow-sm",
        overlay ? "rotate-2 cursor-grabbing shadow-lg" : "cursor-grab hover:border-foreground/20",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="line-clamp-2 flex-1 text-sm font-medium leading-snug">{deal.name}</span>
        {deal.owner && (
          <UserAvatar
            name={deal.owner.name}
            color={deal.owner.avatarColor}
            className="size-4 text-[8px]"
          />
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{formatMoney(deal.value)}</span>
        {deal.account && <span className="truncate">· {deal.account.name}</span>}
      </div>
      {showProject && deal.project && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: deal.project.color }} />
          {deal.project.name}
        </div>
      )}
    </button>
  );
}
