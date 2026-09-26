"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleUser, Contact, Folder, Menu } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Phone navigation. The four destinations plus a More button that opens the
 * drawer AppShell already owns.
 *
 * Four and not five: the drawer also holds the project tree, the page tree,
 * labels, favourites, settings and trash, so More has to exist whatever goes
 * beside it — and a fifth destination would buy one shortcut at the cost of
 * every target's width. At 360px five cells are 72px each, which clears WCAG
 * 2.5.8 with room for a label; six would not.
 *
 * It is a flex sibling of <main>, not `fixed`. A fixed bar floats over the
 * bottom of whatever is scrolling underneath it, so every scroll container in
 * the app would need its own bottom padding to keep its last row reachable;
 * laid out in the column it reserves its own space once.
 */
export function BottomNav({ unreadCount, onMore }: { unreadCount: number; onMore: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      // The inset is the phone's home indicator / gesture bar. Nothing else in
      // this codebase reads it, so without it the row sits under the gesture
      // bar on exactly the devices this nav exists for.
      className="flex shrink-0 border-t bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Item
        href="/my-issues"
        active={pathname === "/my-issues"}
        label="My Issues"
        icon={<CircleUser className="size-5" />}
      />
      <Item
        href="/inbox"
        active={pathname.startsWith("/inbox")}
        label="Inbox"
        icon={<Bell className="size-5" />}
        badge={unreadCount}
      />
      <Item
        href="/projects"
        active={pathname.startsWith("/projects")}
        label="Projects"
        icon={<Folder className="size-5" />}
      />
      <Item
        href="/prospects"
        active={pathname.startsWith("/prospects") || pathname.startsWith("/people")}
        label="Prospects"
        icon={<Contact className="size-5" />}
      />
      <button
        type="button"
        onClick={onMore}
        aria-label="More"
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-muted-foreground transition-colors hover:text-foreground active:bg-sidebar-accent"
      >
        <Menu className="size-5" />
        <span className="text-[10px] leading-none">More</span>
      </button>
    </nav>
  );
}

function Item({
  href,
  active,
  label,
  icon,
  badge,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors active:bg-sidebar-accent",
        active ? "text-brand" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {/* Colour alone does not carry the current tab. */}
      {active && <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-b bg-brand" />}
      <span className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] leading-none">{label}</span>
    </Link>
  );
}
