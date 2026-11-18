import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Divider, Empty, ErrorView, Loading, Segmented, Text } from "@/components/ui";
import { ticketsQuery } from "@/features/business/api";
import { Tickets } from "@/features/business/support/tickets";
import { openCustomer } from "@/features/customers/api";
import { useTheme } from "@/theme";

import { rowsQuery } from "./api";
import { DueChip, StagePill } from "./bits";
import { KIND_LABEL, PROSPECT_KINDS, type ProspectRow } from "./model";

/** Prospects at these stages are customers (web: CUSTOMER_STAGES — Pilot running, Won). */
const CUSTOMER_STAGES: readonly number[] = [4, 5];
const OPEN_REQUESTS = ["open", "pending"];

export type CustomersShow = "customers" | "requests";

/**
 * Sales → Customers, Valytica only (it was the Customer Success screen): every
 * prospect at Pilot running or Won, read from the sheet, and the requests
 * logged against the project. A customer opens its own screen (onboarding,
 * requests, check-ins), which links on to the prospect record.
 */
export function CustomersView({ projectId, header, initialShow }: { projectId: string; header: React.ReactElement; initialShow?: CustomersShow }) {
  const { c, space } = useTheme();
  const [show, setShow] = useState<CustomersShow>(initialShow ?? "customers");
  // Customers come from the whole sheet, not the focus states, as on the web.
  const kinds = useQueries({ queries: PROSPECT_KINDS.map((k) => rowsQuery(k, "all")) });
  const requests = useQuery(ticketsQuery(projectId));
  const pending = kinds.some((q) => q.isPending);
  const failed = kinds.find((q) => q.isError);
  const today = kinds.find((q) => q.data)?.data?.today ?? "";

  const customers = kinds
    .flatMap((q) => q.data?.data ?? [])
    .filter((r) => CUSTOMER_STAGES.includes(r.stage))
    .sort((a, b) => a.stage - b.stage || a.name.localeCompare(b.name));
  const openRequests = (requests.data ?? []).filter((t) => OPEN_REQUESTS.includes(t.status)).length;

  const switcher = (
    <View style={{ gap: space.md }}>
      {header}
      <View style={{ paddingHorizontal: space.lg }}>
        <Segmented<CustomersShow>
          value={show}
          onChange={setShow}
          options={[
            { value: "customers", label: pending ? "Customers" : `Customers ${customers.length}` },
            { value: "requests", label: requests.data ? `Open requests ${openRequests}` : "Open requests" },
          ]}
        />
      </View>
    </View>
  );

  if (show === "requests") return <Tickets projectId={projectId} header={switcher} />;

  return (
    <FlatList
      data={pending || failed ? [] : customers}
      keyExtractor={(r) => `${r.kind}:${r.id}`}
      refreshing={kinds.some((q) => q.isRefetching)}
      onRefresh={() => void Promise.all(kinds.map((q) => q.refetch()))}
      ListHeaderComponent={<View style={{ paddingBottom: space.sm }}>{switcher}</View>}
      ListEmptyComponent={
        pending ? (
          <Loading />
        ) : failed ? (
          <ErrorView error={failed.error} onRetry={() => void failed.refetch()} />
        ) : (
          <Empty icon="users" title="No customers yet" body="A prospect becomes a customer when its status reaches Pilot running or Won." />
        )
      }
      ListFooterComponent={<View style={{ height: 96 }} />}
      ItemSeparatorComponent={() => <Divider inset={space.lg} />}
      renderItem={({ item: r }: { item: ProspectRow }) => (
        <Pressable onPress={() => openCustomer(projectId, r.kind, r.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: pressed ? c.muted : c.background })}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text weight="500" numberOfLines={1}>
              {r.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {KIND_LABEL[r.kind].one} · {r.city || r.state || "—"} · {r.assigned || "Unassigned"}
            </Text>
            {r.nextStep ? (
              <Text variant="small" numberOfLines={1}>
                {r.nextStep}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <StagePill stage={r.stage} />
            {r.nextStepDate ? <DueChip date={r.nextStepDate} today={today} /> : null}
          </View>
        </Pressable>
      )}
    />
  );
}
