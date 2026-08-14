"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Renders once with the server's snapshot (during SSR and hydration), then
 * re-renders as soon as the browser takes over. Anything computed from the
 * clock can use this to hydrate against what the server sent and correct itself
 * immediately afterwards.
 */
function useRerenderAfterHydration(): void {
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * A timestamp rendered as "2 days ago".
 *
 * Relative times are computed from "now", which differs between the server
 * render and the moment the browser hydrates — enough to turn "29 seconds ago"
 * into "36 seconds ago", which React reports as a hydration mismatch and
 * recovers from by throwing away and re-rendering the tree.
 * `suppressHydrationWarning` tells React this text is expected to differ, and
 * the re-render after hydration gives the label the browser's clock rather than
 * leaving the server's stale string on screen.
 *
 * Renders a `<time>` element so the machine-readable instant stays in the DOM
 * and hovering shows the exact timestamp.
 */
export function RelativeTime({
  date,
  addSuffix = true,
  className,
}: {
  date: Date | string;
  /** "2 days ago" (default) vs "2 days" — the latter suits dense table cells. */
  addSuffix?: boolean;
  className?: string;
}) {
  const iso = typeof date === "string" ? date : date.toISOString();
  useRerenderAfterHydration();

  const at = new Date(iso);
  return (
    <time
      dateTime={iso}
      title={at.toLocaleString()}
      className={className}
      suppressHydrationWarning
    >
      {formatDistanceToNowStrict(at, { addSuffix })}
    </time>
  );
}
