import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Icon, Input, Picker, Sheet, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { Missing } from "./bits";

export type FieldType = "text" | "textarea" | "number" | "select";

export type EditSpec = { col: string; label: string; value: string; type?: FieldType; options?: readonly string[] };

/**
 * One labelled value from the sheet. Tapping it opens an editor when the
 * column is writable for this kind; the save writes that one cell.
 */
export function EditRow({ label, value, display, missing = "Not known — research", editable, onEdit }: { label: string; value: string; display?: ReactNode; missing?: string; editable: boolean; onEdit: () => void }) {
  const { c, space } = useTheme();
  return (
    <Pressable
      disabled={!editable}
      onPress={onEdit}
      accessibilityRole={editable ? "button" : undefined}
      accessibilityLabel={editable ? `Edit ${label}` : undefined}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
    >
      <Text tone="muted" variant="small" style={{ width: 112, paddingTop: 1 }}>
        {label}
      </Text>
      <View style={{ flex: 1 }}>{value ? (display ?? <Text variant="small">{value}</Text>) : <Missing>{missing}</Missing>}</View>
      {editable ? <Icon name="edit-2" size={14} color={c.mutedForeground} style={{ paddingTop: 2 }} /> : null}
    </Pressable>
  );
}

/** The editor for whichever field is open: a picker, a one-line sheet, or a full-screen text editor. */
export function FieldEditor({ spec, onClose, onSave }: { spec: EditSpec | null; onClose: () => void; onSave: (col: string, value: string | number | null) => Promise<void> }) {
  if (!spec) return null;
  if (spec.type === "select")
    return (
      <Picker
        visible
        onClose={onClose}
        title={spec.label}
        value={spec.value || "__none"}
        options={[{ value: "__none", label: "— None" }, ...[...new Set([...(spec.options ?? []), ...(spec.value && !spec.options?.includes(spec.value) ? [spec.value] : [])])].map((o) => ({ value: o, label: o }))]}
        onPick={(v) => void onSave(spec.col, v === "__none" ? "" : v)}
      />
    );
  if (spec.type === "textarea") return <TextEditor spec={spec} onClose={onClose} onSave={onSave} />;
  return <LineEditor spec={spec} onClose={onClose} onSave={onSave} />;
}

function LineEditor({ spec, onClose, onSave }: { spec: EditSpec; onClose: () => void; onSave: (col: string, value: string | number | null) => Promise<void> }) {
  const { space } = useTheme();
  const [draft, setDraft] = useState(spec.value);
  const [saving, setSaving] = useState(false);
  const number = spec.type === "number";
  const valid = !number || draft.trim() === "" || /^\d+(\.\d+)?$/.test(draft.trim());
  const save = async () => {
    setSaving(true);
    try {
      await onSave(spec.col, number ? (draft.trim() === "" ? null : Number(draft)) : draft.trim());
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible onClose={onClose} title={spec.label}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
          <Input value={draft} onChangeText={setDraft} autoFocus keyboardType={number ? "decimal-pad" : spec.col === "phone" ? "phone-pad" : spec.col === "email" ? "email-address" : "default"} autoCapitalize={spec.col === "email" ? "none" : "sentences"} hint={`Writes ${spec.col} on this row of the sheet.`} />
          <Button title={saving ? "Saving…" : "Save to the sheet"} variant="brand" loading={saving} disabled={!valid || draft === spec.value} onPress={() => void save()} />
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

/** Full-screen editing for the long columns: notes, research notes, drafts. */
function TextEditor({ spec, onClose, onSave }: { spec: EditSpec; onClose: () => void; onSave: (col: string, value: string | number | null) => Promise<void> }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(spec.value);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await onSave(spec.col, text.trim());
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md }}>
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text variant="title" numberOfLines={1}>
              {spec.label}
            </Text>
            <Text variant="caption" tone="muted" mono>
              → {spec.col}
            </Text>
          </View>
          <Button title="Save" variant="brand" size="sm" loading={saving} disabled={text === spec.value} onPress={() => void save()} />
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          placeholder={spec.col === "research_notes" ? "One finding per line, as “label: text”." : "Write here."}
          placeholderTextColor={c.mutedForeground}
          style={{ flex: 1, padding: space.lg, color: c.foreground, fontSize: 16, lineHeight: 23, textAlignVertical: "top" }}
        />
        <View style={{ height: insets.bottom }} />
      </KeyboardAvoidingView>
    </Modal>
  );
}
