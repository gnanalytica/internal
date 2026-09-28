import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Badge, Button, Card, Divider, Empty, ErrorView, Field, Icon, IconButton, Loading, Picker, Screen, Section, Segmented, Text } from "@/components/ui";
import { DatePicker } from "@/features/issues/pickers";
import { detailQuery, logTouch, saveProspect, type Detail } from "@/features/prospects/api";
import { BandBadge, Bar, DueChip, fail, notify, StagePill } from "@/features/prospects/bits";
import { EditRow, FieldEditor, type EditSpec } from "@/features/prospects/edit";
import { LogTouchModal, type LogTarget } from "@/features/prospects/log-touch";
import {
  addDays,
  DISQUALIFY_REASONS,
  displayDate,
  DRAFT_CHANNELS,
  FACT_COUNT,
  factsKnown,
  fieldFilled,
  firstName,
  isDoNotContact,
  KIND_LABEL,
  mailtoHref,
  markSentTouch,
  OBJECTIONS,
  parseNoteLines,
  PITCH_ANGLES,
  PROSPECT_KINDS,
  SCORE_COLUMNS,
  STAGES,
  telHref,
  todayIST,
  UNSCORED_KINDS,
  whatsappHref,
  WRITABLE,
  type ActivityEntry,
  type Channel,
  type DraftKey,
  type ProspectKind,
  type ProspectRecord,
} from "@/features/prospects/model";
import { STAGE_COACHING } from "@/features/prospects/playbook";
import { useReach } from "@/features/prospects/reach";
import { useMe } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function ProspectScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const kind = (PROSPECT_KINDS as readonly string[]).includes(params.kind) ? (params.kind as ProspectKind) : null;
  const q = useQuery({ ...detailQuery(kind ?? "valuer", params.id), enabled: !!kind });
  if (!kind) return <Empty icon="alert-circle" title="Not a prospect link" body="This link names a record type the app doesn't know." />;
  if (q.isPending)
    return (
      <>
        <Stack.Screen options={{ title: KIND_LABEL[kind].one }} />
        <Loading />
      </>
    );
  if (q.isError)
    return (
      <>
        <Stack.Screen options={{ title: KIND_LABEL[kind].one }} />
        {(q.error as { status?: number }).status === 404 ? <Empty icon="user-x" title="No longer in the sheet" body={`${params.id} isn't on the ${KIND_LABEL[kind].many} tab any more. It may have been removed or its ID changed.`} /> : <ErrorView error={q.error} onRetry={() => void q.refetch()} />}
      </>
    );
  return <RecordBody kind={kind} detail={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

type Sheet = "stage" | "disqualify" | "date" | null;

function RecordBody({ kind, detail, refreshing, onRefresh }: { kind: ProspectKind; detail: Detail; refreshing: boolean; onRefresh: () => void }) {
  const { c, space } = useTheme();
  const me = useMe();
  const r = detail.record;
  const today = todayIST();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [editing, setEditing] = useState<EditSpec | null>(null);
  const [log, setLog] = useState<{ channel?: Channel } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const has = (col: string) => WRITABLE[kind].has(col);
  const scored = !UNSCORED_KINDS.has(kind);
  const myFirst = firstName(me.actor?.name ?? "");
  const target: LogTarget = { kind, id: r.id, name: r.name, stage: r.stage, nextStep: r.nextStep };
  const reach = useReach((channel) => setLog({ channel }));
  const call = telHref(r.phone);
  const wa = whatsappHref(r.phone, r.drafts.whatsapp);
  const mail = mailtoHref(r.email, r.drafts.email);

  const save = async (patch: Record<string, string | number | null>, label = "save") => {
    setBusy(label);
    try {
      notify((await saveProspect(kind, r.id, patch)).message);
      return true;
    } catch (e) {
      fail("Couldn't save to the sheet", e);
      return false;
    } finally {
      setBusy(null);
    }
  };
  const edit = (spec: EditSpec) => has(spec.col) && setEditing(spec);
  const onFieldSave = async (col: string, value: string | number | null) => {
    if (await save({ [col]: value })) setEditing(null);
  };

  return (
    <>
      <Stack.Screen options={{ title: KIND_LABEL[kind].one, headerRight: () => <IconButton icon="copy" label="Copy ID" onPress={() => void Clipboard.setStringAsync(r.id).then(() => notify("ID copied"))} /> }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View style={{ gap: 4 }}>
          <Text variant="small" tone="muted" mono numberOfLines={1}>
            {r.id}
            {r.city ? ` · ${r.city}` : ""}
          </Text>
          <Text variant="heading">{r.name}</Text>
        </View>

        {isDoNotContact(r.researchNotes) ? (
          <View accessibilityRole="alert" style={{ backgroundColor: c.dangerTint, borderRadius: 8, borderWidth: 1, borderColor: c.destructive, padding: space.md }}>
            <Text weight="600" style={{ color: c.destructive }}>
              {r.researchNotes.trim().split("\n")[0]}
            </Text>
          </View>
        ) : null}

        <Card style={{ paddingVertical: 4 }}>
          <Field label="Status" onPress={() => setSheet("stage")}>
            <StagePill stage={r.stage} />
            {busy === "stage" ? <Text variant="small" tone="muted">Saving…</Text> : null}
          </Field>
          {scored ? (
            <>
              <Divider />
              <Field label="Band">
                <BandBadge band={r.band} score={r.opportunityScore} />
                <FactsMeter r={r} />
              </Field>
            </>
          ) : null}
          <Divider />
          <Field label="Assigned">
            <Text numberOfLines={1} style={{ flex: 1 }}>
              {r.assigned || "Nobody"}
            </Text>
            {myFirst && r.assigned.toLowerCase() !== myFirst.toLowerCase() ? <Button size="sm" title="Assign to me" loading={busy === "assign"} onPress={() => void save({ assigned: myFirst }, "assign")} /> : null}
          </Field>
        </Card>

        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button icon="phone" title="Call" variant="brand" disabled={!call} style={{ flex: 1 }} onPress={() => void reach(call, "Call")} />
            <Button icon="message-circle" title="WhatsApp" disabled={!wa} style={{ flex: 1 }} onPress={() => void reach(wa, "WhatsApp")} />
          </View>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button icon="mail" title="Email" disabled={!mail} style={{ flex: 1 }} onPress={() => void reach(mail, null)} />
            <Button icon="edit-3" title="Log a touch" style={{ flex: 1 }} onPress={() => setLog({})} />
          </View>
          {!call || !r.email ? (
            <Text variant="caption" tone="muted">
              {!call && !r.email ? "No phone or email yet" : !call ? "No phone number yet" : "No email yet"} — research, or add it under What we know.
            </Text>
          ) : null}
          {has("disqualified") ? <Button size="sm" variant="danger" icon="slash" title={r.disqualified ? `Disqualified: ${r.disqualified}` : "Disqualify…"} style={{ alignSelf: "flex-start" }} loading={busy === "disqualify"} onPress={() => setSheet("disqualify")} /> : null}
        </View>

        <NextStep r={r} today={today} busy={busy} onEdit={() => edit({ col: "next_step", label: "Next step", value: r.nextStep })} onDate={(d) => void save({ next_step_date: d }, "date")} onPick={() => setSheet("date")} />

        <StageCoaching r={r} kind={kind} busy={busy === "stage"} onMove={(s) => void save({ status: STAGES[s] }, "stage")} />

        <Section title="What we know">
          <Card style={{ paddingVertical: 2 }}>
            <Facts r={r} kind={kind} onEdit={edit} />
          </Card>
        </Section>

        <Drafts r={r} kind={kind} today={today} onEdit={edit} onReach={(href, ch) => void reach(href, ch)} />

        <Section title="Research notes" action={has("research_notes") ? <Button size="sm" variant="ghost" icon="edit-2" title="Edit" onPress={() => edit({ col: "research_notes", label: "Research notes", value: r.researchNotes, type: "textarea" })} /> : null}>
          <ResearchNotes text={r.researchNotes} />
          {r.scoreGaps ? (
            <View style={{ backgroundColor: c.warningTint, borderRadius: 8, padding: space.md }}>
              <Text variant="small" style={{ color: c.warning }}>
                <Text variant="small" weight="700" style={{ color: c.warning }}>
                  Research next:{" "}
                </Text>
                {r.scoreGaps}
              </Text>
            </View>
          ) : null}
        </Section>

        <ResearchSources r={r} />

        {kind === "valuer" ? <ScoreCard r={r} /> : null}

        <Section title="Activity" action={<Button size="sm" variant="ghost" icon="plus" title="Log" onPress={() => setLog({})} />}>
          <ActivityList items={detail.activity} />
        </Section>

        <Section title="Notes · newest first" action={has("notes") ? <Button size="sm" variant="ghost" icon="edit-2" title="Edit" onPress={() => edit({ col: "notes", label: "Notes", value: r.notes, type: "textarea" })} /> : null}>
          {r.notes ? (
            <Card>
              <Text variant="small" style={{ lineHeight: 20 }}>
                {r.notes}
              </Text>
            </Card>
          ) : (
            <Text tone="muted" variant="small">
              No notes yet. Logging a call adds a dated line here.
            </Text>
          )}
        </Section>

        <Section title="Registration">
          <Card style={{ paddingVertical: 4 }}>
            <Registration r={r} kind={kind} />
          </Card>
        </Section>
      </Screen>

      <Picker visible={sheet === "stage"} onClose={() => setSheet(null)} title="Status" value={String(r.stage)} options={STAGES.map((s, i) => ({ value: String(i), label: s, leading: <StagePill stage={i} /> }))} onPick={(v) => Number(v) !== r.stage && void save({ status: STAGES[Number(v)] }, "stage")} />
      <Picker
        visible={sheet === "disqualify"}
        onClose={() => setSheet(null)}
        title="Disqualify"
        value={r.disqualified || "__no"}
        options={[{ value: "__no", label: "Not disqualified" }, ...DISQUALIFY_REASONS.map((d) => ({ value: d, label: d }))]}
        onPick={(v) => void save({ disqualified: v === "__no" ? "" : v }, "disqualify")}
      />
      <DatePicker title="Next step date" visible={sheet === "date"} onClose={() => setSheet(null)} value={r.nextStepDate} onPick={(v) => void save({ next_step_date: v }, "date")} />
      <FieldEditor spec={editing} onClose={() => setEditing(null)} onSave={onFieldSave} />
      <LogTouchModal target={log ? target : null} channel={log?.channel} today={today} onClose={() => setLog(null)} />
    </>
  );
}

function FactsMeter({ r }: { r: ProspectRecord }) {
  const n = factsKnown(r);
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }} accessibilityLabel={`${n} of ${FACT_COUNT} facts known`}>
      <View style={{ width: 60 }}>
        <Bar value={n} max={FACT_COUNT} height={6} />
      </View>
      <Text variant="caption" tone="muted">
        {n}/{FACT_COUNT} facts
      </Text>
    </View>
  );
}

