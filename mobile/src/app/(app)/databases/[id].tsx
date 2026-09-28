import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Divider, Empty, ErrorView, Icon, IconButton, Input, Loading, Row, SearchBar, Segmented, Sheet, Text } from "@/components/ui";
import { ActionSheet, type SheetAction } from "@/features/docs/action-sheet";
import { addRow, databaseQuery, deleteDatabase, deleteRow, duplicateRow, FIELD_TYPES, updateDatabase, type Database, type DbRow, type Field } from "@/features/databases/api";
import { cellText, columnWidth, multiValues, optionColor, primaryField, rowLabel } from "@/features/databases/cells";
import { FieldEditor } from "@/features/databases/field-editor";
import { RowDetail } from "@/features/databases/row-detail";
import { useMe } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function DatabaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(databaseQuery(id));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <DatabaseBody database={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function DatabaseBody({ database, refreshing, onRefresh }: { database: Database; refreshing: boolean; onRefresh: () => void }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [view, setView] = useState<"table" | "list">("table");
  const [search, setSearch] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [fieldEditor, setFieldEditor] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(database.name);
  const [icon, setIcon] = useState(database.icon);
  const [adding, setAdding] = useState(false);

  const primary = primaryField(database.fields);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return database.rows;
    return database.rows.filter((r) => database.fields.some((f) => cellText(f, r, database).toLowerCase().includes(term)));
  }, [database, search]);

  const editField = (f: Field | null) => {
    setEditingField(f);
    setFieldEditor(true);
  };

  const newRow = async () => {
    setAdding(true);
    try {
      const rowId = await addRow(database.id);
      setOpenRow(rowId);
    } catch (e) {
      Alert.alert("Couldn't add a row", (e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const rowActions = (r: DbRow) =>
    Alert.alert(rowLabel(r, primary?.id), undefined, [
      { text: "Duplicate", onPress: () => void duplicateRow(database.id, r.id).catch((e: Error) => Alert.alert("Couldn't duplicate", e.message)) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert("Delete this row?", "It's removed for everyone. This can't be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => void deleteRow(database.id, r.id).catch((e: Error) => Alert.alert("Couldn't delete", e.message)) },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);

  const actions: SheetAction[] = [
    { label: "Rename", icon: "edit-2", onPress: () => { setName(database.name); setIcon(database.icon); setRenaming(true); } },
    { label: "Add a field", icon: "plus-square", onPress: () => editField(null) },
    ...(me.isAdmin
      ? [
          {
            label: "Delete database",
            icon: "trash-2" as const,
            destructive: true,
            onPress: () =>
              Alert.alert(`Delete "${database.name}"?`, `All ${database.rows.length} rows and every field go with it, for everyone. Relations in other databases that point here stop working. This can't be undone.`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete database",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteDatabase(database.id);
                      router.back();
                    } catch (e) {
                      Alert.alert("Couldn't delete the database", (e as Error).message);
                    }
                  },
                },
              ]),
          },
        ]
      : []),
  ];

  const header = (
    <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
      <Pressable onPress={() => { setName(database.name); setIcon(database.icon); setRenaming(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 30 }}>{database.icon || "🗃️"}</Text>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={2}>
            {database.name}
          </Text>
          <Text variant="small" tone="muted">
            {database.rows.length} row{database.rows.length === 1 ? "" : "s"} · {database.fields.length} field{database.fields.length === 1 ? "" : "s"}
          </Text>
        </View>
      </Pressable>
      {database.rows.length > 0 ? <SearchBar value={search} onChangeText={setSearch} placeholder="Search rows" /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: "Table" },
              { value: "list", label: "List" },
            ]}
          />
        </View>
        <Button size="sm" variant="ghost" icon="plus-square" title="Field" onPress={() => editField(null)} />
      </View>
    </View>
  );

  const empty = search.trim() ? (
    <Empty icon="search" title="No rows match" body={`No cell contains "${search.trim()}".`} />
  ) : (
    <Empty icon="grid" title="No rows yet" body="Add a row to start filling in this database." action={<Button title="New row" icon="plus" variant="primary" loading={adding} onPress={() => void newRow()} style={{ marginTop: 8 }} />} />
  );
  const footer = rows.length ? (
    <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}>
      <Button title="New row" icon="plus" loading={adding} onPress={() => void newRow()} />
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: database.name, headerRight: () => <IconButton icon="more-vertical" label="More" onPress={() => setMenu(true)} /> }} />
      {view === "list" ? (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ItemSeparatorComponent={() => <Divider inset={16} />}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          renderItem={({ item: r }) => {
            const rest = database.fields
              .filter((f) => f.id !== primary?.id)
              .map((f) => [f.name, cellText(f, r, database)] as const)
              .filter(([, v]) => v)
              .slice(0, 3);
            return <Row title={rowLabel(r, primary?.id)} subtitle={rest.length ? rest.map(([k, v]) => `${k}: ${v}`).join(" · ") : "Empty row"} chevron onPress={() => setOpenRow(r.id)} onLongPress={() => rowActions(r)} />;
          }}
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} />}>
          {header}
          {database.fields.length === 0 ? (
            <Empty icon="columns" title="No fields yet" body="Fields are the columns of a database. Add one to start." action={<Button title="Add a field" icon="plus" variant="primary" onPress={() => editField(null)} style={{ marginTop: 8 }} />} />
          ) : (
            <>
              <Table database={database} rows={rows} onOpenRow={setOpenRow} onRowActions={rowActions} onEditField={editField} />
              {rows.length === 0 ? empty : footer}
            </>
          )}
        </ScrollView>
      )}

      <RowDetail database={database} rowId={openRow} onClose={() => setOpenRow(null)} />
      <FieldEditor database={database} field={editingField} visible={fieldEditor} onClose={() => setFieldEditor(false)} />
      <ActionSheet visible={menu} onClose={() => setMenu(false)} title={database.name} actions={actions} />
      <Sheet visible={renaming} onClose={() => setRenaming(false)} title="Rename database">
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ width: 72 }}>
              <Input label="Icon" value={icon} onChangeText={setIcon} maxLength={8} style={{ textAlign: "center", fontSize: 20 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Name" value={name} onChangeText={setName} autoFocus />
            </View>
          </View>
          <Button
            title="Save"
            variant="primary"
            disabled={!name.trim()}
            onPress={() => {
              setRenaming(false);
              const patch: { name?: string; icon?: string } = {};
              if (name.trim() !== database.name) patch.name = name.trim();
              if (icon.trim() && icon.trim() !== database.icon) patch.icon = icon.trim();
              if (Object.keys(patch).length) void updateDatabase(database.id, patch).catch((e: Error) => Alert.alert("Couldn't rename", e.message));
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

/** Rows × fields, scrolling sideways. Tap a row to edit it, a column header to change the field. */
function Table({ database, rows, onOpenRow, onRowActions, onEditField }: { database: Database; rows: DbRow[]; onOpenRow: (id: string) => void; onRowActions: (r: DbRow) => void; onEditField: (f: Field | null) => void }) {
  const { c } = useTheme();
  const line = { borderBottomWidth: 0.5, borderBottomColor: c.border };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 16 }}>
      <View style={{ borderWidth: 0.5, borderColor: c.border, borderRadius: 8, overflow: "hidden" }}>
        <View style={[{ flexDirection: "row", backgroundColor: c.muted }, line]}>
          {database.fields.map((f) => (
            <Pressable key={f.id} accessibilityRole="button" accessibilityLabel={`Edit field ${f.name}`} onPress={() => onEditField(f)} style={({ pressed }) => ({ width: columnWidth(f), paddingHorizontal: 10, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6, borderRightWidth: 0.5, borderRightColor: c.border, opacity: pressed ? 0.6 : 1 })}>
              <Icon name={FIELD_TYPES.find((t) => t.id === f.type)?.icon ?? "type"} size={12} color={c.mutedForeground} />
              <Text variant="small" weight="600" numberOfLines={1} style={{ flex: 1 }}>
                {f.name}
              </Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add a field" onPress={() => onEditField(null)} style={{ width: 48, alignItems: "center", justifyContent: "center" }}>
            <Icon name="plus" size={16} color={c.mutedForeground} />
          </Pressable>
        </View>
        {rows.map((r, i) => (
          <Pressable key={r.id} onPress={() => onOpenRow(r.id)} onLongPress={() => onRowActions(r)} style={({ pressed }) => [{ flexDirection: "row", backgroundColor: pressed ? c.muted : c.background }, i < rows.length - 1 ? line : null]}>
            {database.fields.map((f) => (
              <View key={f.id} style={{ width: columnWidth(f), minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, justifyContent: "center", borderRightWidth: 0.5, borderRightColor: c.border }}>
                <CellView field={f} row={r} database={database} />
              </View>
            ))}
            <View style={{ width: 48 }} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function CellView({ field, row, database }: { field: Field; row: DbRow; database: Database }) {
  const { c } = useTheme();
  const v = row.values?.[field.id];
  if (field.type === "checkbox") return v ? <Icon name="check-square" size={16} color={c.brand} /> : <Icon name="square" size={16} color={c.border} />;
  if (field.type === "select") return typeof v === "string" && v ? <Badge label={v} color={optionColor(field, v)} /> : null;
  if (field.type === "multiSelect") {
    const vals = multiValues(row, field.id);
    return vals.length ? (
      <View style={{ flexDirection: "row", gap: 4, overflow: "hidden" }}>
        {vals.slice(0, 2).map((x) => (
          <Badge key={x} label={x} color={optionColor(field, x)} />
        ))}
        {vals.length > 2 ? <Text variant="caption" tone="muted">+{vals.length - 2}</Text> : null}
      </View>
    ) : null;
  }
  const text = cellText(field, row, database);
  const tone = field.type === "url" || field.type === "email" || field.type === "relation" ? "brand" : field.type === "rollup" ? "muted" : "default";
  return (
    <Text variant="small" tone={tone} numberOfLines={2} mono={field.type === "number" || field.type === "rollup"}>
      {text}
    </Text>
  );
}
