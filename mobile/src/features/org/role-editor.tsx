import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, View } from "react-native";

import { Avatar, Button, Divider, Field, Icon, Input, Row, SearchBar, Sheet, Text } from "@/components/ui";
import { membersQuery } from "@/features/workspace/api";
import { useTheme } from "@/theme";

import { createRole, deleteRole, updateRole, type OrgRole } from "./api";
import { allRoles, subtreeIds } from "./tree";

type Mode = "form" | "person" | "parent";

/**
 * Create or edit a position (admins): its title, who holds it (or an open
 * seat), and who it reports to. Pickers open inside the same sheet so only one
 * modal is ever on screen.
 */
export function RoleEditor({ visible, onClose, roots, role, defaultParentId }: { visible: boolean; onClose: () => void; roots: OrgRole[]; role: OrgRole | null; defaultParentId?: string | null }) {
  const { c, space } = useTheme();
  const members = useQuery(membersQuery).data ?? [];
  const flat = useMemo(() => allRoles(roots), [roots]);
  const currentParent = role ? (flat.find((f) => f.role.id === role.id)?.parentId ?? null) : (defaultParentId ?? null);

  const [mode, setMode] = useState<Mode>("form");
  const [title, setTitle] = useState(role?.title ?? "");
  const [userId, setUserId] = useState<string | null>(role?.user?.id ?? null);
  const [parentId, setParentId] = useState<string | null>(currentParent);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const blocked = role ? subtreeIds(role) : new Set<string>();
  const person = members.find((m) => m.id === userId) ?? (role?.user && role.user.id === userId ? { id: role.user.id, name: role.user.name, email: role.user.email } : null);
  const parent = flat.find((f) => f.role.id === parentId)?.role ?? null;
  const q = query.trim().toLowerCase();

  const save = async () => {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      if (role) {
        const patch: { title?: string; userId?: string | null; parentId?: string | null } = {};
        if (t !== role.title) patch.title = t;
        if (userId !== (role.user?.id ?? null)) patch.userId = userId;
        if (parentId !== currentParent) patch.parentId = parentId;
        if (Object.keys(patch).length) await updateRole(role.id, patch);
      } else {
        await createRole({ title: t, userId, parentId });
      }
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save the position", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!role) return;
    Alert.alert(`Delete "${role.title}"?`, role.children.length ? "Its direct reports move up to report to its manager." : "The position is removed from the chart.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRole(role.id);
            onClose();
          } catch (e) {
            Alert.alert("Couldn't delete the position", (e as Error).message);
          }
        },
      },
    ]);
  };

  const pick = (m: Mode) => {
    setQuery("");
    setMode(m);
  };

  const sheetTitle = mode === "person" ? "Who holds it" : mode === "parent" ? "Reports to" : role ? "Edit position" : "New position";

  return (
    <Sheet visible={visible} onClose={mode === "form" ? onClose : () => setMode("form")} title={sheetTitle}>
      {mode === "form" ? (
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Head of Engineering" autoFocus={!role} maxLength={200} />
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: space.md }}>
            <Field label="Held by" onPress={() => pick("person")}>
              {person ? <Avatar name={person.name} seed={person.id} size={22} /> : null}
              <Text numberOfLines={1} tone={person ? "default" : "muted"} style={{ flex: 1 }}>
                {person?.name ?? "Open seat"}
              </Text>
            </Field>
            <Divider />
            <Field label="Reports to" onPress={() => pick("parent")}>
              <Text numberOfLines={1} tone={parent ? "default" : "muted"} style={{ flex: 1 }}>
                {parent ? `${parent.title}${parent.user ? ` · ${parent.user.name}` : ""}` : "No one (top of the chart)"}
              </Text>
            </Field>
          </View>
          <Button title={role ? "Save" : "Add position"} variant="brand" loading={busy} disabled={!title.trim()} onPress={() => void save()} />
          {role ? <Button title="Delete position" variant="danger" icon="trash-2" onPress={remove} /> : null}
        </View>
      ) : mode === "person" ? (
        <View>
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search people" />
          </View>
          <Row
            title="Open seat"
            subtitle="No one holds this position yet"
            leading={<Avatar name={null} size={28} />}
            trailing={userId === null ? <Icon name="check" color={c.brand} /> : null}
            onPress={() => {
              setUserId(null);
              setMode("form");
            }}
          />
          {members
            .filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
            .map((m) => (
              <Row
                key={m.id}
                title={m.name}
                subtitle={m.title ?? m.email}
                leading={<Avatar name={m.name} seed={m.id} size={28} />}
                trailing={m.id === userId ? <Icon name="check" color={c.brand} /> : null}
                onPress={() => {
                  setUserId(m.id);
                  setMode("form");
                }}
              />
            ))}
        </View>
      ) : (
        <View>
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search positions" />
          </View>
          <Row
            title="No one (top of the chart)"
            leading={<Icon name="arrow-up" color={c.mutedForeground} />}
            trailing={parentId === null ? <Icon name="check" color={c.brand} /> : null}
            onPress={() => {
              setParentId(null);
              setMode("form");
            }}
          />
          {flat
            .filter((f) => !blocked.has(f.role.id))
            .filter((f) => !q || f.role.title.toLowerCase().includes(q) || (f.role.user?.name ?? "").toLowerCase().includes(q))
            .map((f) => (
              <Row
                key={f.role.id}
                title={f.role.title}
                subtitle={f.role.user?.name ?? "Open seat"}
                style={{ paddingLeft: space.lg + (q ? 0 : f.depth * 14) }}
                trailing={f.role.id === parentId ? <Icon name="check" color={c.brand} /> : null}
                onPress={() => {
                  setParentId(f.role.id);
                  setMode("form");
                }}
              />
            ))}
          {role && blocked.size > 1 ? (
            <Text variant="small" tone="muted" style={{ padding: space.lg }}>
              Positions under this one aren’t listed — a role can’t report to its own team.
            </Text>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}
