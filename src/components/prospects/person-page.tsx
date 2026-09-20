"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Ban, Building2, Copy, ExternalLink, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

import { LogInteractionForm, Timeline } from "@/components/prospects/interaction-log";
import { ProspectOwnerPicker } from "@/components/prospects/owner-picker";
import { SheetField, SheetFieldGrid } from "@/components/prospects/sheet-fields";
import { BAND_COLORS, PRIORITY_COLORS, Pill, StatusPill } from "@/components/prospects/status-pill";
import { Button } from "@/components/ui/button";
import { bookCall, draftEmail } from "@/lib/google/actions";
import { ScrollTabsList } from "@/components/responsive";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { PEOPLE_GROUPS } from "@/lib/sheet-crm/fields";
import { DEEP_DIVE_DOSSIERS, PEOPLE, PROSPECT_INTELLIGENCE, RESEARCH_QUEUE } from "@/lib/sheet-crm/mapping";
import type { PersonView } from "@/lib/sheet-crm/queries";
import type { Member } from "@/lib/types";
import { formatDate } from "@/lib/matrix-format";

const SCORE_FACTORS = ["Active Practice /20", "Workflow Pain /20", "Valytica Fit /20", "Commercial Potential /15", "Reachability /10", "Influence /5", "Evidence Confidence /10"];

