import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Avatar, Badge, Divider, Empty, ErrorView, Fab, Icon, IconButton, Loading, Row, SearchBar, Segmented, Text } from "@/components/ui";
import { directoryQuery, orgRolesQuery, type OrgRole } from "@/features/org/api";
import { PersonSheet, type PersonDetail } from "@/features/org/people";
import { RoleEditor } from "@/features/org/role-editor";
import { flattenRoles, positionsOf } from "@/features/org/tree";
import { membersQuery } from "@/features/workspace/api";
import { useMe } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

type Tab = "chart" | "people" | "hr";

/** Organization: the org chart, the member directory, and (admins) People & HR. */
export default function Org() {
  const me = useMe();
  const { space } = useTheme();
  const [tab, setTab] = useState<Tab>("chart");
  const options: { value: Tab; label: string }[] = [
    { value: "chart", label: "Org chart" },
    { value: "people", label: "People" },
    ...(me.isAdmin ? [{ value: "hr" as const, label: "People & HR" }] : []),
  ];
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Org" }} />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
        <Segmented value={tab} onChange={setTab} options={options} />
      </View>
      {tab === "chart" ? <ChartView /> : tab === "people" ? <PeopleView /> : <HrView />}
    </View>
  );
}

function ChartView() {
  const me = useMe();
  const { c, space } = useTheme();
  const q = useQuery(orgRolesQuery);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ role: OrgRole | null; parentId?: string | null } | null>(null);
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const members = useQuery(membersQuery).data ?? [];
  const roots = useMemo(() => q.data ?? [], [q.data]);
  const rows = useMemo(() => flattenRoles(roots, collapsed), [roots, collapsed]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openPerson = (role: OrgRole) => {
    if (!role.user) return;
    const m = members.find((x) => x.id === role.user!.id);
    setPerson({ id: role.user.id, name: role.user.name, email: role.user.email, role: m?.role ?? null, title: m?.title ?? null, entity: m?.entity ?? null, positions: positionsOf(roots, role.user.id) });
  };

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.role.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        ListEmptyComponent={<Empty icon="git-merge" title="No positions yet" body={me.isAdmin ? "Add the first position with the + button, then build the chart under it." : "An admin hasn't set up the org chart yet."} />}
        ListFooterComponent={<View style={{ height: 96 }} />}
        renderItem={({ item }) => {
          const { role, depth, reports } = item;
          const open = !collapsed.has(role.id);
          return (
            <Row
              style={{ paddingLeft: space.lg + depth * 18 }}
              onPress={() => (me.isAdmin ? setEditing({ role }) : role.user ? openPerson(role) : role.children.length ? toggle(role.id) : undefined)}
              leading={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {role.children.length ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={open ? `Collapse ${role.title}` : `Expand ${role.title}`} hitSlop={10} onPress={() => toggle(role.id)}>
                      <Icon name={open ? "chevron-down" : "chevron-right"} size={16} color={c.mutedForeground} />
                    </Pressable>
                  ) : (
                    <View style={{ width: 16 }} />
                  )}
                  <Pressable disabled={!role.user} onPress={() => openPerson(role)}>
                    <Avatar name={role.user?.name} seed={role.user?.id} size={30} />
                  </Pressable>
                </View>
              }
              title={role.title}
              subtitle={
                <Text variant="small" tone={role.user ? "muted" : "warning"} numberOfLines={1}>
                  {role.user?.name ?? "Open seat"}
                </Text>
              }
              trailing={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {reports ? <Badge label={`${reports} below`} /> : null}
                  {me.isAdmin ? <IconButton icon="plus" size={18} label={`Add a position under ${role.title}`} color={c.mutedForeground} onPress={() => setEditing({ role: null, parentId: role.id })} /> : null}
                </View>
              }
            />
          );
        }}
      />
      {me.isAdmin ? <Fab label="New position" onPress={() => setEditing({ role: null, parentId: null })} /> : null}
      {editing ? <RoleEditor visible onClose={() => setEditing(null)} roots={roots} role={editing.role} defaultParentId={editing.parentId} /> : null}
      <PersonSheet person={person} onClose={() => setPerson(null)} />
    </View>
  );
}

