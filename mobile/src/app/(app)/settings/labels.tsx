import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";

import { Button, Divider, Empty, ErrorView, Fab, Icon, Input, Loading, Row, SearchBar, Sheet, Text } from "@/components/ui";
import { createLabel, deleteLabel, LABEL_COLORS, updateLabel } from "@/features/settings/api";
import { labelsQuery, type Label } from "@/features/workspace/api";
import { useTheme } from "@/theme";

/** Workspace labels: add, rename, recolour, delete. */
export default function Labels() {
  const { c, space } = useTheme();
  const q = useQuery(labelsQuery);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Label | "new" | null>(null);
  const s = query.trim().toLowerCase();
  const list = (q.data ?? []).filter((l) => !s || l.name.toLowerCase().includes(s));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: "Labels" }} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(l) => l.id}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            q.data.length > 8 ? (
              <View style={{ padding: space.lg, paddingBottom: space.sm }}>
                <SearchBar value={query} onChangeText={setQuery} placeholder="Search labels" />
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <Divider inset={48} />}
          ListEmptyComponent={s ? <Empty icon="tag" title="No labels match" /> : <Empty icon="tag" title="No labels yet" body="Labels group issues across projects, like Bug or Customer. Add one with the + button." />}
          ListFooterComponent={<View style={{ height: 96 }} />}
          renderItem={({ item }) => (
            <Row leading={<View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.color, marginHorizontal: 3 }} />} title={item.name} chevron onPress={() => setEditing(item)} />
          )}
        />
      )}
      <Fab label="New label" onPress={() => setEditing("new")} />
      {editing ? <LabelEditor label={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

function LabelEditor({ label, onClose }: { label: Label | null; onClose: () => void }) {
  const { c, space } = useTheme();
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? LABEL_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      if (label) {
        if (n !== label.name || color !== label.color) await updateLabel(label.id, { name: n, color });
      } else await createLabel({ name: n, color });
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save the label", (e as Error).message);
      setBusy(false);
    }
  };

  const remove = () => {
    if (!label) return;
    Alert.alert(`Delete "${label.name}"?`, "It's removed from every issue that has it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteLabel(label.id);
            onClose();
          } catch (e) {
            Alert.alert("Couldn't delete the label", (e as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <Sheet visible onClose={onClose} title={label ? "Edit label" : "New label"}>
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Bug" autoFocus={!label} maxLength={60} />
        <Text variant="small" tone="muted" weight="500">
          Colour
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {LABEL_COLORS.map((col) => (
            <Pressable key={col} accessibilityRole="button" accessibilityLabel={`Colour ${col}`} accessibilityState={{ selected: col === color }} onPress={() => setColor(col)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: col, alignItems: "center", justifyContent: "center", borderWidth: col === color ? 3 : 0, borderColor: c.foreground }}>
              {col === color ? <Icon name="check" size={16} color="#fff" /> : null}
            </Pressable>
          ))}
        </View>
        <Button title={label ? "Save" : "Add label"} variant="brand" loading={busy} disabled={!name.trim()} onPress={() => void save()} />
        {label ? <Button title="Delete label" variant="danger" icon="trash-2" onPress={remove} /> : null}
      </View>
    </Sheet>
  );
}
