"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  deleteInitiative,
  setProjectInitiative,
  updateInitiative,
} from "@/lib/actions";
import {
  INITIATIVE_STATUSES,
  type Initiative,
  type Project,
  type ProjectWithIssueCount,
} from "@/lib/types";

export function InitiativeDetail({
  initiative,
  allProjects,
}: {
  initiative: Initiative & { projects: ProjectWithIssueCount[] };
  allProjects: Project[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(initiative.name);
  const [description, setDescription] = useState(initiative.description ?? "");
  const [addOpen, setAddOpen] = useState(false);

  const inIds = new Set(initiative.projects.map((p) => p.id));
  const addable = allProjects.filter((p) => !inIds.has(p.id));
  const status =
    INITIATIVE_STATUSES.find((s) => s.id === initiative.status) ?? INITIATIVE_STATUSES[1];

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          { label: "Initiatives", href: "/initiatives" },
          { label: name || "Untitled" },
        ]}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-7" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  persist(async () => {
                    await deleteInitiative(initiative.id);
                    toast.success("Initiative deleted");
                    router.push("/initiatives");
                  })
                }
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Delete initiative
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-10">
          {/* Title + status */}
          <div className="flex items-start gap-3">
            <span
              className="mt-2 size-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: initiative.color }}
            />
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                void updateInitiative(initiative.id, {
                  name: e.target.value.trim() || "Untitled initiative",
                });
              }}
              placeholder="Initiative name"
              className="flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" className="gap-1.5" />}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {status.label}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {INITIATIVE_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() =>
                      persist(() => updateInitiative(initiative.id, { status: s.id }))
                    }
                    className="gap-2 text-xs"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="flex-1">{s.label}</span>
                    {initiative.status === s.id && <Check className="size-3.5 opacity-70" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              void updateInitiative(initiative.id, { description: e.target.value });
            }}
            placeholder="Add a description…"
            rows={2}
            className="mt-3 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />

          {/* Projects */}
          <div className="mt-8 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Projects
            </h3>
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger
                render={<Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" />}
              >
                <Plus className="size-3.5" /> Add project
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
                <Command>
                  <CommandInput placeholder="Search projects…" className="h-9" />
                  <CommandList>
                    <CommandEmpty>No projects.</CommandEmpty>
                    <CommandGroup>
                      {addable.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => {
                            setAddOpen(false);
                            persist(() => setProjectInitiative(p.id, initiative.id));
                          }}
                          className="gap-2"
                        >
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="truncate">{p.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {initiative.projects.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No projects yet. Add projects to roll them up under this initiative.
            </p>
          ) : (
            <div className="mt-2 space-y-0.5">
              {initiative.projects.map((p) => {
                const pct = p.issueCount ? Math.round((p.doneCount / p.issueCount) * 100) : 0;
                return (
                  <div
                    key={p.id}
                    className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <Link
                      href={`/issues?project=${p.id}`}
                      className="flex-1 truncate text-sm hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
                    <span className="w-24 text-right text-xs text-muted-foreground">
                      {p.doneCount}/{p.issueCount} · {pct}%
                    </span>
                    <button
                      onClick={() => persist(() => setProjectInitiative(p.id, null))}
                      className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-black/5 hover:text-foreground group-hover:opacity-100"
                      aria-label="Remove from initiative"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
