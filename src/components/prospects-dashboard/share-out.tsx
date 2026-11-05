"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignTo } from "@/lib/prospects/actions";
import type { ProspectKind } from "@/lib/prospects/schema";
import { dealOut } from "@/lib/prospects/share";
import type { ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { Owner, Segmented } from "./bits";

/** The pools worth sharing out: open, unowned, not marked do-not-contact, best score first. */
const POOLS: { id: string; label: string; kind: ProspectKind; test: (r: ProspectRow) => boolean }[] = [
  { id: "a", label: "A-band valuers", kind: "valuer", test: (r) => r.band === "A" },
  { id: "b", label: "B-band valuers", kind: "valuer", test: (r) => r.band === "B" },
  { id: "firm", label: "Firms", kind: "firm", test: () => true },
  { id: "panel", label: "Panel valuers", kind: "panel", test: () => true },
  { id: "bank", label: "Bank contacts", kind: "bank", test: () => true },
];

/**
 * Share unowned prospects across the team so everyone's Today has work in it.
 * Writes the first name into `assigned` on each row, like Assign to me does.
 */
export function ShareOutDialog({ rows, team, me, open, onOpenChange, onDone }: { rows: ProspectRow[]; team: string[]; me: string; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [poolId, setPoolId] = useState("a");
  const [people, setPeople] = useState<string[]>(() => [...new Set([me, ...team].filter(Boolean))]);
  const [each, setEach] = useState("10");
  const [pending, start] = useTransition();
  const pool = POOLS.find((p) => p.id === poolId)!;
  const available = useMemo(
    () => rows.filter((r) => r.kind === pool.kind && !r.assigned && r.stage === 0 && !r.doNotContact && pool.test(r)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name)),
    [rows, pool],
  );
  const counts = useMemo(() => Object.fromEntries(POOLS.map((p) => [p.id, rows.filter((r) => r.kind === p.kind && !r.assigned && r.stage === 0 && !r.doNotContact && p.test(r)).length])), [rows]);
  const n = Math.max(0, Math.min(50, Number(each) || 0));
  const plan = dealOut(available, people, n);
  const total = [...plan.values()].reduce((s, l) => s + l.length, 0);
  const everyone = [...new Set([me, ...team].filter(Boolean))];

  const toggle = (p: string) => setPeople((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const run = () =>
    start(async () => {
      let done = 0;
      for (const [person, list] of plan) {
        if (!list.length) continue;
        const res = await assignTo(pool.kind, list.map((r) => r.id), person);
        if (!res.ok) {
          toast.error(`${done} assigned; stopped at ${person}: ${res.message}`);
          onDone();
          return;
        }
        done += list.length;
      }
      toast.success(`Shared out ${done} ${pool.label.toLowerCase()}`);
      onDone();
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share out prospects</DialogTitle>
          <DialogDescription>Hand unowned, not-yet-contacted prospects to the team, best score first, so everyone&apos;s Today has work in it.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground/80">Which prospects</span>
          <div className="flex flex-wrap gap-1.5">
            {POOLS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === poolId}
                onClick={() => setPoolId(p.id)}
                className={cn("h-8 rounded-md border px-2.5 text-[13px] whitespace-nowrap", p.id === poolId ? "border-foreground bg-foreground text-background" : "hover:bg-muted", !counts[p.id] && p.id !== poolId && "opacity-50")}
              >
                {p.label} <span className="font-mono text-[11px] opacity-70">{counts[p.id].toLocaleString("en-IN")}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground/80">To whom</span>
          <div className="flex flex-col">
            {everyone.map((p) => (
              <label key={p} className="flex h-9 items-center gap-2.5 rounded-md px-1 text-sm hover:bg-muted/60">
                <input type="checkbox" checked={people.includes(p)} onChange={() => toggle(p)} className="size-4 accent-foreground" />
                <Owner name={p} />
                <span className="flex-1">{p === me ? `${p} (me)` : p}</span>
                <span className="font-mono text-xs text-muted-foreground">{people.includes(p) ? `+${plan.get(p)?.length ?? 0}` : ""}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground/80">How many each</span>
          <Segmented label="How many each" value={["5", "10", "20"].includes(each) ? each : "10"} onChange={setEach} options={["5", "10", "20"].map((v) => ({ value: v, label: v }))} className="self-start" />
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
            {available.length === 0 ? "Nobody left to share out in this group." : `${total} of ${available.length.toLocaleString("en-IN")} will be assigned · written to the sheet`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={run} disabled={pending || total === 0}>
              {pending ? "Assigning…" : `Assign ${total}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
