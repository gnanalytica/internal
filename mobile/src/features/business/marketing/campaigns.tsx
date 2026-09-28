import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { Card, Empty, ErrorView, Fab, Loading, Segmented, Text } from "@/components/ui";
import { inr } from "@/lib/format";
import { useTheme } from "@/theme";

import { campaignsQuery, createRecord, deleteRecord, patchRecord, type Campaign } from "../api";
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, ENTITIES, entityCurrency, optionOf, sumIn } from "../constants";
import { FormSheet, type FieldSpec, type FormValues } from "../form-sheet";
import { useMemberOptions } from "../pick-options";
import { day, dayLabel, Dot, OptionBadge, Stats } from "../ui";

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");

/** The project's campaigns, with spend and outcomes. Tap one to see and edit everything about it. */
export function Campaigns({ projectId }: { projectId: string }) {
  const { space } = useTheme();
  const q = useQuery(campaignsQuery(projectId));
  const members = useMemberOptions();
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);

  const all = useMemo(() => q.data ?? [], [q.data]);
  const rows = useMemo(() => all.filter((c) => status === "all" || c.status === status), [all, status]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const reach = all.reduce((s, c) => s + (c.reach ?? 0), 0);
  const conversions = all.reduce((s, c) => s + (c.conversions ?? 0), 0);
  const current = editing && editing !== "new" ? editing : null;

  const fields: FieldSpec[] = [
    { key: "name", label: "Name", kind: "text", required: true, placeholder: "e.g. Diwali WhatsApp push" },
    { key: "channel", label: "Channel", kind: "choice", options: CAMPAIGN_CHANNELS },
    { key: "status", label: "Status", kind: "choice", options: CAMPAIGN_STATUSES },
    { key: "entity", label: "Entity", kind: "choice", options: ENTITIES, hint: "Sets the currency the budget is in." },
    { key: "budget", label: "Budget", kind: "money", placeholder: "0", currency: (v) => entityCurrency(v.entity as string | null) },
    ...(current
      ? ([
          { key: "reach", label: "Reach", kind: "number", placeholder: "People reached" },
          { key: "replies", label: "Replies", kind: "number" },
          { key: "conversions", label: "Conversions", kind: "number" },
        ] satisfies FieldSpec[])
      : []),
    { key: "startDate", label: "Starts", kind: "date" },
    { key: "endDate", label: "Ends", kind: "date" },
    ...(current ? ([{ key: "ownerId", label: "Owner", kind: "choice", options: members, noneLabel: "No owner" }] satisfies FieldSpec[]) : []),
  ];
  const initial: FormValues = current
    ? { name: current.name, channel: current.channel, status: current.status, entity: current.entity, budget: current.budget, reach: current.reach ?? 0, replies: current.replies ?? 0, conversions: current.conversions ?? 0, startDate: day(current.startDate), endDate: day(current.endDate), ownerId: current.ownerId ?? null }
    : { name: "", channel: "whatsapp", status: "planned", entity: "India", budget: null, startDate: null, endDate: null };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Stats
              items={[
                { label: "Budget", value: inr(sumIn(all, (c) => c.budget)) },
                { label: "Active", value: String(all.filter((c) => c.status === "active").length) },
                { label: "Reach", value: reach.toLocaleString("en-IN") },
                { label: "Conversions", value: `${conversions.toLocaleString("en-IN")} · ${pct(conversions, reach)}`, tone: conversions ? "success" : "default" },
              ]}
            />
            <Segmented value={status} onChange={setStatus} options={[{ value: "all", label: `All ${all.length}` }, ...CAMPAIGN_STATUSES.map((s) => ({ value: s.value, label: `${s.label} ${all.filter((c) => c.status === s.value).length}` }))]} />
          </View>
        }
        renderItem={({ item }) => <CampaignCard campaign={item} onPress={() => setEditing(item)} />}
        ListEmptyComponent={<Empty icon="speaker" title={all.length ? "No campaigns here" : "No campaigns yet"} body={all.length ? "Pick another status above." : "Plan the first one with the + button."} />}
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
      <Fab label="New campaign" onPress={() => setEditing("new")} />
      <FormSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? current.name : "New campaign"}
        submitLabel={current ? "Save" : "Create"}
        fields={fields}
        initial={initial}
        onSubmit={async (v) => {
          const values = { ...v, budget: v.budget ?? 0, reach: v.reach ?? 0, replies: v.replies ?? 0, conversions: v.conversions ?? 0 };
          if (current) await patchRecord("campaigns", current.id, values);
          else await createRecord("campaigns", { name: v.name, channel: v.channel, status: v.status, entity: v.entity, budget: v.budget ?? 0, startDate: v.startDate, endDate: v.endDate, projectId });
        }}
        onDelete={current ? () => deleteRecord("campaigns", current.id) : undefined}
        deleteLabel="Delete campaign"
      />
    </View>
  );
}

function CampaignCard({ campaign: c, onPress }: { campaign: Campaign; onPress: () => void }) {
  const { space } = useTheme();
  const channel = optionOf(CAMPAIGN_CHANNELS, c.channel);
  const reach = c.reach ?? 0;
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
          {c.name}
        </Text>
        <OptionBadge list={CAMPAIGN_STATUSES} value={c.status} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Dot color={channel.color} size={8} />
        <Text variant="small" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
          {channel.label}
          {c.startDate || c.endDate ? ` · ${dayLabel(c.startDate)} → ${dayLabel(c.endDate)}` : ""}
          {c.contentCount ? ` · ${c.contentCount} content` : ""}
        </Text>
        <Text variant="small" weight="600" mono>
          {inr(c.budget, entityCurrency(c.entity))}
        </Text>
      </View>
      {reach || c.replies || c.conversions ? (
        <View style={{ flexDirection: "row", gap: space.lg }}>
          <Metric label="Reach" value={reach} />
          <Metric label="Replies" value={c.replies ?? 0} sub={pct(c.replies ?? 0, reach)} />
          <Metric label="Converted" value={c.conversions ?? 0} sub={pct(c.conversions ?? 0, reach)} />
        </View>
      ) : null}
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text weight="600" mono>
        {value.toLocaleString("en-IN")}
        {sub && sub !== "—" ? <Text variant="small" tone="muted">{`  ${sub}`}</Text> : null}
      </Text>
    </View>
  );
}
