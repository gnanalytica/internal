"use client";

import { ArrowRight, Link2, Mail, MessageCircle, MessageSquare, Phone, Plus, StickyNote, UserMinus, UserPlus, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { SendToProductButton, type ProductFeedback } from "@/components/product/send-to-product";
import type { ActivityEntry, ProspectRecord } from "@/lib/prospects/parse";
import { displayDate, stageIndex } from "@/lib/prospects/parse";
import { buildHistory, whenLabel, type HistoryItem } from "@/lib/prospects/history";
import { isAssignedTo } from "@/lib/prospects/stats";
import { WRITABLE, type Channel } from "@/lib/prospects/schema";
import { canSendTouch, touchContact, touchSource, touchSourceRef } from "@/lib/send-to-product";
import { CHANNEL_TONE, Owner, outcomeTone, StageDot, ToneChip } from "../bits";
import { Section, SmallButton, TextDialog } from "./shared";
import { Button } from "@/components/ui/button";
import { commentOnProspect } from "@/lib/prospects/actions";
import { isMentionToken, mentionKeysForMember } from "@/lib/mentions";
import { useMentionAutocomplete } from "@/lib/use-mention-autocomplete";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

const CHANNEL_ICON: Record<string, typeof Phone> = { Call: Phone, WhatsApp: MessageCircle, Email: Mail, LinkedIn: Link2, Meeting: Users, Other: MessageSquare };

function Dot({ children }: { children: React.ReactNode }) {
  return <span className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground">{children}</span>;
}

function HistoryRow({ item, r, fb, today, people }: { item: HistoryItem; r: ProspectRecord; fb: ProductFeedback; today: string; people: Person[] }) {
  const when = whenLabel(item.date, today);
  const time = when ? <span className="shrink-0 font-mono text-xs text-muted-foreground" title={item.date ? displayDate(item.date) : undefined}>{when}</span> : null;
  if (item.type === "touch") {
    const a = item.entry;
    const Icon = CHANNEL_ICON[a.channel] ?? MessageSquare;
    return (
      <li className="flex gap-3">
        <Dot>
          <Icon className="size-3" />
        </Dot>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
            <span className="font-medium">{first(a.by)}</span>
            <span className="text-muted-foreground">logged</span>
            <ToneChip t={CHANNEL_TONE[a.channel as Channel] ?? "gray"}>{a.channel || "—"}</ToneChip>
            <ToneChip t={outcomeTone(a.outcome)}>{a.outcome || "—"}</ToneChip>
            {a.durationMin ? <span className="text-xs text-muted-foreground">{a.durationMin} min</span> : null}
            {a.statusAfter && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowRight className="size-3" />
                <StageDot stage={stageIndex(a.statusAfter)} /> {a.statusAfter}
              </span>
            )}
            <span className="flex-1" />
            {time}
          </div>
          {canSendTouch(a) && (
            <div className="flex items-start gap-1 rounded-md border bg-muted/30 px-2.5 py-1.5 text-[13px]">
              <span className="min-w-0 flex-1 text-muted-foreground">{a.summary}</span>
              <SendToProductButton fb={fb} payload={{ body: a.summary, contact: touchContact(r.name, r.stage), source: touchSource(r.stage), sourceRef: touchSourceRef(r.kind, r.id, a) }} />
            </div>
          )}
        </div>
      </li>
    );
  }
  if (item.type === "stage") {
    return (
      <li className="flex items-center gap-3 text-[13px]">
        <Dot>
          <StageDot stage={stageIndex(item.to)} />
        </Dot>
        <span className="min-w-0 flex-1">
          {item.by ? <span className="font-medium">{item.by}</span> : "Someone"} <span className="text-muted-foreground">moved</span> {item.from ? <>{item.from} <ArrowRight className="inline size-3 text-muted-foreground" /> </> : <span className="text-muted-foreground">to </span>}
          {item.to}
        </span>
        {time}
      </li>
    );
  }
  if (item.type === "owner") {
    return (
      <li className="flex items-center gap-3 text-[13px]">
        <Dot>{item.to ? <UserPlus className="size-3" /> : <UserMinus className="size-3" />}</Dot>
        <span className="min-w-0 flex-1">
          {item.by ? <span className="font-medium">{item.by}</span> : "Someone"}{" "}
          {item.to ? (
            item.by && isAssignedTo(item.to, item.by) && !item.from ? (
              <span className="text-muted-foreground">took it</span>
            ) : (
              <>
                <span className="text-muted-foreground">assigned it to</span> <span className="font-medium">{item.to}</span>
              </>
            )
          ) : (
            <span className="text-muted-foreground">unassigned it</span>
          )}
          {item.from && <span className="text-muted-foreground"> (was {item.from})</span>}
        </span>
        {time}
      </li>
    );
  }
  if (item.by) {
    return (
      <li className="flex gap-3 text-[13px]">
        <span className="relative z-10 shrink-0">
          <Owner name={item.by} />
        </span>
        <div className="min-w-0 flex-1 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-xs font-medium">{item.by}</span>
            <span className="flex-1" />
            {time}
          </div>
          <MentionText text={item.text} people={people} />
        </div>
      </li>
    );
  }
  return (
    <li className="flex gap-3 text-[13px]">
      <Dot>
        <StickyNote className="size-3" />
      </Dot>
      <span className="min-w-0 flex-1 pt-0.5 leading-relaxed whitespace-pre-wrap">
        <MentionText text={item.text} people={people} />
      </span>
      {time}
    </li>
  );
}

