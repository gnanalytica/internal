import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Button, Card, Divider, ErrorView, Field, IconButton, Loading, Screen, Section, Text } from "@/components/ui";
import { contactsQuery, convertTicket, deleteRecord, patchRecord, replyToTicket, ticketQuery, type TicketDetail } from "@/features/business/api";
import { optionOf, TICKET_PRIORITIES, TICKET_STATUSES } from "@/features/business/constants";
import { ContactActions } from "@/features/business/contact-actions";
import { FormSheet, type FieldSpec, type FormValues } from "@/features/business/form-sheet";
import { useAccountOptions, useContactOptions, useMemberName, useMemberOptions } from "@/features/business/pick-options";
import { Dot, HeaderTitle } from "@/features/business/ui";
import { ago, longDate } from "@/lib/format";
import { useTheme } from "@/theme";

type Editing = "subject" | "status" | "priority" | "assignee" | "account" | "contact" | "requester" | "body" | null;

export default function TicketScreen() {
  const { ticketId } = useLocalSearchParams<{ id: string; ticketId: string }>();
  const q = useQuery(ticketQuery(ticketId));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <TicketBody ticket={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function TicketBody({ ticket, refreshing, onRefresh }: { ticket: TicketDetail; refreshing: boolean; onRefresh: () => void }) {
  const { c, space } = useTheme();
  const [editing, setEditing] = useState<Editing>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const accounts = useAccountOptions();
  const contactOptions = useContactOptions(ticket.account?.id ?? null);
  const contacts = useQuery(contactsQuery).data ?? [];
  const members = useMemberOptions();
  const memberName = useMemberName();
  const contact = contacts.find((x) => x.id === (ticket.contact?.id ?? ticket.contactId));
  const status = optionOf(TICKET_STATUSES, ticket.status);
  const priority = optionOf(TICKET_PRIORITIES, ticket.priority);
  const assignee = memberName(ticket.assigneeId);
  const issueId = ticket.issue?.id ?? ticket.issueId ?? null;

  const save = (patch: Record<string, unknown>, display: Record<string, unknown> = {}) => patchRecord("tickets", ticket.id, patch, display);

  const spec: Record<Exclude<Editing, null>, { title: string; fields: FieldSpec[]; initial: FormValues; submit: (v: FormValues) => Promise<void> }> = {
    subject: { title: "Subject", fields: [{ key: "subject", label: "Subject", kind: "text", required: true }], initial: { subject: ticket.subject }, submit: (v) => save({ subject: v.subject }) },
    body: { title: "Details", fields: [{ key: "body", label: "Details", kind: "multiline" }], initial: { body: ticket.body }, submit: (v) => save({ body: v.body }) },
    status: { title: "Status", fields: [{ key: "status", label: "Status", kind: "choice", options: TICKET_STATUSES }], initial: { status: ticket.status }, submit: (v) => save({ status: v.status }) },
    priority: { title: "Priority", fields: [{ key: "priority", label: "Priority", kind: "choice", options: TICKET_PRIORITIES }], initial: { priority: ticket.priority }, submit: (v) => save({ priority: v.priority }) },
    assignee: { title: "Assignee", fields: [{ key: "assigneeId", label: "Assignee", kind: "choice", options: members, noneLabel: "Unassigned" }], initial: { assigneeId: ticket.assigneeId }, submit: (v) => save({ assigneeId: v.assigneeId }) },
    account: {
      title: "Account",
      fields: [{ key: "accountId", label: "Account", kind: "choice", options: accounts, noneLabel: "No account" }],
      initial: { accountId: ticket.account?.id ?? null },
      submit: (v) => {
        const a = accounts.find((o) => o.value === v.accountId);
        return save({ accountId: v.accountId }, { account: a ? { id: a.value, name: a.label } : null });
      },
    },
    contact: {
      title: "Contact",
      fields: [{ key: "contactId", label: "Contact", kind: "choice", options: contactOptions, noneLabel: "No contact" }],
      initial: { contactId: ticket.contact?.id ?? null },
      submit: (v) => {
        const o = contactOptions.find((x) => x.value === v.contactId);
        return save({ contactId: v.contactId }, { contactId: v.contactId, contact: o ? { id: o.value, name: o.label } : null });
      },
    },
    requester: { title: "Requester email", fields: [{ key: "requesterEmail", label: "Requester email", kind: "text", keyboard: "email-address" }], initial: { requesterEmail: ticket.requesterEmail }, submit: (v) => save({ requesterEmail: v.requesterEmail }) },
  };
  const open = editing ? spec[editing] : null;

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await replyToTicket(ticket.id, reply.trim());
      setReply("");
    } catch (e) {
      Alert.alert("Couldn't send the reply", (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const convert = async () => {
    setConverting(true);
    try {
      const res = await convertTicket(ticket.id);
      router.push(`/issues/${res.issue.id}`);
    } catch (e) {
      Alert.alert("Couldn't convert it", (e as Error).message);
    } finally {
      setConverting(false);
    }
  };

  const remove = () =>
    Alert.alert("Delete this ticket?", "Its conversation goes with it. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRecord("tickets", ticket.id);
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete", (e as Error).message);
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: ticket.subject, headerTitle: () => <HeaderTitle title="Ticket" project={ticket.project?.name} />, headerRight: () => <IconButton icon="trash-2" label="Delete ticket" color={c.destructive} onPress={remove} /> }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Pressable onPress={() => setEditing("subject")} accessibilityHint="Edit the subject">
          <Text variant="heading">{ticket.subject}</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            Opened {longDate(ticket.createdAt)}
          </Text>
        </Pressable>

        <Card style={{ paddingVertical: 4 }}>
          <Field label="Status" onPress={() => setEditing("status")}>
            <Dot color={status.color} />
            <Text>{status.label}</Text>
          </Field>
          <Divider />
          <Field label="Priority" onPress={() => setEditing("priority")}>
            <Dot color={priority.color} />
            <Text>{priority.label}</Text>
          </Field>
          <Divider />
          <Field label="Assignee" onPress={() => setEditing("assignee")}>
            <Avatar name={assignee} seed={ticket.assigneeId} size={22} />
            <Text tone={assignee ? "default" : "muted"} numberOfLines={1}>
              {assignee ?? "Unassigned"}
            </Text>
          </Field>
          <Divider />
          <Field label="Account" onPress={() => setEditing("account")}>
            <Text tone={ticket.account ? "default" : "muted"} numberOfLines={1}>
              {ticket.account?.name ?? "No account"}
            </Text>
          </Field>
          <Divider />
          <Field label="Contact" onPress={() => setEditing("contact")}>
            <Text tone={ticket.contact ? "default" : "muted"} numberOfLines={1}>
              {ticket.contact?.name ?? "No contact"}
            </Text>
          </Field>
          <Divider />
          <Field label="Requester" onPress={() => setEditing("requester")}>
            <Text tone={ticket.requesterEmail ? "default" : "muted"} numberOfLines={1}>
              {ticket.requesterEmail ?? "No email"}
            </Text>
          </Field>
        </Card>

        {contact?.phone || contact?.email || ticket.requesterEmail ? (
          <Section title="Reach the customer">
            <ContactActions phone={contact?.phone} email={contact?.email ?? ticket.requesterEmail} />
          </Section>
        ) : null}

        {issueId ? (
          <Card onPress={() => router.push(`/issues/${issueId}`)} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="small" tone="muted">
                Converted to a task
              </Text>
              <Text weight="600" numberOfLines={2}>
                {ticket.issue?.title ?? "Open the task"}
              </Text>
            </View>
            <Text tone="brand" weight="600">
              Open ›
            </Text>
          </Card>
        ) : (
          <Button title="Convert to task" icon="git-pull-request" loading={converting} onPress={() => void convert()} />
        )}

        <Section title="Details" action={<Button size="sm" variant="ghost" icon="edit-2" title="Edit" onPress={() => setEditing("body")} />}>
          {ticket.body ? <Text>{ticket.body}</Text> : <Text tone="muted">No details recorded.</Text>}
        </Section>

        <Section title={`Conversation${ticket.comments.length ? ` · ${ticket.comments.length}` : ""}`}>
          {ticket.comments.length ? (
            <View style={{ gap: space.sm }}>
              {ticket.comments.map((cm) => (
                <Card key={cm.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Avatar name={cm.author?.name} seed={cm.author?.id} size={22} />
                    <Text weight="600" style={{ flex: 1 }}>
                      {cm.author?.name ?? "Someone"}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {ago(cm.createdAt)}
                    </Text>
                  </View>
                  <Text>{cm.body}</Text>
                </Card>
              ))}
            </View>
          ) : (
            <Text tone="muted">No replies yet.</Text>
          )}
        </Section>
      </Screen>

      <ReplyBox value={reply} onChange={setReply} sending={sending} onSend={() => void send()} />

      {open ? <FormSheet visible onClose={() => setEditing(null)} title={open.title} fields={open.fields} initial={open.initial} onSubmit={open.submit} /> : null}
    </KeyboardAvoidingView>
  );
}

function ReplyBox({ value, onChange, onSend, sending }: { value: string; onChange: (v: string) => void; onSend: () => void; sending: boolean }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.background }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Write a reply…"
        placeholderTextColor={c.mutedForeground}
        multiline
        style={{ flex: 1, maxHeight: 120, minHeight: 40, color: c.foreground, backgroundColor: c.muted, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 }}
      />
      <IconButton icon="send" label="Send reply" color={value.trim() ? c.brand : c.mutedForeground} disabled={!value.trim() || sending} onPress={onSend} />
    </View>
  );
}
