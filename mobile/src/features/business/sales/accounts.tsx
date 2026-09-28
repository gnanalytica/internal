import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { Divider, Empty, ErrorView, Fab, Loading, Row, SearchBar } from "@/components/ui";
import { useTheme } from "@/theme";

import { accountsQuery, createRecord, deleteRecord, patchRecord, type Account } from "../api";
import { ACCOUNT_TYPES, ENTITIES } from "../constants";
import { FormSheet, type FieldSpec } from "../form-sheet";
import { OptionBadge } from "../ui";

const FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", kind: "text", required: true, placeholder: "Firm or company name", autoCapitalize: "words" },
  { key: "type", label: "Type", kind: "choice", options: ACCOUNT_TYPES },
  { key: "industry", label: "Industry", kind: "text", placeholder: "e.g. Valuation, Banking" },
  { key: "website", label: "Website", kind: "text", keyboard: "url", placeholder: "https://" },
  { key: "entity", label: "Entity", kind: "choice", options: ENTITIES },
];

/** Every account in the workspace — the web's Sales › Accounts tab. */
export function Accounts() {
  const { space } = useTheme();
  const q = useQuery(accountsQuery);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Account | "new" | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((a) => !s || [a.name, a.industry, a.website].some((v) => v?.toLowerCase().includes(s)));
  }, [q.data, search]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const current = editing && editing !== "new" ? editing : null;
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        keyboardShouldPersistTaps="handled"
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder={`Search ${q.data?.length ?? 0} accounts`} />
          </View>
        }
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={[item.industry, item.website?.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ") || item.entity}
            trailing={<OptionBadge list={ACCOUNT_TYPES} value={item.type} />}
            onPress={() => setEditing(item)}
          />
        )}
        ListEmptyComponent={<Empty icon="briefcase" title={search ? "No accounts match" : "No accounts yet"} body={search ? `Nothing matches “${search}”.` : "Add a firm or company with the + button."} />}
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
      <Fab label="New account" onPress={() => setEditing("new")} />
      <FormSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? current.name : "New account"}
        submitLabel={current ? "Save" : "Create"}
        fields={FIELDS}
        initial={current ? { name: current.name, type: current.type, industry: current.industry, website: current.website, entity: current.entity } : { name: "", type: "prospect", industry: null, website: null, entity: "Global" }}
        onSubmit={async (v) => {
          if (current) await patchRecord("accounts", current.id, v);
          else await createRecord("accounts", v);
        }}
        onDelete={current ? () => deleteRecord("accounts", current.id) : undefined}
        deleteLabel="Delete account"
      />
    </View>
  );
}