type Person = { id: string; name: string; email: string };

/** A note or comment with its @mentions picked out. */
function MentionText({ text, people }: { text: string; people: Person[] }) {
  return (
    <span className="leading-relaxed whitespace-pre-wrap">
      {text.split(/(@[\w.-]+)/g).map((p, i) =>
        p.startsWith("@") && isMentionToken(p.slice(1), people) ? (
          <span key={i} className="rounded bg-brand/10 px-0.5 font-medium text-brand">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

/** Linear-style comment box: @ to mention a teammate (they get an Inbox ping), ⌘↵ to send. */
function Composer({ ctx, people }: { ctx: Ctx; people: Person[] }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const mention = useMentionAutocomplete({ members: people, value: body, onChange: setBody });
  const { textareaRef, suggestions, activeIndex, handleChange, handleKeyDown, insert, setActiveIndex, close } = mention;
  const submit = () => {
    if (!body.trim() || pending) return;
    start(async () => {
      const res = await commentOnProspect(ctx.kind, ctx.id, body);
      if (res.ok) {
        setBody("");
        close();
        ctx.onChanged();
      } else toast.error(res.message);
    });
  };
  return (
    <div className="relative rounded-lg border focus-within:border-brand">
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border bg-popover py-1 shadow-md">
          {suggestions.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insert(m);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn("flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm", i === activeIndex ? "bg-accent" : "hover:bg-accent/60")}
            >
              <Owner name={m.name} />
              <span className="truncate">{m.name}</span>
              <span className="ml-auto truncate text-[11px] text-muted-foreground">@{mentionKeysForMember(m)[0]}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        aria-label="Comment"
        value={body}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (handleKeyDown(e)) return;
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        placeholder="Leave a comment… (@ to mention)"
        rows={2}
        className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between border-t px-2 py-1.5">
        <span className="text-[11px] text-muted-foreground">
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono">⌘↵</kbd> to send · saved to the sheet&apos;s notes
        </span>
        <Button size="sm" className="h-7" onClick={submit} disabled={pending || !body.trim()}>
          {pending ? "Sending…" : "Comment"}
        </Button>
      </div>
    </div>
  );
}

const first = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function ActivityTab({ ctx, r, activity, fb }: { ctx: Ctx; r: ProspectRecord; activity: ActivityEntry[]; fb: ProductFeedback }) {
  const [editOpen, setEditOpen] = useState(false);
  const items = buildHistory(r.notes, activity);
  const canNote = WRITABLE[ctx.kind].has("notes");
  const people: Person[] = [ctx.me, ...ctx.team.filter((t) => !isAssignedTo(t, ctx.me))].filter(Boolean).map((n) => ({ id: n, name: n, email: "" }));
  return (
    <div className="flex flex-col gap-8">
      <Section
        title={`History${items.length ? ` · ${items.length}` : ""}`}
        aside={
          <div className="flex gap-1.5">
            {r.notes && canNote && <SmallButton onClick={() => setEditOpen(true)}>Edit notes</SmallButton>}
            <SmallButton onClick={() => ctx.onLog()}>
              <Plus className="size-3.5" /> Log a touch
            </SmallButton>
          </div>
        }
      >
        {canNote && (
          <div className="mb-5">
            <Composer ctx={ctx} people={people} />
          </div>
        )}
        {items.length ? (
          <ol className="relative flex flex-col gap-4 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-px before:bg-border">
            {items.map((item, i) => (
              <HistoryRow key={item.type === "touch" ? item.entry.id || `t${i}` : i} item={item} r={r} fb={fb} today={ctx.today} people={people} />
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">Nothing yet. Touches, notes, and stage and owner changes show up here, newest first.</p>
        )}
      </Section>
      <TextDialog ctx={ctx} col="notes" title="Notes" description="Newest first, one line per entry." value={r.notes} open={editOpen} onOpenChange={setEditOpen} rows={16} />
    </div>
  );
}
