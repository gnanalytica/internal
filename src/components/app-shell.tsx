"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";

export function AppShell({
  sidebar,
  workspaceName,
  children,
}: {
  sidebar: React.ReactNode;
  workspaceName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const lastPath = useRef(pathname);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      {/* Skip to content (visible on keyboard focus) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-1.5 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>

      {/* Desktop sidebar (static) */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="grid size-8 place-items-center rounded-md hover:bg-accent"
          >
            <Menu className="size-5" />
          </button>
          <span className="grid size-6 place-items-center rounded-md bg-brand text-xs font-bold text-brand-foreground">
            {workspaceName[0]}
          </span>
          <span className="truncate text-sm font-semibold">{workspaceName}</span>
        </div>

        <main id="main" className="min-w-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </>
  );
}
