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
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketStatusId } from "@/lib/departments";
import type { TicketWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

type Changed = { id: string; status: string; sortKey: string };

/**
 * Zendesk-style ticket queue as a board. Columns are ticket statuses; drag a
 * ticket to change status, persisted via `persist`. Owns its optimistic state;
 * parents remount via a `key` on the ticket id-set.
 */
export function TicketBoard({
  tickets,
  showProduct = false,
  persist,
  onOpen,
}: {
  tickets: TicketWithRelations[];
  showProduct?: boolean;
  persist: (changed: Changed[]) => void;
  onOpen: (ticket: TicketWithRelations) => void;
}) {
  const [local, setLocal] = useState(tickets);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columns = useMemo(() => {
    const map: Record<string, TicketWithRelations[]> = {};
    for (const s of TICKET_STATUSES) map[s.id] = [];
    for (const t of local) (map[t.status] ??= []).push(t);
    for (const k of Object.keys(map))
      map[k].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return map;
  }, [local]);

  const activeTicket = local.find((t) => t.id === activeId) ?? null;

  function findStatus(id: string): TicketStatusId | null {
    if (TICKET_STATUSES.some((s) => s.id === id)) return id as TicketStatusId;
    const t = local.find((x) => x.id === id);
    return (t?.status as TicketStatusId) ?? null;
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeStatus = findStatus(active.id as string);
    const overStatus = findStatus(over.id as string);
    if (!activeStatus || !overStatus) return;

    const cols: Record<string, TicketWithRelations[]> = {};
    for (const s of TICKET_STATUSES) cols[s.id] = [...columns[s.id]];

    const fromIdx = cols[activeStatus].findIndex((t) => t.id === active.id);
    if (fromIdx < 0) return;
    const [moved] = cols[activeStatus].splice(fromIdx, 1);

    let insertAt = cols[overStatus].findIndex((t) => t.id === over.id);
    if (insertAt < 0) insertAt = cols[overStatus].length;
    cols[overStatus].splice(insertAt, 0, { ...moved, status: overStatus });

    const changed: Changed[] = [];
    const next: TicketWithRelations[] = [];
    for (const s of TICKET_STATUSES) {
      cols[s.id].forEach((t, i) => {
        const sortKey = String(i).padStart(6, "0");
        next.push({ ...t, status: s.id, sortKey });
        const original = local.find((o) => o.id === t.id)!;
        if (original.status !== s.id || original.sortKey !== sortKey)
          changed.push({ id: t.id, status: s.id, sortKey });
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
        {TICKET_STATUSES.map((s) => {
          const items = columns[s.id] ?? [];
          return (
            <Column key={s.id} status={s.id} label={s.label} color={s.color} items={items} showProduct={showProduct} onOpen={onOpen} />
          );
        })}
      </div>
      <DragOverlay>
        {activeTicket ? <Card ticket={activeTicket} showProduct={showProduct} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  color,
  items,
  showProduct,
  onOpen,
}: {
  status: TicketStatusId;
  label: string;
  color: string;
  items: TicketWithRelations[];
  showProduct: boolean;
  onOpen: (t: TicketWithRelations) => void;
}) {
  const { setNodeRef } = useSortable({ id: status, data: { type: "column" } });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="scrollbar-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted/40 p-2"
        >
          {items.map((t) => (
            <SortableCard key={t.id} ticket={t} showProduct={showProduct} onOpen={onOpen} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({
  ticket,
  showProduct,
  onOpen,
}: {
  ticket: TicketWithRelations;
  showProduct: boolean;
  onOpen: (t: TicketWithRelations) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ticket.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <Card ticket={ticket} showProduct={showProduct} onOpen={onOpen} />
    </div>
  );
}

function Card({
  ticket,
  showProduct,
  overlay,
  onOpen,
}: {
  ticket: TicketWithRelations;
  showProduct: boolean;
  overlay?: boolean;
  onOpen?: (t: TicketWithRelations) => void;
}) {
  const prio = TICKET_PRIORITIES.find((p) => p.id === ticket.priority);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(ticket)}
      className={cn(
        "w-full rounded-lg border bg-background p-2.5 text-left shadow-sm",
        overlay ? "rotate-2 cursor-grabbing shadow-lg" : "cursor-grab hover:border-foreground/20",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="line-clamp-2 flex-1 text-sm font-medium leading-snug">{ticket.subject}</span>
        {ticket.assignee && (
          <UserAvatar name={ticket.assignee.name} color={ticket.assignee.avatarColor} className="size-4 text-[8px]" />
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {prio && (
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: prio.color }} />
            {prio.label}
          </span>
        )}
        {ticket.account && <span className="truncate">· {ticket.account.name}</span>}
      </div>
      {showProduct && ticket.product && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: ticket.product.color }} />
          {ticket.product.name}
        </div>
      )}
    </button>
  );
}
