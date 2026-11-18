"use client";

import { Check, ChevronDown, Copy, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type ProductFeedback } from "@/components/product/send-to-product";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logTouch } from "@/lib/prospects/actions";
import type { ActivityEntry, ProspectRecord } from "@/lib/prospects/parse";
import { STAGES, UNSCORED_KINDS, WRITABLE, type Channel } from "@/lib/prospects/schema";

import { addDays } from "@/lib/prospects/stats";
import { emailParts, mailtoHref, telHref, whatsappHref } from "@/lib/prospects/contact";
import { BandBadge, DatePicker, DueChip, Segmented, StageDot } from "../bits";
import { STAGE_COACHING } from "../playbook-content";
import { useStageMove } from "../stage-check";
import { fillTemplate, GENERAL_ANGLE, TEMPLATE_ANGLES, type TemplateChannel } from "../templates";
import { ActivityTable } from "./activity";
import type { Detail, RecordTab } from "./index";
import { FactTable, Section, SmallButton, TextDialog, subjectOf, useSave } from "./shared";
import type { Ctx } from "./shared";


/* ---------- overview tab ---------- */

export function NextStepCard({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const { save, pending } = useSave(ctx);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.nextStep);
  const { move, dialog, pending: moving } = useStageMove(ctx.onChanged);
  const commit = () => (draft.trim() === r.nextStep.trim() ? setEditing(false) : save({ next_step: draft.trim() }, () => setEditing(false)));
  const next = r.stage < 5 ? r.stage + 1 : null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex-1 font-medium text-muted-foreground">Next step</span>
        <DatePicker value={r.nextStepDate} today={ctx.today} onPick={(iso) => save({ next_step_date: iso })} disabled={pending}>
          <button type="button" className="rounded-md border px-2 py-1 hover:bg-muted">
            {r.nextStepDate ? <DueChip date={r.nextStepDate} today={ctx.today} /> : <span className="text-muted-foreground">Set a date</span>}
          </button>
        </DatePicker>
      </div>
      {editing ? (
        <input
          autoFocus
          aria-label="Next step"
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-9 rounded-md border bg-background px-2.5 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(r.nextStep);
            setEditing(true);
          }}
          className="group/ns flex items-start gap-2 text-left text-[15px] leading-snug"
        >
          <span className="flex-1">{r.nextStep || <span className="text-muted-foreground">What happens next? Click to write it.</span>}</span>
          <Pencil className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/ns:opacity-100" />
        </button>
      )}
      {next !== null && (
        <div className="flex flex-col gap-2 border-t pt-3 text-[13px] sm:flex-row sm:items-center">
          <span className="flex-1 leading-snug text-muted-foreground">
            To reach <strong className="font-medium text-foreground">{STAGES[next]}</strong>: {STAGE_COACHING[r.stage].tips[0]}
          </span>
          <SmallButton className="h-8 shrink-0" disabled={moving} onClick={() => move(subjectOf(r), next)}>
            Move to {STAGES[next]}
          </SmallButton>
        </div>
      )}
      {dialog}
    </div>
  );
}

export const DRAFTS = [
  { key: "whatsapp", col: "draft_whatsapp", label: "WhatsApp", channel: "WhatsApp" as Channel },
  { key: "call", col: "draft_call", label: "Call script", channel: "Call" as Channel },
  { key: "email", col: "draft_email", label: "Email", channel: "Email" as Channel },
  { key: "meeting", col: "draft_meeting", label: "Meeting", channel: "Meeting" as Channel },
] as const;

