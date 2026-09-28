import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colorFor, PRIORITY_MAP, STATUS_MAP } from "@/lib/constants";
import { initials } from "@/lib/format";
import { useTheme } from "@/theme";

export type IconName = ComponentProps<typeof Feather>["name"];

export function Icon({ name, size = 18, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Feather name={name} size={size} color={color ?? c.foreground} style={style} />;
}

type Tone = "default" | "muted" | "brand" | "danger" | "success" | "warning" | "inverse";
type Variant = "caption" | "small" | "body" | "title" | "heading" | "display";

export function Text({ variant = "body", tone = "default", weight, mono, style, ...rest }: TextProps & { variant?: Variant; tone?: Tone; weight?: TextStyle["fontWeight"]; mono?: boolean }) {
  const { c, type } = useTheme();
  const color = { default: c.foreground, muted: c.mutedForeground, brand: c.brand, danger: c.destructive, success: c.success, warning: c.warning, inverse: c.primaryForeground }[tone];
  return <RNText {...rest} style={[type[variant], { color }, weight ? { fontWeight: weight } : null, mono ? { fontFamily: "monospace", fontVariant: ["tabular-nums"] } : null, style]} />;
}

/** A scrolling screen body with pull-to-refresh and safe-area padding at the bottom. */
export function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, style }: { children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; padded?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const inner = [{ padding: padded ? space.lg : 0, paddingBottom: insets.bottom + space.xxl, gap: space.lg }, style];
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.background }, ...inner]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  title: string;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "brand";
  size?: "sm" | "md";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, icon, variant = "secondary", size = "md", loading, disabled, style, onPress, ...rest }: ButtonProps) {
  const { c, radius } = useTheme();
  const palette = {
    primary: { bg: c.primary, fg: c.primaryForeground, border: c.primary },
    brand: { bg: c.brand, fg: c.brandForeground, border: c.brand },
    secondary: { bg: c.card, fg: c.foreground, border: c.border },
    ghost: { bg: "transparent", fg: c.foreground, border: "transparent" },
    danger: { bg: c.dangerTint, fg: c.destructive, border: c.dangerTint },
  }[variant];
  const h = size === "sm" ? 34 : 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={(e) => {
        void Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        { height: h, paddingHorizontal: size === "sm" ? 12 : 16, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, backgroundColor: palette.bg, borderColor: palette.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={palette.fg} size="small" /> : icon ? <Icon name={icon} size={size === "sm" ? 15 : 17} color={palette.fg} /> : null}
      <Text variant={size === "sm" ? "small" : "body"} weight="600" style={{ color: palette.fg }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color, size = 20, disabled }: { icon: IconName; onPress?: () => void; label: string; color?: string; size?: number; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ padding: 6, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c, radius, space } = useTheme();
  const base = { backgroundColor: c.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: space.lg, gap: space.sm };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.8 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

/** A titled group on a screen. `action` sits at the right of the title. */
export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { space } = useTheme();
  return (
    <View style={[{ gap: space.sm }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24 }}>
        <Text variant="small" tone="muted" weight="600" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** One tappable line in a list: leading element, title/subtitle, trailing element. */
export function Row({ title, subtitle, leading, trailing, onPress, onLongPress, chevron, style, numberOfLines = 1 }: { title: ReactNode; subtitle?: ReactNode; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void; onLongPress?: () => void; chevron?: boolean; style?: StyleProp<ViewStyle>; numberOfLines?: number }) {
  const { c, space } = useTheme();
  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, backgroundColor: pressed ? c.muted : c.background, minHeight: 52 }, style]}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === "string" ? (
          <Text numberOfLines={numberOfLines} weight="500">
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text variant="small" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-right" size={18} color={c.mutedForeground} /> : null}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: inset }} />;
}

export function Badge({ label, color, tone = "neutral", dot }: { label: string; color?: string; tone?: "neutral" | "brand" | "success" | "warning" | "danger"; dot?: boolean }) {
  const { c, radius } = useTheme();
  const t = { neutral: [c.muted, c.mutedForeground], brand: [c.brandTint, c.brand], success: [c.successTint, c.success], warning: [c.warningTint, c.warning], danger: [c.dangerTint, c.destructive] }[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: color ? `${color}22` : t[0] }}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color ?? t[1] }} /> : null}
      <Text variant="caption" weight="600" style={{ color: color && !dot ? color : t[1] }}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({ name, seed, size = 28 }: { name?: string | null; seed?: string | null; size?: number }) {
  const bg = colorFor(seed || name || "?");
  return (
    <View accessibilityLabel={name ?? "Unassigned"} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: name ? bg : "transparent", borderWidth: name ? 0 : 1, borderStyle: "dashed", borderColor: "#9aa0a6", alignItems: "center", justifyContent: "center" }}>
      {name ? <RNText style={{ color: "#fff", fontSize: size * 0.4, fontWeight: "700" }}>{initials(name)}</RNText> : null}
    </View>
  );
}

