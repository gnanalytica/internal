import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Badge, Button, Card, Divider, Empty, ErrorView, Loading, Segmented, Text } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useTheme } from "@/theme";

import { logTouch, myWorkQuery, saveProspect, type Scope } from "./api";
import { DueChip, fail, Missing, notify } from "./bits";
import { LogTouchModal, type LogTarget } from "./log-touch";
import {
  defaultDraftTab,
  DRAFT_TABS,
  firstName,
  KIND_LABEL,
  mailtoHref,
  missingFacts,
  quickOptions,
  quickTouch,
  STAGES,
  telHref,
  TODAY_GROUPS,
  whatsappHref,
  type Channel,
  type DraftTab,
  type MyWorkItem,
  type Outcome,
  type Quick,
} from "./model";
import { useReach } from "./reach";

const keyOf = (t: MyWorkItem) => `${t.row.kind}:${t.row.id}`;

export function openRecord(kind: string, id: string) {
  router.push({ pathname: "/prospects/[kind]/[id]", params: { kind, id } });
}

type Entry = { type: "group"; key: string; title: string; count: number } | { type: "task"; key: string; t: MyWorkItem };

/**
 * Today — the web's Today on a phone. The open prospect sits on top with its
 * draft, the ways to reach them and one-tap outcomes; the rest of the queue
 * (overdue, due today, first contact) is listed below it.
 */
