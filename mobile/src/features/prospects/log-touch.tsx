import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Icon, Input, Segmented, Text } from "@/components/ui";
import { DatePicker } from "@/features/issues/pickers";
import { useTheme } from "@/theme";

import { logTouch } from "./api";
import { Chips, fail, notify } from "./bits";
import {
  addDays,
  CHANNELS,
  defaultNextStep,
  defaultStage,
  FOLLOW_UPS,
  OBJECTIONS,
  OUTCOMES_BY_CHANNEL,
  PITCH_ANGLES,
  shortDate,
  SOFTWARE,
  STAGES,
  WRITABLE,
  type Channel,
  type Outcome,
  type ProspectKind,
  type Stage,
} from "./model";

export type LogTarget = { kind: ProspectKind; id: string; name: string; stage: number; nextStep: string };

const NO_FOLLOW_UP = "No follow-up";
const LOG_CHANNELS = CHANNELS.filter((c) => c !== "Other");

/**
 * Log a call, message or meeting — the web's "Log a touch" on a phone. Short by
 * default (how, what happened, what they said, follow-up); what was learnt is
 * one tap away.
 */
export function LogTouchModal({ target, today, channel, outcome, onClose, onSaved }: { target: LogTarget | null; today: string; channel?: Channel; outcome?: Outcome; onClose: () => void; onSaved?: () => void }) {
  return (
    <Modal visible={!!target} animationType="slide" onRequestClose={onClose}>
      {/* Keyed so each record, and each return from a call, starts from a clean form. */}
      {target ? <LogForm key={`${target.kind}:${target.id}:${channel ?? ""}:${outcome ?? ""}`} target={target} today={today} initialChannel={channel ?? "Call"} initialOutcome={outcome} onClose={onClose} onSaved={onSaved} /> : null}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="small" weight="600">
        {label}
      </Text>
      {children}
    </View>
  );
}

