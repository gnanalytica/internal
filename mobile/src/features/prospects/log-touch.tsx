import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Input, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { logTouch } from "./api";
import { Chips, fail, notify } from "./bits";
import {
  addDays,
  CHANNELS,
  defaultNextStep,
  defaultStage,
  displayDate,
  FOLLOW_UPS,
  OBJECTIONS,
  OUTCOMES,
  PITCH_ANGLES,
  SOFTWARE,
  STAGES,
  WRITABLE,
  type Channel,
  type Outcome,
  type ProspectKind,
  type Stage,
} from "./model";

export type LogTarget = { kind: ProspectKind; id: string; name: string; stage: number; nextStep: string };

/**
 * Log a call, message or meeting — the web's log dialog on a phone. Each field
 * says which sheet column it writes, and the footer lists every cell that will
 * change before saving.
 */
export function LogTouchModal({ target, today, channel, onClose, onSaved }: { target: LogTarget | null; today: string; channel?: Channel; onClose: () => void; onSaved?: () => void }) {
  return (
    <Modal visible={!!target} animationType="slide" onRequestClose={onClose}>
      {/* Keyed so each record, and each return from a call, starts from a clean form. */}
      {target ? <LogForm key={`${target.kind}:${target.id}:${channel ?? ""}`} target={target} today={today} initialChannel={channel ?? "Call"} onClose={onClose} onSaved={onSaved} /> : null}
    </Modal>
  );
}

function Label({ text, col }: { text: string; col: string }) {
  return (
    <Text variant="small" weight="600">
      {text}{" "}
      <Text variant="caption" tone="muted" mono>
        → {col}
      </Text>
    </Text>
  );
}

function LogForm({ target, today, initialChannel, onClose, onSaved }: { target: LogTarget; today: string; initialChannel: Channel; onClose: () => void; onSaved?: () => void }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [outcome, setOutcome] = useState<Outcome>(initialChannel === "WhatsApp" || initialChannel === "Email" ? "Sent" : "Connected");
  const [stageOverride, setStageOverride] = useState<number | null>(null);
  const [minutes, setMinutes] = useState("");
  const [summary, setSummary] = useState("");
  const [software, setSoftware] = useState("");
  const [cases, setCases] = useState("");
  const [objection, setObjection] = useState("");
  const [pitch, setPitch] = useState("");
  const [follow, setFollow] = useState<string>("In 3 days");
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stage = stageOverride ?? defaultStage(target.stage, channel, outcome);
  const days = FOLLOW_UPS.find((f) => f.label === follow)?.days ?? null;
  const nextDate = days === null ? null : addDays(today, days);
  const step = nextStep ?? defaultNextStep(outcome, target.nextStep);
  const isValuer = target.kind === "valuer";
  const tracksPitch = WRITABLE[target.kind].has("pitch_angle");

  const writes = useMemo(() => {
    const cols = ["status", "last_contacted", "notes"];
    if (nextDate) cols.push("next_step_date");
    if (step) cols.push("next_step");
    if (isValuer && software) cols.push("current_software");
    if (isValuer && cases) cols.push("lb_cases_per_month");
    if (tracksPitch && objection) cols.push("objections");
    if (tracksPitch && pitch) cols.push("pitch_angle");
    return cols;
  }, [nextDate, step, software, cases, objection, pitch, isValuer, tracksPitch]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await logTouch(target.kind, target.id, {
        name: target.name,
        channel,
        direction: outcome === "Replied" ? "Inbound" : "Outbound",
        outcome,
        durationMin: minutes ? Number(minutes) : null,
        summary: summary.trim(),
        statusAfter: STAGES[stage],
        nextStep: step || null,
        nextStepDate: nextDate,
        fields: {
          ...(isValuer && software ? { current_software: software } : {}),
          ...(isValuer && cases ? { lb_cases_per_month: Number(cases) } : {}),
          ...(tracksPitch && objection ? { objections: objection } : {}),
          ...(tracksPitch && pitch ? { pitch_angle: pitch } : {}),
        },
      });
      notify(res.message);
      onSaved?.();
      onClose();
    } catch (e) {
      fail("Couldn't log it", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 0.5, borderBottomColor: c.border }}>
        <Button title="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text variant="title">Log a call or message</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {target.name} · {displayDate(today)}
          </Text>
        </View>
        <View style={{ width: 72 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.sm }}>
          <Label text="Channel" col="Activity.channel" />
          <Chips options={CHANNELS} value={channel} required onChange={(v) => v && setChannel(v)} />
        </View>
        <View style={{ gap: space.sm }}>
          <Label text="Outcome" col="Activity.outcome" />
          <Chips options={OUTCOMES} value={outcome} required onChange={(v) => v && setOutcome(v)} />
        </View>
        <View style={{ width: 150, gap: 6 }}>
          <Label text="Minutes" col="duration_min" />
          <Input value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 12" keyboardType="number-pad" />
        </View>
        <View style={{ gap: 6 }}>
          <Label text="What they said" col="notes + Activity.summary" />
          <Input value={summary} onChangeText={setSummary} placeholder="e.g. 4 banks, SBI format is the slowest. Wants to see it on a live case." multiline style={{ minHeight: 80 }} />
        </View>
        {isValuer ? (
          <>
            <View style={{ gap: space.sm }}>
              <Label text="Current software" col="current_software" />
              <Chips options={SOFTWARE} value={software as (typeof SOFTWARE)[number] | ""} onChange={setSoftware} />
            </View>
            <View style={{ width: 150, gap: 6 }}>
              <Label text="Cases / month" col="lb_cases_per_month" />
              <Input value={cases} onChangeText={(v) => setCases(v.replace(/\D/g, "").slice(0, 5))} placeholder="e.g. 40" keyboardType="number-pad" />
            </View>
          </>
        ) : null}
        {tracksPitch ? (
          <>
            <View style={{ gap: space.sm }}>
              <Label text="Main objection" col="objections" />
              <Chips options={OBJECTIONS} value={objection as (typeof OBJECTIONS)[number] | ""} onChange={setObjection} />
            </View>
            <View style={{ gap: space.sm }}>
              <Label text="Pitch that landed" col="pitch_angle" />
              <Chips options={PITCH_ANGLES} value={pitch as (typeof PITCH_ANGLES)[number] | ""} onChange={setPitch} />
            </View>
          </>
        ) : null}
        <View style={{ gap: space.sm }}>
          <Label text="Next follow-up" col="next_step_date" />
          <Chips options={FOLLOW_UPS.map((f) => f.label)} value={follow} required onChange={(v) => setFollow(v || "No follow-up")} />
        </View>
        <View style={{ gap: 6 }}>
          <Label text="Next step" col="next_step" />
          <Input value={step} onChangeText={setNextStep} placeholder="e.g. Send the demo link" />
        </View>
        <View style={{ gap: space.sm }}>
          <Label text="Status after" col="status" />
          <Chips options={STAGES} value={STAGES[stage]} required onChange={(v) => v && setStageOverride(STAGES.indexOf(v as Stage))} />
        </View>
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.md, gap: space.sm, borderTopWidth: 0.5, borderTopColor: c.border }}>
        <Text variant="caption" tone="muted">
          Will write to the sheet: <Text variant="caption" mono>{writes.join(", ")}</Text>
          {nextDate ? ` · follow-up ${displayDate(nextDate)}` : ""} · plus one row in Activity
        </Text>
        <Button title={saving ? "Saving…" : "Save to the sheet"} variant="brand" loading={saving} onPress={() => void save()} />
      </View>
    </KeyboardAvoidingView>
  );
}
