import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { Card, Divider, Empty, ErrorView, Fab, Loading, Row, Section, Segmented, Text } from "@/components/ui";
import { createRecord, deleteRecord, financeQuery, patchRecord, type Expense, type Finance, type Invoice } from "@/features/business/api";
import { ENTITIES, entityCurrency, EXPENSE_CATEGORIES, EXPENSE_STATUSES, INVOICE_STATUSES, optionOf } from "@/features/business/constants";
import { FormSheet, type FieldSpec, type FormValues } from "@/features/business/form-sheet";
import { useAccountOptions } from "@/features/business/pick-options";
import { DeptScaffold } from "@/features/business/scaffold";
import { Bar, day, dayLabel, dueOf, OptionBadge, Restricted, Stats } from "@/features/business/ui";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useTheme } from "@/theme";

type Segment = "invoices" | "expenses";

/** A project's Finance department: invoices and expenses with their totals. Admins and the project's owner only. */
export default function FinanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [segment, setSegment] = useState<Segment>("invoices");
  const q = useQuery(financeQuery(id));

  const body = (() => {
    if (q.isPending) return <Loading />;
    if (q.isError) {
      if (q.error instanceof ApiError && q.error.status === 403)
        return <Restricted title="Finance is for admins and this project's owner" body="Invoices and expenses are only open to workspace admins and whoever owns this project." />;
      return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
    }
    return segment === "invoices" ? <Invoices projectId={id} finance={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} /> : <Expenses projectId={id} finance={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
  })();

  const allowed = !(q.error instanceof ApiError && q.error.status === 403);
  return (
    <DeptScaffold
      title="Finance"
      projectId={id}
      value={allowed ? segment : undefined}
      onChange={setSegment}
      segments={[
        { value: "invoices", label: "Invoices" },
        { value: "expenses", label: "Expenses" },
      ]}
    >
      {body}
    </DeptScaffold>
  );
}

type ListProps = { projectId: string; finance: Finance; refreshing: boolean; onRefresh: () => void };

const amountOf = (row: { amount: number; entity: string }) => inr(row.amount, entityCurrency(row.entity));

function Invoices({ projectId, finance, refreshing, onRefresh }: ListProps) {
  const { space } = useTheme();
  const accounts = useAccountOptions();
  const [status, setStatus] = useState<string>("all");
  const [editing, setEditing] = useState<Invoice | "new" | null>(null);
  const s = finance.summary;
  const ccy = finance.currency;
  const rows = useMemo(() => finance.invoices.filter((i) => status === "all" || i.status === status), [finance.invoices, status]);
  const current = editing && editing !== "new" ? editing : null;

  const fields: FieldSpec[] = [
    { key: "number", label: "Invoice number", kind: "text", placeholder: "e.g. INV-2026-014", autoCapitalize: "none" },
    { key: "entity", label: "Entity", kind: "choice", options: ENTITIES, hint: "Sets the currency the amount is in." },
    { key: "amount", label: "Amount", kind: "money", required: true, placeholder: "0", currency: (v) => entityCurrency(v.entity as string | null) },
    { key: "status", label: "Status", kind: "choice", options: INVOICE_STATUSES },
    { key: "accountId", label: "Billed to", kind: "choice", options: accounts, noneLabel: "No account" },
    { key: "issueDate", label: "Issued on", kind: "date" },
    { key: "dueDate", label: "Due on", kind: "date" },
  ];
  const initial: FormValues = current
    ? { number: current.number, entity: current.entity, amount: current.amount, status: current.status, accountId: current.account?.id ?? null, issueDate: day(current.issueDate), dueDate: day(current.dueDate) }
    : { number: null, entity: "India", amount: null, status: "draft", accountId: null, issueDate: day(new Date().toISOString()), dueDate: null };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md }}>
            <Stats
              items={[
                { label: "Issued", value: inr(s.issued, ccy) },
                { label: "Paid", value: inr(s.paid, ccy), tone: "success" },
                { label: "Outstanding", value: inr(s.outstanding, ccy), tone: s.outstanding ? "warning" : "default" },
                { label: "Overdue", value: inr(s.overdue, ccy), tone: s.overdue ? "danger" : "muted" },
              ]}
            />
            <Filter value={status} onChange={setStatus} options={INVOICE_STATUSES} counts={(v) => finance.invoices.filter((i) => i.status === v).length} total={finance.invoices.length} />
            {!finance.enabled ? <Text variant="small" tone="muted">Finance is turned off for this project on the web, so these records only show here.</Text> : null}
          </View>
        }
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        renderItem={({ item }) => {
          const due = item.status === "sent" || item.status === "overdue" ? dueOf(item.dueDate) : null;
          return (
            <Row
              title={
                <Text weight="600" mono>
                  {amountOf(item)}
                </Text>
              }
              subtitle={
                <Text variant="small" tone={due?.late || item.status === "overdue" ? "danger" : "muted"} numberOfLines={1}>
                  {[item.number, item.account?.name, item.dueDate ? `due ${dayLabel(item.dueDate)}` : item.issueDate ? `issued ${dayLabel(item.issueDate)}` : null].filter(Boolean).join(" · ") || "No details"}
                </Text>
              }
              trailing={<OptionBadge list={INVOICE_STATUSES} value={item.status} />}
              onPress={() => setEditing(item)}
            />
          );
        }}
        ListEmptyComponent={<Empty icon="file-text" title={finance.invoices.length ? "No invoices with this status" : "No invoices yet"} body={finance.invoices.length ? "Pick another status above." : "Raise the first one with the + button."} />}
        ListFooterComponent={<Footnote currency={ccy} />}
      />
      <Fab label="New invoice" onPress={() => setEditing("new")} />
      <FormSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? current.number || "Invoice" : "New invoice"}
        submitLabel={current ? "Save" : "Create"}
        fields={fields}
        initial={initial}
        onSubmit={async (v) => {
          const values = { ...v, amount: v.amount ?? 0 };
          if (current) {
            const a = accounts.find((o) => o.value === v.accountId);
            await patchRecord("invoices", current.id, values, { account: a ? { id: a.value, name: a.label } : null });
          } else await createRecord("invoices", { ...values, projectId });
        }}
        onDelete={current ? () => deleteRecord("invoices", current.id) : undefined}
        deleteLabel="Delete invoice"
      />
    </View>
  );
}

