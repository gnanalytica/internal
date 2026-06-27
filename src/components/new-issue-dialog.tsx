"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AssigneePicker,
  PriorityPicker,
  ProjectPicker,
  StatusPicker,
} from "@/components/pickers";
import { CalendarRange } from "lucide-react";

import { createIssue } from "@/lib/actions";
import type { Label, Member, Project } from "@/lib/types";
import type { PriorityId, StatusId } from "@/lib/constants";

export function NewIssueDialog({
  projects,
  members,
  defaultProjectId = null,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  projects: Project[];
  members: Member[];
  // Accepted for call-site compatibility; labels were removed from issues.
  labels?: Label[];
  defaultProjectId?: string | null;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<StatusId>("backlog");
  const [priority, setPriority] = useState<PriorityId>("none");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setStatus("backlog");
    setPriority("none");
    setAssigneeId(null);
    setProjectId(defaultProjectId);
    setStartDate("");
    setDueDate("");
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Give the issue a title");
      return;
    }
    startTransition(async () => {
      const created = await createIssue({
        title,
        projectId,
        status,
        priority,
        assigneeId,
        startDate: startDate || null,
        dueDate: dueDate || null,
      });
      if (description.trim()) {
        // Store the quick description as a simple TipTap doc.
        const { updateIssue } = await import("@/lib/actions");
        await updateIssue(created.id, {
          description: {
            type: "doc",
            content: description
              .split("\n")
              .map((line) => ({
                type: "paragraph",
                content: line ? [{ type: "text", text: line }] : [],
              })),
          },
        });
      }
      toast.success("Issue created");
      setOpen(false);
      reset();
      router.push(`/issues/${created.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      >
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-xs font-medium text-muted-foreground">
            New issue
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2 pt-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title"
            className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description…"
            rows={3}
            className="mt-2 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 px-3 pb-3">
          <StatusPicker value={status} onChange={setStatus} />
          <PriorityPicker value={priority} onChange={setPriority} />
          <AssigneePicker members={members} value={assigneeId} onChange={setAssigneeId} />
          <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
          <label className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            <CalendarRange className="size-3.5" />
            <input
              type="date"
              value={startDate}
              max={dueDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date"
              className="bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
            <span className="text-muted-foreground/60">→</span>
            <input
              type="date"
              value={dueDate}
              min={startDate || undefined}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date"
              className="bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </label>
        </div>

        <DialogFooter className="mx-0 mb-0 px-3 py-2.5">
          <span className="mr-auto self-center text-[11px] text-muted-foreground">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">⌘↵</kbd> to create
          </span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? "Creating…" : "Create issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
