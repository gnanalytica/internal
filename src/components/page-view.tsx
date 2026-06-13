"use client";

import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Link2, MoreHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { RichEditor } from "@/components/editor/rich-editor";
import { StatusIcon } from "@/components/glyphs";
import { FavoriteButton } from "@/components/favorite-button";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  deletePage,
  linkIssueToPage,
  unlinkIssueFromPage,
  updatePage,
} from "@/lib/actions";
import type { FlatIssue, IssueWithRelations, Page } from "@/lib/types";
import { issueIdentifier } from "@/lib/types";
import type { StatusId } from "@/lib/constants";

const EMOJIS = ["📄", "📝", "📚", "🛠️", "🚀", "🏗️", "📌", "💡", "🎯", "🔥", "✅", "📁", "🧭", "🗂️", "⭐", "🧪"];

export function PageView({
  page,
  allIssues,
  favorited,
}: {
  page: Page & { linkedIssues: IssueWithRelations[] };
  allIssues: FlatIssue[];
  favorited: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(page.title);
  const [icon, setIcon] = useState(page.icon);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const linkedIds = new Set(page.linkedIssues.map((i) => i.id));
  const linkable = allIssues.filter((i) => !linkedIds.has(i.id));

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  function saveTitle(next: string) {
    setTitle(next);
    startTransition(() => {
      void updatePage(page.id, { title: next.trim() || "Untitled" });
    });
  }

  function saveIcon(next: string) {
    setIcon(next);
    setEmojiOpen(false);
    startTransition(() => void updatePage(page.id, { icon: next }));
  }

  function saveContent(json: JSONContent) {
    void updatePage(page.id, { content: json });
  }

  function onDelete() {
    startTransition(async () => {
      await deletePage(page.id);
      toast.success("Page deleted");
      router.push("/issues");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Pages" }, { label: title || "Untitled" }]}
        actions={
          <>
            <FavoriteButton kind="page" targetId={page.id} initial={favorited} />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="size-7" />}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={onDelete}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" /> Move to trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-12 py-12">
          {/* Icon */}
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger
              render={
                <button className="mb-2 rounded-md p-1 text-5xl leading-none transition-transform hover:scale-105" />
              }
            >
              {icon}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => saveIcon(e)}
                    className="grid size-7 place-items-center rounded text-lg hover:bg-accent"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Title */}
          <textarea
            value={title}
            onChange={(e) => saveTitle(e.target.value)}
            rows={1}
            placeholder="Untitled"
            className="w-full resize-none overflow-hidden bg-transparent text-4xl font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/40"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${t.scrollHeight}px`;
            }}
          />

          {/* Body */}
          <div className="mt-3 text-[15px]">
            <RichEditor
              content={(page.content as JSONContent) ?? null}
              onChange={saveContent}
            />
          </div>

          {/* Linked issues */}
          <div className="mt-10 border-t pt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Linked issues
              </h3>
              <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                <PopoverTrigger
                  render={<Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" />}
                >
                  <Link2 className="size-3.5" /> Link issue
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-0">
                  <Command>
                    <CommandInput placeholder="Search issues…" className="h-9" />
                    <CommandList>
                      <CommandEmpty>No issues found.</CommandEmpty>
                      <CommandGroup>
                        {linkable.map((i) => (
                          <CommandItem
                            key={i.id}
                            value={`${i.projectKey ?? ""}-${i.number} ${i.title}`}
                            onSelect={() => {
                              setLinkOpen(false);
                              persist(() => linkIssueToPage(i.id, page.id));
                            }}
                            className="gap-2"
                          >
                            <StatusIcon status={i.status as StatusId} />
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {i.projectKey ? `${i.projectKey}-${i.number}` : `#${i.number}`}
                            </span>
                            <span className="truncate">{i.title}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {page.linkedIssues.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No linked issues. Connect work to this doc.
              </p>
            ) : (
              <div className="space-y-0.5">
                {page.linkedIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <StatusIcon status={issue.status as StatusId} />
                    <span className="font-mono text-xs text-muted-foreground">
                      {issueIdentifier(issue)}
                    </span>
                    <Link href={`/issues/${issue.id}`} className="flex-1 truncate hover:underline">
                      {issue.title}
                    </Link>
                    <button
                      onClick={() => persist(() => unlinkIssueFromPage(issue.id, page.id))}
                      className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-black/5 hover:text-foreground group-hover:opacity-100"
                      aria-label="Unlink issue"
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
    </div>
  );
}
