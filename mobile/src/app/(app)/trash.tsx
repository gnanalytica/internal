import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, View } from "react-native";

import { Button, Divider, Empty, ErrorView, Loading, Row, Text } from "@/components/ui";
import { purgeTrashed, restoreTrashed, trashQuery, type TrashedPage } from "@/features/docs/api";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

/** Pages moved to the trash, newest first: restore them, or delete them for good. */
export default function Trash() {
  const { c, space } = useTheme();
  const q = useQuery(trashQuery);
  const [busy, setBusy] = useState<string | null>(null);

  const restore = async (p: TrashedPage) => {
    setBusy(p.id);
    try {
      await restoreTrashed(p.id);
    } catch (e) {
      Alert.alert("Couldn't restore", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const purge = (p: TrashedPage) =>
    Alert.alert(`Delete "${p.title || "Untitled"}" forever?`, "It's removed for everyone, with its comments and version history. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete forever",
        style: "destructive",
        onPress: async () => {
          setBusy(p.id);
          try {
            await purgeTrashed(p.id);
          } catch (e) {
            Alert.alert("Couldn't delete", (e as Error).message);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: "Trash" }} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(p) => p.id}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          ItemSeparatorComponent={() => <Divider inset={56} />}
          ListHeaderComponent={
            q.data.length ? (
              <Text variant="small" tone="muted" style={{ padding: space.lg, paddingBottom: space.sm }}>
                Restoring a page brings back the sub-pages trashed with it.
              </Text>
            ) : null
          }
          ListEmptyComponent={<Empty icon="trash-2" title="Trash is empty" body="Pages you move to the trash show up here until you restore them or delete them for good." />}
          renderItem={({ item: p }) => (
            <Row
              onPress={() => router.push(`/pages/${p.id}`)}
              leading={<Text style={{ fontSize: 18, width: 26, textAlign: "center" }}>{p.icon || "📄"}</Text>}
              title={p.title || "Untitled"}
              subtitle={`Trashed ${ago(p.deletedAt)} ago`}
              trailing={
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Button size="sm" variant="secondary" title="Restore" loading={busy === p.id} disabled={!!busy} onPress={() => void restore(p)} />
                  <Button size="sm" variant="danger" icon="x" title="Delete" disabled={!!busy} onPress={() => purge(p)} />
                </View>
              }
            />
          )}
        />
      )}
    </View>
  );
}
