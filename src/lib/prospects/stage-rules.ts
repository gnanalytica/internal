import { STAGES, WRITABLE, type ProspectKind } from "./schema";

/**
 * What a record must have before it moves past a stage. Pure, so the stage
 * dialog, the Log touch dialog and the sheet write all hold the same line.
 *
 * Kept short on purpose — only what the next stage can't do without:
 * - leaving Discovery done: how many cases a month, and what they use today
 *   (a demo needs both to be the right demo);
 * - leaving Demo done: the angle that landed and the agreed next step (a
 *   pilot needs both to start).
 * Everything else a stage asks for stays a suggestion (STAGE_COACHING).
 * Moving back, or to Lost, never needs anything.
 */
export const REQUIRED_TO_LEAVE: Readonly<Partial<Record<number, readonly string[]>>> = {
  2: ["lb_cases_per_month", "current_software"],
  3: ["pitch_angle", "next_step"],
};

export const REQUIRED_LABEL: Record<string, string> = {
  lb_cases_per_month: "Cases a month",
  current_software: "Current software",
  pitch_angle: "Pitch angle",
  next_step: "Next step",
};

const LOST = STAGES.indexOf("Lost");

/** The columns a move from stage `from` to stage `to` needs, on this kind's tab, in order. */
export function requiredForMove(kind: ProspectKind, from: number, to: number): string[] {
  if (to <= from || to === LOST) return [];
  const out: string[] = [];
  for (let s = from; s < to; s++) {
    for (const col of REQUIRED_TO_LEAVE[s] ?? []) {
      if (WRITABLE[kind].has(col) && !out.includes(col)) out.push(col);
    }
  }
  return out;
}

const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

/** The required columns still blank once `values` (the row with the change applied) is written. */
export function missingRequired(kind: ProspectKind, values: Record<string, unknown>, from: number, to: number): string[] {
  return requiredForMove(kind, from, to).filter((col) => !filled(values[col]));
}

/** "Demo done needs Cases a month and Current software first." */
export function requiredMessage(to: number, missing: string[]): string {
  const labels = missing.map((c) => REQUIRED_LABEL[c] ?? c);
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}` : labels[0];
  return `${STAGES[to]} needs ${list} first`;
}
