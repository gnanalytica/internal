"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarSync, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateCycleCadence } from "@/lib/actions";
import { type Ceremony, type CycleCadence } from "@/lib/cycle-cadence";

/** Weekday labels for the day-offset picker, relative to the cycle's start. */
const DAY_LABELS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

/**
 * The project's standing cycle ceremonies.
 *
 * A cadence is a team decision ("Friday planning, daily standup, Thursday demo
 * + retro"), so it is edited once here rather than retyped into every cycle.
 * Saving does not touch cycles that already exist — each new cycle picks it up,
 * and an existing one can pull it in from the cycle's own menu.
 */
export function CadenceEditor({
  projectId,
  cadence,
}: {
  projectId: string;
  cadence: CycleCadence | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Ceremony[]>(cadence?.ceremonies ?? []);

  const dirty = JSON.stringify(rows) !== JSON.stringify(cadence?.ceremonies ?? []);

  function patch(i: number, next: Partial<Ceremony>) {
    setRows((prev) => prev.map((r, n) => (n === i ? { ...r, ...next } : r)));
  }

  function save() {
    start(async () => {
      const saved = await updateCycleCadence(projectId, { ceremonies: rows });
      setRows(saved.ceremonies);
      toast.success(
        saved.ceremonies.length === 0
          ? "Cadence cleared"
          : `Cadence saved — ${saved.ceremonies.length} ceremon${saved.ceremonies.length === 1 ? "y" : "ies"} per cycle`,
      );
      router.refresh();
    });
  }

  return (
    <div className="mb-3 rounded-xl border bg-background">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        <CalendarSync className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Cadence</span>
        <span className="text-xs text-muted-foreground">
          {rows.length === 0
            ? "No standing ceremonies"
            : `${rows.length} ceremon${rows.length === 1 ? "y" : "ies"} in every cycle`}
        </span>
      </button>

      {open && (
        <div className="border-t px-3 py-3">
          <p className="mb-3 text-xs text-muted-foreground">
            These tasks are added to every new cycle. Editing them leaves existing cycles
            alone — use <strong>Apply cadence</strong>{" "}on a cycle to pull in what&apos;s missing.
          </p>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  value={row.title}
                  onChange={(e) => patch(i, { title: e.target.value })}
                  placeholder="Ceremony, e.g. Fri: sprint planning"
                  aria-label="Ceremony title"
                  className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <select
                  value={row.dayOffset ?? ""}
                  onChange={(e) =>
                    patch(i, {
                      dayOffset: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  aria-label="Day of cycle"
                  className="h-8 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="">Throughout</option>
                  {DAY_LABELS.map((label, d) => (
                    <option key={d} value={d}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={row.estimate ?? ""}
                  onChange={(e) =>
                    patch(i, {
                      estimate: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="pts"
                  aria-label="Estimate"
                  className="h-8 w-16 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <button
                  onClick={() => setRows((prev) => prev.filter((_, n) => n !== i))}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${row.title || "ceremony"}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() =>
                setRows((prev) => [...prev, { title: "", dayOffset: null, estimate: null }])
              }
            >
              <Plus className="size-3.5" /> Add ceremony
            </Button>
            {dirty && (
              <Button size="sm" className="h-7 text-xs" onClick={save} disabled={pending}>
                Save cadence
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
