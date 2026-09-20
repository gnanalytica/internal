"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
import { deleteInteraction, logInteraction } from "@/lib/sheet-crm/actions";
import { INTERACTION_CHANNELS, LOGGABLE_CHANNELS, OUTREACH_STATUS_MAP, isOutreachStatus, type InteractionDirection } from "@/lib/sheet-crm/outreach";
import type { Interaction } from "@/lib/sheet-crm/queries";
import { formatDate } from "@/lib/matrix-format";

const fieldCls = "h-9 min-w-0 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 sm:h-8";

const channelMeta = (id: string) => INTERACTION_CHANNELS.find((c) => c.id === id) ?? { id, label: id, color: "#94a3b8" };

/** Log a WhatsApp exchange, a call, a LinkedIn message, a meeting or a note. */
export function LogInteractionForm({ contactId, accountId, prefill, campaigns = [] }: { contactId?: string; accountId?: string; prefill?: { body?: string }; campaigns?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [channel, setChannel] = useState("whatsapp");
  const [direction, setDirection] = useState<InteractionDirection>("out");
  const [body, setBody] = useState(prefill?.body ?? "");
  const [subject, setSubject] = useState("");
  const [when, setWhen] = useState("");
  const [held, setHeld] = useState(false);
  const [campaignId, setCampaignId] = useState("");

  function submit() {
    if (!body.trim() && !subject.trim()) return;
    start(async () => {
      const r = await logInteraction({ contactId, accountId, channel, direction, body, subject, occurredAt: when || null, held, campaignId: campaignId || null });
      setBody("");
      setSubject("");
      if (r.newStatus && isOutreachStatus(r.newStatus)) toast.success(`Logged · status → ${OUTREACH_STATUS_MAP[r.newStatus].label}`);
      else toast.success("Logged");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={fieldCls} aria-label="Channel">
          {LOGGABLE_CHANNELS.map((c) => (
            <option key={c} value={c}>{channelMeta(c).label}</option>
          ))}
        </select>
        {channel !== "note" && channel !== "meeting" && (
          <select value={direction} onChange={(e) => setDirection(e.target.value as InteractionDirection)} className={fieldCls} aria-label="Direction">
            <option value="out">Sent</option>
            <option value="in">Received</option>
          </select>
        )}
        {channel === "meeting" && (
          <label className="col-span-2 flex items-center gap-1.5 text-xs sm:col-span-1">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={held} onChange={(e) => setHeld(e.target.checked)} /> Held (not just booked)
          </label>
        )}
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={fieldCls + " col-span-2 sm:col-span-1"} aria-label="When" />
        {campaigns.length > 0 && (
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={fieldCls + " col-span-2 sm:col-span-1"} aria-label="Campaign">
            <option value="">No campaign</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" className={fieldCls + " col-span-2 sm:min-w-40 sm:flex-1"} />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={channel === "whatsapp" ? "Paste the message or reply…" : "What happened?"}
        rows={3}
        className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="flex justify-end">
        <Button size="sm" className="h-9 w-full sm:h-8 sm:w-auto" disabled={pending || (!body.trim() && !subject.trim())} onClick={submit}>
          Log
        </Button>
      </div>
    </div>
  );
}

/** Everything that happened, newest first: interactions, research changes, tasks. */
export function Timeline({ items, activities }: { items: Interaction[]; activities?: { id: string; type: string; body: string | null; createdAt: Date; done: boolean; actor: { name: string; avatarColor: string } | null }[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  type Row = { id: string; at: Date; kind: "interaction"; it: Interaction } | { id: string; at: Date; kind: "activity"; a: NonNullable<typeof activities>[number] };
  const rows: Row[] = [
    ...items.map((it) => ({ id: it.id, at: new Date(it.occurredAt), kind: "interaction" as const, it })),
    ...(activities ?? []).map((a) => ({ id: a.id, at: new Date(a.createdAt), kind: "activity" as const, a })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">Nothing logged yet.</p>;
  return (
    <ol className="space-y-2">
      {rows.map((r) => {
        if (r.kind === "activity") {
          return (
            <li key={r.id} className="rounded-md border bg-background p-2 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border px-1.5">{r.a.type}</span>
                <span>{formatDate(r.a.createdAt)}</span>
                {r.a.actor && <span className="flex items-center gap-1"><UserAvatar name={r.a.actor.name} color={r.a.actor.avatarColor} className="size-4 text-[8px]" />{r.a.actor.name}</span>}
              </div>
              {r.a.body && <p className="mt-1 whitespace-pre-wrap break-words">{r.a.body}</p>}
            </li>
          );
        }
        const it = r.it;
        const m = channelMeta(it.channel);
        return (
          <li key={r.id} className="relative rounded-md border bg-background p-2 pr-8 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="rounded-full border px-1.5 font-medium" style={{ color: m.color, borderColor: m.color + "55", backgroundColor: m.color + "15" }}>{m.label}</span>
              {it.direction !== "none" && <span>{it.direction === "out" ? "sent" : "received"}</span>}
              <span>{formatDate(it.occurredAt)}</span>
              <span className="opacity-70">via {it.source}</span>
              {it.actor && <span className="flex items-center gap-1"><UserAvatar name={it.actor.name} color={it.actor.avatarColor} className="size-4 text-[8px]" />{it.actor.name}</span>}
              {it.externalUrl && <a href={it.externalUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">open</a>}
              {it.source === "manual" && (
                // Absolutely placed: with `ml-auto` in a wrapping row it fell
                // onto a line of its own the moment the meta wrapped, which on a
                // phone is every row.
                <button
                  type="button"
                  className="tap-target absolute right-1 top-1 grid place-items-center text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                  onClick={() => start(async () => { await deleteInteraction(it.id); router.refresh(); })}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            {it.subject && <div className="mt-1 font-medium break-words">{it.subject}</div>}
            {it.summary && <p className="mt-1 whitespace-pre-wrap break-words text-foreground/90">{it.summary}</p>}
            {it.body && <p className="mt-1 whitespace-pre-wrap break-words text-foreground/80">{it.body}</p>}
          </li>
        );
      })}
    </ol>
  );
}
