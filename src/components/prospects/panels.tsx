"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/prospects/person-page";
import { SheetField } from "@/components/prospects/sheet-fields";
import { TableScroll } from "@/components/responsive";
import { Pill, PRIORITY_COLORS, StatusPill } from "@/components/prospects/status-pill";
import { Button } from "@/components/ui/button";
import { syncSheetNow } from "@/lib/sheet-crm/actions";
import { RESEARCH_QUEUE, TAB_SPEC_BY_ID, type TabId } from "@/lib/sheet-crm/mapping";
import type { CellWrite, QualityIssue, QueueItem, SheetRow, SheetSyncRun } from "@/lib/sheet-crm/queries";
import { formatDate } from "@/lib/matrix-format";

const fieldCls = "h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 sm:h-8";

/** A directory row: stacked on a phone, one line of columns from `sm`. */
const rowCls = "grid gap-x-3 gap-y-1.5 border-t px-3 py-2 text-xs sm:gap-y-0.5";

/**
 * One field of a directory row, named on a phone.
 *
 * Stacked, a lender contact was nine muted lines in a column — department,
 * designation, method of contact and empanelment window are all free text and
 * all render identically, so there was no way to tell which line was which.
 * The desktop grid says it with column position; a phone has to say it in
 * words. From `sm` the label is hidden and the columns carry the meaning again.
 *
 * An empty value renders nothing at all, rather than a label over a blank:
 * these rows are routinely partial (a branch desk with no named contact), and
 * a labelled hole reads as a bug in the sheet.
 */
function DirField({
  label,
  value,
  sub,
  subLabel,
  className,
}: {
  label: string;
  value?: string;
  sub?: string;
  subLabel?: string;
  className?: string;
}) {
  if (!value && !sub) return null;
  return (
    <div className={className}>
      {value ? (
        <>
          <span className="block text-[11px] text-muted-foreground sm:hidden">{label}</span>
          <span className="block">{value}</span>
        </>
      ) : null}
      {sub ? (
        <>
          <span className="mt-1 block text-[11px] text-muted-foreground sm:mt-0 sm:hidden">{subLabel ?? label}</span>
          <span className="block text-muted-foreground">{sub}</span>
        </>
      ) : null}
    </div>
  );
}

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
      <div className="space-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:space-y-0">
        <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["lenders", "officers", "rvos", "personas", "sources"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs sm:py-1 ${tab === t ? "bg-muted font-medium" : "text-muted-foreground"}`}>
              {{ lenders: `Lenders (${lenderContacts.length})`, officers: `Association officers (${officers.length})`, rvos: `RVOs (${rvos.length})`, personas: `GTM personas (${personas.length})`, sources: `Source inventory (${sources.length})` }[t]}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className={fieldCls + " w-full sm:ml-auto sm:w-56"} />
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
                <ul>
                  {rows.map((r) => (
                    <li key={r.id} className={rowCls + " sm:grid-cols-6"}>
                      <DirField label="Office" value={r.data.office_level} sub={r.data.department} subLabel="Department" />
                      <DirField label="Contact" value={r.data.contact_person_name} sub={r.data.designation} subLabel="Designation" />
                      <DirField label="Where" value={[r.data.city, r.data.state].filter(Boolean).join(", ")} className="text-muted-foreground" />
                      <DirField label="Email" value={r.data.email} sub={r.data.phone} subLabel="Phone" className="break-all" />
                      <DirField label="How to approach" value={r.data.method_of_contact} sub={r.data.empanelment_open_window} subLabel="Empanelment window" />
                      <DirField label="Notes" value={r.data.approach_notes} className="text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              </details>
            ))}
        </div>
      )}
      {tab === "officers" && (
        <div className="space-y-2">
          {[...byOrg.entries()].map(([org, rows]) => (
            <details key={org} open className="rounded-md border bg-background">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{org} <span className="text-xs text-muted-foreground">{rows.length}</span></summary>
              <ul>
                {rows.sort((a, b) => (a.data.state ?? "").localeCompare(b.data.state ?? "")).map((r) => (
                  <li key={r.id} className={rowCls + " sm:grid-cols-4"}>
                    <DirField label="Branch" value={r.data.branch} sub={[r.data.city, r.data.state].filter(Boolean).join(", ")} subLabel="Where" />
                    <DirField label="Officer" value={r.data.person_name} sub={r.data.designation} subLabel="Designation" className="font-medium [&_span:last-child]:font-normal" />
                    <DirField label="Mobile" value={r.data.mobile} sub={r.data.email} subLabel="Email" className="break-all" />
                    <DirField label="Notes" value={r.data.notes} className="text-muted-foreground" />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
      {tab === "rvos" && (
        <div className="grid gap-3 md:grid-cols-2">
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
        <div className="grid gap-3 md:grid-cols-2">
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
        <TableScroll>
        <table className="w-full min-w-[32rem] rounded-md border bg-background text-xs">
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
        </TableScroll>
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
          <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2.5 text-sm">
            <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">{it.data["Target Completion Order"]}</span>
            {it.data.Priority && <Pill color={PRIORITY_COLORS[it.data.Priority] ?? "#94a3b8"}>{it.data.Priority}</Pill>}
            {it.contactId ? <Link href={`/people/${it.contactId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{it.data["Full Name"]}</Link> : <span className="font-medium">{it.data["Full Name"]}</span>}
            {it.weakKey && <Pill color="#f59e0b" title="No Person ID in the sheet">unlinked</Pill>}
            <span className="text-xs text-muted-foreground">{[it.data.City, it.data.State].filter(Boolean).join(" · ")}</span>
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
              <li key={n} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                <span className="font-mono text-muted-foreground">{TAB_SPEC_BY_ID[i.tab]?.expectedTitle ?? i.tab}</span>
                <span className="min-w-0 flex-1 break-words">{i.detail}</span>
                {i.personId && <Link href={`/people/${i.personId}`} className="tap-target grid place-items-center text-brand hover:underline sm:ml-auto">open</Link>}
                {sheetUrl && <a href={sheetUrl} target="_blank" rel="noreferrer" className="tap-target grid place-items-center text-muted-foreground hover:underline">sheet</a>}
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
        {last && <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">Last run {formatDate(last.startedAt)} · {last.status} · {last.trigger}</span>}
      </div>
      {last?.error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{last.error}</p>}
      {missing.length > 0 && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">Tabs not found by header signature: {missing.join(", ")}</p>}
      {Object.keys(tabs).length > 0 && (
        <TableScroll>
        <table className="w-full min-w-[44rem] rounded-md border bg-background text-xs">
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
        </TableScroll>
      )}
      <Card title="Recent runs">
        <ul className="text-xs">
          {runs.map((r) => <li key={r.id}>{formatDate(r.startedAt)} · {r.trigger} · <span className={r.status === "ok" ? "text-emerald-600" : r.status === "failed" ? "text-destructive" : ""}>{r.status}</span></li>)}
          {runs.length === 0 && <li className="text-muted-foreground">No runs yet.</li>}
        </ul>
      </Card>
      <Card title="Recent writes to the sheet">
        <ul className="space-y-1 text-xs break-words">
          {writes.map((w) => <li key={w.id}><span className={w.status === "ok" ? "text-emerald-600" : "text-amber-600"}>{w.status}</span> · {w.tab} · {w.rowKey} · {w.column} · {formatDate(w.writtenAt)}{w.detail ? ` · ${w.detail}` : ""}</li>)}
          {writes.length === 0 && <li className="text-muted-foreground">Nothing written yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

export type { TabId };
