"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CircleUser,
  Folder,
  House,
  KeyRound,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Table2,
  Tag,
  Trash2,
  Users,
} from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { GitHubIcon } from "@/components/auth/provider-icons";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { ThemeButton, ThemeToggleItem } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { createPage, deletePage, deleteProject, setActiveWorkspace } from "@/lib/actions";
import { authClient } from "@/lib/auth/client";
import type {
  FavoriteItem,
  Label,
  Member,
  PageNode,
  Project,
  Workspace,
  WorkspaceWithRole,
} from "@/lib/types";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { cn } from "@/lib/utils";

export function Sidebar({
  workspace,
  workspaces,
  members,
  currentUser,
  projects,
  pageTree,
  labels,
  unreadCount = 0,
  favorites = [],
}: {
  workspace: Workspace;
  workspaces: WorkspaceWithRole[];
  members: Member[];
  currentUser: Member;
  projects: Project[];
  pageTree: PageNode[];
  labels: Label[];
  unreadCount?: number;
  favorites?: FavoriteItem[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [showProducts, setShowProducts] = useState(true);
  const [showOps, setShowOps] = useState(true);
  const [showLibrary, setShowLibrary] = useState(true);
  const [showFavorites, setShowFavorites] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const products = projects.filter((p) => p.kind === "project");
  const operations = projects.filter((p) => p.kind === "operation");
  const productActive = (p: Project) =>
    pathname === `/projects/${p.id}` ||
    pathname.startsWith(`/projects/${p.id}/`) ||
    (p.key === PROSPECTS_PRODUCT_KEY && pathname.startsWith("/prospects"));

  // Restore collapsed state after mount (avoids SSR hydration mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      if (localStorage.getItem("sidebar-collapsed") === "1") setCollapsed(true);
    } catch {
      // storage may be unavailable
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  function signOut() {
    startTransition(async () => {
      await authClient.signOut();
      // A full reload, not router.push. Under Cache Components the router keeps
      // recently visited routes mounted (React <Activity>), so a client-side
      // navigation would leave this user's drafts, filters and editor content
      // in memory for whoever signs in next.
      window.location.href = "/auth/sign-in";
    });
  }

  function switchWorkspace(id: string) {
    if (id === workspace.id) return;
    startTransition(async () => {
      await setActiveWorkspace(id);
      // Same reasoning as sign-out: every route below is scoped to one
      // workspace, so drop the mounted routes rather than carrying the old
      // workspace's client state into the new one.
      window.location.href = "/";
    });
  }

  function newPage(parentId?: string | null) {
    startTransition(async () => {
      const page = await createPage(parentId ?? null);
      router.push(`/pages/${page.id}`);
      router.refresh();
    });
  }

  if (collapsed) {
    return (
      <aside className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-2 text-sidebar-foreground">
        <button
          onClick={toggleCollapsed}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <PanelLeftOpen className="size-4" />
        </button>
        <span
          className="grid size-7 place-items-center rounded-md bg-brand text-xs font-bold text-brand-foreground"
          title={workspace.name}
        >
          {workspace.name[0]}
        </span>
        <div className="my-1 h-px w-6 bg-border" />
        <NewIssueDialog
          projects={projects}
          members={members}
          labels={labels}
          trigger={
            <Button size="icon" variant="ghost" className="size-8" aria-label="New task" title="New task">
              <PenSquare className="size-4 text-brand" />
            </Button>
          }
        />
        <RailButton onClick={() => window.dispatchEvent(new Event("open-command-palette"))} label="Search (⌘K)">
          <Search className="size-4" />
        </RailButton>
        <div className="my-1 h-px w-6 bg-border" />
        <RailLink href="/" active={pathname === "/"} label="Home"><House className="size-4" /></RailLink>
        <RailLink href="/inbox" active={pathname.startsWith("/inbox")} label="Inbox"><Bell className="size-4" /></RailLink>
        <RailLink href="/my-issues" active={pathname === "/my-issues"} label="My tasks"><CircleUser className="size-4" /></RailLink>
        <RailLink href="/ask" active={pathname.startsWith("/ask")} label="Ask"><Sparkles className="size-4" /></RailLink>
        <div className="my-1 h-px w-6 bg-border" />
        <RailLink href="/projects" active={pathname === "/projects"} label="Projects"><Folder className="size-4" /></RailLink>
        <RailLink href="/issues" active={pathname === "/issues"} label="All tasks"><CircleDot className="size-4" /></RailLink>
        <RailLink href="/org" active={pathname === "/org"} label="Team"><Users className="size-4" /></RailLink>
        <div className="my-1 h-px w-6 bg-border" />
        {products.map((p) => (
          <RailLink key={p.id} href={`/projects/${p.id}`} active={productActive(p)} label={p.name}>
            <span className="size-3 rounded-[3px]" style={{ backgroundColor: p.color }} />
          </RailLink>
        ))}
        <div className="my-1 h-px w-6 bg-border" />
        <RailLink href="/databases" active={pathname.startsWith("/databases")} label="Databases"><Table2 className="size-4" /></RailLink>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Workspace switcher + collapse */}
      <div className="flex items-center gap-1 px-2.5 pt-2.5 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand text-xs font-bold text-brand-foreground">
              {workspace.name[0]}
            </span>
            <span className="truncate text-ui font-semibold">{workspace.name}</span>
            <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <div className="px-2 pt-1.5 text-[11px] text-muted-foreground">
              Workspaces
            </div>
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => switchWorkspace(w.id)}
                className="gap-2 text-sm"
              >
                <span className="grid size-5 place-items-center rounded bg-brand text-[10px] font-bold text-brand-foreground">
                  {w.name[0]}
                </span>
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === workspace.id && (
                  <span className="size-1.5 rounded-full bg-brand" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => router.push("/onboarding")}
              className="gap-2 text-sm text-muted-foreground"
            >
              <Plus className="size-4" />
              New workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 pt-1 text-[11px] text-muted-foreground">
              Integrations
            </div>
            <DropdownMenuItem
              onClick={() => router.push("/settings/slack")}
              className="gap-2 text-sm"
            >
              <MessageSquare className="size-4" />
              Slack
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings/github")}
              className="gap-2 text-sm"
            >
              <GitHubIcon className="size-4" />
              GitHub
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings/api")}
              className="gap-2 text-sm"
            >
              <KeyRound className="size-4" />
              API &amp; MCP
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings/labels")}
              className="gap-2 text-sm"
            >
              <Tag className="size-4" />
              Labels
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ThemeToggleItem />
            <DropdownMenuItem onClick={signOut} className="gap-2 text-sm">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={toggleCollapsed}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* New task + search */}
      <div className="flex items-center gap-1.5 px-2.5 pb-3">
        <NewIssueDialog
          projects={projects}
          members={members}
          labels={labels}
          trigger={
            <Button
              size="sm"
              className="h-8 flex-1 justify-start gap-2 bg-background text-ui text-foreground ring-1 ring-border hover:bg-accent"
              variant="ghost"
            >
              <PenSquare className="size-4 text-brand" />
              New task
              <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px] leading-4 text-muted-foreground">C</kbd>
            </Button>
          }
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-8 ring-1 ring-border"
          aria-label="Search"
          title="Search (⌘K)"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        >
          <Search className="size-4 text-muted-foreground" />
        </Button>
      </div>

      <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
        {/* You — what needs me. Home is your own work, first thing after sign-in. */}
        <NavItem href="/" active={pathname === "/"} icon={<House className="size-4" />} label="Home" />
        <NavItem
          href="/inbox"
          active={pathname.startsWith("/inbox")}
          icon={<Bell className="size-4" />}
          label="Inbox"
          trailing={
            unreadCount > 0 ? (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold tabular-nums text-brand-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : undefined
          }
        />
        <NavItem
          href="/my-issues"
          active={pathname === "/my-issues"}
          icon={<CircleUser className="size-4" />}
          label="My tasks"
        />
        <NavItem
          href="/ask"
          active={pathname.startsWith("/ask")}
          icon={<Sparkles className="size-4" />}
          label="Ask"
        />

        {/* Workspace — every project in one view (with its timeline and this
            week's rollup as tabs), every task, and the people. */}
        <Group title="Workspace">
          <NavItem href="/projects" active={pathname === "/projects"} icon={<Folder className="size-4" />} label="Projects" />
          <NavItem href="/issues" active={pathname === "/issues"} icon={<CircleDot className="size-4" />} label="All tasks" />
          <NavItem href="/org" active={pathname === "/org"} icon={<Users className="size-4" />} label="Team" />
        </Group>

        {favorites.length > 0 && (
          <Section
            title="Favorites"
            open={showFavorites}
            onToggle={() => setShowFavorites((v) => !v)}
          >
            {favorites.map((f) => (
              <NavItem
                key={f.id}
                href={f.href}
                active={pathname === f.href}
                icon={
                  f.kind === "issue" ? (
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  ) : (
                    <span className="text-sm leading-none">{f.icon ?? "📁"}</span>
                  )
                }
                label={f.title}
              />
            ))}
          </Section>
        )}

        {/* Products — departments live in each product's header tabs, not here */}
        <Section
          title="Products"
          open={showProducts}
          onToggle={() => setShowProducts((v) => !v)}
          action={
            <Link
              href="/projects"
              className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label="All projects"
              title="All projects"
            >
              <Folder className="size-3.5" />
            </Link>
          }
        >
          {products.map((p) => (
            <ProductNavItem key={p.id} project={p} active={productActive(p)} />
          ))}
        </Section>

        {/* Back office — company operations across both entities */}
        {operations.length > 0 && (
          <Section title="Back office" open={showOps} onToggle={() => setShowOps((v) => !v)}>
            {operations.map((o) => (
              <NavItem
                key={o.id}
                href={`/projects/${o.id}`}
                active={pathname === `/projects/${o.id}` || pathname.startsWith(`/projects/${o.id}/`)}
                icon={<span className="block size-2 rounded-full ring-[1.5px] ring-current ring-inset" />}
                label={o.name}
              />
            ))}
          </Section>
        )}

        {/* Library — where things are written down. The section and its "+"
            always show: an empty wiki needs a visible way to start it. */}
        <Section
          title="Library"
          open={showLibrary}
          onToggle={() => setShowLibrary((v) => !v)}
          action={
            <button
              onClick={() => newPage(null)}
              className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label="New page"
              title="New page"
            >
              <Plus className="size-3.5" />
            </button>
          }
        >
          <NavItem
            href="/databases"
            active={pathname.startsWith("/databases")}
            icon={<Table2 className="size-4" />}
            label="Databases"
          />
          <NavItem
            href="/trash"
            active={pathname === "/trash"}
            icon={<Trash2 className="size-4" />}
            label="Trash"
          />
          {pageTree.length === 0 ? (
            <button
              onClick={() => newPage(null)}
              className="flex h-7 w-full items-center rounded-md px-2 text-left text-ui text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
            >
              Start the handbook
            </button>
          ) : (
            pageTree.map((node) => (
              <PageTreeItem
                key={node.id}
                node={node}
                depth={0}
                pathname={pathname}
                onAddChild={(id) => newPage(id)}
              />
            ))
          )}
        </Section>
      </nav>

      {/* You, and the way into settings */}
      <div className="flex items-center gap-2 border-t px-2.5 py-2">
        <UserAvatar name={currentUser.name} color={currentUser.avatarColor} className="size-6 text-[10px]" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-ui font-medium">{currentUser.name}</div>
          <div className="truncate text-2xs text-muted-foreground">{currentUser.email}</div>
        </div>
        <ThemeButton />
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-md hover:bg-sidebar-accent hover:text-foreground",
            pathname.startsWith("/settings") ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </aside>
  );
}

