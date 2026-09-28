import { addDays, addMonths, nextMonday } from "date-fns";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type KeyboardTypeOptions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Divider, Field, Icon, IconButton, Input, Row, SearchBar, Text } from "@/components/ui";
import { inr, isoDay, shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

import type { Option } from "./constants";

export type FieldSpec = {
  key: string;
  label: string;
  kind: "text" | "multiline" | "number" | "money" | "date" | "choice";
  placeholder?: string;
  required?: boolean;
  hint?: string;
  /** For `choice`. */
  options?: Option[];
  /** For `choice`: offer a way to clear it, with this label. */
  noneLabel?: string;
  /** For `money`: the currency the amount is in (or how to read it off the form), for the preview. */
  currency?: string | ((values: FormValues) => string);
  keyboard?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words";
};

export type FormValue = string | number | null;
export type FormValues = Record<string, FormValue>;

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  fields: FieldSpec[];
  initial: FormValues;
  submitLabel?: string;
  onSubmit: (values: FormValues) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  deleteLabel?: string;
};

/**
 * A bottom sheet holding a small form. Choices and dates open in place inside
 * the sheet (no stacked modals), and a sheet with a single choice or date field
 * goes straight to the choices and saves on the first tap.
 */
export function FormSheet({ visible, onClose, title, fields, initial, submitLabel = "Save", onSubmit, onDelete, deleteLabel = "Delete" }: Props) {
  const { c, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<FormValues>(initial);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const instant = fields.length === 1 && (fields[0].kind === "choice" || fields[0].kind === "date") ? fields[0] : null;
  const current = instant ?? fields.find((f) => f.key === picking) ?? null;

  const set = (key: string, v: FormValue) => setValues((prev) => ({ ...prev, [key]: v }));
  const missing = fields.find((f) => f.required && (values[f.key] === null || values[f.key] === undefined || String(values[f.key]).trim() === ""));

  const submit = async (vals: FormValues) => {
    setBusy(true);
    try {
      await onSubmit(clean(fields, vals));
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (v: FormValue) => {
    if (!current) return;
    const next = { ...values, [current.key]: v };
    setValues(next);
    setPicking(null);
    if (instant) void submit(next);
  };

  const remove = () =>
    Alert.alert(`${deleteLabel}?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: deleteLabel,
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await onDelete?.();
            onClose();
          } catch (e) {
            Alert.alert("Couldn't delete", (e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => (picking && !instant ? setPicking(null) : onClose())}
      onShow={() => {
        setValues(initial);
        setPicking(null);
      }}
      statusBarTranslucent
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: c.overlay }} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + space.md, maxHeight: "88%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md }}>
            {current && !instant ? <IconButton icon="chevron-left" label="Back" onPress={() => setPicking(null)} /> : null}
            <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
              {current ? (instant ? title : current.label) : title}
            </Text>
            {!current && !busy ? <Button title={submitLabel} variant="brand" size="sm" disabled={!!missing} onPress={() => void submit(values)} /> : null}
            {busy ? <Button title="Saving" size="sm" loading /> : null}
            <IconButton icon="x" label="Close" onPress={onClose} />
          </View>
          {current ? (
            current.kind === "date" ? (
              <DateChoices value={(values[current.key] as string | null) ?? null} onPick={pick} />
            ) : (
              <Choices field={current} value={(values[current.key] as string | null) ?? null} onPick={pick} />
            )
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md }}>
              {fields.map((f) => (
                <FieldInput key={f.key} field={f} values={values} value={values[f.key] ?? null} onChange={(v) => set(f.key, v)} onOpen={() => setPicking(f.key)} />
              ))}
              {onDelete ? <Button title={deleteLabel} icon="trash-2" variant="danger" disabled={busy} onPress={remove} style={{ marginTop: space.sm }} /> : null}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Empty text becomes null; numbers are whole numbers. */
function clean(fields: FieldSpec[], values: FormValues): FormValues {
  const out: FormValues = { ...values };
  for (const f of fields) {
    const v = values[f.key];
    if (f.kind === "number" || f.kind === "money") {
      const n = typeof v === "number" ? v : v === null || v === undefined || String(v).trim() === "" ? null : Number(String(v).replace(/[^\d.-]/g, ""));
      out[f.key] = n === null || !Number.isFinite(n) ? null : Math.round(n);
    } else if (f.kind === "text" || f.kind === "multiline") {
      const s = v === null || v === undefined ? "" : String(v).trim();
      out[f.key] = s || null;
    }
  }
  return out;
}

function FieldInput({ field, values, value, onChange, onOpen }: { field: FieldSpec; values: FormValues; value: FormValue; onChange: (v: FormValue) => void; onOpen: () => void }) {
  const { c, radius } = useTheme();
  if (field.kind === "choice" || field.kind === "date") {
    const shown = field.kind === "date" ? (value ? shortDate(String(value)) : null) : field.options?.find((o) => o.value === value)?.label ?? null;
    const color = field.kind === "choice" ? field.options?.find((o) => o.value === value)?.color : undefined;
    return (
      <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: c.input, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: c.card }}>
        <Field label={field.label} onPress={onOpen}>
          {color ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} /> : null}
          <Text tone={shown ? "default" : "muted"} numberOfLines={1} style={{ flex: 1 }}>
            {shown ?? field.placeholder ?? (field.noneLabel || "—")}
          </Text>
        </Field>
      </View>
    );
  }
  const text = value === null || value === undefined ? "" : String(value);
  const numeric = field.kind === "number" || field.kind === "money";
  const n = numeric && text.trim() ? Number(text.replace(/[^\d.-]/g, "")) : null;
  const currency = typeof field.currency === "function" ? field.currency(values) : field.currency ?? "INR";
  return (
    <Input
      label={field.required ? `${field.label} *` : field.label}
      value={text}
      onChangeText={(t) => onChange(t)}
      placeholder={field.placeholder}
      multiline={field.kind === "multiline"}
      keyboardType={numeric ? "number-pad" : field.keyboard}
      autoCapitalize={field.autoCapitalize ?? (field.keyboard === "email-address" || field.keyboard === "url" ? "none" : "sentences")}
      autoCorrect={!(field.keyboard === "email-address" || field.keyboard === "url")}
      hint={field.kind === "money" && n !== null && Number.isFinite(n) ? `${inr(n, currency)}${field.hint ? ` · ${field.hint}` : ""}` : field.hint}
    />
  );
}

function Choices({ field, value, onPick }: { field: FieldSpec; value: string | null; onPick: (v: string | null) => void }) {
  const { c, space } = useTheme();
  const [q, setQ] = useState("");
  const options = field.options ?? [];
  const searchable = options.length > 12;
  const shown = q ? options.filter((o) => `${o.label} ${o.subtitle ?? ""}`.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      {searchable ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          <SearchBar value={q} onChangeText={setQ} placeholder={`Search ${field.label.toLowerCase()}`} />
        </View>
      ) : null}
      {field.noneLabel ? <Row title={<Text tone="muted">{field.noneLabel}</Text>} trailing={value === null ? <Icon name="check" color={c.brand} /> : null} onPress={() => onPick(null)} /> : null}
      {shown.map((o, i) => (
        <View key={o.value}>
          {i > 0 || field.noneLabel ? <Divider inset={space.lg} /> : null}
          <Row
            title={o.label}
            subtitle={o.subtitle}
            leading={o.color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: o.color }} /> : undefined}
            trailing={o.value === value ? <Icon name="check" color={c.brand} /> : null}
            onPress={() => onPick(o.value)}
          />
        </View>
      ))}
      {shown.length === 0 ? (
        <Text tone="muted" style={{ padding: space.lg, textAlign: "center" }}>
          {q ? `Nothing matches “${q}”.` : "Nothing to choose from yet."}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function DateChoices({ value, onPick }: { value: string | null; onPick: (v: string | null) => void }) {
  const { space } = useTheme();
  const [typed, setTyped] = useState(value ?? "");
  const today = new Date();
  const choices: [string, Date][] = [
    ["Today", today],
    ["Tomorrow", addDays(today, 1)],
    ["Next Monday", nextMonday(today)],
    ["In a week", addDays(today, 7)],
    ["In two weeks", addDays(today, 14)],
    ["In a month", addMonths(today, 1)],
  ];
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(typed) && !Number.isNaN(new Date(typed).getTime());
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      {choices.map(([label, d]) => (
        <Row key={label} title={label} subtitle={shortDate(d)} trailing={<Icon name="calendar" size={16} />} onPress={() => onPick(isoDay(d))} />
      ))}
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Input label="Or type a date" placeholder="yyyy-mm-dd" value={typed} onChangeText={setTyped} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button title="Set" variant="primary" style={{ flex: 1 }} disabled={!valid} onPress={() => onPick(typed)} />
          {value ? <Button title="Clear date" style={{ flex: 1 }} onPress={() => onPick(null)} /> : null}
        </View>
      </View>
    </ScrollView>
  );
}
