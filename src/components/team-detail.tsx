"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { StatusIcon, UserAvatar } from "@/components/glyphs";
import { IssueRow } from "@/components/issue-row";
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
  addTeamMember,
  deleteTeam,
  removeTeamMember,
  updateTeam,
} from "@/lib/actions";
import { STATUSES } from "@/lib/constants";
import type { IssueWithRelations, Member, Team } from "@/lib/types";

export function TeamDetail({
  team,
  allMembers,
}: {
  team: Team & { issues: IssueWithRelations[]; members: Member[] };
  allMembers: Member[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(team.name);
  const [addOpen, setAddOpen] = useState(false);

  const persist = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const memberIds = new Set(team.members.map((m) => m.id));
  const addable = allMembers.filter((m) => !memberIds.has(m.id));

  const grouped = STATUSES.map((s) => ({
    status: s,
    items: team.issues.filter((i) => i.status === s.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Teams", href: "/teams" }, { label: name }]}
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
                    await deleteTeam(team.id);
                    toast.success("Team deleted");
                    router.push("/teams");
                  })
                }
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" /> Delete team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{team.icon}</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                void updateTeam(team.id, { name: e.target.value.trim() || "Team" });
              }}
              className="flex-1 bg-transparent text-2xl font-bold outline-none"
            />
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              {team.key}
            </span>
          </div>

          {/* Members */}
          <div className="mt-8 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Members
            </h3>
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger
                render={<Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" />}
              >
                <UserPlus className="size-3.5" /> Add member
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-0">
                <Command>
                  <CommandInput placeholder="Search people…" className="h-9" />
                  <CommandList>
                    <CommandEmpty>No one to add.</CommandEmpty>
                    <CommandGroup>
                      {addable.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.name}
                          onSelect={() => {
                            setAddOpen(false);
                            persist(() => addTeamMember(team.id, m.id));
                          }}
                          className="gap-2"
                        >
                          <UserAvatar name={m.name} color={m.avatarColor} className="size-5" />
                          <span className="truncate">{m.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {team.members.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No members yet.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {team.members.map((m) => (
                <span
                  key={m.id}
                  className="group flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2 text-xs"
                >
                  <UserAvatar name={m.name} color={m.avatarColor} className="size-5" />
                  {m.name}
                  <button
                    onClick={() => persist(() => removeTeamMember(team.id, m.id))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove from team"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Issues */}
          <h3 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Issues
          </h3>
          {team.issues.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No issues yet. Set an issue&apos;s <strong>Team</strong> to add it here.
            </p>
          ) : (
            <div className="mt-2 overflow-hidden rounded-xl border">
              {grouped.map((g) => (
                <div key={g.status.id}>
                  <div className="flex items-center gap-2 bg-muted/60 px-4 py-1.5">
                    <StatusIcon status={g.status.id} />
                    <span className="text-xs font-semibold">{g.status.label}</span>
                    <span className="text-xs text-muted-foreground">{g.items.length}</span>
                  </div>
                  {g.items.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} members={allMembers} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
