"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    // ignore
  }
}

/** Dropdown item that toggles light/dark. Reads the initial state from the DOM. */
export function ThemeToggleItem() {
  const [dark, setDark] = useState(false);

  // Sync the toggle to the theme the no-flash script already applied to <html>.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setDark(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <DropdownMenuItem
      onClick={(e) => {
        e.preventDefault();
        const next = !dark;
        setDark(next);
        applyTheme(next);
      }}
      className="gap-2 text-sm"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {dark ? "Light mode" : "Dark mode"}
    </DropdownMenuItem>
  );
}