/** Linear-style status glyph: an outlined ring that fills as work progresses. */
export function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.todo;
  const filled = status === "done" || status === "canceled";
  const partial = status === "in_progress" || status === "in_review";
  return (
    <View accessibilityLabel={s.label} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.8, borderColor: s.color, borderStyle: status === "backlog" ? "dashed" : "solid", alignItems: "center", justifyContent: "center", backgroundColor: filled ? s.color : "transparent" }}>
      {filled ? <Feather name={status === "done" ? "check" : "x"} size={size * 0.62} color="#fff" /> : partial ? <View style={{ width: size * 0.45, height: size * 0.45, borderRadius: size, backgroundColor: s.color, opacity: status === "in_review" ? 1 : 0.9 }} /> : null}
    </View>
  );
}

export function PriorityIcon({ priority, size = 16 }: { priority: string; size?: number }) {
  const { c } = useTheme();
  const p = PRIORITY_MAP[priority] ?? PRIORITY_MAP.none;
  if (p.id === "urgent") return <View accessibilityLabel="Urgent" style={{ width: size, height: size, borderRadius: 3, backgroundColor: "#eb5757", alignItems: "center", justifyContent: "center" }}><RNText style={{ color: "#fff", fontSize: size * 0.7, fontWeight: "800" }}>!</RNText></View>;
  if (p.id === "none") return <Feather accessibilityLabel="No priority" name="more-horizontal" size={size} color={c.mutedForeground} />;
  const bars = { high: 3, medium: 2, low: 1 }[p.id as "high" | "medium" | "low"];
  return (
    <View accessibilityLabel={p.label} style={{ flexDirection: "row", alignItems: "flex-end", gap: 1.5, width: size, height: size, justifyContent: "center" }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ width: size / 5, height: (size * i) / 3.4, borderRadius: 1, backgroundColor: i <= bars ? c.foreground : c.border }} />
      ))}
    </View>
  );
}

export const Input = forwardRef<TextInput, TextInputProps & { label?: string; hint?: string }>(function Input({ label, hint, style, multiline, ...rest }, ref) {
  const { c, radius, type } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="small" tone="muted" weight="500">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={c.mutedForeground}
        multiline={multiline}
        style={[type.body, { color: c.foreground, borderWidth: StyleSheet.hairlineWidth, borderColor: c.input, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0, minHeight: multiline ? 96 : 44, textAlignVertical: multiline ? "top" : "center", backgroundColor: c.card }, style]}
        {...rest}
      />
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export function SearchBar({ value, onChangeText, placeholder = "Search" }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.muted, borderRadius: radius.md, paddingHorizontal: 12, height: 40 }}>
      <Icon name="search" size={16} color={c.mutedForeground} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.mutedForeground} style={{ flex: 1, color: c.foreground, fontSize: 15 }} returnKeyType="search" autoCorrect={false} />
      {value ? <IconButton icon="x" size={16} label="Clear search" onPress={() => onChangeText("")} color={c.mutedForeground} /> : null}
    </View>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const { c, radius } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 14, height: 32, borderRadius: radius.full, justifyContent: "center", backgroundColor: on ? c.foreground : c.muted }}>
            <Text variant="small" weight="600" style={{ color: on ? c.background : c.foreground }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Loading({ label }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, minHeight: 160, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: c.background }}>
      <ActivityIndicator color={c.brand} />
      {label ? <Text tone="muted">{label}</Text> : null}
    </View>
  );
}

export function Empty({ icon = "inbox", title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 8 }}>
      <Icon name={icon} size={28} color={c.mutedForeground} />
      <Text variant="title" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" style={{ textAlign: "center" }}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return <Empty icon="alert-circle" title="Couldn't load this" body={message} action={onRetry ? <Button title="Try again" onPress={onRetry} style={{ marginTop: 8 }} /> : null} />;
}

/** A bottom sheet for pickers and small forms. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { c, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: c.overlay }} />
      <View style={{ backgroundColor: c.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + space.md, maxHeight: "85%" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingVertical: space.md }}>
          <Text variant="title">{title}</Text>
          <IconButton icon="x" label="Close" onPress={onClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

/** A pick-one list inside a Sheet. */
export function Picker<T extends string>({ visible, onClose, title, value, options, onPick }: { visible: boolean; onClose: () => void; title: string; value: T | null; options: { value: T; label: string; leading?: ReactNode; subtitle?: string }[]; onPick: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {options.map((o) => (
        <Row
          key={o.value}
          title={o.label}
          subtitle={o.subtitle}
          leading={o.leading}
          trailing={o.value === value ? <Icon name="check" color={c.brand} /> : null}
          onPress={() => {
            onPick(o.value);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}

/** A floating "new" button, bottom right, clear of the tab bar. */
export function Fab({ icon = "plus", label, onPress }: { icon?: IconName; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ position: "absolute", right: 18, bottom: 18, width: 54, height: 54, borderRadius: 27, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } })}>
      <Icon name={icon} size={24} color={c.brandForeground} />
    </Pressable>
  );
}

/** A label/value line for detail screens. */
export function Field({ label, children, onPress }: { label: string; children: ReactNode; onPress?: () => void }) {
  const { c, space } = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md, opacity: pressed ? 0.7 : 1 })}>
      <Text tone="muted" style={{ width: 104 }}>
        {label}
      </Text>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>{children}</View>
      {onPress ? <Icon name="chevron-right" size={16} color={c.mutedForeground} /> : null}
    </Pressable>
  );
}
