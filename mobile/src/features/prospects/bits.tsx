import { Alert, Platform, Pressable, ScrollView, ToastAndroid, View, type StyleProp, type ViewStyle } from "react-native";

import { Icon, Text } from "@/components/ui";
import { useTheme, type Palette } from "@/theme";

import { dueBucket, dueText, STAGES, type Due } from "./model";

/** A short confirmation after a write — a toast on Android, where this app ships. */
export function notify(message: string): void {
  if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
}

export function fail(title: string, e: unknown): void {
  Alert.alert(title, e instanceof Error ? e.message : "Something went wrong writing to the sheet.");
}

/** Tint + text colour per band, from the theme so it holds in dark mode. */
function bandTone(band: string, c: Palette): [string, string] {
  if (band === "A") return [c.successTint, c.success];
  if (band === "B") return [c.brandTint, c.brand];
  if (band === "Disqualified") return [c.dangerTint, c.destructive];
  if (band === "Incomplete") return [c.warningTint, c.warning];
  return [c.muted, c.mutedForeground];
}

function Chip({ bg, fg, label, mono, style }: { bg: string; fg: string; label: string; mono?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: bg }, style]}>
      <Text variant="caption" weight="600" mono={mono} style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function BandBadge({ band, score }: { band: string; score?: number | null }) {
  const { c } = useTheme();
  if (!band)
    return (
      <Text variant="caption" tone="muted">
        Not scored
      </Text>
    );
  const [bg, fg] = bandTone(band, c);
  const text = ["A", "B", "C"].includes(band) ? `${band}${score !== null && score !== undefined ? ` ${score}` : ""}` : band;
  return <Chip bg={bg} fg={fg} label={text} mono />;
}

function dueTone(b: Due, c: Palette): [string, string] {
  if (b === "overdue") return [c.dangerTint, c.destructive];
  if (b === "today") return [c.warningTint, c.warning];
  if (b === "soon") return [c.muted, c.foreground];
  return [c.muted, c.mutedForeground];
}

export function DueChip({ date, today }: { date: string | null; today: string }) {
  const { c } = useTheme();
  const b = dueBucket(date, today);
  if (b === "none")
    return (
      <Text variant="caption" tone="muted">
        No date
      </Text>
    );
  const [bg, fg] = dueTone(b, c);
  return <Chip bg={bg} fg={fg} label={dueText(date, today)} />;
}

/** One colour per stage, from the theme: grey → brand → warning (pilot) → success (won) / danger (lost). */
export function stageColor(stage: number, c: Palette): [string, string] {
  if (stage === 0) return [c.muted, c.mutedForeground];
  if (stage >= 1 && stage <= 3) return [c.brandTint, c.brand];
  if (stage === 4) return [c.warningTint, c.warning];
  if (stage === 5) return [c.successTint, c.success];
  return [c.dangerTint, c.destructive];
}

export function StagePill({ stage }: { stage: number }) {
  const { c } = useTheme();
  const [bg, fg] = stageColor(stage, c);
  return <Chip bg={bg} fg={fg} label={STAGES[stage] ?? STAGES[0]} style={{ borderRadius: 999, paddingHorizontal: 9 }} />;
}

/** A horizontal bar for one magnitude; the value is always written beside it. */
export function Bar({ value, max, height = 8 }: { value: number; max: number; height?: number }) {
  const { c } = useTheme();
  const w = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: c.muted, overflow: "hidden" }}>
      <View style={{ width: `${w}%`, height: "100%", backgroundColor: c.brand, borderRadius: height / 2 }} />
    </View>
  );
}

/** Pick-one chips that wrap; tapping the selected chip clears it unless `required`. */
export function Chips<T extends string>({ options, value, onChange, required }: { options: readonly T[]; value: T | ""; onChange: (v: T | "") => void; required?: boolean }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(on && !required ? "" : o)}
            style={({ pressed }) => ({ paddingHorizontal: 12, minHeight: 34, justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: on ? c.foreground : c.border, backgroundColor: on ? c.foreground : c.card, opacity: pressed ? 0.75 : 1 })}
          >
            <Text variant="small" weight="600" style={{ color: on ? c.background : c.foreground }}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A filter button that shows its current value and opens a picker. */
export function FilterButton({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 12, paddingRight: 8, height: 32, borderRadius: radius.full, borderWidth: 1, borderColor: active ? c.brand : c.border, backgroundColor: active ? c.brandTint : c.card, opacity: pressed ? 0.75 : 1 })}
    >
      <Text variant="small" weight="600" style={{ color: active ? c.brand : c.foreground }} numberOfLines={1}>
        {label}
      </Text>
      <Icon name="chevron-down" size={14} color={active ? c.brand : c.mutedForeground} />
    </Pressable>
  );
}

/** A row of chips that scrolls sideways, with the screen's side padding. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  const { space } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: space.lg }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

/** A value research has not found yet — amber, as on the web. */
export function Missing({ children }: { children: string }) {
  const { c } = useTheme();
  return <Chip bg={c.warningTint} fg={c.warning} label={children} />;
}

/** The sheet's warnings (a missing tab, a duplicate ID), shown rather than hidden. */
export function Warnings({ warnings }: { warnings: string[] }) {
  const { c, radius, space } = useTheme();
  if (!warnings.length) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: c.warningTint, borderRadius: radius.md, padding: space.md, gap: 4 }}>
      {warnings.slice(0, 3).map((w) => (
        <Text key={w} variant="small" style={{ color: c.warning }}>
          {w}
        </Text>
      ))}
      {warnings.length > 3 ? (
        <Text variant="small" style={{ color: c.warning }}>
          …and {warnings.length - 3} more.
        </Text>
      ) : null}
    </View>
  );
}
