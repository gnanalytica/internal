"use client";

import { useSyncExternalStore } from "react";

/**
 * Light, dark or follow the device. The choice lives in localStorage under
 * "theme" (no key means system), and the pre-paint script in the root layout
 * applies it before the first frame; this module keeps it in step afterwards.
 */
export type ThemeChoice = "light" | "dark" | "system";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function stored(): ThemeChoice {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function paint(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Switch theme. With a click position, the new theme grows out from it as a
 * circle (View Transitions); browsers without them, and anyone who asks for
 * reduced motion, get an instant switch.
 */
export function setTheme(choice: ThemeChoice, from?: { x: number; y: number }) {
  try {
    if (choice === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", choice);
  } catch {
    // storage may be unavailable; the switch still applies to this page
  }
  const dark = choice === "dark" || (choice === "system" && media().matches);
  const apply = () => {
    paint(dark);
    emit();
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce || dark === document.documentElement.classList.contains("dark")) {
    apply();
    return;
  }
  const x = from?.x ?? window.innerWidth / 2;
  const y = from?.y ?? 0;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  document.startViewTransition(apply).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 420, easing: "cubic-bezier(0.2, 0, 0, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Repaint when the device switches (for "system") or another tab changes the choice.
  const onMedia = () => {
    const c = stored();
    paint(c === "dark" || (c === "system" && media().matches));
    cb();
  };
  const m = media();
  m.addEventListener("change", onMedia);
  window.addEventListener("storage", onMedia);
  return () => {
    listeners.delete(cb);
    m.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onMedia);
  };
}

/** The saved choice, and whether the page is dark right now. Server render assumes light/system. */
export function useTheme(): { choice: ThemeChoice; dark: boolean } {
  const choice = useSyncExternalStore(subscribe, stored, () => "system" as const);
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark"), () => false);
  return { choice, dark };
}
