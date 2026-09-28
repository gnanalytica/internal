import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { Avatar, Divider, Empty, ErrorView, Fab, Loading, Row, SearchBar, Segmented } from "@/components/ui";
import { useTheme } from "@/theme";

import { contactsQuery, createRecord, deleteRecord, patchRecord, type Contact } from "../api";
import { ENTITIES, LIFECYCLE_STAGES } from "../constants";
import { ContactActions } from "../contact-actions";
import { FormSheet, type FieldSpec } from "../form-sheet";
import { useAccountOptions } from "../pick-options";

/** Every contact in the workspace, with one-tap call, WhatsApp and email. */
export function Contacts() {
  const { space } = useTheme();
  const q = useQuery(contactsQuery);
  const accounts = useAccountOptions();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (c) => (stage === "all" || c.lifecycleStage === stage) && (!s || [c.name, c.email, c.title, c.phone, c.account?.name].some((v) => v?.toLowerCase().includes(s))),
    );
  }, [q.data, search, stage]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const fields: FieldSpec[] = [
    { key: "name", label: "Name", kind: "text", required: true, autoCapitalize: "words" },
    { key: "phone", label: "Phone", kind: "text", keyboard: "phone-pad", placeholder: "10-digit mobile", hint: "A 10-digit Indian mobile also opens in WhatsApp." },
    { key: "email", label: "Email", kind: "text", keyboard: "email-address", placeholder: "name@firm.in" },
    { key: "title", label: "Title", kind: "text", placeholder: "e.g. Partner" },
    { key: "accountId", label: "Account", kind: "choice", options: accounts, noneLabel: "No account" },
    { key: "lifecycleStage", label: "Lifecycle", kind: "choice", options: LIFECYCLE_STAGES },
    { key: "entity", label: "Entity", kind: "choice", options: ENTITIES },
  ];
  const current = editing && editing !== "new" ? editing : null;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder={`Search ${q.data?.length ?? 0} contacts`} />
            <Segmented value={stage} onChange={setStage} options={[{ value: "all", label: "All" }, ...LIFECYCLE_STAGES.map((l) => ({ value: l.value, label: l.label }))]} />
          </View>
        }
        ItemSeparatorComponent={() => <Divider inset={56} />}
        renderItem={({ item }) => (
          <Row
            leading={<Avatar name={item.name} seed={item.id} size={32} />}
            title={item.name}
            subtitle={[item.title, item.account?.name].filter(Boolean).join(" · ") || item.email || item.phone || "No details yet"}
            trailing={<ContactActions phone={item.phone} email={item.email} compact />}
            onPress={() => setEditing(item)}
          />
        )}
        ListEmptyComponent={<Empty icon="users" title={search || stage !== "all" ? "No contacts match" : "No contacts yet"} body={search ? `Nothing matches “${search}”.` : "Add a person with the + button."} />}
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
      <Fab label="New contact" onPress={() => setEditing("new")} />
      <FormSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? current.name : "New contact"}
        submitLabel={current ? "Save" : "Create"}
        fields={fields}
        initial={
          current
            ? { name: current.name, phone: current.phone, email: current.email, title: current.title, accountId: current.account?.id ?? null, lifecycleStage: current.lifecycleStage, entity: current.entity }
            : { name: "", phone: null, email: null, title: null, accountId: null, lifecycleStage: "lead", entity: "Global" }
        }
        onSubmit={async (v) => {
          const account = accounts.find((a) => a.value === v.accountId);
          if (current) await patchRecord("contacts", current.id, v, { account: account ? { id: account.value, name: account.label } : null });
          else await createRecord("contacts", v);
        }}
        onDelete={current ? () => deleteRecord("contacts", current.id) : undefined}
        deleteLabel="Delete contact"
      />
    </View>
  );
}