/** Icon-only nav link for the collapsed rail. */
function RailLink({ href, active, label, children }: { href: string; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid size-8 place-items-center rounded-md transition-colors",
        active
          ? "bg-sidebar-accent text-brand"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** Icon-only action button for the collapsed rail. */
function RailButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
    >
      {children}
    </button>
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-7 items-center gap-2 rounded-md px-2 text-ui transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-foreground",
      )}
    >
      <span className={cn("grid size-4 shrink-0 place-items-center", active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

/** One product, marked by its colour dot. */
function ProductNavItem({ project, active }: { project: Project; active: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const base = `/projects/${project.id}`;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Link
            href={base}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-7 items-center gap-2 rounded-md px-2 text-ui transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-foreground",
            )}
          />
        }
      >
        <span className="grid size-4 shrink-0 place-items-center">
          <span
            className="size-2.5 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: project.color }}
          />
        </span>
        <span className="flex-1 truncate">{project.name}</span>
        <span className="font-mono text-[10px] text-faint-foreground group-hover:text-muted-foreground">{project.key}</span>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => router.push(base)}>Open</ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(`${window.location.origin}${base}`);
            toast.success("Link copied");
          }}
        >
          Copy link
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() => {
            if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
            start(async () => {
              await deleteProject(project.id);
              toast.success("Project deleted");
              router.push("/projects");
              router.refresh();
            });
          }}
        >
          Delete project
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** A fixed group of links under a plain heading. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

