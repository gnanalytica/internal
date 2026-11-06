"use client";

import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { groupRoadmap, isRoadmapStatus, ROADMAP_COLUMNS, ticketsLabel, voicesLabel, type Progress, type RoadmapStatus } from "@/lib/product-roadmap";
import { tone } from "@/lib/tones";
import type { FeatureWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_PROGRESS: Progress = { done: 0, total: 0, pct: 0 };

/** What to say in a column with nothing in it, so the next move is obvious. */
const EMPTY_COPY: Record<(typeof ROADMAP_COLUMNS)[number]["id"], string> = {
  building: "Nothing is being built. Drag a card here when work starts.",
  planned: "Nothing decided yet. Move an idea here once you've committed to it.",
  idea: "No ideas parked. Add one, or start from a feedback theme.",
};

/** The thin done-of-total bar under a card; green once every ticket is done. */
export function TicketBar({ p, className }: { p: Progress; className?: string }) {
  const complete = p.total > 0 && p.done === p.total;
  return (
    <span role="img" aria-label={ticketsLabel(p)} className={cn("block h-1 overflow-hidden rounded-full bg-muted", className)}>
      <span className={cn("block h-full rounded-full transition-[width] duration-500 ease-out", complete ? tone("green").bar : tone("blue").bar)} style={{ width: `${p.pct}%` }} />
    </span>
  );
}

function FeatureCard({ f, column, voices, progress, onOpen, overlay }: { f: FeatureWithRelations; column: RoadmapStatus; voices: number; progress: Progress; onOpen?: (id: string) => void; overlay?: boolean }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: f.id, data: { feature: f }, disabled: overlay });
  const col = ROADMAP_COLUMNS.find((c) => c.id === column);
  return (
    // dnd-kit's own attributes are left off on purpose: they describe a keyboard
    // drag this board doesn't offer. From the keyboard the card is a plain button
    // that opens the feature, where its status can be changed.
    <button
      ref={overlay ? undefined : setNodeRef}
      type="button"
      {...(overlay ? {} : listeners)}
      onClick={() => onOpen?.(f.id)}
      className={cn(
        "hover-lift flex w-full flex-col gap-2 rounded-lg border border-l-[3px] bg-card p-3 text-left shadow-xs outline-none hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50",
        tone(col?.tone ?? "green").edgeL,
        isDragging && "opacity-40",
        overlay && "rotate-2 scale-[1.03] shadow-xl",
      )}
    >
      <span className="text-[13px] leading-snug font-medium">{f.title}</span>
      {f.summary && <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{f.summary}</span>}
      <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-1.5 rounded-full", voices ? tone("pink").dot : "bg-muted-foreground/30")} />
          {voicesLabel(voices)}
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[11px] tabular-nums">{ticketsLabel(progress)}</span>
      </span>
      <TicketBar p={progress} />
    </button>
  );
}

