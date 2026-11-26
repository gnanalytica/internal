import { z } from "zod";

import type { ProspectTouchNote } from "@/lib/slack/events";

import { displayDate } from "./parse";
import type { CellPatch } from "./plan";
import { CHANNELS, DIRECTIONS, OUTCOMES, PROSPECT_KINDS, STAGES, WRITABLE, type Outcome } from "./schema";

export const kindSchema = z.enum(PROSPECT_KINDS);
export const idSchema = z.string().trim().min(1).max(80);
export const valueSchema = z.union([z.string().max(20_000), z.number(), z.null()]);
export const patchSchema = z.record(z.string(), valueSchema);

/**
 * Outcomes where someone actually spoke or wrote back: what they said is the
 * point of logging it, so the summary can't be left blank. "No answer" and
 * "Sent" stay one click.
 */
export const SUMMARY_REQUIRED: readonly Outcome[] = ["Connected", "Replied", "Meeting held", "Demo booked", "Not interested"];

export const needsSummary = (outcome: string): boolean => (SUMMARY_REQUIRED as readonly string[]).includes(outcome);

export const touchSchema = z.object({
  kind: kindSchema,
  id: idSchema,
  name: z.string().max(200),
  channel: z.enum(CHANNELS),
  direction: z.enum(DIRECTIONS),
  outcome: z.enum(OUTCOMES),
  durationMin: z.number().min(0).max(600).nullable(),
  summary: z.string().max(2000),
  statusAfter: z.enum(STAGES),
  nextStep: z.string().max(500).nullable(),
  nextStepDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  fields: z
    .object({
      current_software: z.string().max(200).optional(),
      lb_cases_per_month: z.number().min(0).max(100_000).optional(),
      objections: z.string().max(200).optional(),
      pitch_angle: z.string().max(200).optional(),
      referred_by: z.string().max(200).optional(),
    })
    .default({}),
}).refine((t) => !needsSummary(t.outcome) || t.summary.trim() !== "", {
  message: "Write what they said — it's needed when you spoke or they replied.",
  path: ["summary"],
});

export type TouchInput = z.input<typeof touchSchema>;
export type Touch = z.output<typeof touchSchema>;

/** "dd-mm-yyyy hh:mm", India time — how Activity's logged_at reads. */
export function nowIST(now = Date.now()): string {
  const d = new Date(now + 5.5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** The first name, as the team writes `assigned` and signs notes. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

/**
 * The row change a logged touch makes: status, last_contacted, the next step,
 * anything learnt on the call (only where the tab has that column), and a
 * dated line for the top of notes.
 */
export function touchPatch(t: Touch, by: string, today: string): CellPatch {
  const patch: CellPatch = { status: t.statusAfter, last_contacted: today };
  if (t.nextStepDate !== null) patch.next_step_date = t.nextStepDate;
  if (t.nextStep !== null) patch.next_step = t.nextStep;
  for (const [col, value] of Object.entries(t.fields)) {
    if (value !== undefined && value !== "" && WRITABLE[t.kind].has(col)) patch[col] = value;
  }
  const minutes = t.durationMin ? ` (${t.durationMin} min)` : "";
  patch.prependNote = `${displayDate(today)} — ${t.channel}${minutes}: ${t.outcome}${t.summary ? `. ${t.summary}` : ""} — ${firstName(by)}`;
  return patch;
}

/** How what was learnt on a touch reads in Slack. */
const LEARNT_LABEL: Record<keyof Touch["fields"], string> = {
  lb_cases_per_month: "Cases a month",
  current_software: "Current software",
  objections: "Objection",
  pitch_angle: "Pitch angle",
  referred_by: "Referred by",
};

/** What a logged touch tells Slack — only what was typed, and only columns the tab has. */
export function touchNote(t: Touch): ProspectTouchNote {
  const learnt = (Object.keys(LEARNT_LABEL) as (keyof Touch["fields"])[])
    .filter((col) => WRITABLE[t.kind].has(col) && t.fields[col] !== undefined && String(t.fields[col]).trim() !== "")
    .map((col) => ({ label: LEARNT_LABEL[col], value: String(t.fields[col]).trim() }));
  return {
    channel: t.channel,
    outcome: t.outcome,
    durationMin: t.durationMin,
    summary: t.summary.trim(),
    nextStep: t.nextStep?.trim() || null,
    nextStepDate: t.nextStepDate,
    learnt,
  };
}
