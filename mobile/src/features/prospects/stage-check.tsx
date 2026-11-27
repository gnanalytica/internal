import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Input, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { Chips } from "./bits";
import { missingRequired, PITCH_ANGLES, REQUIRED_LABEL, requiredValues, SOFTWARE, STAGES, type ProspectKind } from "./model";

/** What a stage move needs to know about the record — a list row or a full record both map to it. */
export type MoveSubject = {
  kind: ProspectKind;
  id: string;
  name: string;
  stage: number;
  cases: number | null;
  software: string;
  pitchAngle: string;
  nextStep: string;
};

type Patch = Record<string, string | number | null>;
type Ask = { subject: MoveSubject; target: number; fields: string[] };

/**
 * Move a record to another stage (web: stage-check.tsx). A forward move with
 * required facts missing (model.ts REQUIRED_TO_LEAVE) asks for them first and
 * writes them with the status, in one save — the sheet would refuse the move
 * without them. `write` returns whether the save landed; the sheet stays open
 * on a failure so what was typed isn't lost.
 */
export function useStageMove(write: (s: MoveSubject, patch: Patch) => Promise<boolean>) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const move = (s: MoveSubject, target: number) => {
    if (target === s.stage) return;
    const fields = missingRequired(s.kind, requiredValues(s), s.stage, target);
    if (fields.length) setAsk({ subject: s, target, fields });
    else void write(s, { status: STAGES[target] });
  };
  const sheet = (
    <Modal visible={!!ask} animationType="slide" onRequestClose={() => setAsk(null)}>
      {ask ? (
        <StageCheckForm
          key={`${ask.subject.id}:${ask.target}`}
          ask={ask}
          onClose={() => setAsk(null)}
          onSave={async (extra) => {
            if (await write(ask.subject, { ...extra, status: STAGES[ask.target] })) setAsk(null);
          }}
        />
      ) : null}
    </Modal>
  );
  return { move, sheet };
}

function StageCheckForm({ ask, onClose, onSave }: { ask: Ask; onClose: () => void; onSave: (extra: Patch) => Promise<void> }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));
  const extra: Patch = Object.fromEntries(
    Object.entries(vals)
      .filter(([, v]) => v.trim() !== "")
      .map(([k, v]) => [k, k === "lb_cases_per_month" ? Number(v) : v.trim()]),
  );
  const ready = ask.fields.every((f) => f in extra);
  const save = async () => {
    setSaving(true);
    try {
      await onSave(extra);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 0.5, borderBottomColor: c.border }}>
        <Button title="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text variant="title">Move to {STAGES[ask.target]}</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {ask.subject.name} · {STAGES[ask.subject.stage]}
          </Text>
        </View>
        <View style={{ width: 72 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <Text variant="small" tone="muted">
          {STAGES[ask.target]} needs what {STAGES[ask.subject.stage]} should have found out. Fill these to move — they save to the sheet with the new status.
        </Text>
        {ask.fields.map((f) => (
          <View key={f} style={{ gap: space.sm }}>
            <Text variant="small" weight="600">
              {REQUIRED_LABEL[f] ?? f}{" "}
              <Text variant="small" style={{ color: c.destructive }}>
                Required
              </Text>
            </Text>
            {f === "current_software" ? (
              <Chips options={SOFTWARE} value={(vals[f] ?? "") as (typeof SOFTWARE)[number] | ""} onChange={(v) => set(f, v)} />
            ) : f === "pitch_angle" ? (
              <Chips options={PITCH_ANGLES} value={(vals[f] ?? "") as (typeof PITCH_ANGLES)[number] | ""} onChange={(v) => set(f, v)} />
            ) : f === "lb_cases_per_month" ? (
              <View style={{ width: 150 }}>
                <Input value={vals[f] ?? ""} onChangeText={(v) => set(f, v.replace(/\D/g, "").slice(0, 5))} placeholder="e.g. 40" keyboardType="number-pad" accessibilityLabel={REQUIRED_LABEL[f]} />
              </View>
            ) : (
              <Input value={vals[f] ?? ""} onChangeText={(v) => set(f, v)} placeholder="e.g. Start the pilot on two live cases" accessibilityLabel={REQUIRED_LABEL[f]} />
            )}
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.md, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.muted }}>
        <Button title={saving ? "Saving…" : `Save and move to ${STAGES[ask.target]}`} variant="brand" loading={saving} disabled={!ready || saving} onPress={() => void save()} />
      </View>
    </KeyboardAvoidingView>
  );
}
