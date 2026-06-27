"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronDown, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/glyphs";
import { OrgChart } from "@/components/org-chart";
import { Topbar } from "@/components/topbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  inviteMember,
  removeMember,
  setMemberRole,
  updateMemberProfile,
} from "@/lib/actions";
import { ENTITIES, optionMeta } from "@/lib/departments";
import { dateInputValue } from "@/lib/matrix-format";
import type { MemberWithRole, OrgRoleNode } from "@/lib/types";

const EMPLOYMENT = [
  { id: "employee", label: "Employee", color: "#10b981" },
  { id: "contractor", label: "Contractor", color: "#6366f1" },
] as const;

const fieldCls =
  "h-7 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-70 disabled:cursor-default";

export function PeopleHRView({
  heading,
  members,
  orgRoles,
  currentUserId,
  isAdmin,
}: {
  heading: string;
  members: MemberWithRole[];
  orgRoles: OrgRoleNode[];
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
    persist(async () => {
      await inviteMember({ email, name });
      setEmail("");
      setName("");
    }, "Member added");
  }

  const employees = members.filter((m) => m.employment !== "contractor").length;
  const contractors = members.length - employees;

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <span className="text-xs text-muted-foreground">
            {members.length} people · {employees} employees · {contractors} contractors
          </span>
        }
      />
      <Tabs defaultValue="directory" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="org">Org chart</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="min-h-0 flex-1 overflow-auto p-4">
          {isAdmin && (
            <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border bg-muted/30 p-3">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <span className="text-xs font-medium">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && invite()}
                  placeholder="teammate@gnanalytica.com"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <label className="flex w-40 flex-col gap-1">
                <span className="text-xs font-medium">Name (optional)</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && invite()}
                  placeholder="Jane Doe"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <Button type="button" size="sm" className="h-9 gap-1.5" disabled={pending} onClick={invite}>
                <UserPlus className="size-4" /> Invite
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            {members.map((m) => (
              <PersonRow
                key={m.id}
                member={m}
                members={members}
                isAdmin={isAdmin}
                isSelf={m.id === currentUserId}
                onPersist={persist}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="org" className="min-h-0 flex-1 overflow-auto p-4">
          <OrgChart roots={orgRoles} members={members} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PersonRow({
  member: m,
  members,
  isAdmin,
  isSelf,
  onPersist,
}: {
  member: MemberWithRole;
  members: MemberWithRole[];
  isAdmin: boolean;
  isSelf: boolean;
  onPersist: (fn: () => Promise<unknown>, ok?: string) => void;
}) {
  const upd = (patch: Parameters<typeof updateMemberProfile>[1]) =>
    onPersist(() => updateMemberProfile(m.id, patch));
  const ent = optionMeta(ENTITIES, m.entity);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <UserAvatar name={m.name} color={m.avatarColor} className="size-8" />
      <div className="min-w-40 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {m.name}
          {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">{m.email}</div>
      </div>

      <input
        defaultValue={m.title ?? ""}
        disabled={!isAdmin}
        onBlur={(e) => (e.target.value || null) !== m.title && upd({ title: e.target.value || null })}
        placeholder="Job title"
        className={fieldCls + " min-w-40 flex-1"}
      />

      <select
        defaultValue={m.employment}
        disabled={!isAdmin}
        onChange={(e) => upd({ employment: e.target.value })}
        className={fieldCls}
        title="Employment"
      >
        {EMPLOYMENT.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>

      <select
        defaultValue={m.entity}
        disabled={!isAdmin}
        onChange={(e) => upd({ entity: e.target.value })}
        className={fieldCls}
        title="Entity"
        style={{ color: ent.color }}
      >
        {ENTITIES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>

      <select
        defaultValue={m.managerId ?? ""}
        disabled={!isAdmin}
        onChange={(e) => upd({ managerId: e.target.value || null })}
        className={fieldCls}
        title="Manager"
      >
        <option value="">No manager</option>
        {members
          .filter((x) => x.id !== m.id)
          .map((x) => <option key={x.id} value={x.id}>↳ {x.name}</option>)}
      </select>

      <input
        type="date"
        defaultValue={dateInputValue(m.startDate)}
        disabled={!isAdmin}
        onChange={(e) => upd({ startDate: e.target.value || null })}
        className={fieldCls}
        title="Start date"
      />

      {isAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="h-7 gap-1 capitalize" />}
          >
            {m.role}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["admin", "member"] as const).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => onPersist(() => setMemberRole(m.id, r), "Role updated")}
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
          onClick={() => onPersist(() => removeMember(m.id), "Member removed")}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove member"
          title="Remove from workspace"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

