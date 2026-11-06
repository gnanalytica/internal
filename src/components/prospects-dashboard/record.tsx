"use client";

import { ArrowLeft, Check, ChevronDown, Copy, Mail, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getProspectDetail, getRelatedProspects, logTouch, saveProspect } from "@/lib/prospects/actions";
import type { ActivityEntry, ProspectRecord } from "@/lib/prospects/parse";
import { displayDate, isDoNotContact, parseNoteLines } from "@/lib/prospects/parse";
import { DISQUALIFY_REASONS, KIND_LABEL, OBJECTIONS, PITCH_ANGLES, SCORE_COLUMNS, STAGES, UNSCORED_KINDS, WRITABLE, type Channel, type Outcome, type ProspectKind } from "@/lib/prospects/schema";
import type { Related } from "@/lib/prospects/related";
import { addDays } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { BandBadge, Bar, CHANNEL_TONE, Chips, DatePicker, DueChip, KindDot, outcomeTone, Owner, OwnerPicker, Segmented, StageBar, StageDot, ToneChip } from "./bits";
import { STAGE_COACHING } from "./playbook-content";
import { useStageMove, type StageSubject } from "./stage-check";
import { fillTemplate, GENERAL_ANGLE, TEMPLATE_ANGLES, type TemplateChannel } from "./templates";

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
  // Keep showing the last good detail while a reload is in flight, so the page does not flash.
  const shown = current === undefined && state && sel && state.key.startsWith(`${sel.kind}:${sel.id}:`) ? state.data : current;
  return { data: shown, loading: current === undefined, reload: () => setVersion((v) => v + 1) };
}

type Ctx = { kind: ProspectKind; id: string; today: string; me: string; team: string[]; onChanged: () => void; onLog: (o?: LogOpts) => void; onOpen: (r: { kind: ProspectKind; id: string }) => void };

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

/* ---------- building blocks ---------- */