/** A group that folds away; its actions show on hover. */
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
    <div className="mt-5">
      <div className="group flex items-center gap-1 px-2 pb-1">
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {title}
          <ChevronRight
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
        </button>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          {action}
        </div>
      </div>
      {open && <div>{children}</div>}
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
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(true);
  const active = pathname === `/pages/${node.id}`;
  const hasChildren = node.children.length > 0;
  const href = `/pages/${node.id}`;

  return (
    <div>
      <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            className={cn(
              "group/page flex h-7 items-center gap-1 rounded-md pr-1 text-ui transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-foreground",
            )}
            style={{ paddingLeft: depth * 12 + 4 }}
          />
        }
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-foreground/5",
            !hasChildren && "invisible",
          )}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        </button>
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1"
        >
          <span className="text-sm leading-none">{node.icon}</span>
          <span className="truncate">{node.title || "Untitled"}</span>
        </Link>
        <button
          onClick={() => onAddChild(node.id)}
          className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-foreground/5 hover:text-foreground group-hover/page:opacity-100"
          aria-label="Add sub-page"
        >
          <Plus className="size-3.5" />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onAddChild(node.id)}>New sub-page</ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(`${window.location.origin}${href}`);
            toast.success("Link copied");
          }}
        >
          Copy link
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() =>
            start(async () => {
              await deletePage(node.id);
              toast.success("Page moved to trash");
              router.refresh();
            })
          }
        >
          Delete page
        </ContextMenuItem>
      </ContextMenuContent>
      </ContextMenu>
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