function copy(text: string, what: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`));
}

export function PersonPage({ view, backHref, google, members = [], campaigns = [] }: { view: PersonView; backHref: string; google: { connected: boolean }; members?: Member[]; campaigns?: { id: string; name: string }[] }) {
  const router = useRouter();
  const { contact, people, prospect, dossier, queue, excluded } = view;
  const pid = contact.externalId;
  const p = prospect?.data;
  const d = dossier?.data;
  const [logPrefill, setLogPrefill] = useState<string | undefined>();
  const [busy, start] = useTransition();
  const refresh = () => router.refresh();

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2.5 sm:px-4">
        <Link href={backHref} className="text-muted-foreground hover:text-foreground" aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="min-w-0 text-sm font-semibold">{contact.name}</h1>
        {pid && <span className="font-mono text-xs text-muted-foreground">{pid}</span>}
        {contact.priority && <Pill color={PRIORITY_COLORS[contact.priority]}>Priority {contact.priority}</Pill>}
        {contact.scoreBand && <Pill color={BAND_COLORS[contact.scoreBand.toUpperCase()]}>Band {contact.scoreBand}{contact.opportunityScore != null ? ` · ${contact.opportunityScore}` : ""}</Pill>}
        {contact.persona === "institutional" && <Pill color="#0ea5e9">Institutional</Pill>}
        {(contact.city || contact.state) && <span className="text-xs text-muted-foreground">{[contact.city, contact.state].filter(Boolean).join(", ")}</span>}
        {contact.account && (
          <Link href={`/accounts/${contact.account.id}`} className="flex items-center gap-1 text-xs text-brand hover:underline">
            <Building2 className="size-3.5" /> {contact.account.name}
          </Link>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ProspectOwnerPicker members={members} ownerId={contact.ownerId} contactId={contact.id} />
          <StatusPill status={contact.outreachStatus} contactId={contact.id} onChanged={refresh} readOnly={Boolean(excluded)} />
        </div>
      </header>

      {excluded && (
        <div className="flex items-start gap-2 border-b bg-destructive/10 px-3 py-2 text-sm text-destructive sm:items-center sm:px-4">
          <Ban className="mt-0.5 size-4 shrink-0 sm:mt-0" />
          <span>
            <strong>Do not contact.</strong> Listed on the Exclusions tab as “{excluded.name}” — {excluded.action}
            {excluded.reason ? ` (${excluded.reason})` : ""}. Send actions are hidden.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 text-xs sm:px-4">
        {contact.phone && (
          <span className="flex items-center gap-1"><Phone className="size-3.5 text-muted-foreground" />{contact.phone}
            <button type="button" className="tap-target -m-1 grid place-items-center p-1" onClick={() => copy(contact.phoneE164 ?? contact.phone!, "Phone")} aria-label="Copy phone"><Copy className="size-3.5 text-muted-foreground hover:text-foreground" /></button>
          </span>
        )}
        {contact.email && (
          <span className="flex items-center gap-1"><Mail className="size-3.5 text-muted-foreground" />{contact.email}
            <button type="button" className="tap-target -m-1 grid place-items-center p-1" onClick={() => copy(contact.email!, "Email")} aria-label="Copy email"><Copy className="size-3.5 text-muted-foreground hover:text-foreground" /></button>
          </span>
        )}
        {contact.bestFirstChannel && <Pill color="#6366f1" title="Best First Channel">{contact.bestFirstChannel}</Pill>}
        {contact.lastContactedAt && <span className="text-muted-foreground">Last contact {formatDate(contact.lastContactedAt)}{contact.lastChannel ? ` via ${contact.lastChannel}` : ""}</span>}
        {!excluded && (
          <div className="flex w-full flex-wrap gap-1.5 sm:ml-auto sm:w-auto">
            {d?.["WhatsApp Opener"] && (
              <Button size="sm" variant="outline" className="h-9 sm:h-7" onClick={() => { copy(d["WhatsApp Opener"], "WhatsApp opener"); setLogPrefill(d["WhatsApp Opener"]); }}>
                Copy WhatsApp opener
              </Button>
            )}
            {contact.email && (google.connected ? (
              <Button size="sm" variant="outline" className="h-9 sm:h-7" disabled={busy} onClick={() => start(async () => {
                try {
                  const r = await draftEmail({ contactId: contact.id, subject: `Valytica — ${d?.["One-Line Pitch"]?.slice(0, 60) ?? contact.name}`, body: d?.["Email / LinkedIn Angle"] ?? "" });
                  window.open(r.url, "_blank");
                } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create the draft"); }
              })}>
                Draft in Gmail
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-9 sm:h-7" nativeButton={false} render={<a href={`mailto:${contact.email}?subject=${encodeURIComponent("Valytica")}&body=${encodeURIComponent(d?.["Email / LinkedIn Angle"] ?? "")}`} />}>
                Draft email
              </Button>
            ))}
            {google.connected && <BookCall contactId={contact.id} />}
            {(people?.linkedin || p?.LinkedIn) && (
              <Button size="sm" variant="outline" className="h-9 sm:h-7" nativeButton={false} render={<a href={people?.linkedin || p?.LinkedIn} target="_blank" rel="noreferrer" />}>
                Open LinkedIn <ExternalLink className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue={p || d ? "overview" : "details"} className="flex min-h-0 flex-1 flex-col">
        <ScrollTabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="playbook">Playbook</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="timeline">Timeline{view.interactions.length ? ` (${view.interactions.length})` : ""}</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {!p && !d ? (
            <p className="text-sm text-muted-foreground">No research row for this person yet. Master facts are under Details.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                {p && (
                  <Card title="Angle">
                    <Field label="Valytica Angle" value={p["Valytica Angle"]} />
                    <Field label="Primary Wedge" value={p["Primary Wedge"]} />
                    <Field label="Primary Trigger" value={p["Primary Trigger"]} />
                    <Field label="Pain Point Hypothesis (Inferred)" value={p["Pain Point Hypothesis (Inferred)"]} />
                    <Field label="Lead Role" value={p["Lead Role"]} />
                  </Card>
                )}
                {p && (
                  <Card title="Next action (writes to the sheet)">
                    <SheetField spec={PROSPECT_INTELLIGENCE} rowKey={prospect!.rowKey} header="Next Action" value={p["Next Action"] ?? ""} onWritten={refresh} />
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <SheetField spec={PROSPECT_INTELLIGENCE} rowKey={prospect!.rowKey} header="Research Status" value={p["Research Status"] ?? ""} onWritten={refresh} />
                      <SheetField spec={PROSPECT_INTELLIGENCE} rowKey={prospect!.rowKey} header="Priority" value={p.Priority ?? ""} onWritten={refresh} />
                      <SheetField spec={PROSPECT_INTELLIGENCE} rowKey={prospect!.rowKey} header="Best First Channel" value={p["Best First Channel"] ?? ""} onWritten={refresh} />
                    </div>
                  </Card>
                )}
                {queue && (
                  <Card title="Research queue">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SheetField spec={RESEARCH_QUEUE} rowKey={queue.rowKey} header="Research Status" value={queue.data["Research Status"] ?? ""} onWritten={refresh} />
                      <SheetField spec={RESEARCH_QUEUE} rowKey={queue.rowKey} header="Target Completion Order" value={queue.data["Target Completion Order"] ?? ""} onWritten={refresh} />
                      <SheetField spec={RESEARCH_QUEUE} rowKey={queue.rowKey} header="Next Research Task" value={queue.data["Next Research Task"] ?? ""} onWritten={refresh} />
                      <Field label="Why Prioritized" value={queue.data["Why Prioritized"]} />
                      {["Missing Phone", "Missing Current Bank Proof", "Missing Association / Referral", "Missing Firm / Tooling"].map((h) => (
                        <SheetField key={h} spec={RESEARCH_QUEUE} rowKey={queue.rowKey} header={h} value={queue.data[h] ?? ""} onWritten={refresh} />
                      ))}
                    </div>
                  </Card>
                )}
              </div>
              <div className="space-y-4">
                {p && (
                  <Card title={`Opportunity score${p["Opportunity Score /100"] ? ` · ${p["Opportunity Score /100"]} / 100` : ""}`}>
                    {p["Opportunity Score /100"] ? (
                      <ul className="space-y-1 text-sm">
                        {SCORE_FACTORS.map((f) => (
                          <li key={f} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{f.replace(/ \/\d+$/, "")}</span>
                            <span className="font-mono tabular-nums">{p[f] || "—"}<span className="text-muted-foreground">{f.match(/\/\d+$/)?.[0]}</span></span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not scored yet (researched before the scoring model existed).</p>
                    )}
                    <div className="mt-3 space-y-2">
                      <Field label="Score Reason" value={p["Score Reason"]} />
                      <Field label="Score Gaps / Unknowns" value={p["Score Gaps / Unknowns"]} />
                      <Field label="Research Completeness %" value={p["Research Completeness %"]} />
                      <Field label="Last Researched" value={p["Last Researched"]} />
                    </div>
                  </Card>
                )}
                {d && (
                  <Card title="Why this person now">
                    <p className="whitespace-pre-wrap text-sm">{d["Why This Person Now"]}</p>
                    <Field label="Persona / GTM Role" value={d["Persona / GTM Role"]} />
                    <Field label="Likely Trigger" value={d["Likely Trigger"]} />
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="playbook" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {!d ? (
            <p className="text-sm text-muted-foreground">No dossier for this person yet.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Pitch">
                <Field label="One-Line Pitch" value={d["One-Line Pitch"]} />
                <Field label="Pain Narrative" value={d["Pain Narrative"]} />
                <Field label="Valytica Wedge" value={d["Valytica Wedge"]} />
              </Card>
              <Card title="Openers (edit here, saved to the sheet)">
                {["WhatsApp Opener", "Call Opener", "Email / LinkedIn Angle"].map((h) => (
                  <div key={h} className="mb-3">
                    <SheetField spec={DEEP_DIVE_DOSSIERS} rowKey={dossier!.rowKey} header={h} value={d[h] ?? ""} onWritten={refresh} />
                    {!excluded && d[h] && (
                      <button type="button" className="tap-target mt-1 text-xs text-brand hover:underline" onClick={() => copy(d[h], h)}>Copy</button>
                    )}
                  </div>
                ))}
              </Card>
              <Card title="Demo sequence">
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {(d["Demo Sequence"] ?? "").split(/→|->|\n|\d+\.\s/).map((s) => s.trim()).filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}
                </ol>
                <div className="mt-3">
                  <SheetField spec={DEEP_DIVE_DOSSIERS} rowKey={dossier!.rowKey} header="Demo Sequence" value={d["Demo Sequence"] ?? ""} onWritten={refresh} />
                </div>
              </Card>
              <Card title="Content">
                <SheetField spec={DEEP_DIVE_DOSSIERS} rowKey={dossier!.rowKey} header="Content Asset To Share" value={d["Content Asset To Share"] ?? ""} onWritten={refresh} />
                <div className="mt-3"><Field label="Custom Story / Content Idea" value={d["Custom Story / Content Idea"]} /></div>
                <div className="mt-3"><SheetField spec={DEEP_DIVE_DOSSIERS} rowKey={dossier!.rowKey} header="Next Action" value={d["Next Action"] ?? ""} onWritten={refresh} /></div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="evidence" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Bank / lender relationships">
              <Field label="Verified Current Bank / Lender Relationships" value={p?.["Verified Current Bank / Lender Relationships"] ?? people?.empanelled_with} />
              <Field label="Relationship Evidence / Recency" value={p?.["Relationship Evidence / Recency"]} />
              <Field label="Bank-Side Contact / Decision Path" value={p?.["Bank-Side Contact / Decision Path"]} />
              <Field label="Evidence-Backed Workflow Signal" value={p?.["Evidence-Backed Workflow Signal"]} />
              <Field label="Competitor / Risk Note" value={p?.["Competitor / Risk Note"]} />
            </Card>
            <Card title="Registration & association">
              <Field label="IBBI Reg No" value={contact.ibbiRegNo} />
              <Field label="RVO" value={p?.RVO ?? people?.rvo} />
              <Field label="Association / Influence Role" value={p?.["Association / Influence Role"] ?? people?.associations_and_roles} />
              <Field label="Evidence / Proof" value={d?.["Evidence / Proof"]} />
              {view.iov.length > 0 && (
                <div className="mt-2">
                  <div className="text-[11px] text-muted-foreground">IOV cross-match</div>
                  <ul className="text-sm">
                    {view.iov.map((r, i) => (
                      <li key={i}>#{r.iov_membership_no} · {r.iov_asset_class} · approved {r.iov_approved_valuer} · {r.match_confidence}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            <Card title="Sources">
              <Field label="Source URLs" value={p?.["Source URLs"] ?? d?.["Source URLs"]} links />
              <Field label="Confidence" value={p?.Confidence} />
              <Field label="Enrichment sources" value={people?.enrichment_sources} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="network" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Warm paths">
              <Field label="Warm Referral Path" value={p?.["Warm Referral Path"]} />
              <Field label="Relevant People / Warm Paths" value={d?.["Relevant People / Warm Paths"]} />
              <Field label="Bank / Lender Contacts" value={d?.["Bank / Lender Contacts"]} />
            </Card>
            <Card title={`Referral Map rows naming this person (${view.referrals.length})`}>
              {view.referrals.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
                <ul className="space-y-2 text-sm">
                  {view.referrals.map((r, i) => (
                    <li key={i} className="rounded-md border p-2">
                      <div className="font-medium">{r["Contact / Role"]} · {r["Institution / Association"]}</div>
                      <div className="text-xs text-muted-foreground">{r["Relationship Type"]} · {r.Region} · {r.Status}</div>
                      <div className="mt-1">{r["Recommended Ask"]}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={`Lender contacts on their panels (${view.lenderContacts.length})`}>
              {view.lenderContacts.length === 0 ? <p className="text-sm text-muted-foreground">None matched.</p> : (
                <ul className="space-y-1 text-sm">
                  {view.lenderContacts.map((r, i) => (
                    <li key={i}><span className="font-medium">{r.institution}</span> · {r.office_level} · {r.city} · {r.contact_person_name || r.department} · <span className="text-muted-foreground">{r.method_of_contact}</span></li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Firm">
              {view.company ? (
                <>
                  <Link href={`/accounts/${view.company.account.id}`} className="text-sm text-brand hover:underline">{view.company.account.name}</Link>
                  {view.colleagues.length > 0 && (
                    <ul className="mt-2 text-sm">
                      {view.colleagues.map((c) => (
                        <li key={c.id}><Link href={`/people/${c.id}`} className="hover:underline">{c.name}</Link> <span className="font-mono text-xs text-muted-foreground">{c.externalId}</span></li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No linked company. {people?.company_names ? `Sheet names: ${people.company_names}` : ""}</p>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Timeline items={view.interactions} activities={view.activities} />
            </div>
            <div className="space-y-3">
              {!excluded && <LogInteractionForm contactId={contact.id} prefill={logPrefill ? { body: logPrefill } : undefined} campaigns={campaigns} />}
              {view.writes.length > 0 && (
                <Card title="Sheet writes from Internal">
                  <ul className="space-y-1 text-xs">
                    {view.writes.slice(0, 15).map((w) => (
                      <li key={w.id}><span className={w.status === "ok" ? "text-emerald-600" : "text-amber-600"}>{w.status}</span> · {w.tab} · {w.column} · {formatDate(w.writtenAt)}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="details" className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {people && pid ? (
            <SheetFieldGrid spec={PEOPLE} rowKey={pid} record={people} groups={PEOPLE_GROUPS} onWritten={refresh} />
          ) : (
            <p className="text-sm text-muted-foreground">This contact is not linked to a People row in the sheet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-background p-3 sm:p-3.5">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Field({ label, value, links }: { label: string; value?: string | null; links?: boolean }) {
  if (!value) return null;
  return (
    <div className="mb-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {links ? (
        <div className="flex flex-col gap-0.5 text-sm">
          {value.split(/[;\s]+/).filter((u) => /^https?:\/\//.test(u)).map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="truncate text-brand hover:underline">{u}</a>
          ))}
        </div>
      ) : (
        <div className="whitespace-pre-wrap text-sm">{value}</div>
      )}
    </div>
  );
}

function BookCall({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [busy, start] = useTransition();
  if (!open) return <Button size="sm" variant="outline" className="h-9 sm:h-7" onClick={() => setOpen(true)}>Book a call</Button>;
  return (
    <span className="flex w-full flex-wrap items-center gap-1.5 rounded-md border bg-background p-1 sm:w-auto sm:flex-nowrap">
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-9 min-w-0 flex-1 rounded border px-1 text-xs sm:h-7 sm:flex-none" aria-label="When" />
      <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-9 rounded border px-1 text-xs sm:h-7" aria-label="Duration">
        {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
      </select>
      <Button size="sm" className="h-9 sm:h-7" disabled={busy || !when} onClick={() => start(async () => {
        try {
          const r = await bookCall({ contactId, startIso: new Date(when).toISOString(), minutes });
          toast.success("Booked with a Meet link; invite sent");
          window.open(r.url, "_blank");
          setOpen(false);
          router.refresh();
        } catch (e) { toast.error(e instanceof Error ? e.message : "Could not book"); }
      })}>Book</Button>
      <button type="button" className="tap-target px-2 text-xs text-muted-foreground" onClick={() => setOpen(false)}>Cancel</button>
    </span>
  );
}
