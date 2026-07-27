"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createLabel, deleteLabel, updateLabel } from "@/lib/actions";
import type { Label } from "@/lib/types";
import { SELECT_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";

function ColorSwatch({
  color,
  onPick,
}: {
  color: string;
  onPick: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            className="size-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: color }}
            aria-label="Change color"
          />
        }
      />
      <PopoverContent align="start" className="flex w-auto flex-wrap gap-1 p-1.5">
        {SELECT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              onPick(c);
              setOpen(false);
            }}
            className="grid size-6 place-items-center rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: c }}
            aria-label={`Use ${c}`}
          >
            {c === color && <Check className="size-3.5 text-white" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function LabelsSettings({ labels }: { labels: Label[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SELECT_COLORS[0]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  function add() {
    if (!newName.trim()) return;
    run(async () => {
      await createLabel(newName.trim(), newColor);
      setNewName("");
    }, "Label created");
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Settings" }, { label: "Labels" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-8 py-10">
          <div className="mb-6 flex items-center gap-3">
            <Tag className="size-8 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Labels</h2>
              <p className="text-sm text-muted-foreground">
                Reusable tags for tasks. Create, recolor, rename, or delete them here.
              </p>
            </div>
          </div>

          {/* New label */}
          <div className="mb-4 flex items-center gap-2 rounded-lg border p-2">
            <ColorSwatch color={newColor} onPick={setNewColor} />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="New label name…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button size="sm" className="h-7 gap-1" onClick={add} disabled={!newName.trim()}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>

          {/* Existing labels */}
          {labels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No labels yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {labels.map((l) => (
                <div key={l.id} className="group flex items-center gap-2 px-2 py-1.5">
                  <ColorSwatch
                    color={l.color}
                    onPick={(c) => run(() => updateLabel(l.id, { color: c }))}
                  />
                  <input
                    defaultValue={l.name}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== l.name) run(() => updateLabel(l.id, { name: next }));
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="flex-1 bg-transparent text-sm outline-none focus:rounded focus:bg-accent focus:px-1"
                  />
                  {confirmId === l.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() => run(() => deleteLabel(l.id), "Label deleted")}
                        className="rounded px-1.5 py-0.5 text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(l.id)}
                      className={cn(
                        "rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100",
                      )}
                      aria-label="Delete label"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