export function MyWorkView({ scope, header, onFind }: { scope: Scope; header: React.ReactElement; onFind: () => void }) {
  const { space } = useTheme();
  const me = useMe();
  const q = useQuery(myWorkQuery(scope));
  const listRef = useRef<FlatList<Entry>>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [selKey, setSelKey] = useState<string | null>(null);
  // null follows the record: the first channel research wrote a draft for.
  const [picked, setTab] = useState<DraftTab | null>(null);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ target: LogTarget; key: string; channel?: Channel; outcome?: Outcome } | null>(null);

  const all = q.data?.data;
  const tasks = useMemo(() => {
    const list = all ?? [];
    return [...list.filter((t) => !skipped.has(keyOf(t))), ...list.filter((t) => skipped.has(keyOf(t)))];
  }, [all, skipped]);
  const today = q.data?.today ?? "";
  const current = tasks.find((t) => keyOf(t) === selKey) ?? tasks[0];
  const tab: DraftTab = picked ?? (current ? defaultDraftTab(current.drafts) : "whatsapp");
  const channel: Channel = DRAFT_TABS.find((d) => d.key === tab)!.channel;
  const first = firstName(q.data?.me ?? me.actor?.name ?? "") || "you";
  const total = tasks.length + done;

  const reach = useReach(() => notify("How did it go? Tap an outcome to log it."));

  const select = (key: string | null, scroll = false) => {
    setSelKey(key);
    setTab(null);
    if (scroll) listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };
  const advanceFrom = (key: string) => {
    const next = tasks.find((t) => keyOf(t) !== key);
    select(next ? keyOf(next) : null);
  };

  const quick = async (t: MyWorkItem, qk: Quick) => {
    if (qk.log) {
      setLog({ target: { kind: t.row.kind, id: t.row.id, name: t.row.name, stage: t.row.stage, nextStep: t.row.nextStep }, key: keyOf(t), channel, outcome: qk.outcome });
      return;
    }
    setBusy(qk.label);
    try {
      const res = await logTouch(t.row.kind, t.row.id, quickTouch(qk, channel, t.row, today));
      if (qk.extra && t.row.kind === "valuer") await saveProspect(t.row.kind, t.row.id, qk.extra);
      notify(res.message);
      setDone((n) => n + 1);
      advanceFrom(keyOf(t));
    } catch (e) {
      fail("Couldn't log it", e);
    } finally {
      setBusy(null);
    }
  };

  const entries = useMemo<Entry[]>(
    () =>
      TODAY_GROUPS.flatMap((g) => {
        const items = tasks.filter((t) => t.reason === g.reason);
        if (!items.length) return [];
        return [{ type: "group" as const, key: `group:${g.reason}`, title: g.title, count: items.length }, ...items.map((t) => ({ type: "task" as const, key: keyOf(t), t }))];
      }),
    [tasks],
  );

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  return (
    <>
      <FlatList
        ref={listRef}
        data={entries}
        keyExtractor={(e) => e.key}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingBottom: space.sm }}>
            {header}
            {current ? (
              <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
                <Progress done={done} total={total} />
                <CurrentCard
                  t={current}
                  tab={tab}
                  channel={channel}
                  busy={busy}
                  onTab={setTab}
                  onSkip={() => {
                    const key = keyOf(current);
                    setSkipped((s) => new Set(s).add(key));
                    advanceFrom(key);
                  }}
                  onQuick={(qk) => void quick(current, qk)}
                  onReach={(href) => void reach(href, channel === "Email" ? null : channel)}
                />
                <Text variant="small" weight="600" style={{ paddingTop: space.sm }}>
                  Your queue
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Empty
            icon="sun"
            title={done ? `All done, ${first}` : `Nothing due for ${first}`}
            body={`${done ? `${done} logged this session. ` : ""}Today fills with follow-ups assigned to you that are due, plus A-band valuers of yours nobody has contacted yet.`}
            action={<Button title="Pick up A-band prospects" style={{ marginTop: space.sm }} onPress={onFind} />}
          />
        }
        contentContainerStyle={{ paddingBottom: 96 }}
        renderItem={({ item }) =>
          item.type === "group" ? (
            <Text variant="caption" tone="muted" weight="600" style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 6 }}>
              {item.title}{" "}
              <Text variant="caption" tone="muted" mono>
                {item.count}
              </Text>
            </Text>
          ) : (
            <QueueRow t={item.t} today={today} on={item.t === current} skipped={skipped.has(item.key)} onPress={() => select(item.key, true)} />
          )
        }
      />
      <LogTouchModal
        target={log?.target ?? null}
        channel={log?.channel}
        outcome={log?.outcome}
        today={today}
        onClose={() => setLog(null)}
        onSaved={() => {
          setDone((n) => n + 1);
          if (log) advanceFrom(log.key);
        }}
      />
    </>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const { c, space } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text variant="title">Your day</Text>
        <Text variant="small" tone="muted">
          {done} of {total} done
        </Text>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.muted, overflow: "hidden" }}>
        <View style={{ width: `${total ? (done / total) * 100 : 0}%`, height: "100%", borderRadius: 2, backgroundColor: c.foreground }} />
      </View>
    </View>
  );
}

function QueueRow({ t, today, on, skipped, onPress }: { t: MyWorkItem; today: string; on: boolean; skipped: boolean; onPress: () => void }) {
  const { c, space, radius } = useTheme();
  const sub = t.reason === "new" ? t.row.pitchAngle || t.row.city || t.row.state || "First message" : t.row.nextStep || "Follow up";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, marginHorizontal: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: on || pressed ? c.muted : "transparent", opacity: skipped ? 0.5 : 1 })}
    >
      <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: c.mutedForeground }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="small" weight="600" numberOfLines={1}>
          {t.row.name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {t.reason === "new" ? (
        <Text variant="caption" tone="muted" mono>
          {t.row.kind.slice(0, 3).toUpperCase()}
        </Text>
      ) : (
        <DueChip date={t.row.nextStepDate} today={today} />
      )}
    </Pressable>
  );
}

