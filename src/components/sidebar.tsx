"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileText,
  LogOut,
  Plus,
  PenSquare,
  Search,
} from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { createPage } from "@/lib/actions";
import { authClient } from "@/lib/auth/client";
import type { Label, Member, PageNode, Project } from "@/lib/types";
import type { workspaces } from "@/db/schema";
import { cn } from "@/lib/utils";

type Workspace = typeof workspaces.$inferSelect;

export function Sidebar({
  workspace,
  members,
  currentUser,
  projects,
  pageTree,
  labels,
}: {
  workspace: Workspace;
  members: Member[];
  currentUser: Member;
  projects: Project[];
  pageTree: PageNode[];
  labels: Label[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [showProjects, setShowProjects] = useState(true);
  const [showPages, setShowPages] = useState(true);

  function signOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/auth/sign-in");
      router.refresh();
    });
  }

  function newPage(parentId?: string | null) {
    startTransition(async () => {
      const page = await createPage(parentId ?? null);
      router.push(`/pages/${page.id}`);
      router.refresh();
    });
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Workspace + user */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex flex-1 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sidebar-accent focus:outline-none">
            <span className="grid size-6 place-items-center rounded-md bg-brand text-xs font-bold text-brand-foreground">
              {workspace.name[0]}
            </span>
            <span className="text-sm font-semibold">{workspace.name}</span>
            <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 pt-1.5 text-[11px] text-muted-foreground">
              Signed in as
            </div>
            <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
              <UserAvatar name={currentUser.name} color={currentUser.avatarColor} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{currentUser.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {currentUser.email}
                </div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="gap-2 text-sm">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New issue + search */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        <NewIssueDialog
          projects={projects}
          members={members}
          labels={labels}
          trigger={
            <Button
              size="sm"
              className="h-8 flex-1 justify-start gap-2 bg-background text-foreground shadow-sm ring-1 ring-border hover:bg-accent"
              variant="ghost"
            >
              <PenSquare className="size-4 text-brand" />
              New issue
            </Button>
          }
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-8 ring-1 ring-border"
          aria-label="Search"
        >
          <Search className="size-4 text-muted-foreground" />
        </Button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
        {/* Primary */}
        <NavItem
          href="/issues"
          active={pathname === "/issues"}
          icon={<CircleDot className="size-4" />}
          label="Issues"
        />

        {/* Projects */}
        <Section
          title="Projects"
          open={showProjects}
          onToggle={() => setShowProjects((v) => !v)}
        >
          {projects.map((p) => (
            <NavItem
              key={p.id}
              href={`/issues?project=${p.id}`}
              active={pathname === "/issues" && false}
              icon={
                <span
                  className="size-2.5 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: p.color }}
                />
              }
              label={p.name}
              trailing={<span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>}
            />
          ))}
        </Section>

        {/* Pages */}
        <Section
          title="Pages"
          open={showPages}
          onToggle={() => setShowPages((v) => !v)}
          action={
            <button
              onClick={() => newPage(null)}
              className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label="New page"
            >
              <Plus className="size-3.5" />
            </button>
          }
        >
          {pageTree.length === 0 && (
            <button
              onClick={() => newPage(null)}
              className="px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              + New page
            </button>
          )}
          {pageTree.map((node) => (
            <PageTreeItem
              key={node.id}
              node={node}
              depth={0}
              pathname={pathname}
              onAddChild={(id) => newPage(id)}
            />
          ))}
        </Section>
      </nav>
    </aside>
  );
}

function NavItem({
  href,
  active,
  icon,
  label,
  trailing,
}: {
  href: string;
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <span className={cn("shrink-0", active ? "text-brand" : "")}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

function Section({
  title,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="group flex items-center gap-1 px-2 py-1">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
          {title}
        </button>
        <div className="ml-auto opacity-0 group-hover:opacity-100">{action}</div>
      </div>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

function PageTreeItem({
  node,
  depth,
  pathname,
  onAddChild,
}: {
  node: PageNode;
  depth: number;
  pathname: string;
  onAddChild: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const active = pathname === `/pages/${node.id}`;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group/page flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
          active
            ? "bg-sidebar-accent font-medium text-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-black/5",
            !hasChildren && "invisible",
          )}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        </button>
        <Link
          href={`/pages/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
        >
          <span className="text-sm leading-none">{node.icon}</span>
          <span className="truncate">{node.title || "Untitled"}</span>
        </Link>
        <button
          onClick={() => onAddChild(node.id)}
          className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-black/5 hover:text-foreground group-hover/page:opacity-100"
          aria-label="Add sub-page"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {open &&
        node.children.map((child) => (
          <PageTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            pathname={pathname}
            onAddChild={onAddChild}
          />
        ))}
    </div>
  );
}