function Column({ column, features, voices, progress, onOpen, onAdd, adding }: { column: (typeof ROADMAP_COLUMNS)[number]; features: FeatureWithRelations[]; voices: Map<string, number>; progress: Map<string, Progress>; onOpen: (id: string) => void; onAdd: (status: RoadmapStatus) => void; adding: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}` });
  const t = tone(column.tone);
  return (
    <section ref={setNodeRef} aria-label={`${column.label}: ${column.hint}`} className={cn("flex min-w-0 flex-col gap-2 rounded-xl border-t-2 bg-muted/50 p-2 transition-[box-shadow,background-color] duration-150 md:min-h-[360px]", t.edgeT, isOver && "bg-muted ring-2 ring-brand/40")}>
      <div className="flex items-baseline gap-1.5 px-1.5 pt-1 pb-0.5">
        <span className="text-[13px] font-semibold">{column.label}</span>
        <span className="flex-1 text-xs text-muted-foreground">{column.hint}</span>
        <span className={cn("rounded-full px-1.5 font-mono text-[11px] tabular-nums", t.chip)}>{features.length}</span>
      </div>
      {features.map((f) => (
        <FeatureCard key={f.id} f={f} column={column.id} voices={voices.get(f.id) ?? 0} progress={progress.get(f.id) ?? NO_PROGRESS} onOpen={onOpen} />
      ))}
      {features.length === 0 && <p className="px-1.5 py-2 text-xs leading-relaxed text-muted-foreground">{EMPTY_COPY[column.id]}</p>}
      <button type="button" onClick={() => onAdd(column.id)} disabled={adding} className="mt-auto inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50">
        <Plus className="size-3.5" /> Add to {column.label}
      </button>
    </section>
  );
}

function ShippedRow({ features, onOpen }: { features: FeatureWithRelations[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: "col:shipped" });
  return (
    <section ref={setNodeRef} aria-label="Shipped" className={cn("rounded-lg bg-muted/50 transition-[box-shadow] duration-150", isOver && "ring-2 ring-emerald-500/40")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
        <button type="button" aria-expanded={open} aria-controls="roadmap-shipped" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded hover:underline">
          <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span aria-hidden className={cn("size-[7px] rounded-full", tone("green").dot)} />
          Shipped <span className="font-mono text-xs text-muted-foreground">{features.length}</span>
        </button>
        <span className="text-muted-foreground max-sm:hidden">·</span>
        <span className="text-muted-foreground">
          <span className="sm:hidden">Press and hold a card to move it.</span>
          <span className="max-sm:hidden">Drag a card between columns to change it, or here once it&apos;s live.</span>
        </span>
      </div>
      {open && (
        <ul id="roadmap-shipped" className="flex flex-col border-t px-1.5 py-1.5">
          {features.length === 0 && <li className="px-1.5 py-1.5 text-xs text-muted-foreground">Nothing shipped yet. Drop a finished feature here.</li>}
          {features.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onOpen(f.id)} className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-background">
                <span className="min-w-0 flex-1 truncate text-[13px]">{f.title}</span>
                {f.summary && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground max-sm:hidden">{f.summary}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Now / Next / Later: one column per open status, a collapsed Shipped row
 * underneath. Dragging a card between them changes the feature's status;
 * clicking opens it (the status can be changed there too, for keyboards).
 */
export function RoadmapBoard({
  features,
  voices,
  progress,
  onOpen,
  onMove,
  onAdd,
  adding,
}: {
  features: FeatureWithRelations[];
  voices: Map<string, number>;
  progress: Map<string, Progress>;
  onOpen: (id: string) => void;
  onMove: (id: string, status: RoadmapStatus) => void;
  onAdd: (status: RoadmapStatus) => void;
  adding: boolean;
}) {
  const [active, setActive] = useState<FeatureWithRelations | null>(null);
  // A touch drag starts only after a press-and-hold, so a swipe still scrolls the page.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }));
  const { columns, shipped } = useMemo(() => groupRoadmap(features), [features]);

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const f = e.active.data.current?.feature as FeatureWithRelations | undefined;
    const target = e.over ? String(e.over.id).replace("col:", "") : "";
    if (f && isRoadmapStatus(target) && target !== f.status) onMove(f.id, target);
  };

  return (
    <DndContext id="product-roadmap" sensors={sensors} onDragStart={(e) => setActive((e.active.data.current?.feature as FeatureWithRelations) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-1 items-stretch gap-2.5 md:grid-cols-3">
          {ROADMAP_COLUMNS.map((c) => (
            <Column key={c.id} column={c} features={columns[c.id]} voices={voices} progress={progress} onOpen={onOpen} onAdd={onAdd} adding={adding} />
          ))}
        </div>
        <ShippedRow features={shipped} onOpen={onOpen} />
      </div>
      <DragOverlay>{active ? <FeatureCard f={active} column={active.status as RoadmapStatus} voices={voices.get(active.id) ?? 0} progress={progress.get(active.id) ?? NO_PROGRESS} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