function LogForm({ target, today, initialChannel, initialOutcome, onClose, onSaved }: { target: LogTarget; today: string; initialChannel: Channel; initialOutcome?: Outcome; onClose: () => void; onSaved?: () => void }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [channel, setChannelState] = useState<Channel>(initialChannel);
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome && OUTCOMES_BY_CHANNEL[initialChannel].includes(initialOutcome) ? initialOutcome : OUTCOMES_BY_CHANNEL[initialChannel][0]);
  const [summary, setSummary] = useState("");
  const [followDate, setFollowDate] = useState<string | null>(addDays(today, 3));
  const [picking, setPicking] = useState(false);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [software, setSoftware] = useState("");
  const [cases, setCases] = useState("");
  const [objection, setObjection] = useState("");
  const [pitch, setPitch] = useState("");
  const [stageOverride, setStageOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const setChannel = (ch: Channel) => {
    setChannelState(ch);
    if (!OUTCOMES_BY_CHANNEL[ch].includes(outcome)) setOutcome(OUTCOMES_BY_CHANNEL[ch][0]);
  };
  const stage = stageOverride ?? defaultStage(target.stage, channel, outcome);
  const step = nextStep ?? defaultNextStep(outcome, target.nextStep);
  const tracksPractice = target.kind === "valuer";
  const tracksPitch = WRITABLE[target.kind].has("pitch_angle");

  const quickLabel = FOLLOW_UPS.find((f) => addDays(today, f.days) === followDate)?.label ?? "";
  const pickLabel = followDate && !quickLabel ? shortDate(followDate, today) : "Pick a date";
  const followOptions = [...FOLLOW_UPS.map((f) => f.label), pickLabel, NO_FOLLOW_UP];
  const followValue = !followDate ? NO_FOLLOW_UP : quickLabel || pickLabel;
  const onFollow = (v: string) => {
    if (v === NO_FOLLOW_UP) return setFollowDate(null);
    const quick = FOLLOW_UPS.find((f) => f.label === v);
    if (quick) return setFollowDate(addDays(today, quick.days));
    setPicking(true);
  };
  const learned = [tracksPractice ? "software, cases a month" : "", tracksPitch ? "objection, pitch" : "", "minutes, stage"].filter(Boolean).join(", ");

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
        nextStepDate: followDate,
        fields: {
          ...(tracksPractice && software ? { current_software: software } : {}),
          ...(tracksPractice && cases ? { lb_cases_per_month: Number(cases) } : {}),
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
          <Text variant="title">Log a touch</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {target.name} · {STAGES[target.stage] ?? STAGES[0]}
          </Text>
        </View>
        <View style={{ width: 72 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <Field label="How">
          <Segmented value={channel} onChange={setChannel} options={LOG_CHANNELS.map((ch) => ({ value: ch, label: ch }))} />
        </Field>
        <Field label="What happened">
          <Chips options={OUTCOMES_BY_CHANNEL[channel]} value={outcome} required onChange={(v) => v && setOutcome(v)} />
        </Field>
        <Field label="What they said">
          <Input value={summary} onChangeText={setSummary} placeholder="e.g. Works with 4 banks; the SBI format takes longest. Wants to see it on a live case." multiline style={{ minHeight: 80 }} />
        </Field>
        <Field label="Follow up">
          <Chips options={followOptions} value={followValue} required onChange={(v) => v && onFollow(v)} />
          {followDate ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Text variant="small" tone="muted">
                Next step
              </Text>
              <View style={{ flex: 1 }}>
                <Input value={step} onChangeText={setNextStep} placeholder="e.g. Send the demo link" />
              </View>
            </View>
          ) : null}
        </Field>

        {!more ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setMore(true)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: c.muted, opacity: pressed ? 0.75 : 1 })}
          >
            <Text variant="small" style={{ flex: 1 }}>
              Add what you learned{" "}
              <Text variant="small" tone="muted">
                · {learned}
              </Text>
            </Text>
            <Icon name="chevron-right" size={16} color={c.mutedForeground} />
          </Pressable>
        ) : (
          <View style={{ gap: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: c.muted }}>
            {tracksPractice ? (
              <>
                <Field label="Current software">
                  <Chips options={SOFTWARE} value={software as (typeof SOFTWARE)[number] | ""} onChange={setSoftware} />
                </Field>
                <Field label="Cases a month">
                  <View style={{ width: 150 }}>
                    <Input value={cases} onChangeText={(v) => setCases(v.replace(/\D/g, "").slice(0, 5))} placeholder="e.g. 40" keyboardType="number-pad" />
                  </View>
                </Field>
              </>
            ) : null}
            {tracksPitch ? (
              <>
                <Field label="Main objection">
                  <Chips options={OBJECTIONS} value={objection as (typeof OBJECTIONS)[number] | ""} onChange={setObjection} />
                </Field>
                <Field label="Pitch that landed">
                  <Chips options={PITCH_ANGLES} value={pitch as (typeof PITCH_ANGLES)[number] | ""} onChange={setPitch} />
                </Field>
              </>
            ) : null}
            <Field label="Minutes">
              <View style={{ width: 150 }}>
                <Input value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 12" keyboardType="number-pad" />
              </View>
            </Field>
            <Field label="Stage after">
              <Chips options={STAGES} value={STAGES[stage]} required onChange={(v) => v && setStageOverride(STAGES.indexOf(v as Stage))} />
            </Field>
          </View>
        )}
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.md, gap: space.sm, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.muted }}>
        <Text variant="caption" tone="muted">
          {stage === target.stage ? "Stays at " : "Moves to "}
          <Text variant="caption" weight="600">
            {STAGES[stage]}
          </Text>
          {followDate ? ` · ${step ? `“${step}” ` : "follow up "}on ${shortDate(followDate, today)}` : " · no follow-up"} · saved to the sheet
        </Text>
        <Button title={saving ? "Saving…" : "Save"} variant="brand" loading={saving} onPress={() => void save()} />
      </View>
      <DatePicker title="Follow up on" visible={picking} onClose={() => setPicking(false)} value={followDate} onPick={setFollowDate} />
    </KeyboardAvoidingView>
  );
}
