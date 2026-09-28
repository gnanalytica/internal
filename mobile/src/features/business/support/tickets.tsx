import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { SectionList, View } from "react-native";

import { Avatar, Divider, Empty, ErrorView, Fab, Loading, Row, Segmented, Text } from "@/components/ui";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

import { createRecord, ticketsQuery, type Ticket } from "../api";
import { ENTITIES, TICKET_PRIORITIES, TICKET_STATUSES } from "../constants";
import { FormSheet, type FieldSpec } from "../form-sheet";
import { useAccountOptions, useContactOptions, useMemberName, useMemberOptions } from "../pick-options";
import { GroupHeader, OptionBadge } from "../ui";

const OPEN = ["open", "pending"];

/** The project's support queue, grouped by status. */
export function Tickets({ projectId }: { projectId: string }) {
  const { space } = useTheme();
  const q = useQuery(ticketsQuery(projectId));
  const memberName = useMemberName();
  const [view, setView] = useState<"open" | "all">("open");
  const [creating, setCreating] = useState(false);

  const tickets = useMemo(() => q.data ?? [], [q.data]);
  const sections = useMemo(
    () =>
      TICKET_STATUSES.filter((s) => view === "all" || OPEN.includes(s.value))
        .map((s) => ({ key: s.value, title: s.label, color: s.color, data: tickets.filter((t) => t.status === s.value).sort(byPriority) }))
        .filter((s) => s.data.length > 0),
    [tickets, view],
  );

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const openCount = tickets.filter((t) => OPEN.includes(t.status)).length;

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "open", label: `Open ${openCount}` },
                { value: "all", label: `All ${tickets.length}` },
              ]}
            />
          </View>
        }
        renderSectionHeader={({ section }) => <GroupHeader label={section.title} color={section.color} count={section.data.length} />}
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        renderItem={({ item }) => {
          const who = memberName(item.assigneeId);
          return (
            <Row
              title={item.subject}
              subtitle={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <OptionBadge list={TICKET_PRIORITIES} value={item.priority} />
                  <Text variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {[item.account?.name ?? item.contact?.name ?? item.requesterEmail, ago(item.updatedAt ?? item.createdAt)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              }
              trailing={<Avatar name={who} seed={item.assigneeId} size={24} />}
              onPress={() => router.push(`/projects/${projectId}/tickets/${item.id}`)}
            />
          );
        }}
        ListEmptyComponent={
          <Empty
            icon="life-buoy"
            title={tickets.length ? "No open tickets" : "No tickets yet"}
            body={tickets.length ? "Everything is solved or closed. Switch to All to see them." : "Log a customer request with the + button."}
          />
        }
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
      <Fab label="New ticket" onPress={() => setCreating(true)} />
      <NewTicketSheet projectId={projectId} visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

const RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const byPriority = (a: Ticket, b: Ticket) => (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9) || (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);

function NewTicketSheet({ projectId, visible, onClose }: { projectId: string; visible: boolean; onClose: () => void }) {
  const accounts = useAccountOptions(visible);
  const contacts = useContactOptions(null, visible);
  const members = useMemberOptions();
  const fields: FieldSpec[] = [
    { key: "subject", label: "Subject", kind: "text", required: true, placeholder: "What the customer needs" },
    { key: "body", label: "Details", kind: "multiline", placeholder: "What they said, steps, links…" },
    { key: "priority", label: "Priority", kind: "choice", options: TICKET_PRIORITIES },
    { key: "assigneeId", label: "Assignee", kind: "choice", options: members, noneLabel: "Unassigned" },
    { key: "accountId", label: "Account", kind: "choice", options: accounts, noneLabel: "No account" },
    { key: "contactId", label: "Contact", kind: "choice", options: contacts, noneLabel: "No contact" },
    { key: "requesterEmail", label: "Requester email", kind: "text", keyboard: "email-address" },
    { key: "entity", label: "Entity", kind: "choice", options: ENTITIES },
  ];
  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="New ticket"
      submitLabel="Create"
      fields={fields}
      initial={{ subject: "", body: null, priority: "normal", assigneeId: null, accountId: null, contactId: null, requesterEmail: null, entity: "Global" }}
      onSubmit={async (v) => {
        const created = await createRecord<Ticket>("tickets", { ...v, projectId, status: "open" });
        onClose();
        if (created?.id) router.push(`/projects/${projectId}/tickets/${created.id}`);
      }}
    />
  );
}
