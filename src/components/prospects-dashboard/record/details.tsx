"use client";

import { ChevronDown, Pencil } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { saveProspect } from "@/lib/prospects/actions";
import type { ProspectRecord } from "@/lib/prospects/parse";
import { displayDate } from "@/lib/prospects/parse";
import { DISQUALIFY_REASONS, LINKEDIN_HOW_MET, OBJECTIONS, PITCH_ANGLES, STAGES, WRITABLE, type ProspectKind } from "@/lib/prospects/schema";
import { SOFTWARE } from "@/lib/prospects/contact";
import { cn } from "@/lib/utils";
import { Owner, OwnerPicker } from "../bits";
import { FactTable, Section, SmallButton, useSave } from "./shared";
import type { Ctx } from "./shared";



export type FieldDef = { col: string; label: string; get: (r: ProspectRecord) => string; type?: "text" | "number" | "textarea"; options?: readonly string[] };

/** Every editable fact, in the order the details tab shows them; a kind sees only its own columns. */
export const FIELDS: { group: string; fields: FieldDef[] }[] = [
  {
    group: "Contact",
    fields: [
      { col: "linkedin_url", label: "LinkedIn", get: (r) => r.linkedin.url },
      { col: "headline", label: "Headline", get: (r) => r.linkedin.headline },
      { col: "company", label: "Company", get: (r) => r.linkedin.company },
      { col: "contact_person", label: "Contact person", get: (r) => r.bank.contactPerson },
      { col: "designation", label: "Designation", get: (r) => r.bank.designation },
      { col: "key_contact", label: "Key contact", get: (r) => r.keyContact },
      { col: "phone", label: "Phone", get: (r) => r.phone },
      { col: "email", label: "Email", get: (r) => r.email },
      { col: "city", label: "City", get: (r) => r.city },
      { col: "state", label: "State", get: (r) => r.state },
      { col: "how_met", label: "How they came in", get: (r) => r.linkedin.howMet, options: LINKEDIN_HOW_MET },
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

/**
 * One fact, edited where it is shown: click it, change it, and Enter or
 * clicking away saves that one cell. Escape puts it back. A list of choices
 * opens as a menu; long text saves on blur or Cmd/Ctrl+Enter.
 */
export function InlineField({ ctx, r, f }: { ctx: Ctx; r: ProspectRecord; f: FieldDef }) {
  const current = f.get(r);
  const [draft, setDraft] = useState<string | null>(null);
  // What was just saved, shown until the record reloads with it (or the save fails). `base` is the value it replaced.
  const [saved, setSaved] = useState<{ value: string; base: string } | null>(null);
  // Enter and Escape both unmount the input, which then blurs; this stops that blur from saving a second time.
  const closed = useRef(false);
  const [pending, start] = useTransition();
  const open = () => {
    closed.current = false;
    setDraft(saved && current === saved.base ? saved.value : current);
  };
  const cancel = () => {
    closed.current = true;
    setDraft(null);
  };
  const commit = (raw: string) => {
    if (closed.current) return;
    closed.current = true;
    setDraft(null);
    const v = raw.trim();
    if (v === current.trim()) return;
    setSaved({ value: v, base: current });
    start(async () => {
      const res = await saveProspect(ctx.kind, ctx.id, { [f.col]: f.type === "number" ? (v === "" ? null : Number(v)) : v });
      if (res.ok) {
        toast.success(`${f.label} saved`);
        ctx.onChanged();
      } else {
        setSaved(null);
        toast.error(res.message);
      }
    });
  };
  const value = saved && current === saved.base ? saved.value : current;
  const shown = value || <span className="text-amber-700 dark:text-amber-400">Not known yet</span>;
  const cls = "-my-1 -ml-1.5 w-[calc(100%+0.375rem)] rounded-md px-1.5 py-1 text-left hover:bg-muted disabled:opacity-60";
  if (f.options) {
    const options = [...new Set([...f.options, ...(current && !f.options.includes(current) ? [current] : [])])];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger disabled={pending} aria-label={`${f.label}: ${value || "not known"}. Change`} className={cn(cls, "inline-flex items-center gap-1.5")}>
          <span className="min-w-0 flex-1 truncate">{shown}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto min-w-48">
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => { closed.current = false; commit(String(v)); }}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o} value={o}>
                {o}
              </DropdownMenuRadioItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="">Not known</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  if (draft === null) {
    return (
      <button type="button" disabled={pending} onClick={open} aria-label={`${f.label}: ${value || "not known"}. Edit`} className={cn(cls, "group/f flex items-start gap-1.5 break-words whitespace-pre-wrap")}>
        <span className="min-w-0 flex-1">{shown}</span>
        <Pencil className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 group-hover/f:opacity-100" />
      </button>
    );
  }
  const keys = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && (f.type !== "textarea" || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit(draft);
    }
  };
  return f.type === "textarea" ? (
    <Textarea autoFocus aria-label={f.label} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(draft)} onKeyDown={keys} className="-my-1 text-sm" />
  ) : (
    <Input
      autoFocus
      aria-label={f.label}
      inputMode={f.type === "number" ? "numeric" : undefined}
      value={draft}
      onChange={(e) => setDraft(f.type === "number" ? e.target.value.replace(/\D/g, "") : e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={keys}
      className="-my-1 h-8 text-sm"
    />
  );
}

export function DisqualifyDialog({ ctx, r, open, onOpenChange }: { ctx: Ctx; r: ProspectRecord; open: boolean; onOpenChange: (o: boolean) => void }) {
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


/* ---------- details tab ---------- */

export function registration(r: ProspectRecord, kind: ProspectKind): { label: string; value: string }[] {
  const rows: [string, string][] = [
    [kind === "panel" || kind === "bank" || kind === "linkedin" ? "ID" : "Registration", r.id],
    // A LinkedIn lead's state is edited under Contact instead.
    ["State", kind === "linkedin" ? "" : r.state],
    ["Address", r.address],
  ];
  if (kind === "valuer") rows.push(["RVO", r.rvo], ["Registered", r.registeredOn], ["Firm", r.firmRegNo ? `${r.firmRegNo}${r.firmStatus ? ` · ${r.firmStatus}` : ""}` : ""]);
  if (kind === "firm") rows.push(["RVO", r.rvo], ["Partners", r.people]);
  if (kind === "rvo") rows.push(["Website", r.website], ["Chair", r.keyContact], ["CEO / MD", r.people]);
  if (kind === "panel") rows.push(["Practice", r.practice], ["IBBI", "Not on the IBBI register"]);
  if (kind === "linkedin") rows.push(["Added", [r.linkedin.addedBy, r.linkedin.addedOn ? displayDate(r.linkedin.addedOn) : ""].filter(Boolean).join(" · ")], ["IBBI", "Not matched to the register"]);
  if (kind === "bank")
    rows.push(["Institution", r.bank.institution], ["Type", r.bank.type], ["Office", r.bank.office], ["Department", r.bank.department], ["Empanelment", r.bank.empanelmentWindow], ["Panel page", r.bank.empanelmentPage], ["How to reach", r.bank.howToReach], ["Website", r.website]);
  return rows.filter(([, v]) => v).map(([label, value]) => ({ label, value }));
}

export function DetailsTab({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
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
          return (
            <Section key={g.group} title={g.group}>
              <FactTable rows={fields.map((f) => ({ label: f.label, value: WRITABLE[ctx.kind].has(f.col) ? <InlineField ctx={ctx} r={r} f={f} /> : f.get(r) || "Not known yet", missing: !WRITABLE[ctx.kind].has(f.col) && !f.get(r) }))} />
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
      <DisqualifyDialog ctx={ctx} r={r} open={dq} onOpenChange={setDq} />
    </div>
  );
}
