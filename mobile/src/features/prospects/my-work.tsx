import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Badge, Button, Card, Empty, ErrorView, Loading, Segmented, Text } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useTheme } from "@/theme";

import { logTouch, myWorkQuery, saveProspect, type Scope } from "./api";
import { BandBadge, DueChip, fail, Missing, notify } from "./bits";
import { LogTouchModal, type LogTarget } from "./log-touch";
import { DRAFT_CHANNELS, firstName, mailtoHref, quickTouch, QUICK, telHref, whatsappHref, type Channel, type DraftKey, type MyWorkItem, type Quick } from "./model";
import { useReach } from "./reach";

const keyOf = (t: MyWorkItem) => `${t.row.kind}:${t.row.id}`;

export function openRecord(kind: string, id: string) {
  router.push({ pathname: "/prospects/[kind]/[id]", params: { kind, id } });
}

/**
 * Today's queue: follow-ups overdue, then due today, then A-band valuers of
 * yours nobody has contacted. The open task shows its draft and the ways to
 * reach them; one tap on an outcome writes the sheet and schedules the next step.
 */
export function MyWorkView({ scope, header }: { scope: Scope; header: React.ReactElement }) {
  const { space } = useTheme();
  const me = useMe();
  const q = useQuery(myWorkQuery(scope));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ target: LogTarget; channel?: Channel } | null>(null);
  const tasks = q.data?.data ?? [];
  const today = q.data?.today ?? "";
  const current = tasks.find((t) => keyOf(t) === openKey) ?? tasks[0];
  const first = firstName(q.data?.me ?? me.actor?.name ?? "") || "you";

  const targetOf = (t: MyWorkItem): LogTarget => ({ kind: t.row.kind, id: t.row.id, name: t.row.name, stage: t.row.stage, nextStep: t.row.nextStep });
  const reach = useReach((channel) => current && setLog({ target: targetOf(current), channel }));

  const quick = async (t: MyWorkItem, qk: Quick) => {
    setBusy(qk.label);
    try {
      const res = await logTouch(t.row.kind, t.row.id, quickTouch(qk, t.row, today));
      if (qk.extra && t.row.kind === "valuer") await saveProspect(t.row.kind, t.row.id, qk.extra);
      notify(res.message);
      setDone((n) => n + 1);
      const next = tasks.find((x) => x !== t);
      setOpenKey(next ? keyOf(next) : null);
    } catch (e) {
      fail("Couldn't log it", e);
    } finally {
      setBusy(null);
    }
  };

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  return (
    <>
      <FlatList
        data={tasks}
        keyExtractor={keyOf}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingBottom: space.sm }}>
            {header}
            {tasks.length ? (
              <Text variant="small" tone="muted" style={{ paddingHorizontal: space.lg }}>
                {tasks.length} in your queue{done ? ` · ${done} done this session` : ""}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Empty
            icon="sun"
            title={`Nothing due for ${first}`}
            body={`Your queue is the rows assigned to ${first} whose next step is due today or overdue, plus A-band valuers of yours nobody has contacted yet. Pick some up from the List or the Overview.${done ? `\n\n${done} done this session.` : ""}`}
          />
        }
        contentContainerStyle={{ paddingBottom: 96 }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: space.lg }}>
            <TaskCard
              t={item}
              today={today}
              open={item === current}
              busy={item === current ? busy : null}
              onToggle={() => setOpenKey(keyOf(item))}
              onQuick={(qk) => void quick(item, qk)}
              onLog={() => setLog({ target: targetOf(item) })}
              onReach={(href, channel) => {
                setOpenKey(keyOf(item));
                void reach(href, channel);
              }}
            />
          </View>
        )}
      />
      <LogTouchModal target={log?.target ?? null} channel={log?.channel} today={today} onClose={() => setLog(null)} onSaved={() => setDone((n) => n + 1)} />
    </>
  );
}

