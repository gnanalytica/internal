"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { SendToProductButton, type ProductFeedback } from "@/components/product/send-to-product";
import type { ActivityEntry, ProspectRecord } from "@/lib/prospects/parse";
import { displayDate } from "@/lib/prospects/parse";
import { WRITABLE, type Channel } from "@/lib/prospects/schema";
import { canSendTouch, touchContact, touchSource, touchSourceRef } from "@/lib/send-to-product";
import { CHANNEL_TONE, outcomeTone, ToneChip } from "../bits";
import { AddNoteDialog, Section, SmallButton, TextDialog } from "./shared";
import type { Ctx } from "./shared";


export function shortStamp(a: ActivityEntry): string {
  return a.date ? displayDate(a.date) : a.loggedAt.slice(0, 10);
}

/** A touch's "what they said", with the button that sends it to Product. */
export function SaidCell({ a, r, fb }: { a: ActivityEntry; r: ProspectRecord; fb: ProductFeedback }) {
  if (!canSendTouch(a)) return <td className="px-3 py-2 text-muted-foreground">—</td>;
  return (
    <td className="py-1.5 pr-1.5 pl-3">
      <div className="flex items-start gap-1">
        <span className="min-w-0 flex-1 pt-0.5 text-muted-foreground">{a.summary}</span>
        <SendToProductButton fb={fb} payload={{ body: a.summary, contact: touchContact(r.name, r.stage), source: touchSource(r.stage), sourceRef: touchSourceRef(r.kind, r.id, a) }} />
      </div>
    </td>
  );
}

export function ActivityTable({ items, limit, r, fb }: { items: ActivityEntry[]; limit?: number; r: ProspectRecord; fb: ProductFeedback }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">Nothing logged yet. Every call or message logged here lands in this table and in the sheet&apos;s Activity tab.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-normal">Date</th>
            <th className="px-3 py-2 font-normal">Channel</th>
            <th className="px-3 py-2 font-normal">Outcome</th>
            <th className="px-3 py-2 font-normal">Stage after</th>
            <th className="px-3 py-2 font-normal">By</th>
            <th className="px-3 py-2 font-normal">What they said</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((a) => (
            <tr key={a.id || a.loggedAt} className="border-t border-border/60 align-top hover:bg-muted/30">
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted-foreground">{shortStamp(a)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <ToneChip t={CHANNEL_TONE[a.channel as Channel] ?? "gray"}>{a.channel || "—"}</ToneChip>
                {a.durationMin ? <span className="text-xs text-muted-foreground"> · {a.durationMin} min</span> : null}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <ToneChip t={outcomeTone(a.outcome)}>{a.outcome || "—"}</ToneChip>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{a.statusAfter || "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">{a.by.split(/\s+/)[0]}</td>
              <SaidCell a={a} r={r} fb={fb} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* ---------- activity tab ---------- */

export function ActivityTab({ ctx, r, activity, fb }: { ctx: Ctx; r: ProspectRecord; activity: ActivityEntry[]; fb: ProductFeedback }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const notes = r.notes.split("\n").filter((l) => l.trim());
  return (
    <div className="flex flex-col gap-8">
      <Section
        title={`Touches${activity.length ? ` · ${activity.length}` : ""}`}
        aside={
          <SmallButton onClick={() => ctx.onLog()}>
            <Plus className="size-3.5" /> Log a touch
          </SmallButton>
        }
      >
        <ActivityTable items={activity} r={r} fb={fb} />
      </Section>
      <Section
        title="Notes"
        aside={
          <div className="flex gap-1.5">
            {r.notes && WRITABLE[ctx.kind].has("notes") && <SmallButton onClick={() => setEditOpen(true)}>Edit all</SmallButton>}
            {WRITABLE[ctx.kind].has("notes") && (
              <SmallButton onClick={() => setNoteOpen(true)}>
                <Plus className="size-3.5" /> Add a note
              </SmallButton>
            )}
          </div>
        }
      >
        {notes.length ? (
          <ul className="divide-y divide-border/60 rounded-lg border">
            {notes.map((l, i) => {
              const m = l.match(/^(\d{2}-\d{2}-\d{4})\s+—\s+(.*)$/);
              return (
                <li key={i} className="grid grid-cols-[92px_1fr] gap-3 px-3 py-2 text-[13px] leading-relaxed">
                  <span className="font-mono text-xs text-muted-foreground">{m?.[1] ?? ""}</span>
                  <span>{m?.[2] ?? l}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">No notes yet. Logging a touch adds a dated line here.</p>
        )}
      </Section>
      <AddNoteDialog ctx={ctx} r={r} open={noteOpen} onOpenChange={setNoteOpen} />
      <TextDialog ctx={ctx} col="notes" title="Notes" description="Newest first, one line per entry." value={r.notes} open={editOpen} onOpenChange={setEditOpen} rows={16} />
    </div>
  );
}