function Expenses({ projectId, finance, refreshing, onRefresh }: ListProps) {
  const { space } = useTheme();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const s = finance.summary;
  const ccy = finance.currency;
  const current = editing && editing !== "new" ? editing : null;
  const top = s.byCategory[0]?.amount ?? 0;

  const fields: FieldSpec[] = [
    { key: "vendor", label: "Vendor", kind: "text", placeholder: "Who was paid", autoCapitalize: "words" },
    { key: "category", label: "Category", kind: "choice", options: EXPENSE_CATEGORIES },
    { key: "entity", label: "Entity", kind: "choice", options: ENTITIES, hint: "Sets the currency the amount is in." },
    { key: "amount", label: "Amount", kind: "money", required: true, placeholder: "0", currency: (v) => entityCurrency(v.entity as string | null) },
    { key: "status", label: "Status", kind: "choice", options: EXPENSE_STATUSES },
    { key: "spentDate", label: "Spent on", kind: "date" },
  ];
  const initial: FormValues = current
    ? { vendor: current.vendor, category: current.category, entity: current.entity, amount: current.amount, status: current.status, spentDate: day(current.spentDate) }
    : { vendor: null, category: "tooling", entity: "India", amount: null, status: "paid", spentDate: day(new Date().toISOString()) };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={finance.expenses}
        keyExtractor={(e) => e.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md }}>
            <Stats
              items={[
                { label: "Expenses", value: inr(s.expenses, ccy) },
                { label: "Paid out", value: inr(s.expensesPaid, ccy) },
                { label: "Revenue", value: inr(s.paid, ccy), tone: "success" },
                { label: "Net", value: inr(s.net, ccy), tone: s.net < 0 ? "danger" : "success" },
              ]}
            />
            {s.byCategory.length ? (
              <Section title="By category">
                <Card style={{ gap: space.md }}>
                  {s.byCategory.map((row) => {
                    const cat = optionOf(EXPENSE_CATEGORIES, row.id);
                    return (
                      <View key={row.id} style={{ gap: 4 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text variant="small">{cat.label}</Text>
                          <Text variant="small" weight="600" mono>
                            {inr(row.amount, ccy)}
                          </Text>
                        </View>
                        <Bar value={top ? row.amount / top : 0} color={cat.color} />
                      </View>
                    );
                  })}
                </Card>
              </Section>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        renderItem={({ item }) => (
          <Row
            title={item.vendor || optionOf(EXPENSE_CATEGORIES, item.category).label}
            subtitle={[optionOf(EXPENSE_CATEGORIES, item.category).label, item.spentDate ? dayLabel(item.spentDate) : null, item.status === "planned" ? "planned" : null].filter(Boolean).join(" · ")}
            trailing={
              <Text weight="600" mono tone={item.status === "planned" ? "muted" : "default"}>
                {amountOf(item)}
              </Text>
            }
            onPress={() => setEditing(item)}
          />
        )}
        ListEmptyComponent={<Empty icon="credit-card" title="No expenses yet" body="Record spend on tools, contractors or ads with the + button." />}
        ListFooterComponent={<Footnote currency={ccy} />}
      />
      <Fab label="New expense" onPress={() => setEditing("new")} />
      <FormSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? current.vendor || "Expense" : "New expense"}
        submitLabel={current ? "Save" : "Create"}
        fields={fields}
        initial={initial}
        onSubmit={async (v) => {
          const values = { ...v, amount: v.amount ?? 0 };
          if (current) await patchRecord("expenses", current.id, values);
          else await createRecord("expenses", { ...values, projectId });
        }}
        onDelete={current ? () => deleteRecord("expenses", current.id) : undefined}
        deleteLabel="Delete expense"
      />
    </View>
  );
}

function Filter({ value, onChange, options, counts, total }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; counts: (v: string) => number; total: number }) {
  return <Segmented value={value} onChange={onChange} options={[{ value: "all", label: `All ${total}` }, ...options.map((o) => ({ value: o.value, label: `${o.label} ${counts(o.value)}` }))]} />;
}

function Footnote({ currency }: { currency: string }) {
  const { space } = useTheme();
  return (
    <Text variant="caption" tone="muted" style={{ padding: space.lg, paddingBottom: 110 }}>
      Totals are in {currency}, the project's currency. Each row is in its entity's currency (India ₹, Netherlands €, Global $), converted at the web's fixed rates.
    </Text>
  );
}
