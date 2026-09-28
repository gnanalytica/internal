import { View } from "react-native";

import { Screen, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { ChipRow } from "./bits";
import { PLAYBOOK } from "./playbook";

/** The training material, one section at a time — the web's Playbook tab. */
export function PlaybookView({ section, setSection, header }: { section: string; setSection: (s: string) => void; header: React.ReactElement }) {
  const { c, space, radius } = useTheme();
  const current = PLAYBOOK.find((p) => p.id === section) ?? PLAYBOOK[0];
  return (
    <Screen padded={false}>
      {header}
      <ChipRow>
        {PLAYBOOK.map((p) => {
          const on = p.id === current.id;
          return (
            <Text
              key={p.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setSection(p.id)}
              variant="small"
              weight="600"
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, overflow: "hidden", backgroundColor: on ? c.foreground : c.muted, color: on ? c.background : c.foreground }}
            >
              {p.label}
            </Text>
          );
        })}
      </ChipRow>
      <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <Text variant="heading">{current.title}</Text>
          <Text tone="muted">{current.intro}</Text>
        </View>
        {current.quote ? (
          <View style={{ backgroundColor: c.foreground, borderRadius: radius.lg, padding: space.lg }}>
            <Text variant="title" style={{ color: c.background, lineHeight: 24 }}>
              “{current.quote}”
            </Text>
          </View>
        ) : null}
        {current.groups.map((g) => (
          <View key={g.name} style={{ gap: space.sm }}>
            <Text variant="small" weight="700" tone="brand" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
              {g.name}
            </Text>
            {g.items.map((item) => (
              <View key={item} style={{ backgroundColor: c.muted, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm + 2 }}>
                <Text style={{ lineHeight: 22 }}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}
