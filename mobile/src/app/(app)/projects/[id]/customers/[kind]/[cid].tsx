import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Badge, Button, Card, Divider, Empty, ErrorView, Icon, Input, Loading, Screen, Section, Sheet, Text } from "@/components/ui";
import { addRequest, customerQuery, REQUEST_VIA, setOnboardingStep, type Customer, type CustomerPayload, type CustomerRequest, type Health, type OnboardingStep, type RequestState, type RequestVia } from "@/features/customers/api";
import { Chips, SheetActions } from "@/features/projects/components";
import { StagePill, Warnings } from "@/features/prospects/bits";
import { LogTouchModal, type LogTarget } from "@/features/prospects/log-touch";
import { PROSPECT_KINDS, type ProspectKind } from "@/features/prospects/model";
import { openRecord } from "@/features/prospects/my-work";
import { ago, shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

/** Orange for needs a call, grey for just started, blue for doing fine — as the web's health chip. */
const HEALTH_TONE: Record<Health, "warning" | "neutral" | "brand"> = { "needs-call": "warning", new: "neutral", fine: "brand" };
const STATE_TONE: Record<RequestState, "warning" | "neutral" | "brand"> = { "waiting-us": "warning", "waiting-them": "neutral", answered: "brand" };

/**
 * One customer — the web's customer record in Sales → Customers on a phone:
 * health, the facts (last touch, plan, open requests, stage), onboarding steps
 * to tick, their requests (add one, or open one to reply), check-ins since they
 * became a customer (log one), and "Sales history" to the prospect itself.
 */
export default function CustomerScreen() {
  const { id: projectId, kind: rawKind, cid } = useLocalSearchParams<{ id: string; kind: string; cid: string }>();
  const kind = (PROSPECT_KINDS as readonly string[]).includes(rawKind) ? (rawKind as ProspectKind) : "valuer";
  const q = useQuery(customerQuery(projectId, kind, cid));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <CustomerBody projectId={projectId} data={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function CustomerBody({ projectId, data, refreshing, onRefresh }: { projectId: string; data: CustomerPayload; refreshing: boolean; onRefresh: () => void }) {
  const { c: col, space } = useTheme();
  const c = data.customer;
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [asking, setAsking] = useState(false);
  const facts = [
    { label: "Last touch", value: <Text weight="600">{c.lastTouchLabel}</Text> },
    { label: "Plan", value: <Text weight="600">{c.plan}</Text> },
    { label: "Open requests", value: <Text weight="600">{String(c.openRequests)}</Text> },
    { label: "Stage", value: <StagePill stage={c.stage} /> },
  ];
  const sub = [c.where, c.since ? `Customer since ${shortDate(c.since.date)}` : null, c.owner ? `Owner ${c.owner}` : null].filter(Boolean).join(" · ");

  return (
    <>
      <Stack.Screen options={{ title: c.name }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View style={{ gap: 6 }}>
          <Text variant="heading">{c.name}</Text>
          {sub ? (
            <Text variant="small" tone="muted">
              {sub}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" }}>
            <Badge label={c.healthLabel} tone={HEALTH_TONE[c.health]} dot />
            <Text variant="small" tone="brand" accessibilityRole="link" onPress={() => openRecord(c.kind, c.id)}>
              Sales history →
            </Text>
          </View>
          {c.nextStep ? (
            <Text variant="small">
              <Text variant="small" tone="muted">
                Next step{" "}
              </Text>
              {c.nextStep}
            </Text>
          ) : null}
        </View>

        <Button title="Log a check-in" icon="phone" variant="brand" onPress={() => setLogTarget({ kind: c.kind, id: c.id, name: c.name, stage: c.stage, nextStep: c.nextStep })} />

        {data.warnings.length ? <Warnings warnings={data.warnings} /> : null}

        <Card style={{ flexDirection: "row", flexWrap: "wrap", padding: 0, gap: 0 }}>
          {facts.map((f, i) => (
            <View key={f.label} style={{ width: "50%", padding: space.md, gap: 4, borderTopWidth: i >= 2 ? 1 : 0, borderLeftWidth: i % 2 ? 1 : 0, borderColor: col.border }}>
              <Text variant="caption" tone="muted">
                {f.label}
              </Text>
              {f.value}
            </View>
          ))}
        </Card>

        <Onboarding projectId={projectId} customer={c} today={data.today} />

        <Section title={`Requests · ${c.openRequests} open`} action={<Button size="sm" variant="ghost" icon="plus" title="New request" onPress={() => setAsking(true)} />}>
          {c.requests.length ? (
            <View style={{ gap: space.sm }}>
              {c.requests.map((r) => (
                <RequestCard key={r.id} request={r} onPress={() => router.push({ pathname: "/projects/[id]/tickets/[ticketId]", params: { id: projectId, ticketId: r.id } })} />
              ))}
            </View>
          ) : (
            <Text tone="muted">Nothing asked for yet. Add a request when they ask for something or report a problem.</Text>
          )}
        </Section>

        <Section title={c.touches.length ? `Check-ins · ${c.touches.length}` : "Check-ins"}>
          {c.touches.length ? (
            <Card style={{ padding: 0, gap: 0 }}>
              {c.touches.map((a, i) => (
                <View key={a.id || a.loggedAt}>
                  {i > 0 ? <Divider inset={space.md} /> : null}
                  <View style={{ padding: space.md, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text variant="caption" tone="muted" mono>
                        {a.date ? shortDate(a.date) : "—"}
                      </Text>
                      <Badge label={a.channel || "—"} />
                      <View style={{ flex: 1 }} />
                      {a.outcome ? <Badge label={a.outcome} tone="brand" /> : null}
                    </View>
                    <Text variant="small" tone={a.summary ? "default" : "muted"}>
                      {a.summary || "No notes"}
                    </Text>
                    {a.by ? (
                      <Text variant="caption" tone="muted">
                        {a.by}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Card>
          ) : (
            <Empty icon="phone-call" title="No check-ins yet" body={`Log one after every call, message or visit. It lands in the sheet's Activity tab, and ${c.onboarding.checkInsNeeded} of them tick the onboarding step.`} />
          )}
        </Section>
        <View style={{ height: 48 }} />
      </Screen>

      <LogTouchModal target={logTarget} today={data.today} onClose={() => setLogTarget(null)} onSaved={onRefresh} />
      <NewRequestSheet visible={asking} onClose={() => setAsking(false)} projectId={projectId} customer={c} />
    </>
  );
}

function stepNote(s: OnboardingStep, c: Customer): string {
  if (s.auto) return `Ticked itself · ${c.checkIns} check-ins logged`;
  if (s.doneOn) return `Done ${shortDate(s.doneOn)}`;
  if (s.id === "check-ins") return `${Math.min(c.checkIns, c.onboarding.checkInsNeeded)} of ${c.onboarding.checkInsNeeded} done · ${s.hint.toLowerCase()}`;
  return s.hint;
}

function Onboarding({ projectId, customer: c, today }: { projectId: string; customer: Customer; today: string }) {
  const { c: col, space } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (s: OnboardingStep) => {
    if (s.auto || busy) return;
    setBusy(s.id);
    try {
      await setOnboardingStep(projectId, c.kind, c.id, s.id, !s.done, today);
    } catch (e) {
      Alert.alert("Couldn't save that step", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Section title={`Onboarding · ${c.onboarding.done} of ${c.onboarding.total}`}>
      <Card style={{ padding: 0, gap: 0 }}>
        {c.onboarding.steps.map((s, i) => (
          <View key={s.id}>
            {i > 0 ? <Divider inset={space.md + 30} /> : null}
            <Pressable
              onPress={() => void toggle(s)}
              disabled={s.auto || busy === s.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done, disabled: s.auto || busy === s.id }}
              accessibilityHint={s.auto ? "Ticks itself from logged check-ins" : undefined}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: space.md, opacity: busy === s.id ? 0.6 : 1, backgroundColor: pressed ? col.muted : "transparent" })}
            >
              <Icon name={s.done ? "check-square" : "square"} size={18} color={s.done ? col.brand : col.mutedForeground} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight={s.done ? "400" : "500"} tone={s.done ? "muted" : "default"} style={s.done ? { textDecorationLine: "line-through" } : undefined}>
                  {s.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {stepNote(s, c)}
                </Text>
              </View>
            </Pressable>
          </View>
        ))}
      </Card>
    </Section>
  );
}

function RequestCard({ request: r, onPress }: { request: CustomerRequest; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Badge label={r.stateLabel} tone={STATE_TONE[r.state]} dot />
        {r.viaLabel ? (
          <Text variant="caption" tone="muted">
            {r.viaLabel}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text variant="caption" tone="muted" mono>
          {ago(r.createdAt)}
        </Text>
      </View>
      <Text weight="500">{r.subject}</Text>
      {r.body ? (
        <Text variant="small" tone="muted" numberOfLines={3}>
          “{r.body}”
        </Text>
      ) : null}
      {r.issue ? (
        <Text variant="caption" tone="muted">
          Task #{r.issue.number} · {r.issue.title}
        </Text>
      ) : null}
    </Card>
  );
}

function NewRequestSheet({ visible, onClose, projectId, customer: c }: { visible: boolean; onClose: () => void; projectId: string; customer: Customer }) {
  const { space } = useTheme();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [via, setVia] = useState<RequestVia>("whatsapp");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await addRequest(projectId, c.kind, c.id, { subject: subject.trim(), body: body.trim(), via });
      setSubject("");
      setBody("");
      onClose();
    } catch (e) {
      Alert.alert("Couldn't add the request", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={`New request from ${c.name}`}>
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="What they asked for" placeholder="e.g. Export the report as PDF" value={subject} onChangeText={setSubject} autoFocus />
        <Input label="In their words" placeholder="Optional" value={body} onChangeText={setBody} multiline />
        <Chips value={via} onChange={setVia} options={REQUEST_VIA} />
        <Text variant="caption" tone="muted">
          {"It waits on us, assigned to you, until it's answered."}
        </Text>
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel="Add request" saving={saving} disabled={!subject.trim()} />
      </View>
    </Sheet>
  );
}
