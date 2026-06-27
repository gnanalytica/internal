"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
import { createOrgRole, deleteOrgRole, updateOrgRole } from "@/lib/actions";
import type { Member, OrgRoleNode } from "@/lib/types";

type FlatRole = { id: string; title: string; depth: number };

/** A top-down, connector-lined org chart of positions. One person can hold
 *  several positions (e.g. a founder who is CEO and CTO) — those are shown with
 *  an "also …" chip. Admins can rename, (re)assign, add reports, and delete. */
export function OrgChart({
  roots,
  members,
  isAdmin,
}: {
  roots: OrgRoleNode[];
  members: Member[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  // userId → every position that person holds (to surface multiple hats).
  const rolesByUser = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>();
    const walk = (n: OrgRoleNode) => {
      if (n.user) {
        const list = map.get(n.user.id) ?? [];
        list.push({ id: n.id, title: n.title });
        map.set(n.user.id, list);
      }
      n.children.forEach(walk);
    };
    roots.forEach(walk);
    return map;
  }, [roots]);

  // Flat list of roles for the "reports to" picker.
  const flat = useMemo(() => {
    const out: FlatRole[] = [];
    const walk = (n: OrgRoleNode, depth: number) => {
      out.push({ id: n.id, title: n.title, depth });
      n.children.forEach((c) => walk(c, depth + 1));
    };
    roots.forEach((r) => walk(r, 0));
    return out;
  }, [roots]);

  const descendantsOf = (n: OrgRoleNode): Set<string> => {
    const set = new Set<string>();
    const walk = (x: OrgRoleNode) => x.children.forEach((c) => (set.add(c.id), walk(c)));
    walk(n);
    return set;
  };

  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <UserCircle2 className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No org chart yet.</p>
        {isAdmin && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => persist(() => createOrgRole({ title: "CEO" }), "Role added")}
          >
            <Plus className="size-4" /> Add top role
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {isAdmin && (
        <div className="self-end">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => persist(() => createOrgRole({ title: "New role" }), "Role added")}
          >
            <Plus className="size-4" /> Add top role
          </Button>
        </div>
      )}
      <div className="w-full overflow-x-auto scrollbar-thin">
        <div className="orgchart">
          <ul>
            {roots.map((r) => (
              <RoleNode
                key={r.id}
                node={r}
                isRoot
                members={members}
                flat={flat}
                rolesByUser={rolesByUser}
                descendantsOf={descendantsOf}
                isAdmin={isAdmin}
                pending={pending}
                persist={persist}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RoleNode({
  node,
  isRoot,
  members,
  flat,
  rolesByUser,
  descendantsOf,
  isAdmin,
  pending,
  persist,
}: {
  node: OrgRoleNode;
  isRoot?: boolean;
  members: Member[];
  flat: FlatRole[];
  rolesByUser: Map<string, { id: string; title: string }[]>;
  descendantsOf: (n: OrgRoleNode) => Set<string>;
  isAdmin: boolean;
  pending: boolean;
  persist: (fn: () => Promise<unknown>, ok?: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const otherHats = (node.user ? rolesByUser.get(node.user.id) ?? [] : []).filter(
    (r) => r.id !== node.id,
  );
  const blocked = descendantsOf(node); // can't reparent under self/descendants

  return (
    <li>
      <div
        className={
          "node group/card relative inline-flex w-56 flex-col items-center gap-1.5 rounded-xl border bg-card px-3 py-3 text-center shadow-sm hover-lift " +
          (isRoot ? "border-brand/40 ring-2 ring-brand/30" : "")
        }
      >
        {node.user ? (
          <UserAvatar name={node.user.name} color={node.user.avatarColor} className="size-10" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full border border-dashed text-muted-foreground/60">
            <UserCircle2 className="size-6" />
          </span>
        )}

        <div className="text-sm font-semibold leading-tight">{node.title}</div>
        <div className="text-xs text-muted-foreground leading-tight">
          {node.user ? node.user.name : <span className="italic">Open seat</span>}
        </div>

        {otherHats.length > 0 && (
          <div className="mt-0.5 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
            also {otherHats.map((r) => r.title).join(" · ")}
          </div>
        )}

        {isAdmin && (
          <button
            onClick={() => setEditing((v) => !v)}
            className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover/card:opacity-100 aria-pressed:opacity-100"
            aria-pressed={editing}
            aria-label="Edit role"
            title="Edit role"
          >
            <Pencil className="size-3.5" />
          </button>
        )}

        {isAdmin && editing && (
          <RoleEditor
            node={node}
            members={members}
            flat={flat}
            blocked={blocked}
            pending={pending}
            persist={persist}
            onDone={() => setEditing(false)}
          />
        )}
      </div>

      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <RoleNode
              key={c.id}
              node={c}
              members={members}
              flat={flat}
              rolesByUser={rolesByUser}
              descendantsOf={descendantsOf}
              isAdmin={isAdmin}
              pending={pending}
              persist={persist}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const editFieldCls =
  "h-7 w-full rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40";

function RoleEditor({
  node,
  members,
  flat,
  blocked,
  pending,
  persist,
  onDone,
}: {
  node: OrgRoleNode;
  members: Member[];
  flat: FlatRole[];
  blocked: Set<string>;
  pending: boolean;
  persist: (fn: () => Promise<unknown>, ok?: string) => void;
  onDone: () => void;
}) {
  return (
    <div className="mt-2 w-full space-y-1.5 border-t pt-2 text-left">
      <input
        defaultValue={node.title}
        disabled={pending}
        onBlur={(e) =>
          e.target.value.trim() &&
          e.target.value.trim() !== node.title &&
          persist(() => updateOrgRole(node.id, { title: e.target.value.trim() }))
        }
        placeholder="Role title"
        aria-label="Role title"
        className={editFieldCls}
      />

      <select
        defaultValue={node.user?.id ?? ""}
        disabled={pending}
        onChange={(e) => persist(() => updateOrgRole(node.id, { userId: e.target.value || null }))}
        aria-label="Person"
        className={editFieldCls}
      >
        <option value="">— Open seat —</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        defaultValue=""
        disabled={pending}
        onChange={(e) => persist(() => updateOrgRole(node.id, { parentId: e.target.value || null }))}
        aria-label="Reports to"
        className={editFieldCls}
        title="Reports to"
      >
        <option value="">Reports to… (top level)</option>
        {flat
          .filter((r) => r.id !== node.id && !blocked.has(r.id))
          .map((r) => (
            <option key={r.id} value={r.id}>
              {" ".repeat(r.depth * 2)}↳ {r.title}
            </option>
          ))}
      </select>

      <div className="flex items-center gap-1.5 pt-0.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1"
          disabled={pending}
          onClick={() =>
            persist(() => createOrgRole({ title: "New role", parentId: node.id }), "Report added")
          }
        >
          <Plus className="size-3.5" /> Report
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={pending}
          onClick={() => {
            persist(() => deleteOrgRole(node.id), "Role removed");
            onDone();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