function NextStep({ r, today, busy, onEdit, onDate, onPick }: { r: ProspectRecord; today: string; busy: string | null; onEdit: () => void; onDate: (d: string) => void; onPick: () => void }) {
  const { c, space, radius } = useTheme();
  const quick: [string, number][] = [
    ["Tomorrow", 1],
    ["+3 days", 3],
    ["Next week", 7],
  ];
  return (
    <View style={{ backgroundColor: c.muted, borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="small" tone="muted" weight="600" style={{ flex: 1, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Next step
        </Text>
        {busy === "date" ? <Text variant="caption" tone="muted">Saving…</Text> : <DueChip date={r.nextStepDate} today={today} />}
      </View>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit next step" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}>
        <Text weight="500" style={{ flex: 1 }} tone={r.nextStep ? "default" : "muted"}>
          {r.nextStep || "No next step set"}
        </Text>
        <Icon name="edit-2" size={14} color={c.mutedForeground} />
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {quick.map(([label, d]) => (
          <Button key={label} size="sm" title={label} disabled={busy === "date"} onPress={() => onDate(addDays(today, d))} />
        ))}
        <Button size="sm" icon="calendar" title="Pick…" disabled={busy === "date"} onPress={onPick} />
      </View>
    </View>
  );
}

/** The stage path's coaching for the current stage, and the button that moves it on. */
function StageCoaching({ r, kind, busy, onMove }: { r: ProspectRecord; kind: ProspectKind; busy: boolean; onMove: (stage: number) => void }) {
  const { c, space } = useTheme();
  const coach = STAGE_COACHING[r.stage];
  if (!coach) return null;
  const fields = coach.fields.filter((f) => !UNSCORED_KINDS.has(kind) || WRITABLE[kind].has(f));
  return (
    <Section title={`How to win “${STAGES[r.stage]}”`}>
      <Card>
        {coach.tips.map((t) => (
          <View key={t} style={{ flexDirection: "row", gap: 8 }}>
            <Icon name="check" size={14} color={c.success} style={{ paddingTop: 3 }} />
            <Text variant="small" style={{ flex: 1 }}>
              {t}
            </Text>
          </View>
        ))}
        {fields.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.xs }}>
            {fields.map((f) => (
              <Badge key={f} label={`${f} ${fieldFilled(r, f) ? "✓" : "empty"}`} tone={fieldFilled(r, f) ? "success" : "danger"} />
            ))}
          </View>
        ) : null}
        {r.stage < 5 ? <Button size="sm" variant="primary" title={`Move to ${STAGES[r.stage + 1]}`} loading={busy} style={{ alignSelf: "flex-start", marginTop: space.xs }} onPress={() => onMove(r.stage + 1)} /> : null}
      </Card>
    </Section>
  );
}

function Facts({ r, kind, onEdit }: { r: ProspectRecord; kind: ProspectKind; onEdit: (s: EditSpec) => void }) {
  const has = (col: string) => WRITABLE[kind].has(col);
  const rows: (EditSpec & { missing?: string })[] = [
    ...(has("contact_person") ? [{ col: "contact_person", label: "Contact person", value: r.bank.contactPerson, missing: "Not named yet" }] : []),
    ...(has("designation") ? [{ col: "designation", label: "Designation", value: r.bank.designation, missing: "Not known" }] : []),
    { col: "phone", label: "Phone", value: r.phone },
    { col: "email", label: "Email", value: r.email },
    ...(has("lenders_empanelled_with") ? [{ col: "lenders_empanelled_with", label: "Lenders", value: r.lenders.join("; "), type: "textarea" as const }] : []),
    ...(has("lb_cases_per_month") ? [{ col: "lb_cases_per_month", label: "L&B cases / month", value: r.casesPerMonth === null ? "" : String(r.casesPerMonth), type: "number" as const }] : []),
    ...(has("current_software") ? [{ col: "current_software", label: "Current software", value: r.software }] : []),
    ...(has("pitch_angle") ? [{ col: "pitch_angle", label: "Pitch angle", value: r.pitchAngle, type: "select" as const, options: PITCH_ANGLES, missing: "Not picked yet" }] : []),
    ...(has("objections") ? [{ col: "objections", label: "Objection", value: r.objections, type: "select" as const, options: OBJECTIONS, missing: "None recorded" }] : []),
    { col: "assigned", label: "Assigned", value: r.assigned, missing: "Nobody" },
    ...(has("outreach_route") ? [{ col: "outreach_route", label: "Outreach route", value: r.outreachRoute, missing: "Not planned" }] : []),
    ...(has("key_contact") ? [{ col: "key_contact", label: "Key contact", value: r.keyContact, missing: "Not known" }] : []),
    ...(has("referred_by") ? [{ col: "referred_by", label: "Referred by", value: r.referredBy, missing: "—" }] : []),
    ...(has("city") ? [{ col: "city", label: "City", value: r.city }] : []),
  ];
  return (
    <>
      {rows.map((f, i) => (
        <View key={f.col}>
          {i > 0 ? <Divider /> : null}
          <EditRow label={f.label} value={f.value} missing={f.missing} editable={has(f.col)} onEdit={() => onEdit(f)} />
        </View>
      ))}
    </>
  );
}

function Drafts({ r, kind, today, onEdit, onReach }: { r: ProspectRecord; kind: ProspectKind; today: string; onEdit: (s: EditSpec) => void; onReach: (href: string | null, ch: Channel | null) => void }) {
  const { c, space, radius } = useTheme();
  const channels = DRAFT_CHANNELS.filter((d) => WRITABLE[kind].has(d.col));
  const [tab, setTab] = useState<DraftKey>(channels[0]?.key ?? "whatsapp");
  const [sending, setSending] = useState(false);
  if (!channels.length) return null;
  const ch = channels.find((d) => d.key === tab) ?? channels[0];
  const text = r.drafts[ch.key];
  const href = ch.key === "whatsapp" ? whatsappHref(r.phone, text) : ch.key === "email" ? mailtoHref(r.email, text) : ch.key === "call" ? telHref(r.phone) : null;
  const done = ch.key === "call" || ch.key === "meeting";
  const markSent = async () => {
    setSending(true);
    try {
      notify((await logTouch(kind, r.id, markSentTouch(ch.key, r, today))).message);
    } catch (e) {
      fail("Couldn't log it", e);
    } finally {
      setSending(false);
    }
  };
  return (
    <Section title="Draft to send" action={<Button size="sm" variant="ghost" icon="edit-2" title="Edit" onPress={() => onEdit({ col: ch.col, label: `${ch.label} draft`, value: text, type: "textarea" })} />}>
      {channels.length > 1 ? <Segmented value={ch.key} onChange={setTab} options={channels.map((d) => ({ value: d.key, label: d.label }))} /> : null}
      <Pressable onLongPress={() => text && void Clipboard.setStringAsync(text).then(() => notify("Draft copied"))} style={{ backgroundColor: c.muted, borderRadius: radius.md, padding: space.md, minHeight: 72 }}>
        {text ? (
          <Text variant="small" style={{ lineHeight: 20 }}>
            {text}
          </Text>
        ) : (
          <Text variant="small" tone="muted">
            No {ch.label} draft yet — the research agents write one per record. Tap Edit to write one.
          </Text>
        )}
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {text ? <Button size="sm" icon="copy" title="Copy" onPress={() => void Clipboard.setStringAsync(text).then(() => notify("Draft copied"))} /> : null}
        {href ? <Button size="sm" icon="arrow-up-right" title={ch.key === "call" ? "Call" : `Open in ${ch.label}`} onPress={() => onReach(href, ch.channel === "Email" ? null : ch.channel)} /> : null}
        <Button size="sm" variant="primary" icon="check" title={done ? "Mark done" : "Mark sent"} loading={sending} onPress={() => void markSent()} />
      </View>
    </Section>
  );
}

function ResearchNotes({ text }: { text: string }) {
  const { space } = useTheme();
  const [all, setAll] = useState(false);
  const lines = parseNoteLines(text);
  if (!lines.length)
    return (
      <Text variant="small" tone="muted">
        Nothing yet — research adds findings here, one per line.
      </Text>
    );
  const limit = 6;
  const shown = all ? lines : lines.slice(0, limit);
  return (
    <Card style={{ gap: space.sm }}>
      {shown.map((l, i) =>
        l.label ? (
          <Text key={i} variant="small">
            <Text variant="small" tone="muted" weight="600">
              {l.label}:
            </Text>{" "}
            {l.text}
          </Text>
        ) : (
          <Text key={i} variant="small" tone={l.text.startsWith("- ") ? "default" : "muted"} style={l.text.startsWith("- ") ? { paddingLeft: 10 } : undefined}>
            {l.text}
          </Text>
        ),
      )}
      {lines.length > limit ? <Button size="sm" variant="ghost" title={all ? "Show less" : `Show all ${lines.length} lines`} style={{ alignSelf: "flex-start" }} onPress={() => setAll((v) => !v)} /> : null}
    </Card>
  );
}

function ResearchSources({ r }: { r: ProspectRecord }) {
  const { c } = useTheme();
  return (
    <Section title="Research" action={<Badge label={r.researchStatus || "Not started"} />}>
      <Text variant="caption" tone="muted">
        {r.lastResearched ? `Last researched ${displayDate(r.lastResearched)}` : "Never researched"}
      </Text>
      {r.researchSources.length ? (
        <Card style={{ paddingVertical: 4, gap: 0 }}>
          {r.researchSources.map((s, i) => {
            const url = /^https?:/i.test(s.url) ? s.url : `https://${s.url}`;
            return (
              <View key={i}>
                {i > 0 ? <Divider /> : null}
                <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
                  <Text variant="caption" tone="muted" mono style={{ width: 64 }} numberOfLines={1}>
                    {s.what || "source"}
                  </Text>
                  <Text variant="small" tone="brand" numberOfLines={2} style={{ flex: 1 }}>
                    {s.url}
                  </Text>
                  <Icon name="external-link" size={14} color={c.mutedForeground} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : (
        <Text variant="small" tone="muted">
          No sources yet.
        </Text>
      )}
    </Section>
  );
}

function ScoreCard({ r }: { r: ProspectRecord }) {
  return (
    <Section title="Score" action={<Text variant="small" mono>{`${r.opportunityScore ?? "—"}/100 · ${r.bandLabel || "not scored"}`}</Text>}>
      <Card>
        {SCORE_COLUMNS.map((s, i) => (
          <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text variant="small" style={{ width: 132 }} numberOfLines={1}>
              {s.label}
            </Text>
            <Bar value={r.scores[i] ?? 0} max={s.max} />
            <Text variant="caption" mono style={{ width: 40, textAlign: "right" }}>
              {r.scores[i] ?? "–"}/{s.max}
            </Text>
          </View>
        ))}
        <Text variant="caption" tone="muted">
          switching_barrier {r.switchingBarrier ?? 0} · disqualified {r.disqualified || "No"}
        </Text>
        {r.scoreReason ? (
          <Text variant="small">
            <Text variant="small" weight="700">
              Why:{" "}
            </Text>
            {r.scoreReason}
          </Text>
        ) : null}
      </Card>
    </Section>
  );
}

function ActivityList({ items }: { items: ActivityEntry[] }) {
  const { space } = useTheme();
  if (!items.length)
    return (
      <Text variant="small" tone="muted">
        Nothing logged yet. Every call or message you log lands here and in the sheet&apos;s Activity tab.
      </Text>
    );
  return (
    <Card style={{ paddingVertical: 4, gap: 0 }}>
      {items.map((a, i) => (
        <View key={a.id || `${a.loggedAt}:${i}`}>
          {i > 0 ? <Divider /> : null}
          <View style={{ paddingVertical: space.sm + 2, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Badge label={a.channel || "—"} tone="brand" />
              <Text variant="small" weight="600" style={{ flex: 1 }} numberOfLines={1}>
                {a.outcome}
                {a.durationMin ? ` · ${a.durationMin} min` : ""}
              </Text>
              <Text variant="caption" tone="muted" mono>
                {a.loggedAt}
              </Text>
            </View>
            {a.summary ? <Text variant="small">{a.summary}</Text> : null}
            <Text variant="caption" tone="muted">
              {firstName(a.by) || "Someone"}
              {a.statusAfter ? ` · status → ${a.statusAfter}` : ""}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

function Registration({ r, kind }: { r: ProspectRecord; kind: ProspectKind }) {
  const rows: [string, string][] = [
    [kind === "panel" || kind === "bank" ? "ID" : "Registration", r.id],
    ["State", r.state],
    ["Address", r.address],
    ...(kind === "valuer" ? ([["RVO", r.rvo], ["Registered", r.registeredOn], ["Firm", r.firmRegNo ? `${r.firmRegNo}${r.firmStatus ? ` · firm is ${r.firmStatus}` : ""}` : "—"]] as [string, string][]) : []),
    ...(kind === "firm" ? ([["RVO", r.rvo], ["Directors / partners", r.people]] as [string, string][]) : []),
    ...(kind === "rvo" ? ([["Website", r.website], ["Chair / president", r.keyContact], ["CEO / MD", r.people]] as [string, string][]) : []),
    ...(kind === "panel" ? ([["City", r.city], ["Practice", r.practice], ["IBBI", "Not on the IBBI register"]] as [string, string][]) : []),
    ...(kind === "bank"
      ? ([
          ["Institution", r.bank.institution],
          ["Type", r.bank.type],
          ["Office", r.bank.office],
          ["Department", r.bank.department],
          ["City", r.city],
          ["Empanelment", r.bank.empanelmentWindow],
          ["Panel page", r.bank.empanelmentPage],
          ["How to reach", r.bank.howToReach],
          ["Website", r.website],
        ] as [string, string][])
      : []),
    ["Last contacted", r.lastContacted ? displayDate(r.lastContacted) : "Never"],
  ];
  return (
    <>
      {rows.map(([k, v], i) => (
        <View key={k}>
          {i > 0 ? <Divider /> : null}
          <View style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}>
            <Text variant="small" tone="muted" style={{ width: 112 }}>
              {k}
            </Text>
            <Text variant="small" selectable style={{ flex: 1 }} tone={/^https?:\/\//.test(v) ? "brand" : "default"} onPress={/^https?:\/\//.test(v) ? () => void Linking.openURL(v) : undefined}>
              {v || "—"}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}