function PeopleView() {
  const { space } = useTheme();
  const q = useQuery(membersQuery);
  const roles = useQuery(orgRolesQuery).data ?? [];
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const s = query.trim().toLowerCase();
  const list = (q.data ?? []).filter((m) => !s || [m.name, m.email, m.title ?? "", m.entity ?? ""].some((v) => v.toLowerCase().includes(s)));
  const entities = new Map<string, number>();
  for (const m of q.data ?? []) if (m.entity) entities.set(m.entity, (entities.get(m.entity) ?? 0) + 1);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <>
      <FlatList
        data={list}
        keyExtractor={(m) => m.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name, email, title" />
            <Text variant="small" tone="muted">
              {[`${q.data.length} ${q.data.length === 1 ? "person" : "people"}`, ...[...entities.entries()].map(([e, n]) => `${e} ${n}`)].join(" · ")}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <Divider inset={60} />}
        ListEmptyComponent={<Empty icon="users" title={s ? "No one matches" : "No members yet"} body={s ? `Nobody's name, email or title contains "${query.trim()}".` : undefined} />}
        ListFooterComponent={<View style={{ height: 48 }} />}
        renderItem={({ item: m }) => (
          <Row
            onPress={() => setPerson({ id: m.id, name: m.name, email: m.email, role: m.role, title: m.title, entity: m.entity, positions: positionsOf(roles, m.id) })}
            leading={<Avatar name={m.name} seed={m.id} size={34} />}
            title={m.name}
            subtitle={[m.title, m.entity].filter(Boolean).join(" · ") || m.email}
            trailing={m.role === "admin" ? <Badge label="Admin" tone="brand" /> : null}
          />
        )}
      />
      <PersonSheet person={person} onClose={() => setPerson(null)} />
    </>
  );
}

function HrView() {
  const { space } = useTheme();
  const q = useQuery(directoryQuery);
  const roles = useQuery(orgRolesQuery).data ?? [];
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "employee" | "contractor">("all");
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const s = query.trim().toLowerCase();
  const all = q.data ?? [];
  const list = all.filter((m) => (kind === "all" || m.employment === kind) && (!s || [m.name, m.email, m.title ?? "", m.entity].some((v) => v.toLowerCase().includes(s))));
  const contractors = all.filter((m) => m.employment === "contractor").length;

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <>
      <FlatList
        data={list}
        keyExtractor={(m) => m.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search the directory" />
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: `All ${all.length}` },
                { value: "employee", label: `Employees ${all.length - contractors}` },
                { value: "contractor", label: `Contractors ${contractors}` },
              ]}
            />
            <Text variant="small" tone="muted">
              Only admins see employment, start dates and managers. Edit them on the web in People & HR.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <Divider inset={60} />}
        ListEmptyComponent={<Empty icon="users" title="No one matches" body="Try another name, or switch between employees and contractors." />}
        ListFooterComponent={<View style={{ height: 48 }} />}
        renderItem={({ item: m }) => (
          <Row
            onPress={() => setPerson({ ...m, positions: positionsOf(roles, m.id) })}
            leading={<Avatar name={m.name} seed={m.id} size={34} />}
            title={m.name}
            subtitle={[m.title, m.entity, m.startDate ? `since ${shortDate(m.startDate)}` : null, m.manager?.name ? `reports to ${m.manager.name}` : null].filter(Boolean).join(" · ")}
            trailing={m.employment === "contractor" ? <Badge label="Contractor" tone="warning" /> : null}
          />
        )}
      />
      <PersonSheet person={person} onClose={() => setPerson(null)} />
    </>
  );
}
