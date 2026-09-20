"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, ExternalLink } from "lucide-react";

import { LogInteractionForm, Timeline } from "@/components/prospects/interaction-log";
import { ProspectOwnerPicker } from "@/components/prospects/owner-picker";
import { Card, Field } from "@/components/prospects/person-page";
import { SheetFieldGrid } from "@/components/prospects/sheet-fields";
import { ScrollTabsList } from "@/components/responsive";
import { Pill, PRIORITY_COLORS, StatusPill } from "@/components/prospects/status-pill";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { COMPANY_GROUPS } from "@/lib/sheet-crm/fields";
import { COMPANIES } from "@/lib/sheet-crm/mapping";
import type { CompanyView } from "@/lib/sheet-crm/queries";
import type { Member } from "@/lib/types";

export function CompanyPage({ view, backHref, members = [] }: { view: CompanyView; backHref: string; members?: Member[] }) {
  const router = useRouter();
  const { account, record, excluded } = view;
  const cid = account.externalId;
  const refresh = () => router.refresh();
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2.5 sm:px-4">
        <Link href={backHref} className="text-muted-foreground hover:text-foreground" aria-label="Back"><ArrowLeft className="size-4" /></Link>
        <h1 className="min-w-0 text-sm font-semibold">{account.name}</h1>
        {cid && <span className="font-mono text-xs text-muted-foreground">{cid}</span>}
        {account.pnbCategory && <Pill color="#6366f1">PNB {account.pnbCategory}</Pill>}
        {account.constitution && <span className="text-xs text-muted-foreground">{account.constitution}</span>}
        {(account.city || account.state) && <span className="text-xs text-muted-foreground">{[account.city, account.state].filter(Boolean).join(", ")}</span>}
        {account.website && (
          <a href={account.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand hover:underline">
            {account.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
          </a>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ProspectOwnerPicker members={members} ownerId={account.ownerId} accountId={account.id} />
          <StatusPill status={account.outreachStatus} accountId={account.id} onChanged={refresh} readOnly={Boolean(excluded)} />
        </div>
      </header>
      {excluded && (
        <div className="flex items-start gap-2 border-b bg-destructive/10 px-3 py-2 text-sm text-destructive sm:items-center sm:px-4">
          <Ban className="mt-0.5 size-4 shrink-0 sm:mt-0" /> <span><strong>Do not contact.</strong> Listed on the Exclusions tab as “{excluded.name}” — {excluded.action}.</span>
        </div>
      )}
      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <ScrollTabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">People ({view.people.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </ScrollTabsList>
        <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {!record ? (
            <p className="text-sm text-muted-foreground">Not linked to a Companies row in the sheet.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Angle">
                <Field label="Sales angle" value={record.sales_angle} />
                <Field label="Current tooling signal" value={record.current_tooling_signal} />
                <Field label="Volume signal" value={record.volume_signal} />
                <Field label="Research confidence" value={record.research_confidence} />
              </Card>
              <Card title="Decision makers">
                <Field label="Decision makers" value={record.decision_makers} />
                <Field label="Decision maker contacts" value={record.decision_maker_contacts} />
                <Field label="Key people" value={record.key_people} />
              </Card>
              <Card title="Practice">
                <Field label="Service lines" value={record.service_lines} />
                <Field label="Branch offices" value={record.branch_offices} />
                <Field label="Number of valuers" value={record.num_valuers} />
                <Field label="Empanelled with" value={record.empanelled_with} />
              </Card>
              <Card title="Notes">
                <Field label="Remarks" value={record.remarks} />
                <Field label="Sources" value={record.sources} />
                <Field label="Enrichment sources" value={record.enrichment_sources} />
              </Card>
            </div>
          )}
        </TabsContent>
        <TabsContent value="people" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {view.people.length === 0 ? <p className="text-sm text-muted-foreground">No people linked.</p> : (
            <ul className="divide-y rounded-md border bg-background">
              {view.people.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-sm">
                  <Link href={`/people/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  <span className="font-mono text-xs text-muted-foreground">{p.externalId}</span>
                  {p.priority && <Pill color={PRIORITY_COLORS[p.priority]}>Priority {p.priority}</Pill>}
                  <StatusPill status={p.outreachStatus} readOnly />
                  <span className="w-full break-all text-xs text-muted-foreground sm:ml-auto sm:w-auto sm:break-normal">{[p.phone, p.email].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="timeline" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2"><Timeline items={view.interactions} activities={view.activities} /></div>
            {!excluded && <LogInteractionForm accountId={account.id} />}
          </div>
        </TabsContent>
        <TabsContent value="details" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {record && cid ? <SheetFieldGrid spec={COMPANIES} rowKey={cid} record={record} groups={COMPANY_GROUPS} onWritten={refresh} /> : <p className="text-sm text-muted-foreground">No sheet row.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
