"use client";

import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Bar, DatePicker, Empty, Segmented } from "@/components/prospects-dashboard/bits";
import {
  addDays,
  addMonths,
  atDay,
  bucketByDay,
  CHANNEL_FORMAT,
  CHANNELS,
  channelOf,
  dayLabel,
  dayOf,
  FORMATS,
  formatOf,
  lateLabel,
  monthLabel,
  monthWeeks,
  overdue as overdueOf,
  PIECE_STATUSES,
  rowOf,
  statusOf,
  timeOf,
  weekDays,
  weekLabel,
  weekPace,
  weekStart,
  type ChannelId,
} from "@/lib/marketing";
import type { Member } from "@/lib/types";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ChannelDot, firstName, StatusChip, type Piece, type PiecePatch } from "./bits";

type Mode = "week" | "month";

const OVERDUE_CAP = 5;

/**
 * The content calendar: a week of channels by days (or a month of days),
 * pace against plan for the week, and the ideas still waiting for a date.
 * Drag a piece — or an idea — onto a day to (re)schedule it.
 */
export function CalendarTab({
  items,
  members,
  today,
  salesHref,
  onOpen,
  onSave,
}: {
  items: Piece[];
  members: Member[];
  today: string;
  salesHref: string | null;
  onOpen: (p: Piece) => void;
  onSave: (id: string, patch: PiecePatch) => void;
}) {
  const [mode, setMode] = useState<Mode>("week");
  const [cursor, setCursor] = useState(today);
  const [dragging, setDragging] = useState<Piece | null>(null);
  // A touch drag starts only after a press-and-hold, so a swipe still scrolls the grid.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }));
  const ownerName = useMemo(() => new Map(members.map((m) => [m.id, firstName(m.name)])), [members]);

  const start = weekStart(cursor);
  const month = cursor.slice(0, 7);
  const thisWeek = weekStart(today);
  const paceWeek = mode === "week" ? start : thisWeek;
  const pace = useMemo(() => weekPace(items, paceWeek), [items, paceWeek]);
  const ideas = useMemo(() => items.filter((p) => !p.publishDate), [items]);
  const late = useMemo(() => overdueOf(items, today), [items, today]);
  const [allLate, setAllLate] = useState(false);
  const onCurrent = mode === "week" ? start === thisWeek : month === today.slice(0, 7);

  const shift = (n: number) => setCursor(mode === "week" ? addDays(cursor, 7 * n) : `${addMonths(month, n)}-01`);

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const p = e.active.data.current?.piece as Piece | undefined;
    const [kind, a, b] = String(e.over?.id ?? "").split("|");
    if (!p || !kind) return;
    const day = kind === "cell" ? b : a;
    const row = kind === "cell" ? a : null;
    const channel = row && row !== "other" ? row : p.channel;
    if (dayOf(p.publishDate) === day && channel === p.channel) return;
    const patch: PiecePatch = { publishDate: atDay(day, p.publishDate) };
    if (channel !== p.channel) patch.channel = channel;
    if (!p.format && channelOf(channel)) patch.format = CHANNEL_FORMAT[channel as ChannelId];
    onSave(p.id, patch);
  };

  const chip = (p: Piece) => <PieceChip key={p.id} p={p} owner={p.ownerId ? ownerName.get(p.ownerId) : undefined} onOpen={onOpen} />;

  return (
    <DndContext id="content-calendar" sensors={sensors} onDragStart={(e) => setDragging((e.active.data.current?.piece as Piece) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex gap-1">
            <button type="button" aria-label={mode === "week" ? "Previous week" : "Previous month"} onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground sm:size-7">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label={mode === "week" ? "Next week" : "Next month"} onClick={() => shift(1)} className="grid size-8 place-items-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground sm:size-7">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <h1 aria-live="polite" className="min-w-[7.5rem] text-base font-semibold">
            {mode === "week" ? weekLabel(start) : monthLabel(month)}
          </h1>
          <Segmented
            label="Range"
            value={mode}
            onChange={setMode}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
          {!onCurrent && (
            <button type="button" onClick={() => setCursor(today)} className="h-8 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground sm:h-7">
              {mode === "week" ? "This week" : "This month"}
            </button>
          )}
          <span className="flex-1" />
          <ul aria-label="Status colours" className="flex flex-wrap items-center gap-x-3 gap-y-1 max-sm:w-full">
            {PIECE_STATUSES.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className={cn("size-2 rounded-full", tone(s.tone).dot)} />
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-[999_1_640px]">
            {mode === "week" ? (
              <>
                <WeekGrid items={items} start={start} today={today} chip={chip} />
                <WeekAgenda items={items} start={start} today={today} owner={(p) => (p.ownerId ? ownerName.get(p.ownerId) : undefined)} onOpen={onOpen} />
              </>
            ) : (
              <MonthGrid
                items={items}
                month={month}
                today={today}
                onOpen={onOpen}
                onPickWeek={(day) => {
                  setCursor(day);
                  setMode("week");
                }}
              />
            )}
          </div>

          <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-6">
            <section aria-labelledby="pace-h" className="flex flex-col gap-2.5">
              <h2 id="pace-h" className="text-sm font-semibold">
                {paceWeek === thisWeek ? "This week" : `${weekLabel(paceWeek)}`} against plan
              </h2>
              {pace.length === 0 ? (
                <Empty>Nothing is dated this week yet. Drag an idea onto a day, or give a piece a date.</Empty>
              ) : (
                pace.map((r) => (
                  <div key={r.channel} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-1.5 text-[13px]">
                      <span className="flex-1">{r.label}</span>
                      <span className="font-mono text-xs tabular-nums">{r.done}</span>
                      <span className="text-xs text-muted-foreground">of {r.plan} posted</span>
                    </div>
                    <Bar value={r.done} max={r.plan} fill={tone(r.tone).bar} className="h-1.5 rounded-full" />
                  </div>
                ))
              )}
            </section>

            <section aria-labelledby="leads-h" className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3.5 py-3">
              <h2 id="leads-h" className="text-sm font-semibold">
                Leads from marketing
              </h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                The prospects sheet doesn&rsquo;t record where a lead came from yet, so they can&rsquo;t be counted here. When someone mentions a post, note it on their prospect.
              </p>
              {salesHref && (
                <Link href={salesHref} className="self-start text-[13px] text-brand hover:underline">
                  Open Prospects →
                </Link>
              )}
            </section>

            {late.length > 0 && (
              <section aria-labelledby="overdue-h" className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-1.5">
                  <h2 id="overdue-h" className="flex-1 text-sm font-semibold">
                    Overdue, not posted
                  </h2>
                  <span className={cn("font-mono text-xs", tone("orange").text)}>{late.length}</span>
                </div>
                <p className="text-xs text-muted-foreground">Their day has passed. Give each a new date, or send it back to the ideas.</p>
                <ul className="flex flex-col gap-1.5">
                  {(allLate ? late : late.slice(0, OVERDUE_CAP)).map((p) => (
                    <OverdueRow
                      key={p.id}
                      p={p}
                      today={today}
                      onOpen={onOpen}
                      onReschedule={(day) => onSave(p.id, { publishDate: atDay(day, p.publishDate) })}
                      onUnschedule={() => onSave(p.id, { publishDate: null })}
                    />
                  ))}
                </ul>
                {late.length > OVERDUE_CAP && (
                  <button type="button" aria-expanded={allLate} onClick={() => setAllLate(!allLate)} className="self-start rounded px-1 text-xs text-muted-foreground hover:text-foreground">
                    {allLate ? "Show fewer" : `Show all ${late.length}`}
                  </button>
                )}
              </section>
            )}

            <section aria-labelledby="ideas-h" className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-1.5">
                <h2 id="ideas-h" className="flex-1 text-sm font-semibold">
                  Ideas, not scheduled
                </h2>
                <span className="font-mono text-xs text-muted-foreground">{ideas.length}</span>
              </div>
              {ideas.length === 0 ? (
                <Empty>Every piece has a date. Jot the next idea down with New piece.</Empty>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    <span className="max-md:hidden">Drag one onto a day, or use Schedule…</span>
                    <span className="md:hidden">Use Schedule… to give one a date.</span>
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {ideas.map((p) => (
                      <IdeaRow key={p.id} p={p} today={today} onOpen={onOpen} onSchedule={(day) => onSave(p.id, { publishDate: atDay(day) })} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
      <DragOverlay>{dragging ? <ChipFace p={dragging} className="w-48 rotate-2 shadow-xl" /> : null}</DragOverlay>
    </DndContext>
  );
}

// ---- Week ----

function WeekGrid({ items, start, today, chip }: { items: Piece[]; start: string; today: string; chip: (p: Piece) => React.ReactNode }) {
  const days = weekDays(start);
  const byRow = useMemo(() => bucketByDay(items, weekDays(start)), [items, start]);
  const rows = [...CHANNELS.map((c) => ({ id: c.id as string, label: c.label as string, note: c.note as string })), ...(byRow.has("other") ? [{ id: "other", label: "No channel", note: "Pick one in the piece" }] : [])];
  return (
    <div className="overflow-x-auto rounded-xl border max-md:hidden">
      <div role="table" aria-label={`Content for ${weekLabel(start)}`} className="grid min-w-[760px] grid-cols-[132px_repeat(7,minmax(0,1fr))]">
        <div role="row" className="contents">
          <div role="columnheader" className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Channel
          </div>
          {days.map((d) => (
            <div key={d} role="columnheader" aria-current={d === today ? "date" : undefined} className={cn("border-b border-l px-2.5 py-2 text-[13px]", d === today ? "bg-brand/10 font-medium text-brand" : "bg-muted/40 text-foreground/80")}>
              {dayLabel(d).split(" ")[0]} <span className="font-mono text-xs">{Number(d.slice(8))}</span>
            </div>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.id} role="row" className="contents">
            <div role="rowheader" className="flex flex-col gap-0.5 border-b border-border/60 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                <ChannelDot channel={r.id === "other" ? null : r.id} /> {r.label}
              </span>
              <span className="text-[11px] text-muted-foreground">{r.note}</span>
            </div>
            {days.map((d) => (
              <DropCell key={d} id={`cell|${r.id}|${d}`} label={`${r.label}, ${dayLabel(d)}`} today={d === today}>
                {(byRow.get(r.id)?.get(d) ?? []).map(chip)}
              </DropCell>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DropCell({ id, label, today, children }: { id: string; label: string; today: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} role="cell" aria-label={label} className={cn("flex min-h-16 flex-col gap-1.5 border-b border-l border-border/60 p-1.5 transition-colors", today && "bg-brand/[0.03]", isOver && "bg-brand/[0.08] ring-2 ring-brand/40 ring-inset")}>
      {children}
    </div>
  );
}

/** A phone can't show seven columns: the same week, one day under another. */
function WeekAgenda({ items, start, today, owner, onOpen }: { items: Piece[]; start: string; today: string; owner: (p: Piece) => string | undefined; onOpen: (p: Piece) => void }) {
  const days = weekDays(start);
  const byDay = useMemo(() => {
    const m = new Map<string, Piece[]>();
    for (const [, row] of bucketByDay(items, weekDays(start))) for (const [d, list] of row) m.set(d, [...(m.get(d) ?? []), ...list]);
    return m;
  }, [items, start]);
  return (
    <ol className="flex flex-col gap-3 md:hidden">
      {days.map((d) => {
        const list = byDay.get(d) ?? [];
        return (
          <li key={d} className="flex flex-col gap-1.5">
            <span aria-current={d === today ? "date" : undefined} className={cn("text-[13px]", d === today ? "font-medium text-brand" : "text-muted-foreground")}>
              {d === today ? `Today · ${dayLabel(d)}` : dayLabel(d)}
            </span>
            {list.length ? (
              <div className="flex flex-col gap-1.5">
                {list.map((p) => (
                  <button key={p.id} type="button" onClick={() => onOpen(p)} className="block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                    <ChipFace p={p} owner={owner(p)} />
                  </button>
                ))}
              </div>
            ) : (
              <span className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">Nothing planned</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function chipMeta(p: Piece, owner?: string): string {
  const s = statusOf(p.status);
  const time = timeOf(p.publishDate);
  const f = formatOf(p);
  const what = p.status === "published" ? `Posted${time ? ` ${time}` : ""}` : p.status === "scheduled" ? `Ready${time ? ` · ${time}` : ""}` : s.label;
  return [what, owner || (f ? FORMATS[f].label : null)].filter(Boolean).join(" · ");
}

function ChipFace({ p, owner, className }: { p: Piece; owner?: string; className?: string }) {
  const s = statusOf(p.status);
  return (
    <span className={cn("flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs leading-snug", tone(s.tone).chip, className)}>
      <span className="line-clamp-2 font-medium text-foreground">{p.title}</span>
      <span className="truncate text-[11px] opacity-80">{chipMeta(p, owner)}</span>
    </span>
  );
}

function PieceChip({ p, owner, onOpen }: { p: Piece; owner?: string; onOpen: (p: Piece) => void }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: `piece|${p.id}`, data: { piece: p } });
  return (
    <button ref={setNodeRef} type="button" {...listeners} onClick={() => onOpen(p)} aria-label={`${p.title}, ${statusOf(p.status).label}`} className={cn("block w-full touch-manipulation rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50", isDragging && "opacity-40")}>
      <ChipFace p={p} owner={owner} />
    </button>
  );
}

function IdeaRow({ p, today, onOpen, onSchedule }: { p: Piece; today: string; onOpen: (p: Piece) => void; onSchedule: (day: string) => void }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: `idea|${p.id}`, data: { piece: p } });
  const f = formatOf(p);
  return (
    <li className={cn("flex h-9 items-center gap-1 rounded-md border bg-background pr-1", isDragging && "opacity-40")}>
      <button ref={setNodeRef} type="button" {...listeners} onClick={() => onOpen(p)} className="flex h-full min-w-0 flex-1 touch-manipulation items-center gap-2 rounded-md pl-2.5 text-left text-[13px] outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50">
        <ChannelDot channel={p.channel} />
        <span className="min-w-0 flex-1 truncate">{p.title}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{f ? FORMATS[f].label : channelOf(p.channel)?.label}</span>
      </button>
      <DatePicker value={null} today={today} allowClear={false} onPick={(iso) => iso && onSchedule(iso)}>
        <button type="button" aria-label={`Schedule ${p.title}`} className="h-7 shrink-0 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
          Schedule…
        </button>
      </DatePicker>
    </li>
  );
}

/** A piece whose day went by unposted: open it, give it a new day (keeping its time), or send it back to the ideas. */
function OverdueRow({ p, today, onOpen, onReschedule, onUnschedule }: { p: Piece; today: string; onOpen: (p: Piece) => void; onReschedule: (day: string) => void; onUnschedule: () => void }) {
  const day = dayOf(p.publishDate);
  return (
    <li className="flex flex-col gap-1 rounded-md border bg-background py-1.5 pr-1 pl-2.5">
      <div className="flex min-w-0 items-center gap-2 pr-1.5">
        <button type="button" onClick={() => onOpen(p)} className="flex min-w-0 flex-1 items-center gap-2 rounded text-left text-[13px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
          <ChannelDot channel={p.channel} />
          <span className="min-w-0 flex-1 truncate">{p.title}</span>
        </button>
        <StatusChip status={p.status} className="h-[18px] shrink-0 text-[11px]" />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1 pl-4">
        <span title={day ? `Was due ${dayLabel(day)}` : undefined} className={cn("flex-1 text-[11px] font-medium whitespace-nowrap", tone("orange").text)}>
          {lateLabel(p.publishDate, today)}
        </span>
        <DatePicker value={day} today={today} allowClear={false} onPick={(iso) => iso && onReschedule(iso)}>
          <button type="button" aria-label={`Reschedule ${p.title}`} className="h-7 shrink-0 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
            Reschedule…
          </button>
        </DatePicker>
        <button type="button" aria-label={`Move ${p.title} back to ideas`} onClick={onUnschedule} className="h-7 shrink-0 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
          Back to ideas
        </button>
      </div>
    </li>
  );
}

// ---- Month ----

const MONTH_CAP = 3;

function MonthGrid({ items, month, today, onOpen, onPickWeek }: { items: Piece[]; month: string; today: string; onOpen: (p: Piece) => void; onPickWeek: (day: string) => void }) {
  const weeks = monthWeeks(month);
  const byDay = useMemo(() => {
    const m = new Map<string, Piece[]>();
    for (const p of items) {
      const d = dayOf(p.publishDate);
      if (d) m.set(d, [...(m.get(d) ?? []), p]);
    }
    return m;
  }, [items]);
  return (
    <div role="table" aria-label={monthLabel(month)} className="overflow-hidden rounded-xl border">
      <div role="row" className="grid grid-cols-7 border-b bg-muted/40 text-xs text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} role="columnheader" className="px-2 py-1.5">
            <span className="sm:hidden">{d[0]}</span>
            <span className="max-sm:hidden">{d}</span>
          </div>
        ))}
      </div>
      {weeks.map((w) => (
        <div key={w[0]} role="row" className="grid grid-cols-7 border-b border-border/60 last:border-b-0">
          {w.map((d) => {
            const list = [...(byDay.get(d) ?? [])].sort((a, b) => rowOf(a).localeCompare(rowOf(b)));
            return (
              <MonthCell key={d} day={d} inMonth={d.startsWith(month)} today={d === today}>
                <span className="hidden flex-col gap-1 sm:flex">
                  {list.slice(0, MONTH_CAP).map((p) => (
                    <button key={p.id} type="button" onClick={() => onOpen(p)} className={cn("flex h-6 min-w-0 items-center gap-1.5 rounded px-1.5 text-left text-[11px]", tone(statusOf(p.status).tone).chip)}>
                      <ChannelDot channel={p.channel} className="size-1.5" />
                      <span className="truncate text-foreground">{p.title}</span>
                    </button>
                  ))}
                  {list.length > MONTH_CAP && (
                    <button type="button" onClick={() => onPickWeek(d)} className="self-start px-1 text-[11px] text-muted-foreground hover:text-foreground">
                      +{list.length - MONTH_CAP} more
                    </button>
                  )}
                </span>
                {list.length > 0 && (
                  <button type="button" onClick={() => onPickWeek(d)} aria-label={`${list.length} on ${dayLabel(d)}, open that week`} className="flex flex-wrap gap-0.5 sm:hidden">
                    {list.map((p) => (
                      <span key={p.id} aria-hidden className={cn("size-1.5 rounded-full", tone(statusOf(p.status).tone).dot)} />
                    ))}
                  </button>
                )}
              </MonthCell>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthCell({ day, inMonth, today, children }: { day: string; inMonth: boolean; today: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day|${day}` });
  return (
    <div ref={setNodeRef} role="cell" aria-label={dayLabel(day)} aria-current={today ? "date" : undefined} className={cn("flex min-h-14 min-w-0 flex-col gap-1 border-l border-border/60 p-1 first:border-l-0 sm:min-h-24 sm:p-1.5", !inMonth && "bg-muted/30", isOver && "bg-brand/[0.08] ring-2 ring-brand/40 ring-inset")}>
      <span className={cn("grid size-5 place-items-center rounded-full font-mono text-[11px]", today ? "bg-brand font-medium text-brand-foreground" : inMonth ? "text-foreground/80" : "text-muted-foreground/60")}>{Number(day.slice(8))}</span>
      {children}
    </div>
  );
}
