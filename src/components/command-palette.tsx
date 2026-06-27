"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  BookText,
  CircleDot,
  Database,
  FileText,
  Folder,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { createPage, createProject, searchWorkspace } from "@/lib/actions";
import type { SearchResult, SearchResultKind } from "@/lib/types";

const ic = "size-4 text-muted-foreground";

const KIND_ICON: Record<SearchResultKind, React.ReactNode> = {
  issue: <CircleDot className="size-4 text-muted-foreground" />,
  page: <FileText className="size-4 text-muted-foreground" />,
  project: <Folder className="size-4 text-muted-foreground" />,
  database: <Database className="size-4 text-muted-foreground" />,
  cycle: <Timer className="size-4 text-muted-foreground" />,
};

const KIND_GROUP: Record<SearchResultKind, string> = {
  issue: "Issues",
  page: "Pages",
  project: "Projects",
  database: "Databases",
  cycle: "Cycles",
};

const GROUP_ORDER: SearchResultKind[] = [
  "issue",
  "page",
  "project",
  "database",
  "cycle",
];

// Mirrors the sidebar: daily drivers, then the thin company layer. Per-project
// departments live inside each project, so they aren't listed here.
const NAV_GROUPS: {
  heading: string;
  items: { label: string; href: string; icon: React.ReactNode }[];
}[] = [
  {
    heading: "Jump to",
    items: [
      { label: "Ask AI", href: "/ask", icon: <Sparkles className={ic} /> },
      { label: "Inbox", href: "/inbox", icon: <Bell className={ic} /> },
      { label: "Issues", href: "/issues", icon: <CircleDot className={ic} /> },
      { label: "Projects", href: "/projects", icon: <Folder className={ic} /> },
      { label: "Wiki", href: "/pages", icon: <BookText className={ic} /> },
    ],
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [, startTransition] = useTransition();
  const reqId = useRef(0);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Change visibility and clear transient search state when closing.
  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
    }
  }

  // ⌘K / Ctrl+K + custom event to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        change(!openRef.current);
      }
    }
    function onOpen() {
      change(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  // Debounced server search. When the query is empty the UI shows the nav
  // list instead of results, so there's nothing to fetch.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await searchWorkspace(q);
        if (id === reqId.current) setResults(r);
      });
    }, 160);
    return () => clearTimeout(t);
  }, [query]);

  function go(href: string) {
    change(false);
    router.push(href);
  }

  function createAndOpen(fn: () => Promise<{ id: string }>, prefix: string) {
    change(false);
    startTransition(async () => {
      const created = await fn();
      router.push(`${prefix}/${created.id}`);
    });
  }

  function newIssue() {
    change(false);
    window.dispatchEvent(new Event("open-new-issue"));
  }

  const grouped = GROUP_ORDER.map((kind) => ({
    kind,
    items: results.filter((r) => r.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <CommandDialog
      open={open}
      onOpenChange={change}
      className="max-w-xl"
      title="Search"
      description="Search issues, pages, projects and more"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search or jump to…"
        />
        <CommandList>
          {query.trim() === "" ? (
            <>
              <CommandGroup heading="Create">
                <CommandItem value="new issue" onSelect={newIssue}>
                  <Plus className={ic} />
                  <span>New issue</span>
                </CommandItem>
                <CommandItem
                  value="new page"
                  onSelect={() => createAndOpen(() => createPage(null), "/pages")}
                >
                  <Plus className={ic} />
                  <span>New page</span>
                </CommandItem>
                <CommandItem
                  value="new project"
                  onSelect={() => createAndOpen(() => createProject({ name: "New project" }), "/projects")}
                >
                  <Plus className={ic} />
                  <span>New project</span>
                </CommandItem>
              </CommandGroup>
              {NAV_GROUPS.map((group) => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.items.map((n) => (
                    <CommandItem key={n.href} value={n.label} onSelect={() => go(n.href)}>
                      {n.icon}
                      <span>{n.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </>
          ) : (
            <>
              <CommandEmpty>No results found.</CommandEmpty>
              {grouped.map((g) => (
                <CommandGroup key={g.kind} heading={KIND_GROUP[g.kind]}>
                  {g.items.map((r) => (
                    <CommandItem
                      key={`${r.kind}:${r.id}`}
                      value={`${r.kind}:${r.id}:${r.title}`}
                      onSelect={() => go(r.href)}
                    >
                      {r.icon ? <span className="text-base leading-none">{r.icon}</span> : KIND_ICON[r.kind]}
                      <span className="truncate">{r.title}</span>
                      {r.subtitle && (
                        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                          {r.subtitle}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
