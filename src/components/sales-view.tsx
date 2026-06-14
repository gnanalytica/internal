"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUpRight, Plus } from "lucide-react";

import { DealBoard } from "@/components/deal-board";
import { DealDialog } from "@/components/deal-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createAccount,
  createContact,
  deleteAccount,
  deleteContact,
  moveDeals,
  updateAccount,
  updateContact,
} from "@/lib/actions";
import {
  ACCOUNT_TYPES,
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
  scopeProductId,
  products,
  members,
  initialDeals,
  initialAccounts,
  initialContacts,
}: {
  heading: string;
  scopeProductId: string | null;
  products: Project[];
  members: Member[];
  initialDeals: DealWithRelations[];
  initialAccounts: CrmAccount[];
  initialContacts: ContactWithAccount[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealWithRelations | null>(null);

  const openValue = initialDeals
    .filter((d) => OPEN_DEAL_STAGES.includes(d.stage as (typeof OPEN_DEAL_STAGES)[number]))
    .reduce((sum, d) => sum + (d.value ?? 0), 0);
  const wonValue = initialDeals
    .filter((d) => d.stage === "won")
    .reduce((s, d) => s + (d.value ?? 0), 0);
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
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <h1 className="text-sm font-semibold">{heading}</h1>
        <span className="text-xs text-muted-foreground">
          Open {formatMoney(openValue)} · Won {formatMoney(wonValue)}
        </span>
        <Button size="sm" className="ml-auto gap-1.5" onClick={openNew}>
          <Plus className="size-4" /> New deal
        </Button>
      </header>

      <Tabs defaultValue="pipeline" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="min-h-0 flex-1">
          {initialDeals.length === 0 ? (
            <Empty label="No deals yet. Create your first deal to start the pipeline." />
          ) : (
            <DealBoard
              key={boardKey}
              deals={initialDeals}
              showProduct={!scopeProductId}
              persist={(changed) => startTransition(() => void moveDeals(changed))}
              onOpen={openDeal}
            />
          )}
        </TabsContent>

        <TabsContent value="accounts" className="min-h-0 flex-1 overflow-auto p-4">
          <SectionHeader
            title="Accounts"
            onAdd={() => startTransition(async () => { await createAccount({}); router.refresh(); })}
            addLabel="New account"
          />
          <div className="space-y-1.5">
            {initialAccounts.map((a) => (
              <AccountRow key={a.id} account={a} onChanged={() => router.refresh()} />
            ))}
            {initialAccounts.length === 0 && <Empty inline label="No accounts yet." />}
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="min-h-0 flex-1 overflow-auto p-4">
          <SectionHeader
            title="Contacts"
            onAdd={() => startTransition(async () => { await createContact({}); router.refresh(); })}
            addLabel="New contact"
          />
          <div className="space-y-1.5">
            {initialContacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                accounts={initialAccounts}
                onChanged={() => router.refresh()}
              />
            ))}
            {initialContacts.length === 0 && <Empty inline label="No contacts yet." />}
          </div>
        </TabsContent>
      </Tabs>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deal={editing}
        products={products}
        accounts={initialAccounts}
        contacts={initialContacts}
        members={members}
        scopeProductId={scopeProductId}
        onSaved={() => router.refresh()}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={onAdd}>
        <Plus className="size-4" /> {addLabel}
      </Button>
    </div>
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
      <select defaultValue={account.entity} onChange={(e) => upd({ entity: e.target.value })} className={fieldCls}>
        {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
      </select>
      <input
        defaultValue={account.website ?? ""}
        placeholder="https://"
        onBlur={(e) => e.target.value !== (account.website ?? "") && upd({ website: e.target.value || null })}
        className={fieldCls + " w-40"}
      />
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
  onChanged,
}: {
  contact: ContactWithAccount;
  accounts: CrmAccount[];
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
