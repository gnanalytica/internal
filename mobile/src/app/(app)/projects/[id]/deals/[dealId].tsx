import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Card, Divider, Empty, ErrorView, Field, Icon, IconButton, Loading, Screen, Section, Text } from "@/components/ui";
import { activitiesQuery, contactsQuery, createRecord, dealsQuery, deleteRecord, patchRecord, type Deal } from "@/features/business/api";
import { ACTIVITY_ICON, ACTIVITY_TYPES, DEAL_STAGES, ENTITIES, entityCurrency, optionOf } from "@/features/business/constants";
import { ContactActions } from "@/features/business/contact-actions";
import { FormSheet, type FieldSpec, type FormValues } from "@/features/business/form-sheet";
import { useAccountOptions, useContactOptions, useMemberName, useMemberOptions } from "@/features/business/pick-options";
import { dealValue } from "@/features/business/sales/pipeline";
import { day, dayLabel, Dot, dueOf, HeaderTitle, Restricted } from "@/features/business/ui";
import { useMe } from "@/lib/auth";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

type Editing = "name" | "stage" | "value" | "expectedClose" | "account" | "contact" | "owner" | null;

export default function DealScreen() {
  const { id, dealId } = useLocalSearchParams<{ id: string; dealId: string }>();
  const me = useMe();
  const q = useQuery({ ...dealsQuery(id), enabled: me.isAdmin });
  if (!me.isAdmin) return <Restricted title="Sales is for workspace admins" body="Deals are only open to admins." />;
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const deal = q.data.find((d) => d.id === dealId);
  if (!deal)
    return (
      <>
        <Stack.Screen options={{ title: "Deal" }} />
        <Empty icon="search" title="This deal isn't here any more" body="It may have been deleted or moved to another project." />
      </>
    );
  return <DealBody projectId={id} deal={deal} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function DealBody({ projectId, deal, refreshing, onRefresh }: { projectId: string; deal: Deal; refreshing: boolean; onRefresh: () => void }) {
  const { c, space } = useTheme();
  const [editing, setEditing] = useState<Editing>(null);
  const [logType, setLogType] = useState<string>("call");
  const [logBody, setLogBody] = useState("");
  const [sending, setSending] = useState(false);
  const activities = useQuery(activitiesQuery(deal.id));
  const contacts = useQuery(contactsQuery).data ?? [];
  const accounts = useAccountOptions();
  const contactOptions = useContactOptions(deal.account?.id ?? null);
  const members = useMemberOptions();
  const memberName = useMemberName();
  const contact = contacts.find((x) => x.id === deal.contact?.id);
  const stage = optionOf(DEAL_STAGES, deal.stage);
  const close = deal.stage === "won" || deal.stage === "lost" ? null : dueOf(deal.expectedClose);
  const currency = entityCurrency(deal.entity);

  const save = (patch: Record<string, unknown>, display: Record<string, unknown> = {}) => patchRecord("deals", deal.id, patch, display);

  const spec: Record<Exclude<Editing, null>, { title: string; fields: FieldSpec[]; initial: FormValues; submit: (v: FormValues) => Promise<void> }> = {
    name: { title: "Deal name", fields: [{ key: "name", label: "Deal name", kind: "text", required: true }], initial: { name: deal.name }, submit: (v) => save({ name: v.name }) },
    stage: { title: "Stage", fields: [{ key: "stage", label: "Stage", kind: "choice", options: DEAL_STAGES }], initial: { stage: deal.stage }, submit: (v) => save({ stage: v.stage }) },
    value: {
      title: "Value",
      fields: [
        { key: "value", label: "Value", kind: "money", currency: (v) => entityCurrency(v.entity as string | null) },
        { key: "entity", label: "Entity", kind: "choice", options: ENTITIES, hint: "Sets the currency the value is in." },
      ],
      initial: { value: deal.value, entity: deal.entity },
      submit: (v) => save({ value: v.value ?? 0, entity: v.entity }),
    },
    expectedClose: { title: "Expected close", fields: [{ key: "expectedClose", label: "Expected close", kind: "date" }], initial: { expectedClose: day(deal.expectedClose) }, submit: (v) => save({ expectedClose: v.expectedClose }) },
    account: {
      title: "Account",
      fields: [{ key: "accountId", label: "Account", kind: "choice", options: accounts, noneLabel: "No account" }],
      initial: { accountId: deal.account?.id ?? null },
      submit: (v) => {
        const a = accounts.find((o) => o.value === v.accountId);
        return save({ accountId: v.accountId }, { account: a ? { id: a.value, name: a.label } : null });
      },
    },
    contact: {
      title: "Contact",
      fields: [{ key: "contactId", label: "Contact", kind: "choice", options: contactOptions, noneLabel: "No contact" }],
      initial: { contactId: deal.contact?.id ?? null },
      submit: (v) => {
        const o = contactOptions.find((x) => x.value === v.contactId);
        return save({ contactId: v.contactId }, { contact: o ? { id: o.value, name: o.label } : null });
      },
    },
    owner: { title: "Owner", fields: [{ key: "ownerId", label: "Owner", kind: "choice", options: members, noneLabel: "No owner" }], initial: { ownerId: deal.ownerId }, submit: (v) => save({ ownerId: v.ownerId }) },
  };
  const open = editing ? spec[editing] : null;

  const log = async () => {
    if (!logBody.trim()) return;
    setSending(true);
    try {
      await createRecord("activities", { type: logType, body: logBody.trim(), dealId: deal.id, accountId: deal.account?.id ?? null, contactId: deal.contact?.id ?? null, projectId });
      setLogBody("");
    } catch (e) {
      Alert.alert("Couldn't log it", (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const remove = () =>
    Alert.alert("Delete this deal?", "Its activity log goes with it. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRecord("deals", deal.id);
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete", (e as Error).message);
          }
        },
      },
    ]);

  const log_ = (activities.data ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: deal.name, headerTitle: () => <HeaderTitle title="Deal" project={deal.project?.name} />, headerRight: () => <IconButton icon="trash-2" label="Delete deal" color={c.destructive} onPress={remove} /> }} />
      <Screen refreshing={refreshing || activities.isRefetching} onRefresh={() => { onRefresh(); void activities.refetch(); }}>
        <Pressable onPress={() => setEditing("name")} accessibilityHint="Rename the deal">
          <Text variant="heading">{deal.name}</Text>
          <Text variant="display" mono style={{ marginTop: 4 }}>
            {dealValue(deal)}
          </Text>
        </Pressable>

        <Card style={{ paddingVertical: 4 }}>
          <Field label="Stage" onPress={() => setEditing("stage")}>
            <Dot color={stage.color} />
            <Text>{stage.label}</Text>
          </Field>
          <Divider />
          <Field label="Value" onPress={() => setEditing("value")}>
            <Text mono>{dealValue(deal)}</Text>
            <Text tone="muted" variant="small">
              {deal.entity} · {currency}
            </Text>
          </Field>
          <Divider />
          <Field label="Expected close" onPress={() => setEditing("expectedClose")}>
            <Text style={{ color: close?.late ? c.destructive : c.foreground }}>{deal.expectedClose ? `${dayLabel(deal.expectedClose)}${close ? ` · ${close.text}` : ""}` : "—"}</Text>
          </Field>
          <Divider />
          <Field label="Account" onPress={() => setEditing("account")}>
            <Text numberOfLines={1} tone={deal.account ? "default" : "muted"}>
              {deal.account?.name ?? "No account"}
            </Text>
          </Field>
          <Divider />
          <Field label="Contact" onPress={() => setEditing("contact")}>
            <Text numberOfLines={1} tone={deal.contact ? "default" : "muted"}>
              {deal.contact?.name ?? "No contact"}
            </Text>
          </Field>
          <Divider />
          <Field label="Owner" onPress={() => setEditing("owner")}>
            {deal.ownerId ? <Avatar name={memberName(deal.ownerId)} seed={deal.ownerId} size={22} /> : null}
            <Text numberOfLines={1} tone={deal.ownerId ? "default" : "muted"}>
              {memberName(deal.ownerId) ?? "No owner"}
            </Text>
          </Field>
        </Card>

        {contact && (contact.phone || contact.email) ? (
          <Section title={`Reach ${contact.name.split(" ")[0]}`}>
            <ContactActions phone={contact.phone} email={contact.email} />
          </Section>
        ) : null}

        <Section title={`Activity${log_.length ? ` · ${log_.length}` : ""}`}>
          {activities.isPending ? (
            <Loading />
          ) : activities.isError ? (
            <ErrorView error={activities.error} onRetry={() => void activities.refetch()} />
          ) : log_.length ? (
            <View style={{ gap: space.sm }}>
              {log_.map((a) => (
                <Card key={a.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Icon name={ACTIVITY_ICON[a.type] ?? "edit-3"} size={15} color={c.brand} />
                    <Text weight="600" style={{ flex: 1 }}>
                      {optionOf(ACTIVITY_TYPES.map((t) => ({ value: t.value, label: t.label })), a.type).label}
                      <Text tone="muted" variant="small">{`  ·  ${memberName(a.actorId) ?? "Someone"}`}</Text>
                    </Text>
                    <Text variant="caption" tone="muted">
                      {ago(a.createdAt)}
                    </Text>
                  </View>
                  {a.body ? <Text>{a.body}</Text> : null}
                </Card>
              ))}
            </View>
          ) : (
            <Text tone="muted">Nothing logged yet. Log a call, email, meeting or note below.</Text>
          )}
        </Section>
      </Screen>

      <LogComposer type={logType} onType={setLogType} value={logBody} onChange={setLogBody} sending={sending} onSend={() => void log()} />

      {open ? (
        <FormSheet visible onClose={() => setEditing(null)} title={open.title} fields={open.fields} initial={open.initial} onSubmit={open.submit} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function LogComposer({ type, onType, value, onChange, onSend, sending }: { type: string; onType: (t: string) => void; value: string; onChange: (v: string) => void; onSend: () => void; sending: boolean }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, gap: space.sm, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.background }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {ACTIVITY_TYPES.map((t) => {
          const on = t.value === type;
          return (
            <Pressable key={t.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onType(t.value)} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 30, borderRadius: radius.full, backgroundColor: on ? c.brandTint : c.muted }}>
              <Icon name={t.icon} size={13} color={on ? c.brand : c.mutedForeground} />
              <Text variant="small" weight="600" style={{ color: on ? c.brand : c.foreground }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={type === "call" ? "What was said on the call…" : type === "email" ? "What the email was about…" : type === "meeting" ? "Who met, and what was agreed…" : "Add a note…"}
          placeholderTextColor={c.mutedForeground}
          multiline
          style={{ flex: 1, maxHeight: 120, minHeight: 40, color: c.foreground, backgroundColor: c.muted, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 }}
        />
        <IconButton icon="send" label="Log activity" color={value.trim() ? c.brand : c.mutedForeground} disabled={!value.trim() || sending} onPress={onSend} />
      </View>
    </View>
  );
}
