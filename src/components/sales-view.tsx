"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowUpRight, FileText, Plus } from "lucide-react";

import { DealBoard } from "@/components/deal-board";
import { DealDialog } from "@/components/deal-dialog";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  attachCrmPage,
  createAccount,
  createContact,
  deleteAccount,
  deleteContact,
  moveDeals,
  updateAccount,
  updateContact,
} from "@/lib/actions";
import { ChannelPicker } from "@/components/pickers";
import { CRM_CHANNELS } from "@/lib/constants";
import { ChartCard, ColumnChart, type Slice } from "@/components/charts";
import {
  ACCOUNT_TYPES,
  DEAL_STAGES,
  ENTITIES,
  LIFECYCLE_STAGES,
  OPEN_DEAL_STAGES,
} from "@/lib/departments";
import { formatMoney } from "@/lib/matrix-format";
import type {
  ContactWithAccount,
  CrmAccount,
  DealWithRelations,
  Member,
  Project,
} from "@/lib/types";

const fieldCls =
  "h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

export function SalesView({
  heading,
  scopeProjectId,
  projects,
  members,
  initialDeals,
  initialAccounts,
  initialContacts,
}: {
  heading: string;
  scopeProjectId: string | null;
  projects: Project[];
  members: Member[];
  initialDeals: DealWithRelations[];
  initialAccounts: CrmAccount[];
  initialContacts: ContactWithAccount[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealWithRelations | null>(null);
  // The lists run to hundreds of rows once a lead database is loaded, so both
  // tabs filter before they render.
  const [accountFilter, setAccountFilter] = useState<Filter>({ q: "", channel: "" });
  const [contactFilter, setContactFilter] = useState<Filter>({ q: "", channel: "" });

  const accounts = useMemo(
    () =>
      initialAccounts.filter(
        (a) =>
          (!accountFilter.channel || a.channel === accountFilter.channel) &&
          matches(accountFilter.q, a.name, a.industry, a.website),
      ),
    [initialAccounts, accountFilter],
  );
  const contacts = useMemo(
    () =>
      initialContacts.filter(
        (c) =>
          (!contactFilter.channel || c.channel === contactFilter.channel) &&
          matches(contactFilter.q, c.name, c.email, c.title, c.account?.name),
      ),
    [initialContacts, contactFilter],
  );

  const openValue = initialDeals
    .filter((d) => OPEN_DEAL_STAGES.includes(d.stage as (typeof OPEN_DEAL_STAGES)[number]))
    .reduce((sum, d) => sum + (d.value ?? 0), 0);
  const wonValue = initialDeals
    .filter((d) => d.stage === "won")
    .reduce((s, d) => s + (d.value ?? 0), 0);
  const stageValue: Slice[] = DEAL_STAGES.map((s) => ({
    label: s.label,
    value: initialDeals
      .filter((d) => d.stage === s.id)
      .reduce((sum, d) => sum + (d.value ?? 0), 0),
    color: s.color,
  }));
  // Remount the board when the set of deals changes (create/delete) so server
  // refreshes flow in; drag (which doesn't change the id-set) keeps board state.
  const boardKey = initialDeals.map((d) => d.id).join(",");

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openDeal(d: DealWithRelations) {
    setEditing(d);
    setDialogOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <>
            <span className="text-xs text-muted-foreground">
              Open {formatMoney(openValue)} · Won {formatMoney(wonValue)}
            </span>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="size-4" /> New deal
            </Button>
          </>
        }
      />

      <Tabs defaultValue="pipeline" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="flex min-h-0 flex-1 flex-col">
          {initialDeals.length === 0 ? (
            <Empty label="No deals yet. Create your first deal to start the pipeline." />
          ) : (
            <>
              <div className="px-4 pt-3">
                <ChartCard title="Pipeline by stage" hint={`${initialDeals.length} deals`}>
                  <ColumnChart data={stageValue} format={(n) => formatMoney(n)} />
                </ChartCard>
              </div>
              <div className="min-h-0 flex-1">
                <DealBoard
                  key={boardKey}
                  deals={initialDeals}
                  showProject={!scopeProjectId}
                  persist={(changed) => startTransition(() => void moveDeals(changed))}
                  onOpen={openDeal}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="min-h-0 flex-1 overflow-auto p-4">
          <SectionHeader
            title="Accounts"
            count={`${accounts.length} of ${initialAccounts.length}`}
            onAdd={() => startTransition(async () => { await createAccount({}); router.refresh(); })}
            addLabel="New account"
          />
          <FilterBar
            value={accountFilter}
            onChange={setAccountFilter}
            placeholder="Search name, industry, website"
            rows={initialAccounts}
          />
          <div className="space-y-1.5">
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} onChanged={() => router.refresh()} />
            ))}
            {accounts.length === 0 && (
              <Empty inline label={initialAccounts.length ? "No accounts match." : "No accounts yet."} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="min-h-0 flex-1 overflow-auto p-4">
          <SectionHeader
            title="Contacts"
            count={`${contacts.length} of ${initialContacts.length}`}
            onAdd={() => startTransition(async () => { await createContact({}); router.refresh(); })}
            addLabel="New contact"
          />
          <FilterBar
            value={contactFilter}
            onChange={setContactFilter}
            placeholder="Search name, email, title, account"
            rows={initialContacts}
          />
          <div className="space-y-1.5">
            {contacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                accounts={initialAccounts}
                contacts={initialContacts}
                onChanged={() => router.refresh()}
              />
            ))}
            {contacts.length === 0 && (
              <Empty inline label={initialContacts.length ? "No contacts match." : "No contacts yet."} />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deal={editing}
        projects={projects}
        accounts={initialAccounts}
        contacts={initialContacts}
        members={members}
        scopeProjectId={scopeProjectId}
        onSaved={() => router.refresh()}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

type Filter = { q: string; channel: string };

function matches(q: string, ...fields: (string | null | undefined)[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

function SectionHeader({
  title,
  count,
  onAdd,
  addLabel,
}: {
  title: string;
  count?: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {count && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
      <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={onAdd}>
        <Plus className="size-4" /> {addLabel}
      </Button>
    </div>
  );
}

/** Search + channel filter. Channel buttons show their live count. */
function FilterBar({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  placeholder: string;
  rows: { channel: string }[];
}) {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.channel, (counts.get(r.channel) ?? 0) + 1);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <input
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
        placeholder={placeholder}
        className={fieldCls + " w-64"}
        aria-label={placeholder}
      />
      <div className="flex flex-wrap items-center gap-1">
        {CRM_CHANNELS.filter((c) => counts.get(c.id)).map((c) => {
          const on = value.channel === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onChange({ ...value, channel: on ? "" : c.id })}
              aria-pressed={on}
              className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
              style={{
                borderColor: `color-mix(in oklch, ${c.color} ${on ? "70%" : "30%"}, transparent)`,
                color: c.color,
                backgroundColor: `color-mix(in oklch, ${c.color} ${on ? "22%" : "8%"}, transparent)`,
              }}
            >
              {c.label} {counts.get(c.id)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Opens this record's deck/pitch page, creating it on first click. */
function DeckLink({ kind, id, pageId }: { kind: "account" | "contact"; id: string; pageId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { pageId: target } = await attachCrmPage(kind, id);
          router.push(`/pages/${target}`);
        })
      }
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      title={pageId ? "Open deck & notes" : "Create a deck & notes page"}
    >
      <FileText className="size-3.5" /> {pageId ? "Deck" : "+ Deck"}
    </button>
  );
}

function AccountRow({ account, onChanged }: { account: CrmAccount; onChanged: () => void }) {
  const [, start] = useTransition();
  const upd = (patch: Parameters<typeof updateAccount>[1]) =>
    start(async () => { await updateAccount(account.id, patch); onChanged(); });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <input
        defaultValue={account.name}
        onBlur={(e) => e.target.value !== account.name && upd({ name: e.target.value })}
        className={fieldCls + " min-w-40 flex-1 font-medium"}
      />
      <select defaultValue={account.type} onChange={(e) => upd({ type: e.target.value })} className={fieldCls}>
        {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <input
        defaultValue={account.industry ?? ""}
        placeholder="Industry"
        onBlur={(e) => e.target.value !== (account.industry ?? "") && upd({ industry: e.target.value || null })}
        className={fieldCls + " w-32"}
      />
      <ChannelPicker value={account.channel} onChange={(channel) => upd({ channel })} />
      <select defaultValue={account.entity} onChange={(e) => upd({ entity: e.target.value })} className={fieldCls}>
        {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
      </select>
      <input
        defaultValue={account.website ?? ""}
        placeholder="https://"
        onBlur={(e) => e.target.value !== (account.website ?? "") && upd({ website: e.target.value || null })}
        className={fieldCls + " w-40"}
      />
      <DeckLink kind="account" id={account.id} pageId={account.pageId} />
      <Link
        href={`/accounts/${account.id}`}
        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
      >
        Open <ArrowUpRight className="size-3.5" />
      </Link>
      <button
        onClick={() => start(async () => { await deleteAccount(account.id); onChanged(); })}
        className="text-xs text-muted-foreground hover:text-destructive"
      >
        Delete
      </button>
    </div>
  );
}

function ContactRow({
  contact,
  accounts,
  contacts,
  onChanged,
}: {
  contact: ContactWithAccount;
  accounts: CrmAccount[];
  contacts: ContactWithAccount[];
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  const upd = (patch: Parameters<typeof updateContact>[1]) =>
    start(async () => { await updateContact(contact.id, patch); onChanged(); });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <input
        defaultValue={contact.name}
        onBlur={(e) => e.target.value !== contact.name && upd({ name: e.target.value })}
        className={fieldCls + " min-w-32 flex-1 font-medium"}
      />
      <input
        defaultValue={contact.email ?? ""}
        placeholder="email"
        onBlur={(e) => e.target.value !== (contact.email ?? "") && upd({ email: e.target.value || null })}
        className={fieldCls + " w-44"}
      />
      <input
        defaultValue={contact.title ?? ""}
        placeholder="Title"
        onBlur={(e) => e.target.value !== (contact.title ?? "") && upd({ title: e.target.value || null })}
        className={fieldCls + " w-32"}
      />
      <select
        defaultValue={contact.accountId ?? ""}
        onChange={(e) => upd({ accountId: e.target.value || null })}
        className={fieldCls}
      >
        <option value="">No account</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select
        defaultValue={contact.lifecycleStage}
        onChange={(e) => upd({ lifecycleStage: e.target.value })}
        className={fieldCls}
      >
        {LIFECYCLE_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <ChannelPicker value={contact.channel} onChange={(channel) => upd({ channel })} />
      <select
        defaultValue={contact.referredById ?? ""}
        onChange={(e) => upd({ referredById: e.target.value || null })}
        className={fieldCls + " max-w-44"}
        aria-label="Referred by"
        title="Referred by"
      >
        <option value="">No referrer</option>
        {contacts
          .filter((c) => c.id !== contact.id)
          .map((c) => <option key={c.id} value={c.id}>↩ {c.name}</option>)}
      </select>
      <DeckLink kind="contact" id={contact.id} pageId={contact.pageId} />
      <button
        onClick={() => start(async () => { await deleteContact(contact.id); onChanged(); })}
        className="text-xs text-muted-foreground hover:text-destructive"
      >
        Delete
      </button>
    </div>
  );
}

function Empty({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <div className={inline ? "py-6 text-center text-sm text-muted-foreground" : "grid h-full place-items-center text-sm text-muted-foreground"}>
      {label}
    </div>
  );
}
