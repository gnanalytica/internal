"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/prospects/person-page";
import { SheetField } from "@/components/prospects/sheet-fields";
import { Pill, PRIORITY_COLORS, StatusPill } from "@/components/prospects/status-pill";
import { Button } from "@/components/ui/button";
import { syncSheetNow } from "@/lib/sheet-crm/actions";
import { RESEARCH_QUEUE, TAB_SPEC_BY_ID, type TabId } from "@/lib/sheet-crm/mapping";
import type { CellWrite, QualityIssue, QueueItem, SheetRow, SheetSyncRun } from "@/lib/sheet-crm/queries";
import { formatDate } from "@/lib/matrix-format";

const fieldCls = "h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

// ---- Directories: the reference tabs, read-only ----

export function Directories({ lenders, lenderContacts, officers, rvos, sources, personas }: {
  lenders: SheetRow[]; lenderContacts: SheetRow[]; officers: SheetRow[]; rvos: SheetRow[]; sources: SheetRow[]; personas: SheetRow[];
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"lenders" | "officers" | "rvos" | "personas" | "sources">("lenders");
  const match = (r: SheetRow) => !q || JSON.stringify(r.data).toLowerCase().includes(q.toLowerCase());
  const byInstitution = useMemo(() => {
    const m = new Map<string, SheetRow[]>();
    for (const r of lenderContacts.filter(match)) m.set(r.data.institution, [...(m.get(r.data.institution) ?? []), r]);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenderContacts, q]);
  const relevance = new Map(lenders.map((l) => [l.data.institution, l.data]));
  const byOrg = useMemo(() => {
    const m = new Map<string, SheetRow[]>();
    for (const r of officers.filter(match)) m.set(r.data.organisation, [...(m.get(r.data.organisation) ?? []), r]);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officers, q]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["lenders", "officers", "rvos", "personas", "sources"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md border px-2 py-1 text-xs ${tab === t ? "bg-muted font-medium" : "text-muted-foreground"}`}>
            {{ lenders: `Lenders (${lenderContacts.length})`, officers: `Association officers (${officers.length})`, rvos: `RVOs (${rvos.length})`, personas: `GTM personas (${personas.length})`, sources: `Source inventory (${sources.length})` }[t]}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className={fieldCls + " ml-auto w-56"} />
      </div>
      {tab === "lenders" && (
        <div className="space-y-2">
          {[...byInstitution.entries()]
            .sort((a, b) => rank(relevance.get(a[0])?.relevance_to_valytica) - rank(relevance.get(b[0])?.relevance_to_valytica) || a[0].localeCompare(b[0]))
            .map(([inst, rows]) => (
              <details key={inst} className="rounded-md border bg-background">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="font-medium">{inst}</span>
                  <span className="text-xs text-muted-foreground">{rows[0].data.institution_type}</span>
                  {relevance.get(inst)?.relevance_to_valytica && <Pill color="#6366f1">{relevance.get(inst)!.relevance_to_valytica}</Pill>}
                  <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
                </summary>
                {relevance.get(inst)?.notes && <p className="px-3 pb-2 text-xs text-muted-foreground">{relevance.get(inst)!.notes}</p>}
                <table className="w-full text-xs">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-1.5">{r.data.office_level}<div className="text-muted-foreground">{r.data.department}</div></td>
                        <td className="px-3 py-1.5">{r.data.contact_person_name}<div className="text-muted-foreground">{r.data.designation}</div></td>
                        <td className="px-3 py-1.5">{r.data.city}, {r.data.state}</td>
                        <td className="px-3 py-1.5">{r.data.email}<div>{r.data.phone}</div></td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.data.method_of_contact}<div>{r.data.empanelment_open_window}</div></td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.data.approach_notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
        </div>
      )}
      {tab === "officers" && (
        <div className="space-y-2">
          {[...byOrg.entries()].map(([org, rows]) => (
            <details key={org} open className="rounded-md border bg-background">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{org} <span className="text-xs text-muted-foreground">{rows.length}</span></summary>
              <table className="w-full text-xs">
                <tbody>
                  {rows.sort((a, b) => (a.data.state ?? "").localeCompare(b.data.state ?? "")).map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-1.5">{r.data.branch}<div className="text-muted-foreground">{r.data.city}, {r.data.state}</div></td>
                      <td className="px-3 py-1.5 font-medium">{r.data.person_name}<div className="font-normal text-muted-foreground">{r.data.designation}</div></td>
                      <td className="px-3 py-1.5">{r.data.mobile}<div>{r.data.email}</div></td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.data.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}
      {tab === "rvos" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {rvos.filter(match).map((r) => (
            <Card key={r.id} title={`${r.data.rvo_name} (${r.data.acronym})`}>
              <div className="text-xs text-muted-foreground">{r.data.parent_body} · {r.data.lb_valuer_count}</div>
              <div className="mt-1 text-sm">{r.data.approach_notes}</div>
              <div className="mt-1 text-xs">{r.data.outreach_channels}</div>
              <div className="mt-1 text-xs text-muted-foreground">{r.data.phone} · {r.data.email} · {r.data.website}</div>
            </Card>
          ))}
        </div>
      )}
      {tab === "personas" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {personas.filter(match).map((r) => (
            <Card key={r.id} title={r.data.Persona}>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Pill color="#6366f1">{r.data["GTM Role"]}</Pill>
                {r.data.Priority && <Pill color={PRIORITY_COLORS[r.data.Priority] ?? "#94a3b8"}>Priority {r.data.Priority}</Pill>}
                <span className="text-muted-foreground">{r.data["Buyer/User/Influencer"]}</span>
              </div>
              {(["Why It Matters", "What We Want", "Best Hook", "Content / Demo To Show", "What To Avoid", "Research Criteria"] as const).map((h) => r.data[h] ? (
                <div key={h} className="mt-2"><div className="text-[11px] text-muted-foreground">{h}</div><div className="text-sm">{r.data[h]}</div></div>
              ) : null)}
            </Card>
          ))}
        </div>
      )}
      {tab === "sources" && (
        <table className="w-full rounded-md border bg-background text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="px-3 py-2">Source</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Rows</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Contributed</th></tr></thead>
          <tbody>
            {sources.filter(match).map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-1.5 font-medium">{r.data.source}<div className="font-normal text-muted-foreground">{r.data.url_or_note}</div></td>
                <td className="px-3 py-1.5">{r.data.type}</td>
                <td className="px-3 py-1.5 tabular-nums">{r.data.rows_captured} / {r.data.l_and_b_rows_used}</td>
                <td className="px-3 py-1.5">{r.data.status}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.data.contributed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const rank = (v?: string) => ({ "very high": 0, high: 1, medium: 2 }[(v ?? "").toLowerCase()] ?? 3);

// ---- Research queue ----

export function ResearchQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground">The Research Queue tab is empty (or not synced yet).</p>}
      {items.map((it) => (
        <details key={it.id} className="rounded-md border bg-background">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="w-8 font-mono text-xs text-muted-foreground">{it.data["Target Completion Order"]}</span>
            {it.data.Priority && <Pill color={PRIORITY_COLORS[it.data.Priority] ?? "#94a3b8"}>{it.data.Priority}</Pill>}
            {it.contactId ? <Link href={`/people/${it.contactId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{it.data["Full Name"]}</Link> : <span className="font-medium">{it.data["Full Name"]}</span>}
            {it.weakKey && <Pill color="#f59e0b" title="No Person ID in the sheet">unlinked</Pill>}
            <span className="text-xs text-muted-foreground">{it.data.City} · {it.data.State}</span>
            <span className="text-xs">{it.data["Research Status"]}</span>
            {it.outreachStatus && <StatusPill status={it.outreachStatus} readOnly />}
          </summary>
          <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-sm"><span className="text-[11px] text-muted-foreground">Why Prioritized</span><div>{it.data["Why Prioritized"]}</div></div>
            {["Research Status", "Next Research Task", "Target Completion Order", "Missing Phone", "Missing Current Bank Proof", "Missing Association / Referral", "Missing Firm / Tooling", "Notes"].map((h) => (
              <SheetField key={h} spec={RESEARCH_QUEUE} rowKey={it.rowKey} header={h} value={it.data[h] ?? ""} onWritten={() => router.refresh()} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

// ---- Data quality ----

export function DataQuality({ issues, counts, sheetUrl }: { issues: QualityIssue[]; counts: Record<string, number>; sheetUrl: string | null }) {
  const groups = new Map<string, QualityIssue[]>();
  for (const i of issues) groups.set(i.kind, [...(groups.get(i.kind) ?? []), i]);
  if (!issues.length) return <p className="text-sm text-muted-foreground">No issues detected in the mirror{counts.removed_rows ? ` (${counts.removed_rows} rows have vanished from the sheet since an earlier sync and are kept as history)` : ""}.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Computed live over the mirror. Internal lists these; fixing them is done in the sheet.{counts.removed_rows ? ` ${counts.removed_rows} rows have vanished from the sheet and are kept as history.` : ""}</p>
      {[...groups.entries()].map(([kind, list]) => (
        <details key={kind} className="rounded-md border bg-background" open={list.length <= 8}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{list[0].title} <span className="text-xs text-muted-foreground">{counts[kind] ?? list.length}</span></summary>
          <ul className="divide-y text-xs">
            {list.map((i, n) => (
              <li key={n} className="flex items-center gap-2 px-3 py-1.5">
                <span className="font-mono text-muted-foreground">{TAB_SPEC_BY_ID[i.tab]?.expectedTitle ?? i.tab}</span>
                <span className="truncate">{i.detail}</span>
                {i.personId && <Link href={`/people/${i.personId}`} className="ml-auto text-brand hover:underline">open</Link>}
                {sheetUrl && <a href={sheetUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline">sheet</a>}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

// ---- Sync panel ----

export function SyncPanel({ runs, writes, configured, sheetUrl }: { runs: SheetSyncRun[]; writes: CellWrite[]; configured: boolean; sheetUrl: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const last = runs[0];
  const tabs = (last?.summary as { tabs?: Record<string, { title: string; rows: number; changed: number; added: number; removed: number; weakKeys: number; formulaColumns: string[]; drift: { missing: string[]; unknown: string[]; optionalPresent: string[] } }> } | undefined)?.tabs ?? {};
  const missing = (last?.summary as { missingTabs?: string[] } | undefined)?.missingTabs ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || !configured} onClick={() => start(async () => { const r = await syncSheetNow(); (r.ok ? toast.success : toast.error)(r.message); router.refresh(); })}>
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> Sync now
        </Button>
        {!configured && <span className="text-xs text-amber-600">Sheet sync is not configured on this deployment (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY / VALYTICA_CRM_SHEET_ID).</span>}
        {sheetUrl && <a href={sheetUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">Open the sheet</a>}
        {last && <span className="ml-auto text-xs text-muted-foreground">Last run {formatDate(last.startedAt)} · {last.status} · {last.trigger}</span>}
      </div>
      {last?.error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{last.error}</p>}
      {missing.length > 0 && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">Tabs not found by header signature: {missing.join(", ")}</p>}
      {Object.keys(tabs).length > 0 && (
        <table className="w-full rounded-md border bg-background text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="px-3 py-2">Tab</th><th className="px-3 py-2">Sheet title</th><th className="px-3 py-2">Rows</th><th className="px-3 py-2">Changed / added / removed</th><th className="px-3 py-2">Weak keys</th><th className="px-3 py-2">Formula columns</th><th className="px-3 py-2">Drift</th></tr></thead>
          <tbody>
            {Object.entries(tabs).map(([id, t]) => (
              <tr key={id} className="border-t align-top">
                <td className="px-3 py-1.5 font-mono">{id}</td>
                <td className="px-3 py-1.5">{t.title}</td>
                <td className="px-3 py-1.5 tabular-nums">{t.rows}</td>
                <td className="px-3 py-1.5 tabular-nums">{t.changed} / {t.added} / {t.removed}</td>
                <td className="px-3 py-1.5 tabular-nums">{t.weakKeys}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{t.formulaColumns.join(", ")}</td>
                <td className="px-3 py-1.5">
                  {t.drift.missing.length > 0 && <div className="text-destructive">missing: {t.drift.missing.join(", ")}</div>}
                  {t.drift.unknown.length > 0 && <div className="text-muted-foreground">new: {t.drift.unknown.join(", ")}</div>}
                  {t.drift.optionalPresent.length > 0 && <div className="text-emerald-600">present: {t.drift.optionalPresent.join(", ")}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Card title="Recent runs">
        <ul className="text-xs">
          {runs.map((r) => <li key={r.id}>{formatDate(r.startedAt)} · {r.trigger} · <span className={r.status === "ok" ? "text-emerald-600" : r.status === "failed" ? "text-destructive" : ""}>{r.status}</span></li>)}
          {runs.length === 0 && <li className="text-muted-foreground">No runs yet.</li>}
        </ul>
      </Card>
      <Card title="Recent writes to the sheet">
        <ul className="text-xs">
          {writes.map((w) => <li key={w.id}><span className={w.status === "ok" ? "text-emerald-600" : "text-amber-600"}>{w.status}</span> · {w.tab} · {w.rowKey} · {w.column} · {formatDate(w.writtenAt)}{w.detail ? ` · ${w.detail}` : ""}</li>)}
          {writes.length === 0 && <li className="text-muted-foreground">Nothing written yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

export type { TabId };
