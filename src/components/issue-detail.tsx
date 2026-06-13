"use client";

import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText, Link2, MoreHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { RichEditor } from "@/components/editor/rich-editor";
import {
  AssigneePicker,
  LabelChip,
  LabelPicker,
  PriorityPicker,
  ProjectPicker,
  StatusPicker,
} from "@/components/pickers";
import { Topbar } from "@/components/topbar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  deleteIssue,
  linkIssueToPage,
  setIssueLabels,
  unlinkIssueFromPage,
  updateIssue,
} from "@/lib/actions";
import { issueIdentifier } from "@/lib/types";
import type { IssueWithRelations, Label, Member, Page, Project } from "@/lib/types";
import type { PriorityId, StatusId } from "@/lib/constants";

type FlatPage = Pick<Page, "id" | "title" | "icon">;

export function IssueDetail({
  issue,
  projects,
  members,
  labels,
  allPages,
}: {
  issue: IssueWithRelations & { linkedPages: Page[] };
  projects: Project[];
  members: Member[];
  labels: Label[];
  allPages: FlatPage[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(issue.title);
  const [linkOpen, setLinkOpen] = useState(false);

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const linkedIds = new Set(issue.linkedPages.map((p) => p.id));
  const linkable = allPages.filter((p) => !linkedIds.has(p.id));

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          { label: "Issues", href: "/issues" },
          { label: issueIdentifier(issue) },
        ]}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-7" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  persist(async () => {
                    await deleteIssue(issue.id);
                    toast.success("Issue deleted");
                    router.push("/issues");
                  })
                }
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Delete issue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Main */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-10 py-10">
            <textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                void updateIssue(issue.id, { title: e.target.value.trim() || "Untitled issue" });
              }}
              rows={1}
              placeholder="Issue title"
              className="w-full resize-none overflow-hidden bg-transparent text-2xl font-semibold leading-snug outline-none placeholder:text-muted-foreground/40"
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${t.scrollHeight}px`;
              }}
            />
            <div className="mt-3 text-[15px]">
              <RichEditor
                content={(issue.description as JSONContent) ?? null}
                placeholder="Add a description… (type '/' for commands)"
                onChange={(json) => void updateIssue(issue.id, { description: json })}
              />
            </div>

            {/* Linked pages */}
            <div className="mt-10 border-t pt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Linked pages
                </h3>
                <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                  <PopoverTrigger
                    render={<Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" />}
                  >
                    <Link2 className="size-3.5" /> Link page
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-0">
                    <Command>
                      <CommandInput placeholder="Search pages…" className="h-9" />
                      <CommandList>
                        <CommandEmpty>No pages found.</CommandEmpty>
                        <CommandGroup>
                          {linkable.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.title}
                              onSelect={() => {
                                setLinkOpen(false);
                                persist(() => linkIssueToPage(issue.id, p.id));
                              }}
                              className="gap-2"
                            >
                              <span>{p.icon}</span>
                              <span className="truncate">{p.title || "Untitled"}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {issue.linkedPages.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No linked pages. Connect docs to this issue.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {issue.linkedPages.map((p) => (
                    <div
                      key={p.id}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <span>{p.icon}</span>
                      <Link href={`/pages/${p.id}`} className="flex-1 truncate hover:underline">
                        {p.title || "Untitled"}
                      </Link>
                      <button
                        onClick={() => persist(() => unlinkIssueFromPage(issue.id, p.id))}
                        className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-black/5 hover:text-foreground group-hover:opacity-100"
                        aria-label="Unlink page"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Properties */}
        <aside className="w-64 shrink-0 border-l bg-muted/20 p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Properties
          </h3>
          <div className="space-y-1">
            <PropRow label="Status">
              <StatusPicker
                value={issue.status as StatusId}
                onChange={(v) => persist(() => updateIssue(issue.id, { status: v }))}
              />
            </PropRow>
            <PropRow label="Priority">
              <PriorityPicker
                value={issue.priority as PriorityId}
                onChange={(v) => persist(() => updateIssue(issue.id, { priority: v }))}
              />
            </PropRow>
            <PropRow label="Assignee">
              <AssigneePicker
                members={members}
                value={issue.assigneeId}
                onChange={(v) => persist(() => updateIssue(issue.id, { assigneeId: v }))}
              />
            </PropRow>
            <PropRow label="Project">
              <ProjectPicker
                projects={projects}
                value={issue.projectId}
                onChange={(v) => persist(() => updateIssue(issue.id, { projectId: v }))}
              />
            </PropRow>
            <PropRow label="Labels">
              <LabelPicker
                labels={labels}
                value={issue.labels.map((l) => l.id)}
                onChange={(ids) => persist(() => setIssueLabels(issue.id, ids))}
              />
            </PropRow>
          </div>

          {issue.labels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {issue.labels.map((l) => (
                <LabelChip key={l.id} label={l} />
              ))}
            </div>
          )}

          <div className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileText className="size-3" />
              {issue.linkedPages.length} linked page
              {issue.linkedPages.length === 1 ? "" : "s"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
