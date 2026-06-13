"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createIssuesFromProposals,
  proposeIssuesFromPage,
} from "@/lib/actions";
import type { ProposedIssue } from "@/lib/types";

export function AiGenerateIssues({
  pageId,
  enabled,
}: {
  pageId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [proposals, setProposals] = useState<ProposedIssue[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, startCreate] = useTransition();

  function propose() {
    if (!enabled) {
      toast.info("Add an ANTHROPIC_API_KEY to enable AI features.");
      return;
    }
    setProposing(true);
    proposeIssuesFromPage(pageId)
      .then((p) => {
        if (p.length === 0) {
          toast.info("No issues found in this doc.");
          return;
        }
        setProposals(p);
        setSelected(new Set(p.map((_, i) => i)));
        setOpen(true);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Couldn't generate issues"),
      )
      .finally(() => setProposing(false));
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function create() {
    const chosen = proposals.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    startCreate(async () => {
      const n = await createIssuesFromProposals(pageId, chosen);
      toast.success(`Created ${n} issue${n === 1 ? "" : "s"}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={propose}
        disabled={proposing}
      >
        <Sparkles className="size-3.5" />
        {proposing ? "Reading…" : "Generate issues"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate issues from this doc</DialogTitle>
            <DialogDescription>
              Review what to create. Each issue links back to this page.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {proposals.map((p, i) => (
              <label
                key={i}
                className="flex cursor-pointer gap-2.5 rounded-lg border p-2.5 hover:bg-accent/40"
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p.title}</div>
                  {p.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{p.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" onClick={create} disabled={creating || selected.size === 0}>
              Create {selected.size} issue{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