export function Drafts({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const channels = DRAFTS.filter((c) => WRITABLE[ctx.kind].has(c.col));
  const [tab, setTab] = useState<(typeof DRAFTS)[number]["key"]>(() => channels.find((c) => r.drafts[c.key])?.key ?? channels[0]?.key ?? "whatsapp");
  const [editOpen, setEditOpen] = useState(false);
  const [starter, setStarter] = useState<string | undefined>(undefined);
  const [pending, start] = useTransition();
  if (!channels.length) return null;
  const ch = channels.find((c) => c.key === tab) ?? channels[0];
  const text = r.drafts[ch.key];
  const email = ch.key === "email" ? emailParts(text) : null;
  const openHref = ch.key === "whatsapp" ? whatsappHref(r.phone, text) : ch.key === "email" ? mailtoHref(r.email, text) : ch.key === "call" ? telHref(r.phone) : null;
  const markSent = () =>
    start(async () => {
      const res = await logTouch({
        kind: ctx.kind,
        id: ctx.id,
        name: r.name,
        channel: ch.channel,
        direction: "Outbound",
        outcome: ch.key === "call" || ch.key === "meeting" ? "Connected" : "Sent",
        durationMin: null,
        summary: "",
        statusAfter: STAGES[Math.max(r.stage, 1)],
        nextStep: r.nextStep || "Follow up",
        nextStepDate: addDays(ctx.today, 3),
      });
      if (res.ok) {
        toast.success(res.message);
        ctx.onChanged();
      } else toast.error(res.message);
    });
  return (
    <Section title="Draft" aside={<Segmented label="Draft channel" value={ch.key} onChange={setTab} options={channels.map((c) => ({ value: c.key, label: c.label }))} />}>
      <div className="overflow-hidden rounded-xl border">
        {text ? (
          <div className="text-sm leading-relaxed">
            {email?.subject && (
              <p className="border-b px-4 py-2 text-[13px]">
                <span className="text-muted-foreground">Subject</span>&nbsp;&nbsp;{email.subject}
              </p>
            )}
            <p className="max-h-72 overflow-y-auto px-4 py-3 whitespace-pre-wrap">{email ? email.body : text}</p>
          </div>
        ) : (
          <p className="px-4 py-5 text-[13px] text-muted-foreground">No {ch.label === "Call script" ? "call script" : `${ch.label} draft`} yet. Research writes one per record, or write your own.</p>
        )}
        <div className="flex flex-wrap gap-1.5 border-t bg-muted/30 px-3 py-2">
          {text && openHref && (
            <a href={openHref} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background hover:bg-foreground/85">
              {ch.key === "call" ? "Call now" : `Open in ${ch.key === "email" ? "Mail" : ch.label}`}
            </a>
          )}
          {text && (
            <Button size="sm" variant="outline" className="h-8 bg-background" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Draft copied"))}>
              <Copy /> Copy
            </Button>
          )}
          {WRITABLE[ctx.kind].has(ch.col) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-background"
              onClick={() => {
                setStarter(undefined);
                setEditOpen(true);
              }}
            >
              <Pencil /> {text ? "Edit" : "Write"}
            </Button>
          )}
          {!text && ch.key !== "meeting" && WRITABLE[ctx.kind].has(ch.col) && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-[13px] font-medium hover:bg-muted aria-expanded:bg-muted">
                Start from a template <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-auto min-w-56">
                {TEMPLATE_ANGLES.map((a) => (
                  <DropdownMenuItem
                    key={a}
                    onClick={() => {
                      setStarter(fillTemplate(a, ch.key as TemplateChannel, { kind: r.kind, name: r.name, city: r.city, lenders: r.lenders }, ctx.me));
                      setEditOpen(true);
                    }}
                  >
                    {a === GENERAL_ANGLE ? "Discovery (any prospect)" : a}
                    {a === r.pitchAngle && <span className="ml-auto text-xs text-muted-foreground">their pitch</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className="flex-1" />
          {text && (
            <Button size="sm" variant="ghost" className="h-8" onClick={markSent} disabled={pending}>
              <Check /> {pending ? "Saving…" : ch.key === "call" || ch.key === "meeting" ? "Mark done" : "Mark sent"}
            </Button>
          )}
        </div>
      </div>
      <TextDialog ctx={ctx} col={ch.col} title={`${ch.label} draft`} description={`For ${r.name}. Saved to the sheet; research may rewrite it.`} value={text} initial={starter} open={editOpen} onOpenChange={setEditOpen} />
    </Section>
  );
}


/** Rows this prospect is connected to — firm, partners, lenders, panel — each one click away. */
export function RelatedSection({ ctx, related }: { ctx: Ctx; related: Detail["related"] }) {
  if (!related.items.length) return null;
  return (
    <Section title="Related" aside={related.more ? <span className="text-xs text-muted-foreground">+{related.more} more</span> : undefined}>
      <div className="overflow-hidden rounded-lg border">
          <table className="w-full table-fixed text-[13px]">
            <tbody>
              {related.items.map((x) => (
                <tr key={`${x.kind}:${x.id}`} className="border-b border-border/60 last:border-0">
                  <td className="w-28 truncate bg-muted/30 px-3 py-2 text-muted-foreground">{x.relation}</td>
                  <td className="truncate px-3 py-2">
                    <button type="button" onClick={() => ctx.onOpen(x)} className="font-medium hover:underline">
                      {x.name}
                    </button>
                    {x.city && <span className="text-muted-foreground"> · {x.city}</span>}
                  </td>
                  <td className="w-32 px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                    <StageDot stage={x.stage} /> {STAGES[x.stage]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </Section>
  );
}

export function OverviewTab({ ctx, r, activity, related, fb, onTab }: { ctx: Ctx; r: ProspectRecord; activity: ActivityEntry[]; related: Detail["related"]; fb: ProductFeedback; onTab: (t: RecordTab) => void }) {
  const has = (col: string) => WRITABLE[ctx.kind].has(col);
  const keyFacts = [
    { label: "Phone", value: r.phone || "Not known yet", missing: !r.phone },
    { label: "Email", value: r.email || "Not known yet", missing: !r.email },
    ...(has("lenders_empanelled_with") ? [{ label: "Lender panels", value: r.lenders.join(" · ") || "Not known yet", missing: !r.lenders.length }] : []),
    ...(has("current_software") ? [{ label: "Software", value: r.software || "Ask on a call", missing: !r.software }] : []),
    ...(has("lb_cases_per_month") ? [{ label: "Cases a month", value: r.casesPerMonth ?? "Ask on a call", missing: r.casesPerMonth === null }] : []),
    ...(has("pitch_angle") ? [{ label: "Pitch", value: r.pitchAngle || "Pick one", missing: !r.pitchAngle }] : []),
  ];
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-8">
        <NextStepCard ctx={ctx} r={r} />
        <Drafts ctx={ctx} r={r} />
        <Section
          title="Recent activity"
          aside={
            activity.length > 3 ? (
              <button type="button" onClick={() => onTab("activity")} className="text-xs text-muted-foreground hover:text-foreground">
                All {activity.length} →
              </button>
            ) : undefined
          }
        >
          <ActivityTable items={activity} limit={3} r={r} fb={fb} />
        </Section>
      </div>
      <div className="flex min-w-0 flex-col gap-8">
        <Section
          title="Key facts"
          aside={
            <button type="button" onClick={() => onTab("details")} className="text-xs text-muted-foreground hover:text-foreground">
              All details →
            </button>
          }
        >
          <FactTable rows={keyFacts} />
        </Section>
        {r.scoreGaps && (
          <Section title="Find out next">
            <p className="rounded-lg bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-950 dark:bg-amber-950 dark:text-amber-100">{r.scoreGaps}</p>
          </Section>
        )}
        {!UNSCORED_KINDS.has(ctx.kind) && r.opportunityScore !== null && (
          <Section
            title="Score"
            aside={
              <button type="button" onClick={() => onTab("research")} className="text-xs text-muted-foreground hover:text-foreground">
                Breakdown →
              </button>
            }
          >
            <div className="flex items-center gap-3 rounded-lg border px-3.5 py-3">
              <BandBadge band={r.band} score={r.opportunityScore} />
              <span className="text-[13px] leading-snug text-muted-foreground">{r.scoreReason || r.bandLabel}</span>
            </div>
          </Section>
        )}
        <RelatedSection ctx={ctx} related={related} />
      </div>
    </div>
  );
}