function Section({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-7 items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A two-column table of label → value, the shape every facts block on the page uses. */
function FactTable({ rows }: { rows: { label: string; value: React.ReactNode; missing?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-[13px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-0">
              <th scope="row" className="w-40 bg-muted/30 px-3 py-2 text-left align-top font-normal text-muted-foreground">
                {r.label}
              </th>
              <td className={cn("px-3 py-2 break-words", r.missing && "text-amber-700 dark:text-amber-400")}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SmallButton({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button type="button" {...props} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50", props.className)}>
      {children}
    </button>
  );
}

/* ---------- header ---------- */

/** The stage, as a menu: forward moves ask for what the current stage should have found out. */
function StageMenu({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const { move, dialog, pending } = useStageMove(ctx.onChanged);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] hover:bg-muted aria-expanded:bg-muted">
          <StageDot stage={r.stage} />
          {STAGES[r.stage]}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-48">
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
function ActionBar({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const phone = digits10(r.phone);
  const cls = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-muted sm:h-8 aria-disabled:pointer-events-none aria-disabled:opacity-40";
  const email = emailParts(r.drafts.email);
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
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
        Log a touch
      </button>
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

/* ---------- popups ---------- */

/** A long text cell edited in a dialog: notes, a draft, research notes. */
function TextDialog(props: { ctx: Ctx; col: string; title: string; description?: string; value: string; initial?: string; open: boolean; onOpenChange: (o: boolean) => void; rows?: number }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-2xl">{props.open && <TextForm {...props} />}</DialogContent>
    </Dialog>
  );
}

/** Mounted each time the dialog opens, so it starts from the cell's current text. */
function TextForm({ ctx, col, title, description, value, initial, onOpenChange, rows = 12 }: { ctx: Ctx; col: string; title: string; description?: string; value: string; initial?: string; onOpenChange: (o: boolean) => void; rows?: number }) {
  const [draft, setDraft] = useState(initial ?? value);
  const { save, pending } = useSave(ctx);
  return (
    <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <textarea aria-label={title} value={draft} onChange={(e) => setDraft(e.target.value)} rows={rows} className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || draft.trim() === value.trim()} onClick={() => save({ [col]: draft.trim() }, () => onOpenChange(false))}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
    </>
  );
}

/** Add a dated line to the top of notes, the way logging a touch does. */
function AddNoteDialog({ ctx, r, open, onOpenChange }: { ctx: Ctx; r: ProspectRecord; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("");
  const { save, pending } = useSave(ctx);
  const line = `${displayDate(ctx.today)} — ${text.trim()} — ${ctx.me.split(/\s+/)[0]}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a note</DialogTitle>
          <DialogDescription>Goes at the top of {r.name}&apos;s notes, dated and signed.</DialogDescription>
        </DialogHeader>
        <textarea aria-label="Note" autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="e.g. Partner says SBI cases take 3 days to write up." className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || !text.trim()}
            onClick={() =>
              save({ notes: r.notes.trim() ? `${line}\n${r.notes.trim()}` : line }, () => {
                setText("");
                onOpenChange(false);
              })
            }
          >
            {pending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SOFTWARE = ["Word + Excel", "Word templates", "Own software", "Bank's portal", "Another tool"];

type FieldDef = { col: string; label: string; get: (r: ProspectRecord) => string; type?: "text" | "number" | "textarea"; options?: readonly string[] };

/** Every editable fact, in the order the details tab shows them; a kind sees only its own columns. */
const FIELDS: { group: string; fields: FieldDef[] }[] = [
  {
    group: "Contact",
    fields: [
      { col: "contact_person", label: "Contact person", get: (r) => r.bank.contactPerson },
      { col: "designation", label: "Designation", get: (r) => r.bank.designation },
      { col: "key_contact", label: "Key contact", get: (r) => r.keyContact },
      { col: "phone", label: "Phone", get: (r) => r.phone },
      { col: "email", label: "Email", get: (r) => r.email },
      { col: "city", label: "City", get: (r) => r.city },
    ],
  },
  {
    group: "Practice",
    fields: [
      { col: "lenders_empanelled_with", label: "Lender panels", get: (r) => r.lenders.join("; "), type: "textarea" },
      { col: "current_software", label: "Software", get: (r) => r.software, options: SOFTWARE },
      { col: "lb_cases_per_month", label: "Cases a month", get: (r) => (r.casesPerMonth === null ? "" : String(r.casesPerMonth)), type: "number" },
    ],
  },
  {
    group: "Selling",
    fields: [
      { col: "pitch_angle", label: "Pitch", get: (r) => r.pitchAngle, options: PITCH_ANGLES },
      { col: "objections", label: "Objection", get: (r) => r.objections, options: OBJECTIONS },
      { col: "outreach_route", label: "Outreach route", get: (r) => r.outreachRoute, type: "textarea" },
      { col: "referred_by", label: "Referred by", get: (r) => r.referredBy },
    ],
  },
];

/** One form for a group of facts, saved as a single write to the row. */
function EditFactsDialog({ ctx, r, group, open, onOpenChange }: { ctx: Ctx; r: ProspectRecord; group: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const fields = (FIELDS.find((g) => g.group === group)?.fields ?? []).filter((f) => WRITABLE[ctx.kind].has(f.col));
  // The dialog is mounted only while open, so this starts from the record's current values.
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.col, f.get(r)])));
  const { save, pending } = useSave(ctx);
  const patch = Object.fromEntries(
    fields
      .filter((f) => (vals[f.col] ?? "").trim() !== f.get(r).trim())
      .map((f) => {
        const v = (vals[f.col] ?? "").trim();
        return [f.col, f.type === "number" ? (v === "" ? null : Number(v)) : v];
      }),
  );
  const changed = Object.keys(patch).length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {group.toLowerCase()}</DialogTitle>
          <DialogDescription>{r.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.col} className="flex flex-col gap-1.5">
              <label htmlFor={`ef-${f.col}`} className="text-xs font-medium text-foreground/80">
                {f.label}
              </label>
              {f.options ? (
                <Chips label={f.label} value={vals[f.col] ?? ""} options={[...new Set([...f.options, ...(vals[f.col] && !f.options.includes(vals[f.col]) ? [vals[f.col]] : [])])]} onChange={(v) => setVals((p) => ({ ...p, [f.col]: v }))} allowNone />
              ) : f.type === "textarea" ? (
                <textarea id={`ef-${f.col}`} rows={3} value={vals[f.col] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [f.col]: e.target.value }))} className="rounded-md border bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
              ) : (
                <input
                  id={`ef-${f.col}`}
                  inputMode={f.type === "number" ? "numeric" : undefined}
                  value={vals[f.col] ?? ""}
                  onChange={(e) => setVals((p) => ({ ...p, [f.col]: f.type === "number" ? e.target.value.replace(/\D/g, "") : e.target.value }))}
                  className="h-9 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <span className="flex-1 text-xs text-muted-foreground">{changed ? `${changed} change${changed === 1 ? "" : "s"} to save` : "No changes yet"}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || !changed} onClick={() => save(patch, () => onOpenChange(false))}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DisqualifyDialog({ ctx, r, open, onOpenChange }: { ctx: Ctx; r: ProspectRecord; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState<string>(DISQUALIFY_REASONS[0]);
  const { save, pending } = useSave(ctx);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Disqualify {r.name}?</DialogTitle>
          <DialogDescription>They drop out of every queue and the pipeline. You can undo it from the Details tab.</DialogDescription>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button className="bg-red-700 text-white hover:bg-red-800" disabled={pending} onClick={() => save({ disqualified: reason }, () => onOpenChange(false))}>
            {pending ? "Saving…" : "Disqualify"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- overview tab ---------- */

function NextStepCard({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
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

const DRAFTS = [
  { key: "whatsapp", col: "draft_whatsapp", label: "WhatsApp", channel: "WhatsApp" as Channel },
  { key: "call", col: "draft_call", label: "Call script", channel: "Call" as Channel },
  { key: "email", col: "draft_email", label: "Email", channel: "Email" as Channel },
  { key: "meeting", col: "draft_meeting", label: "Meeting", channel: "Meeting" as Channel },
] as const;

function Drafts({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const channels = DRAFTS.filter((c) => WRITABLE[ctx.kind].has(c.col));
  const [tab, setTab] = useState<(typeof DRAFTS)[number]["key"]>(() => channels.find((c) => r.drafts[c.key])?.key ?? channels[0]?.key ?? "whatsapp");
  const [editOpen, setEditOpen] = useState(false);
  const [starter, setStarter] = useState<string | undefined>(undefined);
  const [pending, start] = useTransition();
  if (!channels.length) return null;
  const ch = channels.find((c) => c.key === tab) ?? channels[0];
  const text = r.drafts[ch.key];
  const phone = digits10(r.phone);
  const email = ch.key === "email" ? emailParts(text) : null;
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

function shortStamp(a: ActivityEntry): string {
  return a.date ? displayDate(a.date) : a.loggedAt.slice(0, 10);
}

function ActivityTable({ items, limit }: { items: ActivityEntry[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">Nothing logged yet. Every call or message logged here lands in this table and in the sheet&apos;s Activity tab.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="bg-muted/40 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
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
              <td className="px-3 py-2 text-muted-foreground">{a.summary || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rows this prospect is connected to — firm, partners, lenders, panel — each one click away. */
function RelatedSection({ ctx }: { ctx: Ctx }) {
  const [state, setState] = useState<{ key: string; items: Related[]; more: number } | null>(null);
  const key = `${ctx.kind}:${ctx.id}`;
  useEffect(() => {
    let alive = true;
    getRelatedProspects(ctx.kind, ctx.id).then(
      (r) => alive && setState({ key, ...r }),
      () => alive && setState({ key, items: [], more: 0 }),
    );
    return () => {
      alive = false;
    };
  }, [ctx.kind, ctx.id, key]);
  const data = state?.key === key ? state : null;
  if (data && !data.items.length) return null;
  return (
    <Section title="Related" aside={data?.more ? <span className="text-xs text-muted-foreground">+{data.more} more</span> : undefined}>
      {!data ? (
        <p className="text-[13px] text-muted-foreground">Looking for the firm, partners and lenders…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full table-fixed text-[13px]">
            <tbody>
              {data.items.map((x) => (
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
      )}
    </Section>
  );
}

function OverviewTab({ ctx, r, activity, onTab }: { ctx: Ctx; r: ProspectRecord; activity: ActivityEntry[]; onTab: (t: RecordTab) => void }) {
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
          <ActivityTable items={activity} limit={3} />
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
        <RelatedSection ctx={ctx} />
      </div>
    </div>
  );
}

/* ---------- activity tab ---------- */

function ActivityTab({ ctx, r, activity }: { ctx: Ctx; r: ProspectRecord; activity: ActivityEntry[] }) {
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
        <ActivityTable items={activity} />
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

/* ---------- research tab ---------- */

function ResearchTab({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const [editOpen, setEditOpen] = useState(false);
  const [all, setAll] = useState(false);
  const lines = parseNoteLines(r.researchNotes);
  const shown = all ? lines : lines.slice(0, 16);
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-8">
        <Section
          title="What research found"
          aside={
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{r.lastResearched ? `Researched ${displayDate(r.lastResearched)}` : "Never researched"}</span>
              {WRITABLE[ctx.kind].has("research_notes") && <SmallButton onClick={() => setEditOpen(true)}>Edit</SmallButton>}
            </span>
          }
        >
          {lines.length ? (
            <div className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-[13px] leading-relaxed">
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
              {lines.length > 16 && (
                <button type="button" className="self-start text-xs text-muted-foreground hover:text-foreground" onClick={() => setAll((v) => !v)}>
                  {all ? "Show less" : `Show all ${lines.length} lines`}
                </button>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">Nothing yet. Research adds findings here, one per line.</p>
          )}
        </Section>
        <Section title={`Sources${r.researchSources.length ? ` · ${r.researchSources.length}` : ""}`}>
          {r.researchSources.length ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full table-fixed text-[13px]">
                <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-44 px-3 py-2 font-normal">What</th>
                    <th className="px-3 py-2 font-normal">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {r.researchSources.map((s, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="truncate px-3 py-2 text-muted-foreground">{s.what || "Source"}</td>
                      <td className="truncate px-3 py-2">
                        <a href={/^https?:/i.test(s.url) ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer" className="hover:underline">
                          {s.url.replace(/^https?:\/\/(www\.)?/i, "")}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No sources yet.</p>
          )}
        </Section>
      </div>
      <div className="flex min-w-0 flex-col gap-8">
        <Section title="Status">
          <FactTable
            rows={[
              { label: "Research", value: r.researchStatus || "Not started", missing: !r.researchStatus },
              { label: "Find out next", value: r.scoreGaps || "—" },
            ]}
          />
        </Section>
        {!UNSCORED_KINDS.has(ctx.kind) && (
          <Section title="Score" aside={r.opportunityScore !== null ? <BandBadge band={r.band} score={r.opportunityScore} /> : undefined}>
            {r.opportunityScore === null ? (
              <p className="text-[13px] text-muted-foreground">Not scored yet. Scoring runs once research is reviewed.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-[13px]">
                  <tbody>
                    {SCORE_COLUMNS.map((s, i) => (
                      <tr key={s.key} className="border-b border-border/60 last:border-0">
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          {s.label}
                        </th>
                        <td className="w-24 px-2">
                          <Bar value={r.scores[i] ?? 0} max={s.max} className="h-1.5" />
                        </td>
                        <td className="w-14 px-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {r.scores[i] ?? "–"}/{s.max}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30">
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        Total
                      </th>
                      <td />
                      <td className="px-3 text-right font-mono text-xs font-medium tabular-nums">{r.opportunityScore}/100</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {r.scoreReason && <p className="text-[13px] leading-relaxed text-muted-foreground">{r.scoreReason}</p>}
          </Section>
        )}
      </div>
      <TextDialog ctx={ctx} col="research_notes" title="Research notes" description="One finding per line, as “label: text”." value={r.researchNotes} open={editOpen} onOpenChange={setEditOpen} rows={18} />
    </div>
  );
}

/* ---------- details tab ---------- */

function registration(r: ProspectRecord, kind: ProspectKind): { label: string; value: string }[] {
  const rows: [string, string][] = [
    [kind === "panel" || kind === "bank" ? "ID" : "Registration", r.id],
    ["State", r.state],
    ["Address", r.address],
  ];
  if (kind === "valuer") rows.push(["RVO", r.rvo], ["Registered", r.registeredOn], ["Firm", r.firmRegNo ? `${r.firmRegNo}${r.firmStatus ? ` · ${r.firmStatus}` : ""}` : ""]);
  if (kind === "firm") rows.push(["RVO", r.rvo], ["Partners", r.people]);
  if (kind === "rvo") rows.push(["Website", r.website], ["Chair", r.keyContact], ["CEO / MD", r.people]);
  if (kind === "panel") rows.push(["Practice", r.practice], ["IBBI", "Not on the IBBI register"]);
  if (kind === "bank")
    rows.push(["Institution", r.bank.institution], ["Type", r.bank.type], ["Office", r.bank.office], ["Department", r.bank.department], ["Empanelment", r.bank.empanelmentWindow], ["Panel page", r.bank.empanelmentPage], ["How to reach", r.bank.howToReach], ["Website", r.website]);
  return rows.filter(([, v]) => v).map(([label, value]) => ({ label, value }));
}

function DetailsTab({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [dq, setDq] = useState(false);
  const { save, pending } = useSave(ctx);
  const isOut = Boolean(r.disqualified) && r.disqualified !== "No";
  const canDq = WRITABLE[ctx.kind].has("disqualified");
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-8">
        <Section title="Ownership">
          <FactTable
            rows={[
              {
                label: "Owner",
                value: (
                  <OwnerPicker value={r.assigned} me={ctx.me} team={ctx.team} disabled={pending} onPick={(n) => save({ assigned: n })}>
                    <button type="button" className="-my-1 -ml-1.5 inline-flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
                      {r.assigned ? (
                        <>
                          <Owner name={r.assigned} /> {r.assigned}
                        </>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">Nobody · assign</span>
                      )}
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    </button>
                  </OwnerPicker>
                ),
              },
              { label: "Stage", value: STAGES[r.stage] },
              { label: "Last contacted", value: r.lastContacted ? displayDate(r.lastContacted) : "Never" },
            ]}
          />
        </Section>
        {FIELDS.map((g) => {
          const fields = g.fields.filter((f) => WRITABLE[ctx.kind].has(f.col) || (f.col === "email" && r.email));
          if (!fields.length) return null;
          const editable = fields.some((f) => WRITABLE[ctx.kind].has(f.col));
          return (
            <Section
              key={g.group}
              title={g.group}
              aside={
                editable ? (
                  <SmallButton onClick={() => setEditing(g.group)}>
                    <Pencil className="size-3" /> Edit
                  </SmallButton>
                ) : undefined
              }
            >
              <FactTable rows={fields.map((f) => ({ label: f.label, value: f.get(r) || "Not known yet", missing: !f.get(r) }))} />
            </Section>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-col gap-8">
        <Section title="Registration">
          <FactTable rows={registration(r, ctx.kind)} />
        </Section>
        {canDq && (
          <Section title="Disqualify">
            <div className="flex flex-col gap-3 rounded-lg border border-red-200 px-4 py-3 text-[13px] dark:border-red-900">
              {isOut ? (
                <>
                  <span>
                    Disqualified: <strong className="font-medium">{r.disqualified}</strong>. They are out of every queue and the pipeline.
                  </span>
                  <SmallButton className="self-start" disabled={pending} onClick={() => save({ disqualified: "No" })}>
                    Undo
                  </SmallButton>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Takes them out of every queue and the pipeline, with a reason. You can undo it here.</span>
                  <SmallButton className="self-start border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400" onClick={() => setDq(true)}>
                    Disqualify…
                  </SmallButton>
                </>
              )}
            </div>
          </Section>
        )}
      </div>
      {editing && <EditFactsDialog ctx={ctx} r={r} group={editing} open onOpenChange={(o) => !o && setEditing(null)} />}
      <DisqualifyDialog ctx={ctx} r={r} open={dq} onOpenChange={setDq} />
    </div>
  );
}

/* ---------- page ---------- */

export type RecordTab = "overview" | "activity" | "research" | "details";

/** The full page for one prospect: a header to act from, and tabs for everything known. */
export function RecordPage({
  sel,
  today,
  me,
  team,
  onBack,
  backLabel,
  onLog,
  onChanged,
  detail,
  tab,
  setTab,
  onOpen,
}: {
  sel: Selection;
  today: string;
  me: string;
  team: string[];
  onOpen: (r: { kind: ProspectKind; id: string }) => void;
  onBack: () => void;
  backLabel: string;
  onLog: (o?: LogOpts) => void;
  onChanged: () => void;
  detail: ReturnType<typeof useDetail>;
  tab: RecordTab;
  setTab: (t: RecordTab) => void;
}) {
  const r = detail.data?.record;
  const ctx: Ctx = { kind: sel.kind, id: sel.id, today, me, team, onChanged, onLog, onOpen };
  if (!r || !detail.data) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground" onClick={onBack}>
          <ArrowLeft /> {backLabel}
        </Button>
        <p className="text-sm text-muted-foreground">{detail.data === null ? "This prospect is no longer in the sheet." : "Loading…"}</p>
      </div>
    );
  }
  const activity = detail.data.activity;
  return (
    <div className={cn("mx-auto flex max-w-6xl flex-col gap-6", detail.loading && "opacity-80")}>
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground" onClick={onBack}>
          <ArrowLeft /> {backLabel}
        </Button>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
              <KindDot kind={sel.kind} />
              {KIND_LABEL[sel.kind].one}
              {r.city ? ` · ${r.city}` : r.state ? ` · ${r.state}` : ""} · <span className="font-mono text-xs">{r.id}</span>
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{r.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {r.assigned && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Owner name={r.assigned} /> {r.assigned}
              </span>
            )}
            <StageMenu ctx={ctx} r={r} />
          </div>
        </div>
        <StageBar stage={r.stage} labels className="max-sm:[&_span.text-xs]:hidden" />
        <DoNotContactBanner r={r} />
        <ActionBar ctx={ctx} r={r} />
      </div>

      <nav role="tablist" aria-label="Prospect" className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "activity", label: "Activity", count: activity.length },
            { id: "research", label: "Research" },
            { id: "details", label: "Details" },
          ] as { id: RecordTab; label: string; count?: number }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={cn("-mb-px h-10 shrink-0 border-b-2 px-3 text-sm whitespace-nowrap", t.id === tab ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.count ? <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{t.count}</span> : null}
          </button>
        ))}
      </nav>

      <div className="pb-10">
        {tab === "overview" ? <OverviewTab ctx={ctx} r={r} activity={activity} onTab={setTab} /> : tab === "activity" ? <ActivityTab ctx={ctx} r={r} activity={activity} /> : tab === "research" ? <ResearchTab ctx={ctx} r={r} /> : <DetailsTab ctx={ctx} r={r} />}
      </div>
    </div>
  );
}
