import * as Linking from "expo-linking";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, Divider, Icon, IconButton, Picker, Row, Screen, SearchBar, Sheet, Text } from "@/components/ui";
import { DatePicker } from "@/features/issues/pickers";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

import { deleteRow, duplicateRow, FIELD_TYPES, ROLLUP_FNS, setCell, type Database, type DbRow, type Field } from "./api";
import { computeRollup, multiValues, optionColor, primaryField, relationIds, rowLabel } from "./cells";

/** Every cell of one row, each edited the way its field type calls for. */
export function RowDetail({ database, rowId, onClose }: { database: Database; rowId: string | null; onClose: () => void }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const row = database.rows.find((r) => r.id === rowId) ?? null;
  const primary = primaryField(database.fields);
  const commit = (fieldId: string, value: unknown) => {
    if (!row) return;
    void setCell(database.id, row.id, fieldId, value).catch((e: Error) => Alert.alert("Couldn't save", e.message));
  };

  const remove = () =>
    Alert.alert("Delete this row?", "It's removed for everyone. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (!row) return;
          onClose();
          void deleteRow(database.id, row.id).catch((e: Error) => Alert.alert("Couldn't delete", e.message));
        },
      },
    ]);

  return (
    <Modal visible={!!rowId} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: insets.top, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm }}>
            <IconButton icon="x" label="Close" onPress={onClose} />
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
              {row ? rowLabel(row, primary?.id) : "Row"}
            </Text>
            {row ? (
              <>
                <IconButton
                  icon="copy"
                  label="Duplicate row"
                  onPress={() => {
                    void duplicateRow(database.id, row.id)
                      .then(() => Alert.alert("Row duplicated", "The copy was added at the end of the database."))
                      .catch((e: Error) => Alert.alert("Couldn't duplicate", e.message));
                  }}
                />
                <IconButton icon="trash-2" label="Delete row" color={c.destructive} onPress={remove} />
              </>
            ) : null}
          </View>
          {!row ? (
            <Screen>
              <Text tone="muted">This row was deleted.</Text>
            </Screen>
          ) : (
            <Screen>
              {database.fields.length === 0 ? <Text tone="muted">This database has no fields yet. Add one from the table's header.</Text> : null}
              {database.fields.map((f) => (
                <View key={f.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon name={FIELD_TYPES.find((t) => t.id === f.type)?.icon ?? "type"} size={13} color={c.mutedForeground} />
                    <Text variant="small" tone="muted" weight="600">
                      {f.name}
                    </Text>
                  </View>
                  <CellEditor key={`${row.id}:${f.id}`} field={f} row={row} database={database} commit={(v) => commit(f.id, v)} />
                </View>
              ))}
            </Screen>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CellEditor({ field, row, database, commit }: { field: Field; row: DbRow; database: Database; commit: (v: unknown) => void }) {
  const raw = row.values?.[field.id];
  switch (field.type) {
    case "checkbox":
      return <CheckboxCell value={Boolean(raw)} onChange={commit} />;
    case "number":
      return <TextCell initial={raw == null ? "" : String(raw)} keyboardType="decimal-pad" placeholder="A number" commit={(t) => (t.trim() === "" ? null : Number(t.replace(/,/g, "")))} validate={(t) => t.trim() === "" || Number.isFinite(Number(t.replace(/,/g, "")))} invalid="That isn't a number." onCommit={commit} same={(v) => v === raw || (v === null && raw == null)} />;
    case "url":
      return <TextCell initial={raw == null ? "" : String(raw)} keyboardType="url" placeholder="https://…" open={(t) => (/^https?:\/\//i.test(t) ? t : `https://${t}`)} onCommit={commit} same={(v) => v === (raw ?? "")} />;
    case "email":
      return <TextCell initial={raw == null ? "" : String(raw)} keyboardType="email-address" placeholder="name@example.com" open={(t) => `mailto:${t}`} onCommit={commit} same={(v) => v === (raw ?? "")} />;
    case "date":
      return <DateCell value={typeof raw === "string" && raw ? raw : null} onChange={commit} />;
    case "select":
      return <SelectCell field={field} value={typeof raw === "string" ? raw : null} onChange={commit} />;
    case "multiSelect":
      return <MultiSelectCell field={field} value={multiValues(row, field.id)} onChange={commit} />;
    case "relation":
      return <RelationCell field={field} row={row} database={database} onChange={commit} />;
    case "rollup":
      return <RollupCell field={field} row={row} database={database} />;
    default:
      return <TextCell initial={raw == null ? "" : String(raw)} multiline placeholder="Empty" onCommit={commit} same={(v) => v === (raw ?? "")} />;
  }
}

function Box({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  const { c, radius } = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, borderRadius: radius.md, borderWidth: 0.5, borderColor: c.input, backgroundColor: pressed ? c.muted : c.card, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 })}>
      {children}
    </Pressable>
  );
}

/** Text-like cells save when you leave the box, like the web's table. */
function TextCell({
  initial,
  onCommit,
  same,
  commit = (t) => t,
  validate,
  invalid,
  open,
  ...input
}: {
  initial: string;
  onCommit: (v: unknown) => void;
  same: (v: unknown) => boolean;
  commit?: (t: string) => unknown;
  validate?: (t: string) => boolean;
  invalid?: string;
  open?: (t: string) => string;
  keyboardType?: "default" | "decimal-pad" | "url" | "email-address";
  placeholder?: string;
  multiline?: boolean;
}) {
  const { c, radius, type } = useTheme();
  const [text, setText] = useState(initial);
  const bad = validate ? !validate(text) : false;
  const save = () => {
    if (bad) return;
    const v = commit(text);
    if (!same(v)) onCommit(v);
  };
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={save}
          onSubmitEditing={input.multiline ? undefined : save}
          placeholder={input.placeholder}
          placeholderTextColor={c.mutedForeground}
          keyboardType={input.keyboardType ?? "default"}
          autoCapitalize={input.keyboardType === "url" || input.keyboardType === "email-address" ? "none" : "sentences"}
          autoCorrect={!(input.keyboardType === "url" || input.keyboardType === "email-address")}
          multiline={input.multiline}
          style={[type.body, { flex: 1, color: c.foreground, minHeight: 44, paddingHorizontal: 12, paddingVertical: input.multiline ? 10 : 0, borderRadius: radius.md, borderWidth: 0.5, borderColor: bad ? c.destructive : c.input, backgroundColor: c.card, textAlignVertical: input.multiline ? "top" : "center" }]}
        />
        {open && text.trim() ? <IconButton icon="external-link" label="Open" onPress={() => void Linking.openURL(open(text.trim()))} /> : null}
      </View>
      {bad && invalid ? (
        <Text variant="caption" tone="danger">
          {invalid}
        </Text>
      ) : null}
    </View>
  );
}

function CheckboxCell({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  const [on, setOn] = useState(value);
  return (
    <Box onPress={() => { setOn(!on); onChange(!on); }}>
      <Text style={{ flex: 1 }}>{on ? "Checked" : "Not checked"}</Text>
      <Switch value={on} onValueChange={(v) => { setOn(v); onChange(v); }} trackColor={{ true: c.brand, false: c.border }} thumbColor="#fff" />
    </Box>
  );
}

function DateCell({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Box onPress={() => setOpen(true)}>
        <Icon name="calendar" size={16} color={c.mutedForeground} />
        <Text tone={value ? "default" : "muted"} style={{ flex: 1 }}>
          {value ? shortDate(value) || value : "No date"}
        </Text>
      </Box>
      <DatePicker visible={open} onClose={() => setOpen(false)} value={value} onPick={onChange} />
    </>
  );
}

function SelectCell({ field, value, onChange }: { field: Field; value: string | null; onChange: (v: string | null) => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const options = field.options ?? [];
  return (
    <>
      <Box onPress={() => setOpen(true)}>
        {value ? <Badge label={value} color={optionColor(field, value)} /> : <Text tone="muted">None</Text>}
        <View style={{ flex: 1 }} />
        <Icon name="chevron-down" size={16} color={c.mutedForeground} />
      </Box>
      <Picker
        visible={open}
        onClose={() => setOpen(false)}
        title={field.name}
        value={value ?? "__none"}
        options={[{ value: "__none", label: "None" }, ...options.map((o) => ({ value: o.label, label: o.label, leading: <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: o.color }} /> }))]}
        onPick={(v) => onChange(v === "__none" ? null : v)}
      />
    </>
  );
}

function MultiSelectCell({ field, value, onChange }: { field: Field; value: string[]; onChange: (v: string[]) => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(value);
  const options = field.options ?? [];
  return (
    <>
      <Box onPress={() => { setPicked(value); setOpen(true); }}>
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>{value.length ? value.map((v) => <Badge key={v} label={v} color={optionColor(field, v)} />) : <Text tone="muted">None</Text>}</View>
        <Icon name="chevron-down" size={16} color={c.mutedForeground} />
      </Box>
      <Sheet
        visible={open}
        onClose={() => {
          setOpen(false);
          if (picked.join("\u0000") !== value.join("\u0000")) onChange(picked);
        }}
        title={field.name}
      >
        {options.length === 0 ? <Text tone="muted" style={{ padding: 16 }}>This field has no options yet. Add some from the field's settings.</Text> : null}
        {options.map((o) => {
          const on = picked.includes(o.label);
          return (
            <Row
              key={o.label}
              title={o.label}
              leading={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: o.color }} />}
              trailing={on ? <Icon name="check" color={c.brand} /> : null}
              onPress={() => setPicked(on ? picked.filter((x) => x !== o.label) : [...picked, o.label])}
            />
          );
        })}
      </Sheet>
    </>
  );
}

function RelationCell({ field, row, database, onChange }: { field: Field; row: DbRow; database: Database; onChange: (v: string[]) => void }) {
  const { c, space } = useTheme();
  const target = field.relationDatabaseId ? database.related[field.relationDatabaseId] : undefined;
  const selected = relationIds(row, field.id);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(selected);
  const [search, setSearch] = useState("");
  const candidates = useMemo(() => {
    const rows = target?.rows ?? [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => rowLabel(r, target?.primaryFieldId).toLowerCase().includes(q)) : rows;
  }, [target, search]);
  if (!target) return <Box><Text tone="muted">The database this links to is gone.</Text></Box>;
  const chosen = target.rows.filter((r) => selected.includes(r.id));
  return (
    <>
      <Box onPress={() => { setPicked(selected); setSearch(""); setOpen(true); }}>
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>{chosen.length ? chosen.map((r) => <Badge key={r.id} tone="brand" label={rowLabel(r, target.primaryFieldId)} />) : <Text tone="muted">Link {target.name} rows</Text>}</View>
        <Icon name="plus" size={16} color={c.mutedForeground} />
      </Box>
      <Sheet
        visible={open}
        onClose={() => {
          setOpen(false);
          if ([...picked].sort().join() !== [...selected].sort().join()) onChange(picked);
        }}
        title={`Link ${target.name}`}
      >
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={`Search ${target.name}`} />
        </View>
        {candidates.length === 0 ? <Text tone="muted" style={{ padding: space.lg }}>{target.rows.length ? "No rows match." : `${target.name} has no rows yet.`}</Text> : null}
        {candidates.map((r, i) => {
          const on = picked.includes(r.id);
          return (
            <View key={r.id}>
              {i > 0 ? <Divider inset={16} /> : null}
              <Row title={rowLabel(r, target.primaryFieldId)} trailing={on ? <Icon name="check" color={c.brand} /> : null} onPress={() => setPicked(on ? picked.filter((x) => x !== r.id) : [...picked, r.id])} />
            </View>
          );
        })}
      </Sheet>
    </>
  );
}

function RollupCell({ field, row, database }: { field: Field; row: DbRow; database: Database }) {
  const rel = database.fields.find((f) => f.id === field.config?.relationFieldId);
  const target = rel?.relationDatabaseId ? database.related[rel.relationDatabaseId] : undefined;
  const of = field.config?.targetFieldId ? target?.fields.find((f) => f.id === field.config?.targetFieldId) : undefined;
  const fn = field.config?.fn ?? "count";
  const fnLabel = ROLLUP_FNS.find((x) => x.id === fn)?.label ?? fn;
  return (
    <Card style={{ paddingVertical: 10 }}>
      <Text mono weight="600">
        {computeRollup(field.config, row, database.fields, database.related)}
      </Text>
      <Text variant="caption" tone="muted">
        {rel ? `${fn === "count" ? "Count of" : `${fnLabel} of ${of?.name ?? "a field"} across`} linked ${rel.name}` : "Its relation field was deleted."} · Calculated, not editable
      </Text>
    </Card>
  );
}

