"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Columns3, List as ListIcon, Plus } from "lucide-react";

import { StatusIcon } from "@/components/glyphs";
import { IssueBoard } from "@/components/issue-board";
import { IssueRow } from "@/components/issue-row";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { updateIssue } from "@/lib/actions";
import { STATUSES, type StatusId } from "@/lib/constants";
import type { IssueWithRelations, Label, Member, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "list" | "board";

export function IssuesView({
  initialIssues,
  projects,
  members,
  labels,
  heading = "All issues",
  defaultProjectId = null,
}: {
  initialIssues: IssueWithRelations[];
  projects: Project[];
  members: Member[];
  labels: Label[];
  heading?: string;
  defaultProjectId?: string | null;
}) {
  const router = useRouter();
  const [issues, setIssues] = useState(initialIssues);
  const [view, setView] = useState<View>("list");
  const [, startTransition] = useTransition();

  useEffect(() => setIssues(initialIssues), [initialIssues]);

  function persist(changed: { id: string; status: StatusId; sortKey: string }[]) {
    startTransition(async () => {
      await Promise.all(
        changed.map((c) => updateIssue(c.id, { status: c.status, sortKey: c.sortKey })),
      );
      router.refresh();
    });
  }

  const grouped = STATUSES.map((s) => ({
    status: s,
    items: issues
      .filter((i) => i.status === s.id)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Issues", href: "/issues" }, { label: heading }]}
        actions={
          <NewIssueDialog
            projects={projects}
            members={members}
            labels={labels}
            defaultProjectId={defaultProjectId}
            trigger={
              <Button size="sm" className="h-7 gap-1.5">
                <Plus className="size-4" /> New
              </Button>
            }
          />
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-4 py-1.5">
        <span className="text-sm font-medium">{heading}</span>
        <span className="text-xs text-muted-foreground">{issues.length}</span>
        <div className="ml-auto flex items-center rounded-md border p-0.5">
          <ViewButton active={view === "list"} onClick={() => setView("list")}>
            <ListIcon className="size-3.5" /> List
          </ViewButton>
          <ViewButton active={view === "board"} onClick={() => setView("board")}>
            <Columns3 className="size-3.5" /> Board
          </ViewButton>
        </div>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          projects={projects}
          members={members}
          labels={labels}
          defaultProjectId={defaultProjectId}
        />
      ) : view === "list" ? (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {grouped.map((g) => (
            <div key={g.status.id}>
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-muted/60 px-4 py-1.5 backdrop-blur">
                <StatusIcon status={g.status.id} />
                <span className="text-xs font-semibold">{g.status.label}</span>
                <span className="text-xs text-muted-foreground">{g.items.length}</span>
              </div>
              {g.items.map((issue) => (
                <IssueRow key={issue.id} issue={issue} members={members} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <IssueBoard
            issues={issues}
            members={members}
            onChange={setIssues}
            persist={persist}
          />
        </div>
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  projects,
  members,
  labels,
  defaultProjectId,
}: {
  projects: Project[];
  members: Member[];
  labels: Label[];
  defaultProjectId: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
        <StatusIcon status="todo" className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">No issues yet</p>
        <p className="text-xs text-muted-foreground">Create your first issue to get started.</p>
      </div>
      <NewIssueDialog
        projects={projects}
        members={members}
        labels={labels}
        defaultProjectId={defaultProjectId}
        trigger={
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" /> New issue
          </Button>
        }
      />
    </div>
  );
}
