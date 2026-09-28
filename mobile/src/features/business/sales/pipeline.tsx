import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, SectionList, View } from "react-native";

import { Divider, Empty, ErrorView, Fab, Loading, Row, Segmented, Text } from "@/components/ui";
import { inr } from "@/lib/format";
import { useTheme } from "@/theme";

import { createRecord, dealsQuery, patchRecord, type Deal } from "../api";
import { DEAL_STAGES, ENTITIES, entityCurrency, OPEN_DEAL_STAGES, optionOf, sumIn } from "../constants";
import { FormSheet, type FieldSpec } from "../form-sheet";
import { useAccountOptions, useContactOptions } from "../pick-options";
import { dayLabel, dueOf, GroupHeader, Stats } from "../ui";

export const dealValue = (d: Pick<Deal, "value" | "entity">) => inr(d.value, entityCurrency(d.entity));

/** Deals grouped by stage, with the pipeline's value up top. */
export function Pipeline({ projectId }: { projectId: string }) {
  const { c, space } = useTheme();
  const q = useQuery(dealsQuery(projectId));
  const [stage, setStage] = useState<string>("open");
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<Deal | null>(null);

  const deals = useMemo(() => q.data ?? [], [q.data]);
  const sections = useMemo(
    () =>
      DEAL_STAGES.filter((s) => (stage === "open" ? OPEN_DEAL_STAGES.includes(s.value) : stage === "all" || s.value === stage))
        .map((s) => ({ key: s.value, title: s.label, color: s.color, data: deals.filter((d) => d.stage === s.value) }))
        .filter((s) => s.data.length > 0),
    [deals, stage],
  );

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const open = deals.filter((d) => OPEN_DEAL_STAGES.includes(d.stage));
  const won = deals.filter((d) => d.stage === "won");
  const count = (id: string) => deals.filter((d) => d.stage === id).length;

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(d) => d.id}
        stickySectionHeadersEnabled
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md }}>
            <Stats
              items={[
                { label: `Open · ${open.length}`, value: inr(sumIn(open, (d) => d.value)) },
                { label: `Won · ${won.length}`, value: inr(sumIn(won, (d) => d.value)), tone: "success" },
              ]}
            />
            <Segmented
              value={stage}
              onChange={setStage}
              options={[
                { value: "open", label: `Open ${open.length}` },
                ...DEAL_STAGES.map((s) => ({ value: s.value, label: `${s.label} ${count(s.value)}` })),
                { value: "all", label: `All ${deals.length}` },
              ]}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <GroupHeader
            label={section.title}
            color={section.color}
            count={section.data.length}
            right={
              <Text variant="small" tone="muted" mono>
                {inr(sumIn(section.data, (d) => d.value))}
              </Text>
            }
          />
        )}
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        renderItem={({ item }) => {
          const close = OPEN_DEAL_STAGES.includes(item.stage) ? dueOf(item.expectedClose) : null;
          return (
            <Row
              title={item.name}
              subtitle={
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {[item.account?.name, item.contact?.name].filter(Boolean).join(" · ") || "No account"}
                  {item.expectedClose ? (
                    <Text variant="small" style={{ color: close?.late ? c.destructive : c.mutedForeground }}>
                      {`  ·  closes ${dayLabel(item.expectedClose)}`}
                    </Text>
                  ) : null}
                </Text>
              }
              trailing={
                <Text weight="600" mono>
                  {dealValue(item)}
                </Text>
              }
              onPress={() => router.push(`/projects/${projectId}/deals/${item.id}`)}
              onLongPress={() => setMoving(item)}
            />
          );
        }}
        ListEmptyComponent={
          <Empty
            icon="trending-up"
            title={deals.length ? "No deals at this stage" : "No deals yet"}
            body={deals.length ? "Pick another stage above." : "Add the first deal for this project with the + button."}
          />
        }
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
      <Fab label="New deal" onPress={() => setCreating(true)} />
      <NewDealSheet projectId={projectId} visible={creating} onClose={() => setCreating(false)} />
      <FormSheet
        visible={!!moving}
        onClose={() => setMoving(null)}
        title={moving ? `Move “${moving.name}”` : "Stage"}
        fields={[{ key: "stage", label: "Stage", kind: "choice", options: DEAL_STAGES }]}
        initial={{ stage: moving?.stage ?? null }}
        onSubmit={async (v) => {
          if (moving && v.stage && v.stage !== moving.stage) await patchRecord("deals", moving.id, { stage: v.stage });
        }}
      />
    </View>
  );
}

function NewDealSheet({ projectId, visible, onClose }: { projectId: string; visible: boolean; onClose: () => void }) {
  const accounts = useAccountOptions(visible);
  const contacts = useContactOptions(null, visible);
  const fields: FieldSpec[] = [
    { key: "name", label: "Deal name", kind: "text", required: true, placeholder: "e.g. Sharma Valuers — annual plan" },
    { key: "entity", label: "Entity", kind: "choice", options: ENTITIES, hint: "Sets the currency the value is in." },
    { key: "value", label: "Value", kind: "money", placeholder: "0", currency: (v) => entityCurrency(v.entity as string | null) },
    { key: "stage", label: "Stage", kind: "choice", options: DEAL_STAGES },
    { key: "accountId", label: "Account", kind: "choice", options: accounts, noneLabel: "No account" },
    { key: "contactId", label: "Contact", kind: "choice", options: contacts, noneLabel: "No contact" },
    { key: "expectedClose", label: "Expected close", kind: "date" },
  ];
  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="New deal"
      submitLabel="Create"
      fields={fields}
      initial={{ name: "", entity: "Global", value: null, stage: "lead", accountId: null, contactId: null, expectedClose: null }}
      onSubmit={async (v) => {
        const created = await createRecord<Deal>("deals", { ...v, value: v.value ?? 0, projectId });
        onClose();
        if (created?.id) router.push(`/projects/${projectId}/deals/${created.id}`);
        else Alert.alert("Deal created");
      }}
    />
  );
}

export const stageLabel = (id: string) => optionOf(DEAL_STAGES, id).label;
