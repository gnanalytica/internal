import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, Divider, Icon, IconButton, Input, Row, Screen, Section, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { addField, databasesQuery, deleteField, FIELD_TYPES, ROLLUP_FNS, SELECT_COLORS, updateField, type Database, type Field, type FieldInput, type RollupFn } from "./api";

type Opt = { label: string; color: string; previousLabel?: string };

/**
 * Add a field, or change one: name, type, a select's options, a relation's
 * target, a rollup's settings — the same choices as the web's field menu.
 */
export function FieldEditor({ database, field, visible, onClose }: { database: Database; field: Field | null; visible: boolean; onClose: () => void }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const databases = useQuery({ ...databasesQuery, enabled: visible }).data ?? [];
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState<Opt[]>([]);
  const [relationDb, setRelationDb] = useState<string | null>(null);
  const [rollupRel, setRollupRel] = useState<string | null>(null);
  const [rollupFn, setRollupFn] = useState<RollupFn>("count");
  const [rollupTarget, setRollupTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(field?.name ?? "");
    setType(field?.type ?? "text");
    setOptions((field?.options ?? []).map((o) => ({ ...o, previousLabel: o.label })));
    setRelationDb(field?.relationDatabaseId ?? null);
    setRollupRel(field?.config?.relationFieldId ?? null);
    setRollupFn(field?.config?.fn ?? "count");
    setRollupTarget(field?.config?.targetFieldId ?? null);
  };

  const hasOptions = type === "select" || type === "multiSelect";
  const relationFields = database.fields.filter((f) => f.type === "relation" && f.relationDatabaseId && f.id !== field?.id);
  const rel = relationFields.find((f) => f.id === rollupRel);
  const numberTargets = rel?.relationDatabaseId ? (database.related[rel.relationDatabaseId]?.fields ?? []).filter((f) => f.type === "number") : [];
  const labels = options.map((o) => o.label.trim());
  const optionsOk = !hasOptions || (labels.every(Boolean) && new Set(labels).size === labels.length);
  const canSave =
    !!name.trim() &&
    optionsOk &&
    (type !== "relation" || !!relationDb) &&
    (type !== "rollup" || (!!rel && (rollupFn === "count" || numberTargets.some((f) => f.id === rollupTarget))));

  const save = async () => {
    setSaving(true);
    const config = type === "rollup" ? { relationFieldId: rollupRel!, fn: rollupFn, targetFieldId: rollupFn === "count" ? null : rollupTarget } : undefined;
    try {
      if (!field) {
        const input: FieldInput = { name: name.trim(), type };
        if (hasOptions && options.length) input.options = options.map(({ label, color }) => ({ label: label.trim(), color }));
        if (type === "relation") input.relationDatabaseId = relationDb;
        if (config) input.config = config;
        await addField(database.id, input);
      } else {
        const patch: FieldInput = {};
        if (name.trim() !== field.name) patch.name = name.trim();
        if (type !== field.type) patch.type = type;
        const before = JSON.stringify((field.options ?? []).map((o) => [o.label, o.color]));
        const after = JSON.stringify(options.map((o) => [o.label.trim(), o.color]));
        if (hasOptions && (before !== after || type !== field.type) && options.length) patch.options = options.map((o) => ({ ...o, label: o.label.trim() }));
        if (type === "relation" && (type !== field.type || relationDb !== field.relationDatabaseId)) patch.relationDatabaseId = relationDb;
        if (config && (type !== field.type || JSON.stringify(config) !== JSON.stringify(field.config ? { relationFieldId: field.config.relationFieldId, fn: field.config.fn, targetFieldId: field.config.targetFieldId } : null))) patch.config = config;
        if (Object.keys(patch).length) await updateField(database.id, field.id, patch);
      }
      onClose();
    } catch (e) {
      Alert.alert(field ? "Couldn't change the field" : "Couldn't add the field", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    field &&
    Alert.alert(`Delete "${field.name}"?`, "Its values in every row are lost, and rollups that read it stop working. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete field",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteField(database.id, field.id);
            onClose();
          } catch (e) {
            Alert.alert("Couldn't delete the field", (e as Error).message);
          }
        },
      },
    ]);

  const chip = (on: boolean) => ({ paddingHorizontal: 12, height: 34, borderRadius: radius.full, justifyContent: "center" as const, flexDirection: "row" as const, alignItems: "center" as const, gap: 6, borderWidth: 1, borderColor: on ? c.brand : c.border, backgroundColor: on ? c.brandTint : c.card });

  return (
    <Modal visible={visible} animationType="slide" onShow={reset} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: insets.top, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md }}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Text variant="title">{field ? "Edit field" : "New field"}</Text>
            <Button title={field ? "Save" : "Add"} variant="brand" size="sm" loading={saving} disabled={!canSave} onPress={() => void save()} />
          </View>
          <Screen>
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Owner, Due, Stage" autoFocus={!field} />

            <Section title="Type">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {FIELD_TYPES.map((t) => (
                  <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ selected: type === t.id }} onPress={() => setType(t.id)} style={chip(type === t.id)}>
                    <Icon name={t.icon} size={14} color={type === t.id ? c.brand : c.mutedForeground} />
                    <Text variant="small" weight="600" style={{ color: type === t.id ? c.brand : c.foreground }}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {field && type !== field.type ? (
                <Text variant="caption" tone="warning">
                  Values already in this column stay stored as they are; some may not show under the new type.
                </Text>
              ) : null}
            </Section>

            {hasOptions ? (
              <Section title="Options" action={<Button size="sm" variant="ghost" icon="plus" title="Add" onPress={() => setOptions([...options, { label: `Option ${options.length + 1}`, color: SELECT_COLORS[options.length % SELECT_COLORS.length] }])} />}>
                {options.length === 0 ? <Text tone="muted">{field ? "No options yet." : "Starts with one option; add more here or later."}</Text> : null}
                {options.map((o, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Change colour"
                      onPress={() => setOptions(options.map((x, j) => (j === i ? { ...x, color: SELECT_COLORS[(SELECT_COLORS.indexOf(x.color) + 1) % SELECT_COLORS.length] } : x)))}
                      style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: o.color }}
                    />
                    <TextInput
                      value={o.label}
                      onChangeText={(v) => setOptions(options.map((x, j) => (j === i ? { ...x, label: v } : x)))}
                      placeholder="Option name"
                      placeholderTextColor={c.mutedForeground}
                      style={{ flex: 1, height: 40, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 0.5, borderColor: labels.indexOf(o.label.trim()) !== i || !o.label.trim() ? c.destructive : c.input, color: c.foreground, backgroundColor: c.card, fontSize: 15 }}
                    />
                    <IconButton icon="x" label={`Remove ${o.label}`} color={c.mutedForeground} onPress={() => setOptions(options.filter((_, j) => j !== i))} />
                  </View>
                ))}
                {!optionsOk ? (
                  <Text variant="caption" tone="danger">
                    Every option needs a name, and no two can share one.
                  </Text>
                ) : field && options.some((o) => o.previousLabel && o.previousLabel !== o.label.trim()) ? (
                  <Text variant="caption" tone="muted">
                    Renamed options are updated in every row. Rows using a removed option keep its name.
                  </Text>
                ) : (
                  <Text variant="caption" tone="muted">
                    Tap a dot to change its colour.
                  </Text>
                )}
              </Section>
            ) : null}

            {type === "relation" ? (
              <Section title="Links to">
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  {databases.map((d, i) => (
                    <View key={d.id}>
                      {i > 0 ? <Divider inset={52} /> : null}
                      <Row leading={<Text style={{ fontSize: 18, width: 24, textAlign: "center" }}>{d.icon}</Text>} title={d.id === database.id ? `${d.name} (this database)` : d.name} trailing={relationDb === d.id ? <Icon name="check" color={c.brand} /> : null} onPress={() => setRelationDb(d.id)} />
                    </View>
                  ))}
                </Card>
              </Section>
            ) : null}

            {type === "rollup" ? (
              relationFields.length === 0 ? (
                <Card>
                  <Text tone="muted">A rollup reads through a relation. Add a relation field to this database first.</Text>
                </Card>
              ) : (
                <>
                  <Section title="Through relation">
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {relationFields.map((f) => (
                        <Pressable key={f.id} onPress={() => { setRollupRel(f.id); setRollupTarget(null); }} style={chip(rollupRel === f.id)}>
                          <Text variant="small" weight="600">
                            {f.name} → {database.related[f.relationDatabaseId!]?.name ?? "?"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </Section>
                  <Section title="Calculate">
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {ROLLUP_FNS.map((f) => (
                        <Pressable key={f.id} onPress={() => setRollupFn(f.id)} style={chip(rollupFn === f.id)}>
                          <Text variant="small" weight="600">
                            {f.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </Section>
                  {rollupFn !== "count" && rel ? (
                    <Section title="Of field">
                      {numberTargets.length === 0 ? (
                        <Text tone="muted">{database.related[rel.relationDatabaseId!]?.name ?? "That database"} has no number fields to calculate with. Count its rows instead, or add a number field there.</Text>
                      ) : (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {numberTargets.map((f) => (
                            <Pressable key={f.id} onPress={() => setRollupTarget(f.id)} style={chip(rollupTarget === f.id)}>
                              <Text variant="small" weight="600">
                                {f.name}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </Section>
                  ) : null}
                </>
              )
            ) : null}

            {field ? <Button title="Delete field" variant="danger" icon="trash-2" onPress={remove} style={{ marginTop: space.md }} /> : null}
          </Screen>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
