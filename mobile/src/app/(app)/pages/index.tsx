import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, View } from "react-native";

import { Divider, Empty, ErrorView, Fab, IconButton, Loading, Picker, Row, SearchBar, Segmented, Text } from "@/components/ui";
import { createPage, pagesQuery, type PageSummary } from "@/features/docs/api";
import { TreeRow } from "@/features/docs/page-tree";
import { childrenIndex, matches, pathOf, visibleTree, type TreeNode } from "@/features/docs/tree";
import { projectsQuery } from "@/features/workspace/api";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

type Item = { kind: "node"; node: TreeNode } | { kind: "header"; id: string; title: string; count: number } | { kind: "hit"; page: PageSummary; path: string };

/** Docs: the company wiki as a tree (the web sidebar's Wiki), and each project's docs. */
export default function Docs() {
  const { c, space } = useTheme();
  const q = useQuery(pagesQuery);
  const projects = useQuery(projectsQuery).data ?? [];
  const [scope, setScope] = useState<"wiki" | "projects">("wiki");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [pickingProject, setPickingProject] = useState(false);

  const pages = useMemo(() => q.data ?? [], [q.data]);
  const index = useMemo(() => childrenIndex(pages), [pages]);
  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);

  const items = useMemo<Item[]>(() => {
    const inScope = (p: PageSummary) => (scope === "wiki" ? !p.projectId : !!p.projectId);
    if (search.trim()) {
      return pages
        .filter((p) => inScope(p) && matches(p, search))
        .map((p) => ({ kind: "hit" as const, page: p, path: [p.projectId ? projects.find((x) => x.id === p.projectId)?.name : null, pathOf(p, byId)].filter(Boolean).join(" › ") }));
    }
    const roots = (index.get(null) ?? []).filter(inScope);
    if (scope === "wiki") return visibleTree(roots, index, expanded).map((node) => ({ kind: "node" as const, node }));
    const out: Item[] = [];
    const groups = new Map<string, PageSummary[]>();
    for (const r of roots) groups.set(r.projectId!, [...(groups.get(r.projectId!) ?? []), r]);
    const named = [...groups.entries()].map(([id, list]) => ({ id, list, name: projects.find((p) => p.id === id)?.name ?? "Project" })).sort((a, b) => a.name.localeCompare(b.name));
    for (const g of named) {
      out.push({ kind: "header", id: g.id, title: g.name, count: pages.filter((p) => p.projectId === g.id).length });
      out.push(...visibleTree(g.list, index, expanded).map((node) => ({ kind: "node" as const, node })));
    }
    return out;
  }, [pages, index, byId, scope, search, expanded, projects]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expand = (id: string) => setExpanded((prev) => new Set(prev).add(id));

  const newPage = async (projectId: string | null) => {
    setCreating(true);
    try {
      const id = await createPage({ projectId });
      router.push(`/pages/${id}`);
    } catch (e) {
      Alert.alert("Couldn't create the page", (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const allExpandable = pages.filter((p) => (index.get(p.id) ?? []).length > 0).map((p) => p.id);
  const anyOpen = expanded.size > 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: "Docs",
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              {allExpandable.length ? <IconButton icon={anyOpen ? "minimize-2" : "maximize-2"} label={anyOpen ? "Collapse all" : "Expand all"} onPress={() => setExpanded(anyOpen ? new Set() : new Set(allExpandable))} /> : null}
              <IconButton icon="trash-2" label="Trash" onPress={() => router.push("/trash")} />
            </View>
          ),
        }}
      />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => (i.kind === "node" ? i.node.page.id : i.kind === "hit" ? `hit-${i.page.id}` : `h-${i.id}`)}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
              <SearchBar value={search} onChangeText={setSearch} placeholder={scope === "wiki" ? "Search the wiki" : "Search project docs"} />
              <Segmented
                value={scope}
                onChange={setScope}
                options={[
                  { value: "wiki", label: "Wiki" },
                  { value: "projects", label: "Project docs" },
                ]}
              />
            </View>
          }
          ItemSeparatorComponent={() => <Divider inset={16} />}
          ListEmptyComponent={
            search.trim() ? (
              <Empty icon="search" title="No pages match" body={`Nothing titled "${search.trim()}" in ${scope === "wiki" ? "the wiki" : "project docs"}.`} />
            ) : scope === "wiki" ? (
              <Empty icon="book-open" title="The wiki is empty" body="Handbooks, how-tos and reference pages for the whole company live here. Tap + to write the first one." />
            ) : (
              <Empty icon="folder" title="No project docs" body="Docs filed under a project show up here, grouped by project." />
            )
          }
          ListFooterComponent={<View style={{ height: 96 }} />}
          renderItem={({ item }) => {
            if (item.kind === "header")
              return (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.lg, paddingVertical: 8, backgroundColor: c.muted }}>
                  <Text variant="small" weight="600" style={{ flex: 1 }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text variant="small" tone="muted">
                    {item.count}
                  </Text>
                </View>
              );
            if (item.kind === "hit")
              return (
                <Row
                  leading={<Text style={{ fontSize: 17, width: 24, textAlign: "center" }}>{item.page.icon || "📄"}</Text>}
                  title={item.page.title || "Untitled"}
                  subtitle={item.path || undefined}
                  trailing={
                    item.page.updatedAt ? (
                      <Text variant="caption" tone="muted">
                        {ago(item.page.updatedAt)}
                      </Text>
                    ) : null
                  }
                  onPress={() => router.push(`/pages/${item.page.id}`)}
                />
              );
            return <TreeRow node={item.node} onToggle={toggle} onCreated={expand} />;
          }}
        />
      )}
      <Fab label="New page" icon={creating ? "loader" : "plus"} onPress={() => (creating ? undefined : scope === "wiki" ? void newPage(null) : setPickingProject(true))} />
      <Picker
        visible={pickingProject}
        onClose={() => setPickingProject(false)}
        title="New page in"
        value={null}
        options={[{ value: "__wiki", label: "Company wiki", subtitle: "Visible to the whole workspace" }, ...projects.map((p) => ({ value: p.id, label: p.name, subtitle: p.key }))]}
        onPick={(v) => void newPage(v === "__wiki" ? null : v)}
      />
    </View>
  );
}
