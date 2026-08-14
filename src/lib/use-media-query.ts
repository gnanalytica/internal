"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query from React.
 *
 * The server has no viewport, so the server snapshot is always `false` — the
 * query is treated as unmatched during SSR and the first hydration render, then
 * re-evaluated for real once the browser takes over. Write queries so that
 * `false` means "the desktop layout", and hydration stays clean.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below Tailwind's `sm` breakpoint — phone-width layouts. */
export const NARROW_SCREEN = "(max-width: 639px)";
