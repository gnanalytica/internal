import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, View } from "react-native";

import { Button, Divider, Empty, ErrorView, Fab, Input, Loading, Row, SearchBar, Sheet, Text } from "@/components/ui";
import { createDatabase, databasesQuery } from "@/features/databases/api";
import { useTheme } from "@/theme";

/** Every database in the workspace, and a way to start a new one. */
export default function Databases() {
  const { c, space } = useTheme();
  const q = useQuery(databasesQuery);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const list = useMemo(() => (q.data ?? []).filter((d) => d.name.toLowerCase().includes(search.trim().toLowerCase())), [q.data, search]);

  const create = async () => {
    setSaving(true);
    try {
      const id = await createDatabase(name.trim() || "Untitled database");
      setCreating(false);
      setName("");
      router.push(`/databases/${id}`);
    } catch (e) {
      Alert.alert("Couldn't create the database", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: "Databases" }} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(d) => d.id}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={q.data.length > 6 ? <View style={{ padding: space.lg, paddingBottom: space.sm }}><SearchBar value={search} onChangeText={setSearch} placeholder="Search databases" /></View> : null}
          ItemSeparatorComponent={() => <Divider inset={56} />}
          ListEmptyComponent={
            search.trim() ? (
              <Empty icon="search" title="No databases match" body={`Nothing is called "${search.trim()}".`} />
            ) : (
              <Empty icon="grid" title="No databases yet" body="Track anything as rows and fields — vendors, hiring, content, assets. Tap + to start one." />
            )
          }
          ListFooterComponent={<View style={{ height: 96 }} />}
          renderItem={({ item: d }) => (
            <Row
              leading={<Text style={{ fontSize: 22, width: 30, textAlign: "center" }}>{d.icon || "🗃️"}</Text>}
              title={d.name}
              subtitle={`${d.rowCount} row${d.rowCount === 1 ? "" : "s"} · ${d.fieldCount} field${d.fieldCount === 1 ? "" : "s"}`}
              chevron
              onPress={() => router.push(`/databases/${d.id}`)}
            />
          )}
        />
      )}
      <Fab label="New database" onPress={() => setCreating(true)} />
      <Sheet visible={creating} onClose={() => setCreating(false)} title="New database">
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
          <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Vendors" autoFocus onSubmitEditing={() => void create()} returnKeyType="done" />
          <Text variant="small" tone="muted">
            It starts with a Name and a Status field and three empty rows, as on the web.
          </Text>
          <Button title="Create" variant="primary" loading={saving} onPress={() => void create()} />
        </View>
      </Sheet>
    </View>
  );
}
