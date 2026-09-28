import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SectionList, View } from "react-native";

import { Divider, Empty, ErrorView, Icon, Row, SearchBar, Text } from "@/components/ui";
import { groupHits, hrefFor, searchQuery } from "@/features/search/api";
import { useTheme } from "@/theme";

/** Global search across the workspace, results grouped by kind. */
export default function Search() {
  const { c, space } = useTheme();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const query = useQuery({ ...searchQuery(q), placeholderData: q ? keepPreviousData : undefined });
  const sections = useMemo(() => (q ? groupHits(query.data ?? []) : []), [q, query.data]);
  const typing = text.trim() !== q;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: "Search" }} />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <SearchBar value={text} onChangeText={setText} placeholder="Issues, docs, projects, people…" />
        </View>
        {query.isFetching || typing ? <ActivityIndicator color={c.brand} size="small" /> : null}
      </View>
      {!q ? (
        <Empty icon="search" title="Search the workspace" body="Find issues, docs, projects, databases, cycles, milestones, features, tickets, deals, accounts and contacts." />
      ) : query.isError ? (
        <ErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? null : (
        <SectionList
          sections={sections}
          keyExtractor={(h) => `${h.type}-${h.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ItemSeparatorComponent={() => <Divider inset={48} />}
          ListEmptyComponent={typing ? null : <Empty icon="search" title="No results" body={`Nothing you can see matches "${q}".`} />}
          ListFooterComponent={<View style={{ height: 48 }} />}
          renderSectionHeader={({ section }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.lg, paddingVertical: 8, backgroundColor: c.muted }}>
              <Icon name={section.icon} size={14} color={c.mutedForeground} />
              <Text variant="small" weight="600">
                {section.label}
              </Text>
              <Text variant="small" tone="muted">
                {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item, section }) => (
            <Row
              onPress={() => router.push(hrefFor(item))}
              leading={<Icon name={section.icon} size={18} color={c.mutedForeground} />}
              title={item.title}
              subtitle={item.subtitle ?? undefined}
              chevron
            />
          )}
        />
      )}
    </View>
  );
}
