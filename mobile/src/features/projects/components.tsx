import { useQuery } from "@tanstack/react-query";
import { Children, Fragment, useState, type ReactNode } from "react";
import { Modal, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Badge, Button, Card, Divider, Picker, Text } from "@/components/ui";
import { membersQuery } from "@/features/workspace/api";
import { useTheme } from "@/theme";

import { HEALTH_MAP } from "./constants";

/** A thin progress track. `color` defaults to the brand colour. */
export function ProgressBar({ pct, color, height = 6 }: { pct: number; color?: string; height?: number }) {
  const { c } = useTheme();
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: w }} style={{ height, borderRadius: height, backgroundColor: c.muted, overflow: "hidden" }}>
      <View style={{ width: `${w}%`, height, borderRadius: height, backgroundColor: color ?? c.brand }} />
    </View>
  );
}

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function HealthBadge({ health }: { health: string | null | undefined }) {
  const h = health ? HEALTH_MAP[health] : undefined;
  if (!h) return <Badge label="No update" />;
  return <Badge label={h.label} color={h.color} dot />;
}

/** Rows in one bordered card, divided — the grouped list the issue screen uses. */
export function ListCard({ children, inset = 0 }: { children: ReactNode; inset?: number }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <Card style={{ padding: 0, overflow: "hidden", gap: 0 }}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <Divider inset={inset} /> : null}
          {child}
        </Fragment>
      ))}
    </Card>
  );
}

/** A small stat: a number over its label. */
export function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.muted, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 6, alignItems: "center", gap: 2 }}>
      <Text weight="700" mono numberOfLines={1} style={tone ? { color: tone } : undefined}>
        {value}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Pick one member (or nobody). */
export function MemberPicker({ visible, onClose, value, onPick, title, noneLabel = "Nobody" }: { visible: boolean; onClose: () => void; value: string | null; onPick: (v: string | null) => void; title: string; noneLabel?: string }) {
  const members = useQuery(membersQuery).data ?? [];
  return (
    <Picker
      visible={visible}
      onClose={onClose}
      title={title}
      value={value ?? "__none"}
      options={[{ value: "__none", label: noneLabel }, ...members.map((m) => ({ value: m.id, label: m.name, subtitle: m.title ?? m.email, leading: <Avatar name={m.name} seed={m.id} size={24} /> }))]}
      onPick={(v) => onPick(v === "__none" ? null : v)}
    />
  );
}

/** Full-screen Markdown editor, for a feature's PRD. */
export function MarkdownEditor({ visible, initial, onClose, onSave, title, placeholder }: { visible: boolean; initial: string; onClose: () => void; onSave: (v: string) => void; title: string; placeholder?: string }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);
  return (
    <Modal visible={visible} animationType="slide" onShow={() => setText(initial)} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md }}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Text variant="title">{title}</Text>
          <Button
            title="Save"
            variant="brand"
            size="sm"
            disabled={text === initial}
            onPress={() => {
              onSave(text);
              onClose();
            }}
          />
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          placeholder={placeholder ?? "Write in Markdown — # headings, - lists, **bold**, [links](https://…)"}
          placeholderTextColor={c.mutedForeground}
          style={{ flex: 1, padding: space.lg, color: c.foreground, fontSize: 16, lineHeight: 23, textAlignVertical: "top" }}
        />
        <Text variant="caption" tone="muted" style={{ padding: space.md, paddingBottom: insets.bottom + space.md }}>
          Markdown. Headings, lists, checkboxes, bold, italic, code and links.
        </Text>
      </View>
    </Modal>
  );
}

/** Two-button row at the bottom of a sheet form. */
export function SheetActions({ onCancel, onSave, saveLabel = "Save", saving, disabled }: { onCancel: () => void; onSave: () => void; saveLabel?: string; saving?: boolean; disabled?: boolean }) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      <Button title="Cancel" style={{ flex: 1 }} onPress={onCancel} />
      <Button title={saveLabel} variant="primary" style={{ flex: 1 }} loading={saving} disabled={disabled} onPress={onSave} />
    </View>
  );
}

/** Tappable chips for a small set of choices inside a sheet form. */
export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly { id: T; label: string; color?: string }[] }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Text
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            variant="small"
            weight="600"
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, overflow: "hidden", backgroundColor: on ? (o.color ?? c.foreground) : c.muted, color: on ? (o.color ? "#fff" : c.background) : c.foreground }}
          >
            {o.label}
          </Text>
        );
      })}
    </View>
  );
}
