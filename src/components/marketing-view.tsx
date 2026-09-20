"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FileText, Plus } from "lucide-react";

import { ChartCard, Donut, Legend, type Slice } from "@/components/charts";
import { DepartmentTasks } from "@/components/department-tasks";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Labelled, ScrollTabsList } from "@/components/responsive";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  attachCrmPage,
  createCampaign,
  createContent,
  deleteCampaign,
  deleteContent,
  updateCampaign,
  updateContent,
} from "@/lib/actions";
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUSES,
  CONTENT_STATUSES,
  ENTITIES,
} from "@/lib/departments";
import { dateInputValue, formatDate, formatMoney } from "@/lib/matrix-format";
import type { CampaignOutcome, ContentAssetRow, SheetRow } from "@/lib/sheet-crm/queries";
import type {
  IssueWithRelations,
  CampaignWithRelations,
  ContentItemWithCampaign,
  Project,
  TaskContext,
} from "@/lib/types";

const fieldCls =
  "h-9 min-w-0 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 sm:h-8";

export function MarketingView({
  heading,
  scopeProjectId,
  ctx,
  initialCampaigns,
  initialContent,
  issues,
  personas = [],
  assets = [],
  outcomes = {},
}: {
  heading: string;
  scopeProjectId: string | null;
  productKey?: string;
  projects: Project[];
  initialCampaigns: CampaignWithRelations[];
  initialContent: ContentItemWithCampaign[];
  issues: IssueWithRelations[];
  ctx: TaskContext;
  /** GTM Personas from the lead sheet. */
  personas?: SheetRow[];
  /** Dossier "Content Asset To Share" strings resolved against the content calendar. */
  assets?: ContentAssetRow[];
  /** Per-campaign reach / replies / meetings computed from logged interactions. */
  outcomes?: Record<string, CampaignOutcome>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const refresh = () => router.refresh();
  const totalBudget = initialCampaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const budgetByChannel: Slice[] = CAMPAIGN_CHANNELS.map((ch) => ({
    label: ch.label,
    value: initialCampaigns
      .filter((c) => c.channel === ch.id)
      .reduce((s, c) => s + (c.budget ?? 0), 0),
    color: ch.color,
  }));

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <span className="text-xs text-muted-foreground">
            {initialCampaigns.length} campaigns · Budget {formatMoney(totalBudget)}
          </span>
        }
      />

      <Tabs defaultValue="tasks" className="flex min-h-0 flex-1 flex-col">
        <ScrollTabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="assets">Assets to make{assets.filter((a) => !a.match).length ? ` (${assets.filter((a) => !a.match).length})` : ""}</TabsTrigger>
          <TabsTrigger value="personas">Personas ({personas.length})</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="assets" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Every asset the Deep Dive dossiers promise to share, and the content-calendar item it resolves to. An unresolved asset is content to make; add it to the calendar with the same title and it links up on the next load.
          </p>
          {assets.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No dossier names a content asset yet (or the sheet is not synced).</div>
          ) : (
            <ul className="divide-y rounded-md border bg-background text-sm">
              {assets.map((a) => (
                <li key={a.asset} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                  <span className={a.match ? "" : "font-medium"}>{a.asset}</span>
                  {a.match ? (
                    <span className="text-xs text-emerald-600">→ {a.match.title} · {a.match.status}{a.match.url ? " · linked" : ""}</span>
                  ) : (
                    <button
                      type="button"
                      className="tap-target text-xs text-brand hover:underline"
                      onClick={() => start(async () => { await createContent({ projectId: scopeProjectId, title: a.asset }); refresh(); })}
                    >
                      Add to calendar
                    </button>
                  )}
                  <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
                    for {a.people.slice(0, 4).map((p, i) => (
                      <span key={p.name}>{i > 0 && ", "}{p.id ? <Link href={`/people/${p.id}`} className="hover:underline">{p.name}</Link> : p.name}</span>
                    ))}{a.people.length > 4 ? ` +${a.people.length - 4}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="personas" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {personas.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">GTM Personas come from the lead sheet; nothing synced yet.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {personas.map((r) => (
                <section key={r.id} className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{r.data.Persona}</h3>
                    <span className="rounded-full border px-2 text-[11px]">{r.data["GTM Role"]}</span>
                    {r.data.Priority && <span className="rounded-full border px-2 text-[11px]">Priority {r.data.Priority}</span>}
                    <span className="text-xs text-muted-foreground">{r.data["Buyer/User/Influencer"]}</span>
                  </div>
                  {(["Why It Matters", "What We Want", "Best Hook", "Content / Demo To Show", "What To Avoid", "Research Criteria"] as const).map((h) => r.data[h] ? (
                    <div key={h} className="mt-2"><div className="text-[11px] text-muted-foreground">{h}</div><div>{r.data[h]}</div></div>
                  ) : null)}
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="min-h-0 flex-1 overflow-hidden">
          <DepartmentTasks
            issues={issues}
            department="marketing"
            ctx={ctx}
            projectId={scopeProjectId}
            emptyLabel="No marketing tasks yet."
          />
        </TabsContent>

        <TabsContent value="campaigns" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {totalBudget > 0 && (
            <ChartCard title="Budget by channel" hint={formatMoney(totalBudget)} className="mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <Donut
                  data={budgetByChannel}
                  center={
                    <div>
                      <div className="text-sm font-bold leading-none">{formatMoney(totalBudget)}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">budget</div>
                    </div>
                  }
                />
                <Legend data={budgetByChannel.filter((c) => c.value > 0)} className="flex-col" />
              </div>
            </ChartCard>
          )}
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Campaigns</h2>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1.5"
              onClick={() => start(async () => { await createCampaign({ projectId: scopeProjectId }); refresh(); })}
            >
              <Plus className="size-4" /> New campaign
            </Button>
          </div>
          <div className="space-y-1.5">
            {initialCampaigns.map((c) => (
              <div key={c.id}>
                <CampaignRow campaign={c} showProject={!scopeProjectId} onChanged={refresh} />
                {outcomes[c.id] && (
                  <div className="px-2 pt-1 text-[11px] text-muted-foreground">
                    Logged: {outcomes[c.id].sent} sent · {outcomes[c.id].replies} replies · {outcomes[c.id].meetings} meetings · {outcomes[c.id].people} people
                  </div>
                )}
              </div>
            ))}
            {initialCampaigns.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No campaigns yet.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="content" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Content calendar</h2>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1.5"
              onClick={() => start(async () => { await createContent({ projectId: scopeProjectId }); refresh(); })}
            >
              <Plus className="size-4" /> New content
            </Button>
          </div>
          <div className="scrollbar-thin flex gap-3 overflow-x-auto">
            {CONTENT_STATUSES.map((s) => {
              const items = initialContent.filter((c) => c.status === s.id);
              return (
                <div key={s.id} className="flex w-[17rem] max-w-[85vw] shrink-0 flex-col sm:w-64 sm:max-w-none">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="flex min-h-24 flex-1 flex-col gap-2 rounded-lg bg-muted/40 p-2">
                    {items.map((c) => (
                      <ContentCard key={c.id} item={c} onChanged={refresh} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Opens the campaign brief, creating it on first click. The structured fields
 * live on the row; the copy, targeting and creative links live on the page.
 */
function BriefLink({ id, pageId }: { id: string; pageId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { pageId: target } = await attachCrmPage("campaign", id);
          router.push(`/pages/${target}`);
        })
      }
      className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      title={pageId ? "Open brief" : "Create a brief page"}
    >
      <FileText className="size-3.5" /> {pageId ? "Brief" : "+ Brief"}
    </button>
  );
}

function CampaignRow({
  campaign,
  showProject,
  onChanged,
}: {
  campaign: CampaignWithRelations;
  showProject: boolean;
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  const upd = (patch: Parameters<typeof updateCampaign>[1]) =>
    start(async () => { await updateCampaign(campaign.id, patch); onChanged(); });
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border bg-background p-2 lg:flex lg:flex-wrap lg:items-center">
      <input
        defaultValue={campaign.name}
        onBlur={(e) => e.target.value !== campaign.name && upd({ name: e.target.value })}
        className={fieldCls + " col-span-2 font-medium lg:min-w-40 lg:flex-1"}
      />
      {showProject && campaign.project && (
        <span className="col-span-2 flex items-center gap-1 text-[11px] text-muted-foreground lg:col-span-1">
          <span className="size-2 rounded-full" style={{ backgroundColor: campaign.project.color }} />
          {campaign.project.name}
        </span>
      )}
      <select defaultValue={campaign.channel} onChange={(e) => upd({ channel: e.target.value })} className={fieldCls}>
        {CAMPAIGN_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <select defaultValue={campaign.status} onChange={(e) => upd({ status: e.target.value })} className={fieldCls}>
        {CAMPAIGN_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <Num label="Budget" width="lg:w-24" value={campaign.budget} onCommit={(budget) => upd({ budget })} />
      <Num label="Reach" width="lg:w-20" value={campaign.reach} onCommit={(reach) => upd({ reach })} />
      <Num label="Replies" width="lg:w-20" value={campaign.replies} onCommit={(replies) => upd({ replies })} />
      <Num label="Conversions" width="lg:w-20" value={campaign.conversions} onCommit={(conversions) => upd({ conversions })} />
      <input
        type="date"
        defaultValue={dateInputValue(campaign.startDate)}
        onChange={(e) => upd({ startDate: e.target.value || null })}
        className={fieldCls}
      />
      <select defaultValue={campaign.entity} onChange={(e) => upd({ entity: e.target.value })} className={fieldCls}>
        {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
      </select>
      <div className="col-span-2 flex items-center gap-3 lg:col-span-1 lg:contents">
        <BriefLink id={campaign.id} pageId={campaign.pageId} />
        <button
          type="button"
          onClick={() => start(async () => { await deleteCampaign(campaign.id); onChanged(); })}
          className="tap-target ml-auto text-xs text-muted-foreground hover:text-destructive lg:ml-0"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/**
 * A campaign metric. Named on a phone by `Labelled`; on a laptop it is the same
 * bare fixed-width input in the row it always was.
 */
function Num({
  label,
  width,
  value,
  onCommit,
}: {
  label: string;
  width: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  return (
    <Labelled label={label} className={width}>
      <input
        type="number"
        inputMode="numeric"
        defaultValue={value}
        onBlur={(e) => Number(e.target.value) !== value && onCommit(Number(e.target.value) || 0)}
        className={fieldCls + " w-full " + width}
        placeholder={label}
        title={label}
        aria-label={label}
      />
    </Labelled>
  );
}

function ContentCard({ item, onChanged }: { item: ContentItemWithCampaign; onChanged: () => void }) {
  const [, start] = useTransition();
  const upd = (patch: Parameters<typeof updateContent>[1]) =>
    start(async () => { await updateContent(item.id, patch); onChanged(); });
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-sm">
      <input
        defaultValue={item.title}
        onBlur={(e) => e.target.value !== item.title && upd({ title: e.target.value })}
        className="w-full bg-transparent text-sm font-medium focus:outline-none"
      />
      <div className="mt-1.5 flex items-center gap-1">
        <input
          defaultValue={item.url ?? ""}
          onBlur={(e) => (e.target.value || null) !== item.url && upd({ url: e.target.value || null })}
          placeholder="Asset / link URL"
          className="min-w-0 flex-1 rounded border bg-background px-1.5 py-1 text-[11px] focus:outline-none"
        />
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] text-brand hover:underline"
          >
            Open
          </a>
        )}
      </div>
      <textarea
        defaultValue={item.notes ?? ""}
        onBlur={(e) => (e.target.value || null) !== item.notes && upd({ notes: e.target.value || null })}
        placeholder="Notes / copy…"
        rows={2}
        className="mt-1 w-full resize-y rounded border bg-background px-1.5 py-1 text-[11px] focus:outline-none"
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <select
          defaultValue={item.status}
          onChange={(e) => upd({ status: e.target.value })}
          className="h-7 rounded border bg-background px-1 text-xs"
        >
          {CONTENT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(item.publishDate)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{item.campaign?.name ?? "No campaign"}</span>
        <button
          onClick={() => start(async () => { await deleteContent(item.id); onChanged(); })}
          className="text-[11px] text-muted-foreground hover:text-destructive"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
