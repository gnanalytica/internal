"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";

import { ChartCard, Donut, Legend, type Slice } from "@/components/charts";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
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
import type {
  CampaignWithRelations,
  ContentItemWithCampaign,
  Project,
} from "@/lib/types";

const fieldCls =
  "h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

export function MarketingView({
  heading,
  scopeProjectId,
  initialCampaigns,
  initialContent,
}: {
  heading: string;
  scopeProjectId: string | null;
  projects: Project[];
  initialCampaigns: CampaignWithRelations[];
  initialContent: ContentItemWithCampaign[];
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

      <Tabs defaultValue="campaigns" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="min-h-0 flex-1 overflow-auto p-4">
          {totalBudget > 0 && (
            <ChartCard title="Budget by channel" hint={formatMoney(totalBudget)} className="mb-4">
              <div className="flex items-center gap-4">
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
              <CampaignRow key={c.id} campaign={c} showProject={!scopeProjectId} onChanged={refresh} />
            ))}
            {initialCampaigns.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No campaigns yet.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="content" className="min-h-0 flex-1 overflow-auto p-4">
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
                <div key={s.id} className="flex w-64 shrink-0 flex-col">
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
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <input
        defaultValue={campaign.name}
        onBlur={(e) => e.target.value !== campaign.name && upd({ name: e.target.value })}
        className={fieldCls + " min-w-40 flex-1 font-medium"}
      />
      {showProject && campaign.project && (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
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
      <input
        type="number"
        defaultValue={campaign.budget}
        onBlur={(e) => Number(e.target.value) !== campaign.budget && upd({ budget: Number(e.target.value) || 0 })}
        className={fieldCls + " w-24"}
        placeholder="Budget"
        title="Budget"
      />
      <input
        type="number"
        defaultValue={campaign.reach}
        onBlur={(e) => Number(e.target.value) !== campaign.reach && upd({ reach: Number(e.target.value) || 0 })}
        className={fieldCls + " w-20"}
        placeholder="Reach"
        title="Reach"
      />
      <input
        type="number"
        defaultValue={campaign.replies}
        onBlur={(e) => Number(e.target.value) !== campaign.replies && upd({ replies: Number(e.target.value) || 0 })}
        className={fieldCls + " w-20"}
        placeholder="Replies"
        title="Replies"
      />
      <input
        type="number"
        defaultValue={campaign.conversions}
        onBlur={(e) =>
          Number(e.target.value) !== campaign.conversions &&
          upd({ conversions: Number(e.target.value) || 0 })
        }
        className={fieldCls + " w-20"}
        placeholder="Conv."
        title="Conversions"
      />
      <input
        type="date"
        defaultValue={dateInputValue(campaign.startDate)}
        onChange={(e) => upd({ startDate: e.target.value || null })}
        className={fieldCls}
      />
      <select defaultValue={campaign.entity} onChange={(e) => upd({ entity: e.target.value })} className={fieldCls}>
        {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
      </select>
      <button
        onClick={() => start(async () => { await deleteCampaign(campaign.id); onChanged(); })}
        className="text-xs text-muted-foreground hover:text-destructive"
      >
        Delete
      </button>
    </div>
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
