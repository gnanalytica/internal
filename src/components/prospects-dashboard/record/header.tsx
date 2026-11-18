"use client";

import { ChevronDown, Mail, MessageCircle, Phone } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ProspectRecord } from "@/lib/prospects/parse";
import { isDoNotContact } from "@/lib/prospects/parse";
import { STAGES } from "@/lib/prospects/schema";
import { mailtoHref, telHref, whatsappHref } from "@/lib/prospects/contact";
import { cn } from "@/lib/utils";
import { StageDot } from "../bits";
import { useStageMove } from "../stage-check";
import { subjectOf } from "./shared";
import type { Ctx } from "./shared";


/* ---------- header ---------- */

/** The stage, as a menu: forward moves ask for what the current stage should have found out. */
export function StageMenu({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
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
export function ActionBar({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const tel = telHref(r.phone);
  const wa = whatsappHref(r.phone, r.drafts.whatsapp);
  const cls = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] font-medium whitespace-nowrap hover:bg-muted sm:h-8 aria-disabled:pointer-events-none aria-disabled:opacity-40";
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
      <a href={tel ?? undefined} aria-disabled={!tel} title={tel ? undefined : "No phone number yet"} onClick={() => tel && setTimeout(() => ctx.onLog({ channel: "Call", outcome: "Connected" }), 400)} className={cls}>
        <Phone className="size-3.5" /> Call
      </a>
      <a
        href={wa ?? undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!wa}
        title={wa ? undefined : "No phone number yet"}
        onClick={() => wa && setTimeout(() => ctx.onLog({ channel: "WhatsApp", outcome: "Sent" }), 400)}
        className={cls}
      >
        <MessageCircle className="size-3.5" /> <span className="max-sm:hidden">WhatsApp</span>
        <span className="sm:hidden">Chat</span>
      </a>
      <a
        href={mailtoHref(r.email, r.drafts.email) ?? undefined}
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
export function DoNotContactBanner({ r }: { r: ProspectRecord }) {
  if (!isDoNotContact(r.researchNotes)) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-snug font-medium text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {r.researchNotes.trim().split("\n")[0]}
    </div>
  );
}
