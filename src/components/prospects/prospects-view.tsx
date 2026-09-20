"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Ban, Mail, Phone, Search, X } from "lucide-react";
import { toast } from "sonner";

import { AssigneePicker } from "@/components/pickers";
import { ProspectOwnerPicker } from "@/components/prospects/owner-picker";
import { Directories, DataQuality, ResearchQueue, SyncPanel } from "@/components/prospects/panels";
import { FilterBar, ScrollTabsList, TableScroll } from "@/components/responsive";
import { BAND_COLORS, Pill, PRIORITY_COLORS, StatusPill } from "@/components/prospects/status-pill";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { searchProspects, setProspectOwner } from "@/lib/sheet-crm/actions";
import { OUTREACH_STATUSES } from "@/lib/sheet-crm/outreach";
import { MINE, UNASSIGNED } from "@/lib/sheet-crm/ownership";
import type { CellWrite, PeopleFilter, ProspectRow, ProspectStats, QualityIssue, QueueItem, SheetRow, SheetSyncRun } from "@/lib/sheet-crm/queries";
import type { CrmAccount, Member } from "@/lib/types";
import { formatDate } from "@/lib/matrix-format";

const fieldCls = "h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 sm:h-8 sm:w-auto";
const panelCls = "min-h-0 flex-1 overflow-auto p-3 sm:p-4";

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
  /** Workspace members, for the owner picker and the owner filter. */
  members: Member[];
  /** Resolves the "Mine" filter to an id without making the cached query per-viewer. */
  currentUserId: string;
  configured: boolean;
  /** False until `pnpm db:push` has run: the sync tables do not exist yet. */
  schemaReady: boolean;
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
            {/* The full line is the one a laptop has room for; a phone gets the
                headline count and reads the rest from the stats strip below. */}
            <span className="hidden truncate text-xs text-muted-foreground lg:inline">
              {stats.people.toLocaleString("en-IN")} people · {stats.researched} researched · {stats.scored} scored · {stats.withPhone} with phone{stats.unassigned ? ` · ${stats.unassigned} unassigned` : ""}{stats.duplicates ? ` · ${stats.duplicates} flagged duplicate` : ""}
            </span>
            <span className="text-xs whitespace-nowrap text-muted-foreground lg:hidden">{stats.people.toLocaleString("en-IN")} people</span>
            {dealsHref && <Link href={dealsHref} className="whitespace-nowrap text-xs text-brand hover:underline">Deals →</Link>}
          </>
        }
      />
      {!data.schemaReady && (
        <div className="border-b bg-amber-500/10 px-3 py-2 text-sm sm:px-4">
          <strong>Not set up yet.</strong> The sync tables do not exist in this database. Run <code className="rounded bg-muted px-1">pnpm db:push</code>, then press Sync now under the Sync tab. Nothing is lost; there is simply nothing to show until then.
        </div>
      )}
      {data.schemaReady && !data.configured && (
        <div className="border-b bg-amber-500/10 px-3 py-2 text-sm sm:px-4">
          <strong>Sheet sync is not configured on this deployment.</strong> Set <code className="rounded bg-muted px-1">GOOGLE_SA_EMAIL</code>, <code className="rounded bg-muted px-1">GOOGLE_SA_PRIVATE_KEY</code> and <code className="rounded bg-muted px-1">VALYTICA_CRM_SHEET_ID</code>, then redeploy.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-1.5 text-xs sm:px-4 lg:hidden">
        <span className="text-muted-foreground">{stats.researched} researched · {stats.scored} scored · {stats.withPhone} with phone{stats.unassigned ? ` · ${stats.unassigned} unassigned` : ""}{stats.duplicates ? ` · ${stats.duplicates} dup` : ""}</span>
      </div>
      {funnel.length > 0 && (
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto border-b px-3 py-1.5 text-xs sm:flex-wrap sm:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-muted-foreground">Funnel</span>
          {funnel.map((s) => <Pill key={s.id} color={s.color}>{s.label} {stats.byStatus[s.id]}</Pill>)}
        </div>
      )}
      <Tabs defaultValue="board" className="flex min-h-0 flex-1 flex-col">
        <ScrollTabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="companies">Companies ({data.accounts.length})</TabsTrigger>
          <TabsTrigger value="directories">Directories</TabsTrigger>
          <TabsTrigger value="queue">Queue ({data.queue.length})</TabsTrigger>
          <TabsTrigger value="quality">Quality{data.quality.issues.length ? ` (${data.quality.issues.length})` : ""}</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
        </ScrollTabsList>
        <TabsContent value="board" className={panelCls}>
          <PeopleTable initial={data.board} facets={data.facets} base={{ researched: true, limit: 200 }} members={data.members} currentUserId={data.currentUserId} />
        </TabsContent>
        <TabsContent value="people" className={panelCls}>
          <PeopleTable initial={null} facets={data.facets} base={{ limit: 100 }} members={data.members} currentUserId={data.currentUserId} />
        </TabsContent>
        <TabsContent value="companies" className={panelCls}>
          <CompaniesTable accounts={data.accounts} members={data.members} />
        </TabsContent>
        <TabsContent value="directories" className={panelCls}>
          <Directories {...data.directories} />
        </TabsContent>
        <TabsContent value="queue" className={panelCls}>
          <ResearchQueue items={data.queue} />
        </TabsContent>
        <TabsContent value="quality" className={panelCls}>
          <DataQuality issues={data.quality.issues} counts={data.quality.counts} sheetUrl={data.sheetUrl} />
        </TabsContent>
        <TabsContent value="sync" className={panelCls}>
          <SyncPanel runs={data.runs} writes={data.writes} configured={data.configured} sheetUrl={data.sheetUrl} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** The identity block, identical in the card and the table so the two cannot drift. */
function PersonIdentity({ r }: { r: ProspectRow }) {
  return (
    <>
      <Link href={`/people/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
      {r.excluded && <Ban className="ml-1 inline size-3.5 text-destructive" aria-label="On the Exclusions tab" />}
      {r.sheetDuplicate && <span className="ml-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-1.5 text-[10px] text-amber-700" title="The sheet flags this row as a duplicate of another">dup</span>}
      <div className="text-xs text-muted-foreground">
        <span className="font-mono">{r.externalId}</span>
        {r.persona === "institutional" && <span className="ml-1">· institutional</span>}
        {r.account && <span className="ml-1">· {r.account.name}</span>}
        {r.rvo && <span className="ml-1">· {r.rvo.replace(/Registered Valuers Foundation/i, "RVF")}</span>}
      </div>
    </>
  );
}

function PersonScores({ r }: { r: ProspectRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {r.priority && <Pill color={PRIORITY_COLORS[r.priority]}>{r.priority}</Pill>}
      {r.scoreBand && <Pill color={BAND_COLORS[r.scoreBand.toUpperCase()]}>{r.scoreBand}{r.opportunityScore != null ? ` · ${r.opportunityScore}` : ""}</Pill>}
      {r.leadScore != null && !r.priority && <span className="font-mono text-xs text-muted-foreground" title="lead_score">{r.leadScore}</span>}
    </div>
  );
}

function ReachIcons({ r }: { r: ProspectRow }) {
  return (
    <span className="flex gap-1.5">
      {r.phoneE164 && <Phone className="size-3.5 text-emerald-600" aria-label="Has phone" />}
      {r.email && <Mail className="size-3.5 text-emerald-600" aria-label="Has email" />}
    </span>
  );
}

const checkboxCls = "size-4 shrink-0 accent-[var(--brand)]";

/**
 * Server-filtered people list. The search term goes through a server action,
 * never a URL: what gets typed here is routinely a person's name.
 *
 * Below `sm` the same rows render as cards. A seven-column table on a 360px
 * screen is either unreadable or a sideways scroll over the one screen this
 * product is most often opened on — standing in front of a valuer's office.
 */
function PeopleTable({
  initial,
  facets,
  base,
  members,
  currentUserId,
}: {
  initial: { rows: ProspectRow[]; total: number } | null;
  facets: ProspectsData["facets"];
  base: PeopleFilter;
  members: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<PeopleFilter>(base);
  const [result, setResult] = useState(initial ?? { rows: [], total: 0 });
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const first = useRef(Boolean(initial));

  // "Mine" is a label, not a stored value: it resolves to the viewer's id here
  // so the cached query stays a pure function of its arguments.
  const [ownerChoice, setOwnerChoice] = useState("");
  const ownerFilter = ownerChoice === MINE ? currentUserId : ownerChoice || undefined;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => start(async () => setResult(await searchProspects({ ...filter, owner: ownerFilter }))), 250);
    return () => clearTimeout(t);
  }, [filter, ownerFilter]);

  const set = (patch: Partial<PeopleFilter>) => setFilter((f) => ({ ...f, ...patch, offset: 0 }));
  const reload = () =>
    start(async () => {
      // Keep the window the valuer has already paged open, rather than
      // collapsing it back to the first page after an assignment.
      const next = await searchProspects({ ...filter, owner: ownerFilter, limit: Math.max(result.rows.length, filter.limit ?? 100), offset: 0 });
      setResult(next);
    });
  const more = () =>
    start(async () => {
      const next = await searchProspects({ ...filter, owner: ownerFilter, offset: result.rows.length });
      setResult({ rows: [...result.rows, ...next.rows], total: next.total });
    });

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShown = result.rows.length > 0 && result.rows.every((r) => picked.has(r.id));
  const toggleAll = () => setPicked(allShown ? new Set() : new Set(result.rows.map((r) => r.id)));

  const check = "col-span-2 flex items-center gap-2 text-xs sm:col-span-1";
  const summary = pending ? "searching…" : `${result.rows.length} of ${result.total.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filter.q ?? ""}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Name, id, IBBI, email, phone, city, firm"
          className="h-10 w-full rounded-md border bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 sm:h-9"
        />
      </div>
      <FilterBar summary={summary}>
        <select value={ownerChoice} onChange={(e) => setOwnerChoice(e.target.value)} className={fieldCls} aria-label="Owner">
          <option value="">Anyone&rsquo;s</option>
          <option value={MINE}>Mine</option>
          <option value={UNASSIGNED}>Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
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
        <select value={filter.persona ?? ""} onChange={(e) => set({ persona: (e.target.value || undefined) as PeopleFilter["persona"] })} className={`${fieldCls} col-span-2 sm:col-span-1`} aria-label="Kind">
          <option value="">Valuers + institutional</option>
          <option value="valuer">Valuers only</option>
          <option value="institutional">Institutional only</option>
        </select>
        <label className={check}><input type="checkbox" className={checkboxCls} checked={Boolean(filter.hasPhone)} onChange={(e) => set({ hasPhone: e.target.checked || undefined })} /> has phone</label>
        <label className={check}><input type="checkbox" className={checkboxCls} checked={Boolean(filter.hasEmail)} onChange={(e) => set({ hasEmail: e.target.checked || undefined })} /> has email</label>
        {base.researched === undefined && (
          <label className={check}><input type="checkbox" className={checkboxCls} checked={Boolean(filter.researched)} onChange={(e) => set({ researched: e.target.checked || undefined })} /> researched only</label>
        )}
        <label className={check} title="The sheet's own duplicate_flag"><input type="checkbox" className={checkboxCls} checked={Boolean(filter.hideDuplicates)} onChange={(e) => set({ hideDuplicates: e.target.checked || undefined })} /> hide duplicates</label>
      </FilterBar>

      <BulkAssign
        picked={picked}
        members={members}
        onDone={() => {
          // The server render (the headline counts) is refreshed by the action
          // itself; this list is client state and has to be re-fetched.
          setPicked(new Set());
          reload();
        }}
        onClear={() => setPicked(new Set())}
      />

      {result.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{initial === null && !filter.q && !pending ? "Type to search, or pick a filter." : "No people match."}</p>
      ) : (
        <>
          {/* Phone: one card per person. */}
          <ul className="space-y-2 sm:hidden">
            {result.rows.map((r) => (
              <li key={r.id} className="rounded-md border bg-background p-3 text-sm">
                <div className="flex items-start gap-2">
                  <input type="checkbox" className={checkboxCls + " mt-1"} checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                  <div className="min-w-0 flex-1">
                    <PersonIdentity r={r} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PersonScores r={r} />
                  <ReachIcons r={r} />
                  <span className="text-xs text-muted-foreground">{[r.city, r.state].filter(Boolean).join(", ")}</span>
                </div>
                {r.bestFirstChannel && <div className="mt-1.5 text-xs text-muted-foreground">First channel: {r.bestFirstChannel}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={r.outreachStatus} contactId={r.id} onChanged={() => router.refresh()} readOnly={Boolean(r.excluded)} />
                  <ProspectOwnerPicker members={members} ownerId={r.ownerId} contactId={r.id} onChanged={reload} />
                  <span className="text-xs text-muted-foreground">{r.lastContactedAt ? `Last contact ${formatDate(r.lastContactedAt)}${r.lastChannel ? ` · ${r.lastChannel}` : ""}` : "Never contacted"}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet and up: the dense table, with the softer columns held back
              until there is room for them. */}
          <TableScroll className="hidden sm:block">
            <table className="w-full min-w-[44rem] rounded-md border bg-background text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-8 px-2 py-2">
                    <input type="checkbox" className={checkboxCls} checked={allShown} onChange={toggleAll} aria-label="Select every person shown" />
                  </th>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Where</th>
                  <th className="px-3 py-2">Priority · score</th>
                  <th className="hidden px-3 py-2 xl:table-cell">First channel</th>
                  <th className="px-3 py-2">Outreach</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="hidden px-3 py-2 lg:table-cell">Last contact</th>
                  <th className="px-3 py-2">Reach</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} className={`border-t align-top ${picked.has(r.id) ? "bg-brand/5" : ""}`}>
                    <td className="px-2 py-1.5">
                      <input type="checkbox" className={checkboxCls + " mt-1"} checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                    </td>
                    <td className="px-3 py-1.5"><PersonIdentity r={r} /></td>
                    <td className="px-3 py-1.5 text-xs">{[r.city, r.state].filter(Boolean).join(", ")}</td>
                    <td className="px-3 py-1.5"><PersonScores r={r} /></td>
                    <td className="hidden max-w-56 truncate px-3 py-1.5 text-xs xl:table-cell" title={r.bestFirstChannel ?? ""}>{r.bestFirstChannel}</td>
                    <td className="px-3 py-1.5"><StatusPill status={r.outreachStatus} contactId={r.id} onChanged={() => router.refresh()} readOnly={Boolean(r.excluded)} /></td>
                    <td className="px-3 py-1.5"><ProspectOwnerPicker members={members} ownerId={r.ownerId} contactId={r.id} onChanged={reload} /></td>
                    <td className="hidden px-3 py-1.5 text-xs text-muted-foreground lg:table-cell">{r.lastContactedAt ? `${formatDate(r.lastContactedAt)}${r.lastChannel ? ` · ${r.lastChannel}` : ""}` : "—"}</td>
                    <td className="px-3 py-1.5 text-xs"><ReachIcons r={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
      {result.rows.length < result.total && (
        <button onClick={more} disabled={pending} className="h-10 w-full rounded-md border text-sm text-brand hover:bg-accent/40 disabled:opacity-60 sm:h-8 sm:w-auto sm:border-0 sm:px-0 sm:text-xs sm:hover:bg-transparent sm:hover:underline">
          {pending ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

/**
 * Assign everyone ticked in one go.
 *
 * Splitting a few hundred researched people between three valuers is the
 * reason the owner field exists, and one popover per person is not a way to do
 * it. Sticky, because the selection is made by scrolling.
 */
function BulkAssign({
  picked,
  members,
  onDone,
  onClear,
}: {
  picked: Set<string>;
  members: Member[];
  onDone: () => void;
  onClear: () => void;
}) {
  const [pending, start] = useTransition();
  const ids = useMemo(() => [...picked], [picked]);
  if (!ids.length) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur">
      <span className="text-sm font-medium tabular-nums">{ids.length} selected</span>
      <AssigneePicker
        members={members}
        // No single current owner across a batch, so nothing is ticked.
        value={undefined}
        label="Unassign"
        triggerLabel="Assign to…"
        onChange={(ownerId) =>
          start(async () => {
            try {
              const { assigned } = await setProspectOwner({ contactIds: ids, ownerId });
              const who = ownerId ? members.find((m) => m.id === ownerId)?.name ?? "them" : "nobody";
              toast.success(`${assigned} ${assigned === 1 ? "person" : "people"} assigned to ${who}`);
              onDone();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not assign");
            }
          })
        }
      />
      {pending && <span className="text-xs text-muted-foreground">assigning…</span>}
      <button type="button" onClick={onClear} className="tap-target ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <X className="size-3.5" /> Clear
      </button>
    </div>
  );
}

function CompaniesTable({ accounts, members }: { accounts: CrmAccount[]; members: Member[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const rows = accounts.filter((a) => !q || [a.name, a.city, a.state, a.website, a.externalId].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 sm:h-9 sm:w-72 sm:flex-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} of {accounts.length}</span>
      </div>

      <ul className="space-y-2 sm:hidden">
        {rows.map((a) => (
          <li key={a.id} className="rounded-md border bg-background p-3 text-sm">
            <Link href={`/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
            <div className="font-mono text-xs text-muted-foreground">{a.externalId}</div>
            <div className="mt-1 text-xs text-muted-foreground">{[a.city, a.state, a.constitution].filter(Boolean).join(" · ")}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={a.outreachStatus} accountId={a.id} onChanged={() => router.refresh()} />
              <ProspectOwnerPicker members={members} ownerId={a.ownerId} accountId={a.id} />
              {a.pnbCategory && <span className="text-xs text-muted-foreground">PNB {a.pnbCategory}</span>}
              {a.researchConfidence && <span className="text-xs text-muted-foreground">{a.researchConfidence}</span>}
            </div>
          </li>
        ))}
      </ul>

      <TableScroll className="hidden sm:block">
        <table className="w-full min-w-[40rem] rounded-md border bg-background text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-3 py-2">Company</th><th className="px-3 py-2">Where</th><th className="hidden px-3 py-2 lg:table-cell">Constitution</th><th className="hidden px-3 py-2 lg:table-cell">PNB</th><th className="hidden px-3 py-2 xl:table-cell">Confidence</th><th className="px-3 py-2">Outreach</th><th className="px-3 py-2">Owner</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-1.5"><Link href={`/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link><div className="font-mono text-xs text-muted-foreground">{a.externalId}</div></td>
                <td className="px-3 py-1.5 text-xs">{[a.city, a.state].filter(Boolean).join(", ")}</td>
                <td className="hidden px-3 py-1.5 text-xs lg:table-cell">{a.constitution}</td>
                <td className="hidden px-3 py-1.5 text-xs lg:table-cell">{a.pnbCategory}</td>
                <td className="hidden px-3 py-1.5 text-xs xl:table-cell">{a.researchConfidence}</td>
                <td className="px-3 py-1.5"><StatusPill status={a.outreachStatus} accountId={a.id} onChanged={() => router.refresh()} /></td>
                <td className="px-3 py-1.5"><ProspectOwnerPicker members={members} ownerId={a.ownerId} accountId={a.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
