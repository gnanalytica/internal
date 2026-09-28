import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button, Input, Sheet, Text } from "@/components/ui";
import { useTheme } from "@/theme";

const ICONS = ["📄", "📝", "📘", "📚", "📌", "📎", "🗂️", "📁", "🧭", "🗺️", "🎯", "🚀", "💡", "🧪", "🛠️", "⚙️", "🔒", "📣", "💬", "🤝", "💼", "💰", "📈", "📊", "🧾", "🏷️", "🗓️", "⏱️", "✅", "⭐", "🔥", "🌱", "🏢", "👥", "🎓", "🧠"];

/** Pick a page icon from a grid, or type any emoji. */
export function IconPicker({ visible, onClose, value, onPick }: { visible: boolean; onClose: () => void; value: string; onPick: (icon: string) => void }) {
  const { c, space, radius } = useTheme();
  const [typed, setTyped] = useState("");
  const pick = (icon: string) => {
    onPick(icon);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Page icon">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: space.lg }}>
        {ICONS.map((icon) => (
          <Pressable key={icon} accessibilityRole="button" accessibilityLabel={`Use ${icon}`} onPress={() => pick(icon)} style={({ pressed }) => ({ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: icon === value ? c.brandTint : pressed ? c.muted : "transparent" })}>
            <Text style={{ fontSize: 26 }}>{icon}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Input label="Or type an emoji" value={typed} onChangeText={setTyped} maxLength={8} />
        <Button title="Use it" variant="primary" disabled={!typed.trim()} onPress={() => pick(typed.trim())} />
      </View>
    </Sheet>
  );
}
