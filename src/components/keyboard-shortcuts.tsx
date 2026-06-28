"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NewIssueDialog } from "@/components/new-issue-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Label, Member, Project } from "@/lib/types";

const GO_TO: Record<string, string> = {
  i: "/issues",
  p: "/projects",
  n: "/inbox",
  a: "/ask",
};

const HELP = [
  { keys: "C", label: "Create task" },
  { keys: "⌘K", label: "Search / command palette" },
  { keys: "G then I", label: "Go to Tasks" },
  { keys: "G then P", label: "Go to Projects" },
  { keys: "G then N", label: "Go to Inbox" },
  { keys: "G then A", label: "Go to Ask AI" },
  { keys: "?", label: "This help" },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function KeyboardShortcuts({
  projects,
  members,
  labels,
}: {
  projects: Project[];
  members: Member[];
  labels: Label[];
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const awaitingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      // Sequence: G then <key> to navigate.
      if (awaitingG.current) {
        awaitingG.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const dest = GO_TO[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }

      if (e.key === "g") {
        awaitingG.current = true;
        gTimer.current = setTimeout(() => {
          awaitingG.current = false;
        }, 1200);
        return;
      }

      if (e.key === "c") {
        e.preventDefault();
        setNewOpen(true);
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    }

    function onNewIssue() {
      setNewOpen(true);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("open-new-issue", onNewIssue);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-new-issue", onNewIssue);
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, [router]);

  return (
    <>
      <NewIssueDialog
        projects={projects}
        members={members}
        labels={labels}
        open={newOpen}
        onOpenChange={setNewOpen}
      />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {HELP.map((h) => (
              <div key={h.label} className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground">{h.label}</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{h.keys}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
