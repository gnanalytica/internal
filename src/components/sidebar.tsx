"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Compass,
  Folder,
  House,
  KeyRound,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessageSquare,
  Plus,
  PenSquare,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { GitHubIcon } from "@/components/auth/provider-icons";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { ThemeToggleItem } from "@/components/theme-toggle";
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
import { visibleDepartments, type DepartmentSlug } from "@/lib/departments";
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
  isAdmin = false,
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
  const [showProjects, setShowProjects] = useState(true);
  const [showOps, setShowOps] = useState(true);
  const [showPages, setShowPages] = useState(true);
  const [showFavorites, setShowFavorites] = useState(true);
  const peopleHr = projects.find((p) => p.key === "PPL");

  function signOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/auth/sign-in");
      router.refresh();
    });
  }

  function switchWorkspace(id: string) {
    if (id === workspace.id) return;
    startTransition(async () => {
      await setActiveWorkspace(id);
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
            {peopleHr && (
              <DropdownMenuItem
                onClick={() => router.push(`/projects/${peopleHr.id}`)}
                className="gap-2 text-sm"
              >
                <Users className="size-4" />
                People &amp; HR
              </DropdownMenuItem>
            )}
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
              onClick={() => router.push("/settings")}
              className="gap-2 text-sm"
            >
              <Settings className="size-4" />
              Account settings
            </DropdownMenuItem>
            <ThemeToggleItem />
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
          title="Search (⌘K)"
          onClick={() =>
            window.dispatchEvent(new Event("open-command-palette"))
          }
        >
          <Search className="size-4 text-muted-foreground" />
        </Button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
        {/* Primary — personal + daily driver */}
        <NavItem
          href="/"
          active={pathname === "/"}
          icon={<House className="size-4" />}
          label="Overview"
        />
        <NavItem
          href="/ask"
          active={pathname.startsWith("/ask")}
          icon={<Sparkles className="size-4" />}
          label="Ask AI"
        />
        <NavItem
          href="/inbox"
          active={pathname.startsWith("/inbox")}
          icon={<Bell className="size-4" />}
          label="Inbox"
          trailing={
            unreadCount > 0 ? (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : undefined
          }
        />
        <NavItem
          href="/issues"
          active={pathname === "/issues"}
          icon={<CircleDot className="size-4" />}
          label="Issues"
        />

        {/* Favorites */}
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

        {/* Projects — each expands to its department modules */}
        <Section
          title="Projects"
          open={showProjects}
          onToggle={() => setShowProjects((v) => !v)}
          action={
            <Link
              href="/projects"
              className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label="All projects"
            >
              <Folder className="size-3.5" />
            </Link>
          }
        >
          {projects
            .filter((p) => p.kind === "project")
            .map((p) => (
              <ProjectNavItem key={p.id} project={p} pathname={pathname} isAdmin={isAdmin} />
            ))}
        </Section>

        {/* Operations — back-office projects, no department modules */}
        {projects.some((p) => p.kind === "operation") && (
          <Section
            title="Operations"
            open={showOps}
            onToggle={() => setShowOps((v) => !v)}
          >
            {projects
              .filter((p) => p.kind === "operation")
              .map((p) => (
                <NavItem
                  key={p.id}
                  href={`/projects/${p.id}`}
                  active={pathname === `/projects/${p.id}`}
                  icon={
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: p.color }}
                    />
                  }
                  label={p.name}
                  trailing={
                    <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
                  }
                />
              ))}
          </Section>
        )}

        {/* Wiki — company pages (handbook, SOPs, entity refs) */}
        <Section
          title="Wiki"
          open={showPages}
          onToggle={() => setShowPages((v) => !v)}
          action={
            <>
            <Link
              href="/trash"
              className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Trash"
            >
              <Trash2 className="size-3.5" />
            </Link>
            <button
              onClick={() => newPage(null)}
              className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label="New page"
            >
              <Plus className="size-3.5" />
            </button>
            </>
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

function ProjectNavItem({
  project,
  pathname,
  isAdmin,
}: {
  project: Project;
  pathname: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const base = `/projects/${project.id}`;
  const [open, setOpen] = useState(pathname.startsWith(base));
  const deptIcons: Record<DepartmentSlug, React.ReactNode> = {
    product: <Compass className="size-3.5" />,
    engineering: <CircleDot className="size-3.5" />,
    analytics: <BarChart3 className="size-3.5" />,
    marketing: <Megaphone className="size-3.5" />,
    sales: <TrendingUp className="size-3.5" />,
    "customer-success": <LifeBuoy className="size-3.5" />,
  };
  const depts = visibleDepartments(project.enabledDepartments, isAdmin ? "admin" : "member").map((d) => ({
    href: `${base}/${d.slug}`,
    icon: deptIcons[d.slug],
    label: d.label,
  }));
  return (
    <div>
      <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            className={cn(
              "group/prod flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
              pathname === base
                ? "bg-sidebar-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          />
        }
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-black/5"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        </button>
        <Link href={base} className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: project.color }}
          />
          <span className="flex-1 truncate">{project.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{project.key}</span>
        </Link>
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
      {open &&
        depts.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className={cn(
              "flex items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-sm transition-colors",
              pathname === d.href
                ? "bg-sidebar-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <span className="shrink-0">{d.icon}</span>
            <span className="truncate">{d.label}</span>
          </Link>
        ))}
    </div>
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
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          {action}
        </div>
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
              "group/page flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
            style={{ paddingLeft: depth * 12 + 4 }}
          />
        }
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
          href={href}
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