function TaskCard({ t, today, open, busy, onToggle, onQuick, onLog, onReach }: { t: MyWorkItem; today: string; open: boolean; busy: string | null; onToggle: () => void; onQuick: (q: Quick) => void; onLog: () => void; onReach: (href: string | null, channel: Channel | null) => void }) {
  const { c, space, radius } = useTheme();
  const [tab, setTab] = useState<DraftKey>("whatsapp");
  const draft = t.drafts[tab];
  const call = telHref(t.phone);
  const wa = whatsappHref(t.phone, t.drafts.whatsapp);
  const mail = mailtoHref(t.email, t.drafts.email);
  return (
    <Card style={{ gap: space.md, borderColor: open ? c.foreground : c.border }} onPress={open ? undefined : onToggle}>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="600" numberOfLines={open ? 2 : 1}>
            {t.reason === "new" ? "First contact" : t.row.nextStep || "Follow up"}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {t.row.name} · {t.row.city || t.row.state || t.row.kind.toUpperCase()}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {t.reason === "new" ? <Badge label="New" tone="success" /> : <DueChip date={t.row.nextStepDate} today={today} />}
          <BandBadge band={t.row.band} score={t.row.score} />
        </View>
      </View>
      {t.row.doNotContact ? <Badge label="Research says: do not contact" tone="danger" /> : null}
      {open ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {t.lenders ? <Badge label={`${t.lenders} lender panels`} /> : <Missing>Lenders unknown</Missing>}
            {t.casesPerMonth !== null ? <Badge label={`${t.casesPerMonth} cases / month`} /> : <Missing>Volume unknown — ask</Missing>}
            {t.software ? <Badge label={t.software} /> : <Missing>Software unknown — ask</Missing>}
            {t.pitchAngle ? <Badge label={`Pitch: ${t.pitchAngle}`} tone="brand" /> : null}
          </View>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button size="sm" icon="phone" title="Call" disabled={!call} style={{ flex: 1 }} onPress={() => onReach(call, "Call")} />
            <Button size="sm" icon="message-circle" title="WhatsApp" disabled={!wa} style={{ flex: 1 }} onPress={() => onReach(wa, "WhatsApp")} />
            <Button size="sm" icon="mail" title="Email" disabled={!mail} style={{ flex: 1 }} onPress={() => onReach(mail, null)} />
          </View>
          {!call ? (
            <Text variant="caption" tone="muted">
              No phone number yet — add one on the record.
            </Text>
          ) : null}
          <Segmented value={tab} onChange={setTab} options={DRAFT_CHANNELS.map((d) => ({ value: d.key, label: d.label }))} />
          <Pressable
            onLongPress={() => draft && void Clipboard.setStringAsync(draft).then(() => notify("Draft copied"))}
            style={{ backgroundColor: c.muted, borderRadius: radius.md, padding: space.md, minHeight: 88 }}
          >
            {draft ? (
              <Text variant="small" style={{ lineHeight: 20 }}>
                {draft}
              </Text>
            ) : (
              <Text variant="small" tone="muted">
                No {DRAFT_CHANNELS.find((d) => d.key === tab)!.label} draft yet — the research agents write one per record. You can also write it from the record.
              </Text>
            )}
          </Pressable>
          {draft ? <Button size="sm" variant="ghost" icon="copy" title="Copy draft" style={{ alignSelf: "flex-start" }} onPress={() => void Clipboard.setStringAsync(draft).then(() => notify("Draft copied"))} /> : null}
          <Text variant="small" tone="muted" weight="500">
            How did it go? One tap writes the sheet and schedules the follow-up.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {QUICK.map((qk) => (
              <OutcomeButton key={qk.label} title={qk.label} hint={qk.hint} loading={busy === qk.label} disabled={!!busy} onPress={() => onQuick(qk)} />
            ))}
            <OutcomeButton title="Replied / talked…" hint="log what they said" strong disabled={!!busy} onPress={onLog} />
          </View>
          <Button size="sm" variant="ghost" icon="arrow-up-right" title="Open record" style={{ alignSelf: "flex-start" }} onPress={() => openRecord(t.row.kind, t.row.id)} />
        </>
      ) : null}
    </Card>
  );
}

function OutcomeButton({ title, hint, onPress, disabled, loading, strong }: { title: string; hint: string; onPress: () => void; disabled?: boolean; loading?: boolean; strong?: boolean }) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${hint}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ width: "48.5%", minHeight: 56, borderWidth: 1, borderColor: strong ? c.foreground : c.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8, justifyContent: "center", backgroundColor: pressed ? c.muted : c.card, opacity: disabled && !loading ? 0.5 : 1 })}
    >
      <Text variant="small" weight="600">
        {loading ? "Saving…" : title}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
  );
}
