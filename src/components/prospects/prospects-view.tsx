"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Ban, Mail, Phone, Search } from "lucide-react";

import { Directories, DataQuality, ResearchQueue, SyncPanel } from "@/components/prospects/panels";
import { BAND_COLORS, Pill, PRIORITY_COLORS, StatusPill } from "@/components/prospects/status-pill";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { searchProspects } from "@/lib/sheet-crm/actions";
import { OUTREACH_STATUSES } from "@/lib/sheet-crm/outreach";
import type { CellWrite, PeopleFilter, ProspectRow, ProspectStats, QualityIssue, QueueItem, SheetRow, SheetSyncRun } from "@/lib/sheet-crm/queries";
import type { CrmAccount } from "@/lib/types";
import { formatDate } from "@/lib/matrix-format";

const fieldCls = "h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

export type ProspectsData = {
  stats: ProspectStats;
  facets: { states: string[]; rvos: string[]; priorities: string[]; bands: string[] };
  board: { rows: ProspectRow[]; total: number };
  accounts: CrmAccount[];
  queue: QueueItem[];
  quality: { issues: QualityIssue[]; counts: Record<string, number> };
  runs: SheetSyncRun[];
  writes: CellWrite[];
  directories: { lenders: SheetRow[]; lenderContacts: SheetRow[]; officers: SheetRow[]; rvos: SheetRow[]; sources: SheetRow[]; personas: SheetRow[] };
  configured: boolean;
  sheetUrl: string | null;
};

export function ProspectsView({ heading, data, dealsHref }: { heading: string; data: ProspectsData; dealsHref?: string }) {
  const { stats } = data;
  const funnel = OUTREACH_STATUSES.filter((s) => (stats.byStatus[s.id] ?? 0) > 0 && s.id !== "not_planned");
  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <>
            <span className="text-xs text-muted-foreground">
              {stats.people.toLocaleString("en-IN")} people · {stats.researched} researched · {stats.scored} scored · {stats.withPhone} with phone
            </span>
            {dealsHref && <Link href={dealsHref} className="text-xs text-brand hover:underline">Deals &amp; tasks →</Link>}
          </>
        }
      />
      {funnel.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-1.5 text-xs">
          <span className="text-muted-foreground">Funnel</span>
          {funnel.map((s) => <Pill key={s.id} color={s.color}>{s.label} {stats.byStatus[s.id]}</Pill>)}
        </div>
      )}
      <Tabs defaultValue="board" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="board">Priority board</TabsTrigger>
          <TabsTrigger value="people">All people</TabsTrigger>
          <TabsTrigger value="companies">Companies ({data.accounts.length})</TabsTrigger>
          <TabsTrigger value="directories">Directories</TabsTrigger>
          <TabsTrigger value="queue">Research queue ({data.queue.length})</TabsTrigger>
          <TabsTrigger value="quality">Data quality{data.quality.issues.length ? ` (${data.quality.issues.length})` : ""}</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="min-h-0 flex-1 overflow-auto p-4">
          <PeopleTable initial={data.board} facets={data.facets} base={{ researched: true, limit: 200 }} />
        </TabsContent>
        <TabsContent value="people" className="min-h-0 flex-1 overflow-auto p-4">
          <PeopleTable initial={null} facets={data.facets} base={{ limit: 100 }} />
        </TabsContent>
        <TabsContent value="companies" className="min-h-0 flex-1 overflow-auto p-4">
          <CompaniesTable accounts={data.accounts} />
        </TabsContent>
        <TabsContent value="directories" className="min-h-0 flex-1 overflow-auto p-4">
          <Directories {...data.directories} />
        </TabsContent>
        <TabsContent value="queue" className="min-h-0 flex-1 overflow-auto p-4">
          <ResearchQueue items={data.queue} />
        </TabsContent>
        <TabsContent value="quality" className="min-h-0 flex-1 overflow-auto p-4">
          <DataQuality issues={data.quality.issues} counts={data.quality.counts} sheetUrl={data.sheetUrl} />
        </TabsContent>
        <TabsContent value="sync" className="min-h-0 flex-1 overflow-auto p-4">
          <SyncPanel runs={data.runs} writes={data.writes} configured={data.configured} sheetUrl={data.sheetUrl} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Server-filtered people list. The search term goes through a server action,
 * never a URL: what gets typed here is routinely a person's name.
 */
