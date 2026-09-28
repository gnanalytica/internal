"use client";

import { ArrowLeft, ArrowUpRight, Check, Copy, Mail, MessageCircle, Pencil, Phone, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getProspectDetail, logTouch, saveProspect } from "@/lib/prospects/actions";
import type { ActivityEntry, ProspectRecord } from "@/lib/prospects/parse";
import { displayDate, isDoNotContact, parseNoteLines } from "@/lib/prospects/parse";
import { DISQUALIFY_REASONS, KIND_LABEL, OBJECTIONS, PITCH_ANGLES, SCORE_COLUMNS, STAGES, WRITABLE, type ProspectKind } from "@/lib/prospects/schema";
import { addDays, FACT_COUNT, factsKnown } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { BandBadge, Bar, DueChip, MissingValue, StagePill } from "./bits";
import { STAGE_COACHING } from "./playbook-content";

export type Selection = { kind: ProspectKind; id: string };
export type Detail = { record: ProspectRecord; activity: ActivityEntry[] };

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

type Ctx = { kind: ProspectKind; id: string; today: string; me: string; onChanged: () => void; onLog: () => void };

function save(ctx: Ctx, patch: Record<string, string | number | null>, start: (fn: () => Promise<void>) => void, after?: () => void) {
  start(async () => {
    const r = await saveProspect(ctx.kind, ctx.id, patch);
    if (r.ok) {
      toast.success(r.message);
      after?.();
      ctx.onChanged();
    } else toast.error(r.message);
  });
}

