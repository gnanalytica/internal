"use client";

import { ArrowLeft, Check, ChevronDown, Copy, Mail, Maximize2, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getProspectDetail, logTouch, saveProspect } from "@/lib/prospects/actions";
import type { ActivityEntry, ProspectRecord } from "@/lib/prospects/parse";
import { displayDate, isDoNotContact, parseNoteLines } from "@/lib/prospects/parse";
import { DISQUALIFY_REASONS, KIND_LABEL, OBJECTIONS, PITCH_ANGLES, SCORE_COLUMNS, STAGES, UNSCORED_KINDS, WRITABLE, type Channel, type Outcome, type ProspectKind } from "@/lib/prospects/schema";
import { addDays } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { BandBadge, Bar, DatePicker, DueChip, Owner, OwnerPicker, PATH, Segmented, StageBar, StageDot, shortDate } from "./bits";
import { STAGE_COACHING } from "./playbook-content";
import { useStageMove, type StageSubject } from "./stage-check";

export type Selection = { kind: ProspectKind; id: string };
export type Detail = { record: ProspectRecord; activity: ActivityEntry[] };
export type LogOpts = { channel?: Channel; outcome?: Outcome };

/** Loads one record's full detail through a server action; `reload` after every write. */
export function useDetail(sel: Selection | null) {
  const [state, setState] = useState<{ key: string; data: Detail | null } | null>(null);
  const [version, setVersion] = useState(0);
  const key = sel ? `${sel.kind}:${sel.id}:${version}` : "";
  useEffect(() => {
    if (!sel) return;
    let alive = true;
    getProspectDetail(sel.kind, sel.id).then(
      (data) => alive && setState({ key, data }),
      () => alive && setState({ key, data: null }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state && state.key === key ? state.data : undefined;
  // Keep showing the last good detail while a reload is in flight, so the panel does not flash.
  const shown = current === undefined && state && sel && state.key.startsWith(`${sel.kind}:${sel.id}:`) ? state.data : current;
  return { data: shown, loading: current === undefined, reload: () => setVersion((v) => v + 1) };
}

type Ctx = { kind: ProspectKind; id: string; today: string; me: string; team: string[]; onChanged: () => void; onLog: (o?: LogOpts) => void };

function useSave(ctx: Ctx) {
  const [pending, start] = useTransition();
  const save = (patch: Record<string, string | number | null>, after?: () => void) =>
    start(async () => {
      const r = await saveProspect(ctx.kind, ctx.id, patch);
      if (r.ok) {
        toast.success(r.message);
        after?.();
        ctx.onChanged();
      } else toast.error(r.message);
    });
  return { save, pending };
}

export function subjectOf(r: ProspectRecord): StageSubject {
  return { kind: r.kind, id: r.id, name: r.name, stage: r.stage, nextStep: r.nextStep, nextStepDate: r.nextStepDate, cases: r.casesPerMonth, software: r.software, pitchAngle: r.pitchAngle, objections: r.objections, hasPhone: Boolean(r.phone) };
}

function digits10(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

function emailParts(draft: string): { subject: string; body: string } {
  const m = draft.match(/^Subject:\s*(.+)\n+([\s\S]*)$/);
  return m ? { subject: m[1].trim(), body: m[2].trim() } : { subject: "", body: draft };
}

/**
 * One property: label on the left, value on the right. Clicking the value
 * edits it in place; Enter saves that one cell to the sheet, Escape cancels.
 */
function Prop({ ctx, col, label, value, display, options, type = "text", missing = "Add" }: { ctx: Ctx; col: string; label: string; value: string; display?: React.ReactNode; options?: readonly string[]; type?: "text" | "number"; missing?: string }) {
  const editable = WRITABLE[ctx.kind].has(col);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const { save, pending } = useSave(ctx);
  const commit = (v: string) => {
    if (v.trim() === value.trim()) return setEditing(false);
    save({ [col]: type === "number" ? (v.trim() === "" ? null : Number(v)) : v.trim() }, () => setEditing(false));
  };
  const shown = value ? (display ?? value) : <span className={editable ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>{editable ? missing : "—"}</span>;
  const body = !editable ? (
    <span className="block truncate px-2 py-1">{shown}</span>
  ) : options ? (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={pending} className="flex w-full min-w-0 items-center rounded-md px-2 py-1 text-left hover:bg-muted aria-expanded:bg-muted">
        <span className="truncate">{shown}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-52">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => commit(String(v))}>
          {[...new Set([...options, ...(value && !options.includes(value) ? [value] : [])])].map((o) => (
            <DropdownMenuRadioItem key={o} value={o}>
              {o}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="">Clear</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : editing ? (
    <input
      autoFocus
      aria-label={label}
      inputMode={type === "number" ? "numeric" : undefined}
      value={draft}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(draft);
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-7 w-full min-w-0 rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    />
  ) : (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="block w-full min-w-0 truncate rounded-md px-2 py-1 text-left hover:bg-muted"
    >
      {shown}
    </button>
  );
  return (
    <div className="grid min-h-8 grid-cols-[112px_minmax(0,1fr)] items-center text-[13px]">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="-mx-0 min-w-0">{body}</dd>
    </div>
  );
}

/** A long text cell (notes, research notes, a draft) that switches to a textarea to edit. */
function LongText({ ctx, col, label, value, display, empty, rows = 8 }: { ctx: Ctx; col: string; label: string; value: string; display: React.ReactNode; empty: string; rows?: number }) {
  const editable = WRITABLE[ctx.kind].has(col);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const { save, pending } = useSave(ctx);
  if (editing)
    return (
      <div className="flex flex-col gap-2">
        <textarea aria-label={label} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={rows} className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => save({ [col]: draft.trim() }, () => setEditing(false))}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  return (
    <div className="group/long flex flex-col gap-1.5">
      {value ? display : <p className="text-[13px] text-muted-foreground">{empty}</p>}
      {editable && (
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="self-start text-xs text-muted-foreground hover:text-foreground"
        >
          {value ? "Edit" : "Write"}
        </button>
      )}
    </div>
  );
}

/** The stage, as a menu: forward moves ask for what the current stage should have found out. */
function StageMenu({ ctx, r, className }: { ctx: Ctx; r: ProspectRecord; className?: string }) {
  const { move, dialog, pending } = useStageMove(ctx.onChanged);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger disabled={pending} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[13px] hover:bg-muted aria-expanded:bg-muted", className)}>
          <StageDot stage={r.stage} />
          {STAGES[r.stage]}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-48">
          <DropdownMenuRadioGroup value={String(r.stage)} onValueChange={(v) => move(subjectOf(r), Number(v))}>
            {STAGES.map((s, i) => (
              <div key={s} className="contents">
                {i === 6 && <DropdownMenuSeparator />}
                <DropdownMenuRadioItem value={String(i)}>
                  <StageDot stage={i} /> {s}
                </DropdownMenuRadioItem>
              </div>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}

/** Call, WhatsApp, Email and Log. Reaching out opens the log, ready for how it went. */
function ActionBar({ ctx, r, className }: { ctx: Ctx; r: ProspectRecord; className?: string }) {
  const phone = digits10(r.phone);
  const cls = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-muted sm:h-8 aria-disabled:pointer-events-none aria-disabled:opacity-40";
  const email = emailParts(r.drafts.email);
  return (
    <div className={cn("grid grid-cols-4 gap-1.5", className)}>
      <a href={phone ? `tel:+91${phone}` : undefined} aria-disabled={!phone} title={phone ? undefined : "No phone number yet"} onClick={() => phone && setTimeout(() => ctx.onLog({ channel: "Call", outcome: "Connected" }), 400)} className={cls}>
        <Phone className="size-3.5" /> Call
      </a>
      <a
        href={phone ? `https://wa.me/91${phone}${r.drafts.whatsapp ? `?text=${encodeURIComponent(r.drafts.whatsapp)}` : ""}` : undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!phone}
        title={phone ? undefined : "No phone number yet"}
        onClick={() => phone && setTimeout(() => ctx.onLog({ channel: "WhatsApp", outcome: "Sent" }), 400)}
        className={cls}
      >
        <MessageCircle className="size-3.5" /> <span className="max-sm:hidden">WhatsApp</span>
        <span className="sm:hidden">Chat</span>
      </a>
      <a
        href={r.email ? `mailto:${r.email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}` : undefined}
        aria-disabled={!r.email}
        title={r.email ? undefined : "No email yet"}
        onClick={() => r.email && setTimeout(() => ctx.onLog({ channel: "Email", outcome: "Sent" }), 400)}
        className={cls}
      >
        <Mail className="size-3.5" /> Email
      </a>
      <button type="button" onClick={() => ctx.onLog()} className={cn(cls, "border-foreground bg-foreground text-background hover:bg-foreground/85")}>
        Log
      </button>
    </div>
  );
}

function NextStep({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const { save, pending } = useSave(ctx);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.nextStep);
  const commit = () => (draft.trim() === r.nextStep.trim() ? setEditing(false) : save({ next_step: draft.trim() }, () => setEditing(false)));
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Next step</span>
        <DatePicker value={r.nextStepDate} today={ctx.today} onPick={(iso) => save({ next_step_date: iso })} disabled={pending}>
          <button type="button" className="rounded px-1 hover:bg-background">
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
          className="h-8 rounded-md border bg-background px-2 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(r.nextStep);
            setEditing(true);
          }}
          className="text-left text-sm leading-snug hover:text-foreground/80"
        >
          {r.nextStep || <span className="text-muted-foreground">What happens next? Click to write it.</span>}
        </button>
      )}
    </div>
  );
}

const DRAFTS = [
  { key: "whatsapp", col: "draft_whatsapp", label: "WhatsApp", channel: "WhatsApp" as Channel },
  { key: "call", col: "draft_call", label: "Call script", channel: "Call" as Channel },
  { key: "email", col: "draft_email", label: "Email", channel: "Email" as Channel },
  { key: "meeting", col: "draft_meeting", label: "Meeting", channel: "Meeting" as Channel },
] as const;

function Drafts({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const channels = DRAFTS.filter((c) => WRITABLE[ctx.kind].has(c.col));
  const [tab, setTab] = useState<(typeof DRAFTS)[number]["key"]>(() => channels.find((c) => r.drafts[c.key])?.key ?? channels[0]?.key ?? "whatsapp");
  const [pending, start] = useTransition();
  if (!channels.length) return null;
  const ch = channels.find((c) => c.key === tab) ?? channels[0];
  const text = r.drafts[ch.key];
  const phone = digits10(r.phone);
  const openHref =
    ch.key === "whatsapp" && phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
      : ch.key === "email" && r.email
        ? `mailto:${r.email}?subject=${encodeURIComponent(emailParts(text).subject)}&body=${encodeURIComponent(emailParts(text).body)}`
        : ch.key === "call" && phone
          ? `tel:+91${phone}`
          : null;
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
  const email = ch.key === "email" ? emailParts(text) : null;
  return (
    <section aria-label="Draft" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-2 text-sm font-semibold">Draft</h3>
        <Segmented label="Draft channel" value={ch.key} onChange={setTab} options={channels.map((c) => ({ value: c.key, label: c.label }))} />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <LongText
          ctx={ctx}
          col={ch.col}
          label={`${ch.label} draft`}
          value={text}
          rows={10}
          empty={`No ${ch.label.toLowerCase()} draft yet. Research writes one per record, or write your own.`}
          display={
            <div className="text-sm leading-relaxed">
              {email?.subject && (
                <p className="border-b px-3.5 py-2 text-[13px]">
                  <span className="text-muted-foreground">Subject</span>&nbsp;&nbsp;{email.subject}
                </p>
              )}
              <p className="px-3.5 py-3 whitespace-pre-wrap">{email ? email.body : text}</p>
            </div>
          }
        />
      </div>
      {text && (
        <div className="flex flex-wrap gap-1.5">
          {openHref && (
            <a href={openHref} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background hover:bg-foreground/85">
              {ch.key === "call" ? "Call now" : `Open in ${ch.key === "email" ? "Mail" : ch.label}`}
            </a>
          )}
          <Button size="sm" variant="outline" className="h-8" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Draft copied"))}>
            <Copy /> Copy
          </Button>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" className="h-8" onClick={markSent} disabled={pending}>
            <Check /> {pending ? "Saving…" : ch.key === "call" || ch.key === "meeting" ? "Mark done" : "Mark sent"}
          </Button>
        </div>
      )}
    </section>
  );
}

function ActivityList({ items, limit }: { items: ActivityEntry[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <p className="text-[13px] text-muted-foreground">Nothing logged yet. Every call or message you log lands here.</p>;
  return (
    <ul className="flex flex-col">
      {shown.map((a) => (
        <li key={a.id || a.loggedAt} className="grid grid-cols-[64px_1fr] gap-3 border-t py-2.5 text-[13px] first:border-t-0">
          <span className="pt-0.5 font-mono text-[11px] text-muted-foreground">{(a.date ? displayDate(a.date) : a.loggedAt).slice(0, 5)}</span>
          <span className="leading-snug">
            {a.channel} · <strong className="font-medium">{a.outcome}</strong>
            {a.durationMin ? ` · ${a.durationMin} min` : ""}
            {a.statusAfter ? <span className="text-muted-foreground"> → {a.statusAfter}</span> : null}
            <span className="text-muted-foreground"> · {a.by.split(/\s+/)[0]}</span>
            {a.summary && <span className="mt-0.5 block text-muted-foreground">{a.summary}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ResearchNotes({ r, limit }: { r: ProspectRecord; limit: number }) {
  const [all, setAll] = useState(false);
  const lines = parseNoteLines(r.researchNotes);
  const shown = all ? lines : lines.slice(0, limit);
  return (
    <div className="flex flex-col gap-1.5 text-[13px] leading-relaxed">
      {shown.map((l, i) =>
        l.label ? (
          <p key={i}>
            <span className="text-muted-foreground">{l.label}:</span> {l.text}
          </p>
        ) : (
          <p key={i} className={l.text.startsWith("- ") ? "pl-3" : "text-xs text-muted-foreground"}>
            {l.text}
          </p>
        ),
      )}
      {lines.length > limit && (
        <button type="button" className="self-start text-xs text-muted-foreground hover:text-foreground" onClick={() => setAll((v) => !v)}>
          {all ? "Show less" : `Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}

/** Shown on any record research has marked do-not-contact, above everything else. */
function DoNotContactBanner({ r }: { r: ProspectRecord }) {
  if (!isDoNotContact(r.researchNotes)) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-snug font-medium text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {r.researchNotes.trim().split("\n")[0]}
    </div>
  );
}

/** The editable facts for a kind of record, in the order people look for them. */
function Properties({ ctx, r, compact }: { ctx: Ctx; r: ProspectRecord; compact?: boolean }) {
  const has = (col: string) => WRITABLE[ctx.kind].has(col);
  const { save, pending } = useSave(ctx);
  return (
    <dl className="flex flex-col">
      <div className="grid min-h-8 grid-cols-[112px_minmax(0,1fr)] items-center text-[13px]">
        <dt className="text-muted-foreground">Owner</dt>
        <dd className="min-w-0">
          <OwnerPicker value={r.assigned} me={ctx.me} team={ctx.team} disabled={pending} onPick={(n) => save({ assigned: n })}>
            <button type="button" className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted">
              {r.assigned ? (
                <>
                  <Owner name={r.assigned} /> <span className="truncate">{r.assigned}</span>
                </>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">Nobody · assign</span>
              )}
            </button>
          </OwnerPicker>
        </dd>
      </div>
      {has("contact_person") && <Prop ctx={ctx} col="contact_person" label="Contact person" value={r.bank.contactPerson} />}
      {has("designation") && <Prop ctx={ctx} col="designation" label="Designation" value={r.bank.designation} />}
      <Prop ctx={ctx} col="phone" label="Phone" value={r.phone} missing="Add a number" />
      <Prop ctx={ctx} col="email" label="Email" value={r.email} missing="Add an email" />
      {has("lenders_empanelled_with") && <Prop ctx={ctx} col="lenders_empanelled_with" label="Lender panels" value={r.lenders.join("; ")} missing="Not known yet" />}
      {has("current_software") && <Prop ctx={ctx} col="current_software" label="Software" value={r.software} missing="Ask on a call" />}
      {has("lb_cases_per_month") && <Prop ctx={ctx} col="lb_cases_per_month" label="Cases / month" value={r.casesPerMonth === null ? "" : String(r.casesPerMonth)} type="number" missing="Ask on a call" />}
      {has("pitch_angle") && <Prop ctx={ctx} col="pitch_angle" label="Pitch" value={r.pitchAngle} options={PITCH_ANGLES} missing="Pick one" />}
      {has("objections") && <Prop ctx={ctx} col="objections" label="Objection" value={r.objections} options={OBJECTIONS} missing="None recorded" />}
      {!compact && has("key_contact") && <Prop ctx={ctx} col="key_contact" label="Key contact" value={r.keyContact} />}
      {!compact && has("outreach_route") && <Prop ctx={ctx} col="outreach_route" label="Outreach" value={r.outreachRoute} missing="Not planned" />}
      {!compact && has("referred_by") && <Prop ctx={ctx} col="referred_by" label="Referred by" value={r.referredBy} missing="—" />}
      {!compact && has("city") && <Prop ctx={ctx} col="city" label="City" value={r.city} />}
      {!UNSCORED_KINDS.has(ctx.kind) && (
        <div className="grid min-h-8 grid-cols-[112px_minmax(0,1fr)] items-center text-[13px]">
          <dt className="text-muted-foreground">Band</dt>
          <dd className="px-2">{r.band ? <BandBadge band={r.band} score={r.opportunityScore} /> : <span className="text-muted-foreground">Not scored yet</span>}</dd>
        </div>
      )}
      <div className="grid min-h-8 grid-cols-[112px_minmax(0,1fr)] items-center text-[13px]">
        <dt className="text-muted-foreground">Last contacted</dt>
        <dd className="px-2">{r.lastContacted ? displayDate(r.lastContacted) : <span className="text-muted-foreground">Never</span>}</dd>
      </div>
    </dl>
  );
}

function Registration({ r, kind }: { r: ProspectRecord; kind: ProspectKind }) {
  const rows = ([
    ["State", r.state],
    ["Address", r.address],
    ...(kind === "valuer" ? ([["RVO", r.rvo], ["Registered", r.registeredOn], ["Firm", r.firmRegNo ? `${r.firmRegNo}${r.firmStatus ? ` · ${r.firmStatus}` : ""}` : ""]] as [string, string][]) : []),
    ...(kind === "firm" ? ([["RVO", r.rvo], ["Partners", r.people]] as [string, string][]) : []),
    ...(kind === "rvo" ? ([["Website", r.website], ["Chair", r.keyContact], ["CEO / MD", r.people]] as [string, string][]) : []),
    ...(kind === "panel" ? ([["Practice", r.practice], ["IBBI", "Not on the IBBI register"]] as [string, string][]) : []),
    ...(kind === "bank"
      ? ([
          ["Institution", r.bank.institution],
          ["Type", r.bank.type],
          ["Office", r.bank.office],
          ["Department", r.bank.department],
          ["Empanelment", r.bank.empanelmentWindow],
          ["How to reach", r.bank.howToReach],
          ["Website", r.website],
        ] as [string, string][])
      : []),
  ] as [string, string][]).filter(([, v]) => v);
  return (
    <dl className="flex flex-col gap-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[96px_1fr] gap-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ScoreCard({ r }: { r: ProspectRecord }) {
  if (r.opportunityScore === null) return <p className="text-[13px] text-muted-foreground">{r.researchStatus ? `${r.researchStatus}. Scoring runs once research is reviewed.` : "Not scored yet."}</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {SCORE_COLUMNS.map((s, i) => (
        <div key={s.key} className="grid grid-cols-[1fr_64px_36px] items-center gap-2 text-xs">
          <span className="truncate">{s.label}</span>
          <Bar value={r.scores[i] ?? 0} max={s.max} className="h-1.5" />
          <span className="text-right font-mono text-muted-foreground tabular-nums">
            {r.scores[i] ?? "–"}/{s.max}
          </span>
        </div>
      ))}
      {r.scoreReason && <p className="mt-1 text-[13px] leading-snug">{r.scoreReason}</p>}
    </div>
  );
}

function DisqualifyButton({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(DISQUALIFY_REASONS[0]);
  const { save, pending } = useSave(ctx);
  if (!WRITABLE[ctx.kind].has("disqualified")) return null;
  const isOut = Boolean(r.disqualified) && r.disqualified !== "No";
  if (isOut)
    return (
      <p className="text-xs text-muted-foreground">
        Disqualified: {r.disqualified}.{" "}
        <button type="button" disabled={pending} onClick={() => save({ disqualified: "No" })} className="underline hover:text-foreground">
          Undo
        </button>
      </p>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="self-start text-[13px] text-red-700 hover:underline dark:text-red-400">
        Disqualify…
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disqualify {r.name}?</DialogTitle>
            <DialogDescription>They drop out of every queue and the pipeline. You can undo it from the record.</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Reason" className="flex flex-col">
            {DISQUALIFY_REASONS.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={reason === d} onClick={() => setReason(d)} className="flex h-9 items-center gap-2.5 rounded-md px-2 text-left text-sm hover:bg-muted">
                <span className={cn("size-3.5 shrink-0 rounded-full", reason === d ? "shadow-[inset_0_0_0_4.5px_var(--foreground)]" : "shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]")} />
                {d}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" className="bg-red-700 text-white hover:bg-red-800 dark:bg-red-700" disabled={pending} onClick={() => save({ disqualified: reason }, () => setOpen(false))}>
              {pending ? "Saving…" : "Disqualify"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** What the current stage still needs before moving on, and the button to move. */
function StageGuide({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const { move, dialog, pending } = useStageMove(ctx.onChanged);
  if (r.stage >= 5) return null;
  const next = r.stage + 1;
  const coach = STAGE_COACHING[r.stage];
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/60 px-3.5 py-3 text-[13px] sm:flex-row sm:items-center">
      <span className="flex-1 leading-snug">
        To reach <strong className="font-medium">{STAGES[next]}</strong>: {coach.tips[0]}
      </span>
      <Button size="sm" variant="outline" className="h-8 shrink-0 bg-background" disabled={pending} onClick={() => move(subjectOf(r), next)}>
        Move to {STAGES[next]}
      </Button>
      {dialog}
    </div>
  );
}

function useEscape(onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => {
    ref.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[role=dialog][data-open],[data-slot=popover-content],[data-slot=dropdown-menu-content]") && ref.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

type PanelProps = { sel: Selection; today: string; me: string; team: string[]; onLog: (o?: LogOpts) => void; onChanged: () => void; detail: ReturnType<typeof useDetail> };

/** The side panel: enough to act without leaving the list or board you were working through. */
export function RecordPanel({ sel, today, me, team, onClose, onExpand, onLog, onChanged, detail }: PanelProps & { onClose: () => void; onExpand: () => void }) {
  const r = detail.data?.record;
  const ctx: Ctx = { kind: sel.kind, id: sel.id, today, me, team, onChanged, onLog };
  useEscape(onClose);
  return (
    <aside aria-label="Prospect" className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[460px] flex-col border-l bg-background shadow-[-12px_0_32px_rgba(0,0,0,0.06)]">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-3">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {KIND_LABEL[sel.kind].one} · <span className="font-mono text-[11px]">{sel.id}</span>
        </span>
        <Button size="icon-sm" variant="ghost" aria-label="Open full page" onClick={onExpand}>
          <Maximize2 />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </div>
      {detail.data === null && <p className="p-5 text-sm text-muted-foreground">This record is no longer in the sheet.</p>}
      {detail.data === undefined && <p className="p-5 text-sm text-muted-foreground">Loading…</p>}
      {r && detail.data && (
        <div className={cn("flex flex-1 flex-col gap-5 overflow-y-auto px-5 pt-4 pb-8", detail.loading && "opacity-70")}>
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-xl leading-tight font-semibold tracking-tight">{r.name}</h2>
              {(r.city || r.state) && <p className="mt-0.5 text-[13px] text-muted-foreground">{r.city || r.state}</p>}
            </div>
            <StageBar stage={r.stage} />
            <div className="flex items-center justify-between gap-2">
              <StageMenu ctx={ctx} r={r} />
              {r.stage < 5 && <span className="text-xs text-muted-foreground">Next: {PATH[r.stage + 1]}</span>}
            </div>
          </div>
          <DoNotContactBanner r={r} />
          <ActionBar ctx={ctx} r={r} />
          <NextStep ctx={ctx} r={r} />
          <Properties ctx={ctx} r={r} compact />
          {r.scoreGaps && (
            <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] leading-snug text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              <span className="font-medium">Find out next:</span> {r.scoreGaps}
            </p>
          )}
          <Drafts ctx={ctx} r={r} />
          <section className="flex flex-col gap-1 border-t pt-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Activity</h3>
              {detail.data.activity.length > 3 && (
                <button type="button" onClick={onExpand} className="text-xs text-muted-foreground hover:text-foreground">
                  See all {detail.data.activity.length}
                </button>
              )}
            </div>
            <ActivityList items={detail.data.activity} limit={3} />
          </section>
        </div>
      )}
    </aside>
  );
}

/** The full page for one record: the work on the left, everything known on the right. */
export function RecordFull({ sel, today, me, team, onBack, backLabel, onLog, onChanged, detail }: PanelProps & { onBack: () => void; backLabel: string }) {
  const r = detail.data?.record;
  const [history, setHistory] = useState<"touches" | "notes" | "research">("touches");
  const ctx: Ctx = { kind: sel.kind, id: sel.id, today, me, team, onChanged, onLog };
  if (!r || !detail.data) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
          <ArrowLeft /> {backLabel}
        </Button>
        <p className="text-sm text-muted-foreground">{detail.data === null ? "This record is no longer in the sheet." : "Loading…"}</p>
      </div>
    );
  }
  const hasResearch = Boolean(r.researchNotes.trim());
  return (
    <div className={cn("-mx-3 -my-3 grid min-h-full sm:-mx-6 sm:-my-5 lg:grid-cols-[minmax(0,1fr)_340px]", detail.loading && "opacity-80")}>
      <div className="flex min-w-0 flex-col gap-7 px-4 py-5 sm:px-8 sm:py-6 lg:px-10">
        <div className="flex flex-col gap-4">
          <Button variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground" onClick={onBack}>
            <ArrowLeft /> {backLabel}
          </Button>
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-muted-foreground">
              {KIND_LABEL[sel.kind].one}
              {r.city ? ` · ${r.city}` : ""} · <span className="font-mono text-xs">{r.id}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex-1 text-2xl font-semibold tracking-tight sm:text-[28px]">{r.name}</h1>
              <StageMenu ctx={ctx} r={r} />
            </div>
          </div>
          <StageBar stage={r.stage} labels className="max-sm:[&_span.text-xs]:hidden" />
          <DoNotContactBanner r={r} />
          <ActionBar ctx={ctx} r={r} className="sm:flex sm:flex-wrap" />
          <StageGuide ctx={ctx} r={r} />
        </div>

        <NextStep ctx={ctx} r={r} />
        <Drafts ctx={ctx} r={r} />

        <section aria-label="History" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-2 text-sm font-semibold">History</h3>
            <Segmented
              label="History"
              value={history}
              onChange={setHistory}
              options={[
                { value: "touches", label: `Touches ${detail.data.activity.length || ""}` },
                { value: "notes", label: "Notes" },
                { value: "research", label: "Research" },
              ]}
            />
          </div>
          {history === "touches" ? (
            <ActivityList items={detail.data.activity} />
          ) : history === "notes" ? (
            <LongText ctx={ctx} col="notes" label="Notes" value={r.notes} rows={10} empty="No notes yet. Logging a touch adds a dated line here." display={<p className="text-[13px] leading-relaxed whitespace-pre-wrap">{r.notes}</p>} />
          ) : (
            <LongText
              ctx={ctx}
              col="research_notes"
              label="Research notes"
              value={r.researchNotes}
              rows={16}
              empty="Nothing yet. Research adds findings here, one per line."
              display={hasResearch ? <ResearchNotes r={r} limit={14} /> : null}
            />
          )}
        </section>
      </div>

      <aside aria-label="Details" className="flex flex-col gap-7 border-t bg-muted/20 px-4 py-6 sm:px-8 lg:border-t-0 lg:border-l lg:px-5">
        <section className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">Details</h3>
          <Properties ctx={ctx} r={r} />
        </section>
        {r.scoreGaps && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Find out next</h3>
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-950 dark:bg-amber-950 dark:text-amber-100">{r.scoreGaps}</p>
          </section>
        )}
        {!UNSCORED_KINDS.has(sel.kind) && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Score</h3>
              {r.opportunityScore !== null && <BandBadge band={r.band} score={r.opportunityScore} />}
            </div>
            <ScoreCard r={r} />
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Registration</h3>
          <Registration r={r} kind={sel.kind} />
        </section>
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Sources</h3>
            <span className="text-xs text-muted-foreground">{r.lastResearched ? `Researched ${displayDate(r.lastResearched)}` : "Never researched"}</span>
          </div>
          {r.researchSources.length ? (
            r.researchSources.map((s, i) => (
              <a key={i} href={/^https?:/i.test(s.url) ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer" className="truncate text-[13px] hover:underline">
                {s.url.replace(/^https?:\/\/(www\.)?/i, "")}
              </a>
            ))
          ) : (
            <p className="text-[13px] text-muted-foreground">No sources yet.</p>
          )}
        </section>
        <DisqualifyButton ctx={ctx} r={r} />
        <p className="text-xs text-muted-foreground">Every change here is written to this row of the sheet{r.nextStepDate ? ` · next step ${shortDate(r.nextStepDate, today)}` : ""}.</p>
      </aside>
    </div>
  );
}
