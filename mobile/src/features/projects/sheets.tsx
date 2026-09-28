import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Input, Sheet } from "@/components/ui";
import { useTheme } from "@/theme";

import { createFeature } from "./api";
import { SheetActions } from "./components";

/** Add a feature to a project's roadmap (optionally on a milestone), then open it. */
export function NewFeatureSheet({ visible, onClose, projectId, milestoneId }: { visible: boolean; onClose: () => void; projectId: string; milestoneId: string | null }) {
  const { space } = useTheme();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const f = await createFeature({ projectId, milestoneId, title: title.trim() });
      setTitle("");
      onClose();
      router.push(`/projects/${projectId}/features/${f.id}`);
    } catch (e) {
      Alert.alert("Couldn't add the feature", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New feature">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Title" placeholder="e.g. Bulk export to Excel" value={title} onChangeText={setTitle} autoFocus />
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel="Add feature" saving={saving} disabled={!title.trim()} />
      </View>
    </Sheet>
  );
}
