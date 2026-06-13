"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronDown, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/glyphs";
import { Topbar } from "@/components/topbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  inviteMember,
  removeMember,
  setMemberRole,
} from "@/lib/actions";
import type { MemberWithRole } from "@/lib/types";

export function MembersView({
  members,
  currentUserId,
  isAdmin,
}: {
  members: MemberWithRole[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const persist = (fn: () => Promise<unknown>, ok?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  function invite() {
    if (!email.trim()) return;
    persist(
      async () => {
        await inviteMember({ email, name });
        setEmail("");
        setName("");
      },
      "Member added",
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Members" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-8 py-10">
          <h2 className="text-sm font-semibold">Members</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">
            People in the <strong>Acme</strong> workspace.{" "}
            {isAdmin
              ? "As an admin you can invite, change roles, and remove members."
              : "Only admins can manage members."}
          </p>

          {isAdmin && (
            <div className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border bg-muted/30 p-3">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <span className="text-xs font-medium">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") invite();
                  }}
                  placeholder="teammate@company.com"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <label className="flex w-40 flex-col gap-1">
                <span className="text-xs font-medium">Name (optional)</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") invite();
                  }}
                  placeholder="Jane Doe"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5"
                disabled={pending}
                onClick={invite}
              >
                <UserPlus className="size-4" /> Invite
              </Button>
            </div>
          )}

          <div className="divide-y rounded-xl border">
            {members.map((m) => {
              const isSelf = m.id === currentUserId;
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar name={m.name} color={m.avatarColor} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {m.name}
                      {isSelf && (
                        <span className="text-[10px] text-muted-foreground">(you)</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                  </div>

                  {isAdmin ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="outline" size="sm" className="h-7 gap-1 capitalize" />
                        }
                      >
                        {m.role}
                        <ChevronDown className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(["admin", "member"] as const).map((r) => (
                          <DropdownMenuItem
                            key={r}
                            onClick={() =>
                              persist(() => setMemberRole(m.id, r), "Role updated")
                            }
                            className="gap-2 text-xs capitalize"
                          >
                            <span className="flex-1">{r}</span>
                            {m.role === r && <Check className="size-3.5 opacity-70" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                      {m.role}
                    </span>
                  )}

                  {isAdmin && !isSelf && (
                    <button
                      onClick={() =>
                        persist(() => removeMember(m.id), "Member removed")
                      }
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove member"
                      title="Remove from workspace"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Invited people become assignable right away. When they sign in with that
            email, their account links automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