/** A labelled value that turns into an input when clicked, and saves that one cell to the sheet. */
export function EditField({
  ctx,
  col,
  label,
  value,
  type = "text",
  options,
  display,
  missing,
  rows = 6,
}: {
  ctx: Ctx;
  col: string;
  label: string;
  value: string;
  type?: "text" | "textarea" | "number" | "select" | "date";
  options?: readonly string[];
  display?: React.ReactNode;
  missing?: string;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  const editable = WRITABLE[ctx.kind].has(col);
  const inputId = `pf-${col}`;
  const commit = () => {
    const v = type === "number" ? (draft.trim() === "" ? null : Number(draft)) : draft.trim();
    save(ctx, { [col]: v }, start, () => setEditing(false));
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-1">
        <label htmlFor={inputId} className="text-[11px] font-medium text-muted-foreground">
          {label}
        </label>
        {editable && !editing && (
          <button
            type="button"
            aria-label={`Edit ${label}`}
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"
          >
            <Pencil className="size-3" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          {type === "textarea" ? (
            <textarea id={inputId} value={draft} onChange={(e) => setDraft(e.target.value)} rows={rows} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
          ) : type === "select" ? (
            <select id={inputId} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
              <option value="">—</option>
              {[...new Set([...(options ?? []), ...(value && !options?.includes(value) ? [value] : [])])].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input id={inputId} type={type} inputMode={type === "number" ? "numeric" : undefined} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm" />
          )}
          <div className="flex gap-1.5">
            <Button size="xs" onClick={commit} disabled={pending}>
              {pending ? "Saving…" : "Save to sheet"}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-w-0 text-sm break-words whitespace-pre-line">{value ? (display ?? value) : <MissingValue>{missing ?? "Not known — research"}</MissingValue>}</div>
      )}
    </div>
  );
}

function digits10(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

function emailParts(draft: string): { subject: string; body: string } {
  const m = draft.match(/^Subject:\s*(.+)\n+([\s\S]*)$/);
  return m ? { subject: m[1].trim(), body: m[2].trim() } : { subject: "", body: draft };
}

const CHANNEL_KEYS = [
  { key: "whatsapp", col: "draft_whatsapp", label: "WhatsApp" },
  { key: "email", col: "draft_email", label: "Email" },
  { key: "call", col: "draft_call", label: "Call" },
  { key: "meeting", col: "draft_meeting", label: "Meeting" },
] as const;

function Drafts({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const [tab, setTab] = useState<(typeof CHANNEL_KEYS)[number]["key"]>("whatsapp");
  const [pending, start] = useTransition();
  if (!WRITABLE[ctx.kind].has("draft_whatsapp")) return null;
  const ch = CHANNEL_KEYS.find((c) => c.key === tab)!;
  const text = r.drafts[tab];
  const phone = digits10(r.phone);
  const openHref =
    tab === "whatsapp" && phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
      : tab === "email" && r.email
        ? `mailto:${r.email}?subject=${encodeURIComponent(emailParts(text).subject)}&body=${encodeURIComponent(emailParts(text).body)}`
        : tab === "call" && phone
          ? `tel:+91${phone}`
          : null;
  const markSent = () =>
    start(async () => {
      const res = await logTouch({
        kind: ctx.kind,
        id: ctx.id,
        name: r.name,
        channel: ch.label === "Meeting" ? "Meeting" : ch.label === "Call" ? "Call" : ch.label === "Email" ? "Email" : "WhatsApp",
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h4 className="flex-1 text-sm font-semibold">Draft to send</h4>
        <span className="text-[11px] text-muted-foreground">written by the research agents</span>
      </div>
      <div role="tablist" aria-label="Draft channel" className="flex gap-1">
        {CHANNEL_KEYS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={c.key === tab}
            onClick={() => setTab(c.key)}
            className={cn("h-7 rounded-full border px-3 text-xs font-medium", c.key === tab ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
          >
            {c.label}
          </button>
        ))}
      </div>
      <EditField ctx={ctx} col={ch.col} label={`${ch.label} draft`} value={text} type="textarea" missing="No draft yet — the research agents write one per record" display={<div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">{text}</div>} />
      <div className="flex flex-wrap gap-1.5">
        {text && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(text).then(() => toast.success("Draft copied"));
            }}
          >
            <Copy /> Copy
          </Button>
        )}
        {openHref && (
          <a href={openHref} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[0.8rem] font-medium hover:bg-muted">
            <ArrowUpRight className="size-3.5" /> {tab === "call" ? "Call" : `Open in ${ch.label}`}
          </a>
        )}
        <Button size="sm" onClick={markSent} disabled={pending}>
          <Check /> {pending ? "Saving…" : tab === "call" || tab === "meeting" ? "Mark done" : "Mark sent"}
        </Button>
        <Button size="sm" variant="ghost" onClick={ctx.onLog}>
          Log details…
        </Button>
      </div>
    </div>
  );
}

function QuickActions({ ctx, r, compact }: { ctx: Ctx; r: ProspectRecord; compact?: boolean }) {
  const [pending, start] = useTransition();
  const phone = digits10(r.phone);
  const firstName = ctx.me.split(/\s+/)[0];
  const cls = "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium hover:bg-muted";
  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "grid grid-cols-4")}>
      {phone ? (
        <a href={`tel:+91${phone}`} onClick={() => setTimeout(ctx.onLog, 400)} className={cls}>
          <Phone className="size-3.5" /> Call
        </a>
      ) : (
        <button type="button" className={cn(cls, "opacity-50")} disabled title="No phone number yet">
          <Phone className="size-3.5" /> Call
        </button>
      )}
      {phone ? (
        <a href={`https://wa.me/91${phone}${r.drafts.whatsapp ? `?text=${encodeURIComponent(r.drafts.whatsapp)}` : ""}`} target="_blank" rel="noreferrer" className={cls}>
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
      ) : (
        <button type="button" className={cn(cls, "opacity-50")} disabled title="No phone number yet">
          <MessageCircle className="size-3.5" /> WhatsApp
        </button>
      )}
      {r.email ? (
        <a href={`mailto:${r.email}?subject=${encodeURIComponent(emailParts(r.drafts.email).subject)}&body=${encodeURIComponent(emailParts(r.drafts.email).body)}`} className={cls}>
          <Mail className="size-3.5" /> Email
        </a>
      ) : (
        <button type="button" className={cn(cls, "opacity-50")} disabled title="No email yet">
          <Mail className="size-3.5" /> Email
        </button>
      )}
      <button type="button" onClick={ctx.onLog} className={cls}>
        Log…
      </button>
      {!compact && (
        <>
          <button type="button" disabled={pending} onClick={() => save(ctx, { next_step_date: addDays(ctx.today, 3) }, start)} className={cls}>
            Follow up in 3 days
          </button>
          {!r.assigned || r.assigned.toLowerCase() !== firstName.toLowerCase() ? (
            <button type="button" disabled={pending} onClick={() => save(ctx, { assigned: firstName }, start)} className={cls}>
              Assign to me
            </button>
          ) : null}
          {ctx.kind === "valuer" && (
            <select
              aria-label="Disqualify"
              value=""
              disabled={pending}
              onChange={(e) => e.target.value && save(ctx, { disqualified: e.target.value }, start)}
              className="h-8 rounded-md border border-red-200 bg-background px-2 text-[13px] text-red-700 dark:border-red-900 dark:text-red-300"
            >
              <option value="">Disqualify…</option>
              {DISQUALIFY_REASONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  );
}

function StatusSelect({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Status"
      value={STAGES[r.stage]}
      disabled={pending}
      onChange={(e) => save(ctx, { status: e.target.value }, start)}
      className="h-7 rounded-md border bg-background px-2 text-xs font-medium"
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function NextStep({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Next step</span>
        <DueChip date={r.nextStepDate} today={ctx.today} />
      </div>
      <EditField ctx={ctx} col="next_step" label="What" value={r.nextStep} missing="No next step set" />
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          ["Tomorrow", 1],
          ["+3 days", 3],
          ["Next week", 7],
        ].map(([label, d]) => (
          <button key={label} type="button" disabled={pending} onClick={() => save(ctx, { next_step_date: addDays(ctx.today, d as number) }, start)} className="h-6 rounded-full border bg-background px-2.5 text-[11px] hover:bg-muted">
            {label}
          </button>
        ))}
        <label className="sr-only" htmlFor="pf-next-date">
          Pick a date
        </label>
        <input id="pf-next-date" type="date" defaultValue={r.nextStepDate ?? ""} onChange={(e) => e.target.value && save(ctx, { next_step_date: e.target.value }, start)} className="h-6 rounded-md border bg-background px-1.5 text-[11px]" />
      </div>
    </div>
  );
}

function ScoreCard({ r }: { r: ProspectRecord }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h4 className="flex-1 text-sm font-semibold">Score</h4>
        <span className="font-mono text-lg tabular-nums">{r.opportunityScore ?? "—"}</span>
        <span className="text-xs text-muted-foreground">/100 · {r.bandLabel || "not scored"}</span>
      </div>
      {SCORE_COLUMNS.map((s, i) => (
        <div key={s.key} className="grid grid-cols-[130px_1fr_40px] items-center gap-2 text-xs">
          <span>{s.label}</span>
          <Bar value={r.scores[i] ?? 0} max={s.max} />
          <span className="text-right font-mono tabular-nums">{r.scores[i] ?? "–"}/{s.max}</span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        switching_barrier {r.switchingBarrier ?? 0} · disqualified {r.disqualified || "No"}
      </p>
      {r.scoreReason && (
        <p className="text-sm leading-snug">
          <strong>Why:</strong> {r.scoreReason}
        </p>
      )}
      <div className="rounded-md bg-amber-50 px-3 py-2 text-sm leading-snug dark:bg-amber-950">
        <strong>Research next:</strong> {r.scoreGaps || "Nothing recorded — the research agents fill this when they score."}
      </div>
    </div>
  );
}

/** Shown on any record research has marked do-not-contact, above everything else. */
function DoNotContactBanner({ r }: { r: ProspectRecord }) {
  if (!isDoNotContact(r.researchNotes)) return null;
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] leading-snug font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      {r.researchNotes.trim().split("\n")[0]}
    </div>
  );
}

function ResearchNotes({ ctx, r, limit }: { ctx: Ctx; r: ProspectRecord; limit: number }) {
  const [all, setAll] = useState(false);
  const lines = parseNoteLines(r.researchNotes);
  const shown = all ? lines : lines.slice(0, limit);
  return (
    <EditField
      ctx={ctx}
      col="research_notes"
      label="Research notes"
      value={r.researchNotes}
      type="textarea"
      rows={16}
      missing="Nothing yet — research adds findings here, one per line"
      display={
        <div className="flex flex-col gap-1.5 text-[13px] leading-snug">
          {shown.map((l, i) =>
            l.label ? (
              <p key={i}>
                <span className="font-medium text-muted-foreground">{l.label}:</span> {l.text}
              </p>
            ) : (
              <p key={i} className={l.text.startsWith("- ") ? "pl-3" : "text-xs text-muted-foreground"}>
                {l.text}
              </p>
            ),
          )}
          {lines.length > limit && (
            <button type="button" className="self-start text-xs font-medium text-brand hover:underline" onClick={() => setAll((v) => !v)}>
              {all ? "Show less" : `Show all ${lines.length} lines`}
            </button>
          )}
        </div>
      }
    />
  );
}

function ResearchCard({ r }: { r: ProspectRecord }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h4 className="flex-1 text-sm font-semibold">Research</h4>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{r.researchStatus || "Not started"}</span>
      </div>
      <span className="text-xs text-muted-foreground">{r.lastResearched ? `Last researched ${displayDate(r.lastResearched)}` : "Never researched"}</span>
      {r.researchSources.length ? (
        r.researchSources.map((s, i) => (
          <div key={i} className="grid grid-cols-[72px_1fr] gap-2 text-xs">
            <span className="font-mono text-muted-foreground">{s.what || "source"}</span>
            <a href={/^https?:/i.test(s.url) ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">
              {s.url}
            </a>
          </div>
        ))
      ) : (
        <span className="text-xs text-muted-foreground">No sources yet.</span>
      )}
    </div>
  );
}

function ActivityList({ items, limit }: { items: ActivityEntry[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <p className="text-xs text-muted-foreground">Nothing logged yet. Every call or message you log lands here and in the Activity tab.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {shown.map((a) => (
        <li key={a.id || a.loggedAt} className="grid grid-cols-[88px_70px_1fr] gap-2 border-b pb-2 text-[13px] last:border-0">
          <span className="font-mono text-[11px] text-muted-foreground">{a.loggedAt}</span>
          <span className="text-[11px] font-medium">{a.channel}</span>
          <span className="leading-snug">
            <strong className="font-medium">{a.outcome}</strong>
            {a.durationMin ? ` · ${a.durationMin} min` : ""}
            {a.summary ? ` — ${a.summary}` : ""}
            <span className="text-muted-foreground"> · {a.by.split(/\s+/)[0]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Facts({ ctx, r, compact }: { ctx: Ctx; r: ProspectRecord; compact?: boolean }) {
  const lenders = r.lenders.join("; ");
  return (
    <div className={cn("grid gap-x-4 gap-y-3", compact ? "grid-cols-2" : "grid-cols-1")}>
      <EditField ctx={ctx} col="phone" label="Phone" value={r.phone} />
      {!compact && <EditField ctx={ctx} col="email" label="Email" value={r.email} />}
      {ctx.kind === "valuer" && <EditField ctx={ctx} col="lenders_empanelled_with" label="Lenders empanelled with" value={lenders} type="textarea" />}
      {ctx.kind === "valuer" && <EditField ctx={ctx} col="lb_cases_per_month" label="L&B cases / month" value={r.casesPerMonth === null ? "" : String(r.casesPerMonth)} type="number" />}
      {ctx.kind === "valuer" && <EditField ctx={ctx} col="current_software" label="Current software" value={r.software} />}
      {ctx.kind !== "rvo" && <EditField ctx={ctx} col="pitch_angle" label="Pitch angle" value={r.pitchAngle} type="select" options={PITCH_ANGLES} missing="Not picked yet" />}
      {ctx.kind !== "rvo" && <EditField ctx={ctx} col="objections" label="Objection" value={r.objections} type="select" options={OBJECTIONS} missing="None recorded" />}
      <EditField ctx={ctx} col="assigned" label="Assigned" value={r.assigned} missing="Nobody" />
      {ctx.kind !== "firm" && <EditField ctx={ctx} col="outreach_route" label="Outreach route" value={r.outreachRoute} missing="Not planned" />}
      {ctx.kind === "firm" && <EditField ctx={ctx} col="key_contact" label="Key contact" value={r.keyContact} missing="Not known" />}
      {ctx.kind !== "rvo" && <EditField ctx={ctx} col="referred_by" label="Referred by" value={r.referredBy} missing="—" />}
      {!compact && ctx.kind === "valuer" && <EditField ctx={ctx} col="city" label="City" value={r.city} />}
    </div>
  );
}

function Registration({ r, kind }: { r: ProspectRecord; kind: ProspectKind }) {
  const rows: [string, string][] = [
    ["Registration", r.id],
    ["State", r.state],
    ["Address", r.address],
    ...(kind === "valuer" ? ([["RVO", r.rvo], ["Registered", r.registeredOn], ["Firm", r.firmRegNo ? `${r.firmRegNo}${r.firmStatus ? ` · firm is ${r.firmStatus}` : ""}` : "—"]] as [string, string][]) : []),
    ...(kind === "firm" ? ([["RVO", r.rvo], ["Directors / partners", r.people]] as [string, string][]) : []),
    ...(kind === "rvo" ? ([["Website", r.website], ["Chair / president", r.keyContact], ["CEO / MD", r.people]] as [string, string][]) : []),
    ["Last contacted", r.lastContacted ? displayDate(r.lastContacted) : "Never"],
  ];
  return (
    <dl className="flex flex-col gap-2 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[112px_1fr] gap-2 border-b pb-1.5 last:border-0">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function FactsMeter({ r }: { r: ProspectRecord }) {
  const n = factsKnown(r);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" title="Phone, email, lenders, software, case volume, firm/team, pitch angle, score">
      <div className="h-1.5 w-24 rounded bg-muted">
        <div className="h-full rounded bg-brand" style={{ width: `${(n / FACT_COUNT) * 100}%` }} />
      </div>
      {n}/{FACT_COUNT} facts known
    </div>
  );
}

/** The side panel: enough to act without leaving the list you were working through. */
export function RecordPanel({ sel, today, me, onClose, onExpand, onLog, onChanged, detail }: { sel: Selection; today: string; me: string; onClose: () => void; onExpand: () => void; onLog: () => void; onChanged: () => void; detail: ReturnType<typeof useDetail> }) {
  const r = detail.data?.record;
  const ctx: Ctx = { kind: sel.kind, id: sel.id, today, me, onChanged, onLog };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside aria-label="Record" className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[480px] flex-col border-l bg-background shadow-2xl">
      <div className="flex flex-col gap-2 border-b p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{r?.name ?? (detail.data === null ? "Not found" : "Loading…")}</h2>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {sel.id}
              {r?.city ? ` · ${r.city}` : ""}
            </p>
          </div>
          <Button size="icon-sm" variant="outline" aria-label="Open full record" onClick={onExpand}>
            <ArrowUpRight />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        {r && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusSelect ctx={ctx} r={r} />
              <BandBadge band={r.band} score={r.opportunityScore} />
              <span className="flex-1" />
              <FactsMeter r={r} />
            </div>
            <DoNotContactBanner r={r} />
            <QuickActions ctx={ctx} r={r} compact />
          </>
        )}
      </div>
      {detail.data === null && <p className="p-4 text-sm text-muted-foreground">This record is no longer in the sheet.</p>}
      {r && detail.data && (
        <div className={cn("flex flex-1 flex-col gap-5 overflow-y-auto p-4", detail.loading && "opacity-70")}>
          <NextStep ctx={ctx} r={r} />
          <Facts ctx={ctx} r={r} compact />
          <ResearchNotes ctx={ctx} r={r} limit={6} />
          {r.scoreGaps && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-[13px] leading-snug dark:bg-amber-950">
              <strong>Research next:</strong> {r.scoreGaps}
            </div>
          )}
          <Drafts ctx={ctx} r={r} />
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Recent</h4>
            <ActivityList items={detail.data.activity} limit={3} />
          </div>
        </div>
      )}
    </aside>
  );
}

/** The full page for one record: everything, plus the stage path with its coaching. */
export function RecordFull({ sel, today, me, onBack, backLabel, onLog, onChanged, detail }: { sel: Selection; today: string; me: string; onBack: () => void; backLabel: string; onLog: () => void; onChanged: () => void; detail: ReturnType<typeof useDetail> }) {
  const r = detail.data?.record;
  const [view, setView] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const ctx: Ctx = { kind: sel.kind, id: sel.id, today, me, onChanged, onLog };
  if (!r || !detail.data) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="outline" size="sm" className="self-start" onClick={onBack}>
          <ArrowLeft /> Back to {backLabel}
        </Button>
        <p className="text-sm text-muted-foreground">{detail.data === null ? "This record is no longer in the sheet." : "Loading…"}</p>
      </div>
    );
  }
  const pv = view ?? r.stage;
  const coach = STAGE_COACHING[pv];
  return (
    <div className={cn("flex flex-col gap-4", detail.loading && "opacity-80")}>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft /> Back to {backLabel}
        </Button>
        <span className="text-xs text-muted-foreground">Every change here is written to this row of the sheet.</span>
      </div>
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {KIND_LABEL[sel.kind].one} · <span className="font-mono">{r.id}</span>
              {r.city ? ` · ${r.city}` : ""}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">{r.name}</h2>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <BandBadge band={r.band} score={r.opportunityScore} />
            <FactsMeter r={r} />
          </div>
        </div>
        <DoNotContactBanner r={r} />
        <QuickActions ctx={ctx} r={r} />
        <div role="tablist" aria-label="Stage" className="grid grid-cols-7 gap-1">
          {STAGES.map((s, i) => {
            const current = i === r.stage;
            const done = i < r.stage && i < 5;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={i === pv}
                onClick={() => setView(i)}
                className={cn(
                  "h-9 truncate px-3 text-xs font-semibold transition-colors [clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%,10px_50%)] first:[clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%)] last:[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,10px_50%)]",
                  current ? "bg-brand text-brand-foreground" : done ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : i === pv ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? "✓ " : ""}
                {s}
              </button>
            );
          })}
        </div>
        <div className="grid gap-5 rounded-lg bg-muted/60 p-4 md:grid-cols-[240px_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fill before moving on</span>
            {coach.fields.map((f) => {
              const filled = fieldFilled(r, f);
              return (
                <div key={f} className="flex justify-between text-xs">
                  <span className="font-mono">{f}</span>
                  <span className={filled ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold text-red-700 dark:text-red-400"}>{filled ? "Filled" : "Empty"}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">How to win “{STAGES[pv]}”</span>
            {coach.tips.map((t) => (
              <p key={t} className="text-[13px] leading-snug">
                ✓ {t}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {pv !== r.stage ? (
              <Button size="sm" disabled={pending} onClick={() => save(ctx, { status: STAGES[pv] }, start, () => setView(null))}>
                Set status to {STAGES[pv]}
              </Button>
            ) : r.stage < 5 ? (
              <Button size="sm" disabled={pending} onClick={() => save(ctx, { status: STAGES[r.stage + 1] }, start)}>
                Move to {STAGES[r.stage + 1]}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr_320px]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">What we know</h3>
            <Facts ctx={ctx} r={r} />
          </section>
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Registration</h3>
            <Registration r={r} kind={sel.kind} />
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <NextStep ctx={ctx} r={r} />
            <Drafts ctx={ctx} r={r} />
          </section>
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <h3 className="flex-1 text-sm font-semibold">Activity</h3>
              <Button size="sm" variant="outline" onClick={onLog}>
                Log a call or message
              </Button>
            </div>
            <ActivityList items={detail.data.activity} />
          </section>
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <EditField ctx={ctx} col="notes" label="Notes (newest first)" value={r.notes} type="textarea" missing="No notes yet" display={<div className="text-[13px] leading-relaxed whitespace-pre-wrap">{r.notes}</div>} />
          </section>
        </div>
        <div className="flex flex-col gap-4">
          {sel.kind === "valuer" && (
            <section className="rounded-xl border bg-card p-4">
              <ScoreCard r={r} />
            </section>
          )}
          <section className="rounded-xl border bg-card p-4">
            <ResearchNotes ctx={ctx} r={r} limit={14} />
          </section>
          <section className="rounded-xl border bg-card p-4">
            <ResearchCard r={r} />
          </section>
          <StagePillLegend stage={r.stage} />
        </div>
      </div>
    </div>
  );
}

function StagePillLegend({ stage }: { stage: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      Currently <StagePill stage={stage} />
    </p>
  );
}

function fieldFilled(r: ProspectRecord, col: string): boolean {
  const map: Record<string, unknown> = {
    phone: r.phone,
    pitch_angle: r.pitchAngle,
    draft_whatsapp: r.drafts.whatsapp,
    last_contacted: r.lastContacted,
    next_step_date: r.nextStepDate,
    next_step: r.nextStep,
    lb_cases_per_month: r.casesPerMonth,
    current_software: r.software,
    objections: r.objections,
    notes: r.notes,
    referred_by: r.referredBy,
  };
  const v = map[col];
  return v !== null && v !== undefined && v !== "";
}
