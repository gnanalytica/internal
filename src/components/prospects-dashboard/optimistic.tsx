"use client";

import { createContext, useContext } from "react";

import { STAGES } from "@/lib/prospects/schema";
import type { ProspectRow } from "@/lib/prospects/stats";

export type SheetPatch = Record<string, string | number | null>;

export const rowKey = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;

/** The list-row fields a sheet patch changes, so a write can show before the sheet answers. */
export function rowPatch(p: SheetPatch): Partial<ProspectRow> {
  const out: Partial<ProspectRow> = {};
  if (typeof p.status === "string" && STAGES.includes(p.status as (typeof STAGES)[number])) out.stage = STAGES.indexOf(p.status as (typeof STAGES)[number]);
  if ("assigned" in p) out.assigned = String(p.assigned ?? "");
  if ("next_step" in p) out.nextStep = String(p.next_step ?? "");
  if ("next_step_date" in p) out.nextStepDate = p.next_step_date ? String(p.next_step_date) : null;
  return out;
}

export type OptimisticUpdate = { keys: string[]; patch: SheetPatch };

export function applyOptimistic(rows: ProspectRow[], u: OptimisticUpdate): ProspectRow[] {
  const keys = new Set(u.keys);
  const patch = rowPatch(u.patch);
  return rows.map((r) => (keys.has(rowKey(r)) ? { ...r, ...patch } : r));
}

/**
 * Shows a write on every view at once while it is in flight. Call it inside
 * the same transition as the server action: React drops the patch when the
 * transition ends, by which time the action's refresh has brought the real
 * rows — or, on failure, the old ones back.
 */
export const PatchRowsContext = createContext<(u: OptimisticUpdate) => void>(() => {});

export const usePatchRows = () => useContext(PatchRowsContext);
