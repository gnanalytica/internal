import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Markdown } from "@/components/markdown";
import { Button, Screen, Segmented, Text } from "@/components/ui";
import { useTheme } from "@/theme";

/**
 * Full-screen Markdown editor for a page body, with a preview tab. `onSave`
 * resolves when the server accepted the text; while it runs the editor stays
 * open, so a refused save (a conflict) never loses what was typed.
 */
export function MarkdownEditor({ visible, initial, title, onClose, onSave }: { visible: boolean; initial: string; title: string; onClose: () => void; onSave: (text: string) => Promise<boolean> }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const dirty = text !== initial;

  const close = () => {
    if (!dirty) return onClose();
    Alert.alert("Discard your changes?", "What you typed here hasn't been saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onShow={() => {
        setText(initial);
        setMode("write");
      }}
      onRequestClose={close}
    >
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: insets.top, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md, gap: space.sm }}>
            <Button title="Cancel" variant="ghost" onPress={close} />
            <Text variant="title" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
              {title}
            </Text>
            <Button
              title="Save"
              variant="brand"
              size="sm"
              loading={saving}
              disabled={!dirty}
              onPress={async () => {
                setSaving(true);
                try {
                  if (await onSave(text)) onClose();
                } finally {
                  setSaving(false);
                }
              }}
            />
          </View>
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "write", label: "Write" },
                { value: "preview", label: "Preview" },
              ]}
            />
          </View>
          {mode === "write" ? (
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              placeholder="Write in Markdown — # headings, - lists, - [ ] tasks, **bold**, [links](https://…)"
              placeholderTextColor={c.mutedForeground}
              style={{ flex: 1, padding: space.lg, color: c.foreground, fontSize: 16, lineHeight: 23, textAlignVertical: "top" }}
            />
          ) : (
            <Screen>{text.trim() ? <Markdown source={text} /> : <Text tone="muted">Nothing to preview yet.</Text>}</Screen>
          )}
          <Text variant="caption" tone="muted" style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.md }}>
            Markdown: headings, lists, checkboxes, quotes, code, tables, bold, italic and links. Saving replaces the whole page body.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