function PeopleTable({ initial, facets, base }: { initial: { rows: ProspectRow[]; total: number } | null; facets: ProspectsData["facets"]; base: PeopleFilter }) {
  const router = useRouter();
  const [filter, setFilter] = useState<PeopleFilter>(base);
  const [result, setResult] = useState(initial ?? { rows: [], total: 0 });
  const [pending, start] = useTransition();
  const first = useRef(Boolean(initial));

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => start(async () => setResult(await searchProspects(filter))), 250);
    return () => clearTimeout(t);
  }, [filter]);

  const set = (patch: Partial<PeopleFilter>) => setFilter((f) => ({ ...f, ...patch, offset: 0 }));
  const more = () =>
    start(async () => {
      const next = await searchProspects({ ...filter, offset: result.rows.length });
      setResult({ rows: [...result.rows, ...next.rows], total: next.total });
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
          <input value={filter.q ?? ""} onChange={(e) => set({ q: e.target.value })} placeholder="Name, id, IBBI, email, phone, city, firm" className={fieldCls + " w-72 pl-7"} />
        </div>
        <select value={filter.state ?? ""} onChange={(e) => set({ state: e.target.value || undefined })} className={fieldCls} aria-label="State">
          <option value="">All states</option>
          {facets.states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.priority ?? ""} onChange={(e) => set({ priority: e.target.value || undefined })} className={fieldCls} aria-label="Priority">
          <option value="">Any priority</option>
          {facets.priorities.map((s) => <option key={s} value={s}>Priority {s}</option>)}
        </select>
        <select value={filter.band ?? ""} onChange={(e) => set({ band: e.target.value || undefined })} className={fieldCls} aria-label="Band">
          <option value="">Any band</option>
          {facets.bands.map((s) => <option key={s} value={s}>Band {s}</option>)}
        </select>
        <select value={filter.status ?? ""} onChange={(e) => set({ status: e.target.value || undefined })} className={fieldCls} aria-label="Outreach status">
          <option value="">Any status</option>
          {OUTREACH_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={filter.persona ?? ""} onChange={(e) => set({ persona: (e.target.value || undefined) as PeopleFilter["persona"] })} className={fieldCls} aria-label="Kind">
          <option value="">Valuers + institutional</option>
          <option value="valuer">Valuers only</option>
          <option value="institutional">Institutional only</option>
        </select>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(filter.hasPhone)} onChange={(e) => set({ hasPhone: e.target.checked || undefined })} /> has phone</label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(filter.hasEmail)} onChange={(e) => set({ hasEmail: e.target.checked || undefined })} /> has email</label>
        {base.researched === undefined && (
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(filter.researched)} onChange={(e) => set({ researched: e.target.checked || undefined })} /> researched only</label>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{pending ? "searching…" : `${result.rows.length} of ${result.total.toLocaleString("en-IN")}`}</span>
      </div>
      {result.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{initial === null && !filter.q && !pending ? "Type to search, or pick a filter." : "No people match."}</p>
      ) : (
        <table className="w-full rounded-md border bg-background text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Where</th>
              <th className="px-3 py-2">Priority · score</th>
              <th className="px-3 py-2">First channel</th>
              <th className="px-3 py-2">Outreach</th>
              <th className="px-3 py-2">Last contact</th>
              <th className="px-3 py-2">Reach</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-1.5">
                  <Link href={`/people/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                  {r.excluded && <Ban className="ml-1 inline size-3.5 text-destructive" aria-label="On the Exclusions tab" />}
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{r.externalId}</span>
                    {r.persona === "institutional" && <span className="ml-1">· institutional</span>}
                    {r.account && <span className="ml-1">· {r.account.name}</span>}
                    {r.rvo && <span className="ml-1">· {r.rvo.replace(/Registered Valuers Foundation/i, "RVF")}</span>}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-xs">{[r.city, r.state].filter(Boolean).join(", ")}</td>
                <td className="px-3 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {r.priority && <Pill color={PRIORITY_COLORS[r.priority]}>{r.priority}</Pill>}
                    {r.scoreBand && <Pill color={BAND_COLORS[r.scoreBand.toUpperCase()]}>{r.scoreBand}{r.opportunityScore != null ? ` · ${r.opportunityScore}` : ""}</Pill>}
                    {r.leadScore != null && !r.priority && <span className="font-mono text-xs text-muted-foreground" title="lead_score">{r.leadScore}</span>}
                  </div>
                </td>
                <td className="max-w-56 truncate px-3 py-1.5 text-xs" title={r.bestFirstChannel ?? ""}>{r.bestFirstChannel}</td>
                <td className="px-3 py-1.5"><StatusPill status={r.outreachStatus} contactId={r.id} onChanged={() => router.refresh()} readOnly={Boolean(r.excluded)} /></td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.lastContactedAt ? `${formatDate(r.lastContactedAt)}${r.lastChannel ? ` · ${r.lastChannel}` : ""}` : "—"}</td>
                <td className="px-3 py-1.5 text-xs">
                  <span className="flex gap-1.5">
                    {r.phoneE164 && <Phone className="size-3.5 text-emerald-600" aria-label="Has phone" />}
                    {r.email && <Mail className="size-3.5 text-emerald-600" aria-label="Has email" />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.rows.length < result.total && (
        <button onClick={more} disabled={pending} className="text-xs text-brand hover:underline">Load more</button>
      )}
    </div>
  );
}

function CompaniesTable({ accounts }: { accounts: CrmAccount[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const rows = accounts.filter((a) => !q || [a.name, a.city, a.state, a.website, a.externalId].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies" className={fieldCls + " w-72"} />
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} of {accounts.length}</span>
      </div>
      <table className="w-full rounded-md border bg-background text-sm">
        <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-3 py-2">Company</th><th className="px-3 py-2">Where</th><th className="px-3 py-2">Constitution</th><th className="px-3 py-2">PNB</th><th className="px-3 py-2">Confidence</th><th className="px-3 py-2">Outreach</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="px-3 py-1.5"><Link href={`/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link><div className="font-mono text-xs text-muted-foreground">{a.externalId}</div></td>
              <td className="px-3 py-1.5 text-xs">{[a.city, a.state].filter(Boolean).join(", ")}</td>
              <td className="px-3 py-1.5 text-xs">{a.constitution}</td>
              <td className="px-3 py-1.5 text-xs">{a.pnbCategory}</td>
              <td className="px-3 py-1.5 text-xs">{a.researchConfidence}</td>
              <td className="px-3 py-1.5"><StatusPill status={a.outreachStatus} accountId={a.id} onChanged={() => router.refresh()} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