function CurrentCard({ t, tab, channel, busy, onTab, onSkip, onQuick, onReach }: { t: MyWorkItem; tab: DraftTab; channel: Channel; busy: string | null; onTab: (t: DraftTab) => void; onSkip: () => void; onQuick: (q: Quick) => void; onReach: (href: string | null) => void }) {
  const { c, space, radius } = useTheme();
  const r = t.row;
  const draft = t.drafts[tab];
  const label = DRAFT_TABS.find((d) => d.key === tab)!.label;
  const href = tab === "whatsapp" ? whatsappHref(t.phone, draft) : tab === "email" ? mailtoHref(t.email, draft) : telHref(t.phone);
  const copy = () => void Clipboard.setStringAsync(draft).then(() => notify("Draft copied"));
  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ gap: 4 }}>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {KIND_LABEL[r.kind].one}
          {r.city ? ` · ${r.city}` : ""} · {STAGES[r.stage] ?? STAGES[0]}
        </Text>
        <Text variant="heading">{r.name}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {t.lenders ? <Badge label={`${t.lenders} lender panels`} /> : null}
          {t.software ? <Badge label={t.software} /> : null}
          {t.casesPerMonth !== null ? <Badge label={`${t.casesPerMonth} cases / month`} /> : null}
          {missingFacts(t).map((m) => (
            <Missing key={m}>{m}</Missing>
          ))}
        </View>
        {r.doNotContact ? <Badge label="Research says: do not contact" tone="danger" /> : null}
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button size="sm" icon="arrow-up-right" title="Open record" onPress={() => openRecord(r.kind, r.id)} />
        <Button size="sm" variant="ghost" title="Skip" onPress={onSkip} />
      </View>

      {r.nextStep || r.pitchAngle ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm, backgroundColor: c.muted, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md }}>
          <View style={{ backgroundColor: c.background, borderRadius: radius.sm, borderWidth: 0.5, borderColor: c.border, paddingHorizontal: 6, paddingVertical: 1 }}>
            <Text variant="caption">{t.reason === "new" ? "First contact" : "Next step"}</Text>
          </View>
          <Text variant="small" style={{ flex: 1 }}>
            {r.nextStep || `Lead with: ${r.pitchAngle}`}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Segmented value={tab} onChange={onTab} options={DRAFT_TABS.map((d) => ({ value: d.key, label: d.label }))} />
        <Pressable onLongPress={draft ? copy : undefined} style={{ borderWidth: 0.5, borderColor: c.border, borderRadius: radius.md, padding: space.md, minHeight: 96 }}>
          {draft ? (
            <Text variant="small" style={{ lineHeight: 20 }}>
              {draft}
            </Text>
          ) : (
            <Text variant="small" tone="muted">
              No {tab === "call" ? "call script" : `${label} draft`} yet. Research writes one per record; you can also write one from the record.
            </Text>
          )}
        </Pressable>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {href ? <Button size="sm" variant="primary" icon={tab === "call" ? "phone" : tab === "email" ? "mail" : "message-circle"} title={tab === "call" ? "Call now" : tab === "email" ? "Open in Mail" : "Open in WhatsApp"} onPress={() => onReach(href)} /> : null}
          {draft ? <Button size="sm" icon="copy" title="Copy" onPress={copy} /> : null}
        </View>
      </View>

      <Divider />
      <View style={{ gap: space.sm }}>
        <View style={{ gap: 2 }}>
          <Text variant="small" weight="600">
            How did it go?
          </Text>
          <Text variant="caption" tone="muted">
            One tap logs it, sets the follow-up and moves you on
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {quickOptions(channel).map((qk) => (
            <OutcomeButton key={qk.label} title={qk.label} hint={qk.hint} loading={busy === qk.label} disabled={!!busy} onPress={() => onQuick(qk)} />
          ))}
        </View>
      </View>
    </Card>
  );
}

function OutcomeButton({ title, hint, onPress, disabled, loading }: { title: string; hint: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${hint}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ width: "48.5%", minHeight: 56, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8, justifyContent: "center", backgroundColor: pressed ? c.muted : c.card, opacity: disabled && !loading ? 0.5 : 1 })}
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
