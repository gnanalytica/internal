"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { setTheme, useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

const CHOICES: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="size-4" /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-4" /> },
  { value: "system", label: "Match device", icon: <Monitor className="size-4" /> },
];

/** Theme submenu for the workspace menu: Light, Dark or Match device. */
export function ThemeToggleItem() {
  const { choice, dark } = useTheme();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 text-sm">
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-40">
        <DropdownMenuRadioGroup value={choice} onValueChange={(v) => setTheme(v as ThemeChoice)}>
          {CHOICES.map((c) => (
            <DropdownMenuRadioItem key={c.value} value={c.value} className="gap-2 text-sm">
              {c.icon}
              {c.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** One click between light and dark; the new theme spreads out from the button. */
export function ThemeButton({ className }: { className?: string }) {
  const { dark } = useTheme();
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTheme(dark ? "light" : "dark", { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      className={cn("group relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground", className)}
    >
      <Sun className={cn("absolute size-4 transition-all duration-300", dark ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
      <Moon className={cn("absolute size-4 transition-all duration-300", dark ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")} />
    </button>
  );
}
