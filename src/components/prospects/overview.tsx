"use client";

import type { ReactNode } from "react";

import { ChartCard, Donut, type Slice } from "@/components/charts";
import { PRIORITY_COLORS } from "@/components/prospects/status-pill";
import { OUTREACH_STATUSES } from "@/lib/sheet-crm/outreach";
import type { MarketStats, PeopleFilter, ProspectStats } from "@/lib/sheet-crm/queries";

/**
 * The prospects overview: what the workspace holds, how far along it is, and
 * where to click to act on any of it.
 *
 * Every figure here is a filter. A number nobody can act on is a number that
 * belongs in a report, not on the working surface — so each tile, bar and slice
 * hands `jump` a `PeopleFilter` and the page switches to People with it applied.
 *
 * On form: the funnel and the state breakdown are ORDERED MAGNITUDE, so they
 * are one hue light-to-dark with the label carrying the identity. They are
 * deliberately not seven categorical hues — the status palette's
 * `meeting_booked` and `met` sit 5.1 ΔE apart for normal vision and 0.3 under
 * protanopia, so colour could not have told those two stages apart anyway.
 * Priority IS identity (four named grades), so that one gets its own hues and a
 * legend; its greys are meant to read grey, because C and WATCH mean parked.
 * Every mark is directly labelled, which is also what relieves the sub-3:1
 * contrast of the lighter fills.
 */
export function ProspectsOverview({
  stats,
  market,
  qualityCount,
  queueCount,
  onJump,
  onTab,
}: {
  stats: ProspectStats;
  market: MarketStats;
  qualityCount: number;
  queueCount: number;
  onJump: (filter: PeopleFilter, label: string) => void;
  onTab: (tab: string) => void;
}) {
  const pct = (n: number) => (stats.people > 0 ? Math.round((n / stats.people) * 100) : 0);

  const funnel = OUTREACH_STATUSES.filter((s) => s.id !== "not_planned" && (stats.byStatus[s.id] ?? 0) > 0).map((s) => ({
    id: s.id,
    label: s.label,
    value: stats.byStatus[s.id] ?? 0,
  }));
  const inFunnel = funnel.reduce((n, s) => n + s.value, 0);

  const states = topWithOther(stats.byState, 8);
  const priority = stats.byPriority.filter((p) => p.label !== "—");

  return (
    <div className="space-y-3 sm:space-y-4">
      <section>
        <SectionHeading>Where the list stands</SectionHeading>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <StatTile
            label="People"
            value={stats.people}
            sub={stats.institutional ? `${fmt(stats.institutional)} institutional` : "on the sheet"}
            onClick={() => onJump({ limit: 100 }, "All people")}
          />
          <StatTile
            label="Researched"
            value={stats.researched}
            sub={`${pct(stats.researched)}% of the list`}
            meter={pct(stats.researched)}
            onClick={() => onJump({ researched: true, limit: 100 }, "Researched")}
          />
          <StatTile
            label="Contactable"
            value={stats.contactable}
            sub={`${fmt(stats.withPhone)} phone · ${fmt(stats.withEmail)} email`}
            meter={pct(stats.contactable)}
            onClick={() => onJump({ hasEmail: true, limit: 100 }, "Has an email")}
          />
          <StatTile
            label="In the funnel"
            value={inFunnel}
            sub={inFunnel ? "planned or beyond" : "nobody contacted yet"}
            onClick={() => onJump({ status: "planned", limit: 100 }, "Planned")}
          />
        </div>
      </section>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <ChartCard title="Outreach funnel" hint={inFunnel ? `${fmt(inFunnel)} in play` : undefined}>
          {funnel.length === 0 ? (
            <Empty>
              Nobody has been moved past <em>Not planned</em> yet. Set a status on a person and the funnel appears here.
            </Empty>
          ) : (
            <OrderedBars
              rows={funnel.map((s) => ({ key: s.id, label: s.label, value: s.value }))}
              total={inFunnel}
              onPick={(key, label) => onJump({ status: key, limit: 100 }, label)}
            />
          )}
        </ChartCard>

        <ChartCard title="Research grade" hint={stats.scored ? `${fmt(stats.scored)} scored` : undefined}>
          {priority.length === 0 ? (
            <Empty>No priorities assigned yet. The research pass sets these.</Empty>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <Donut
                data={priority.map<Slice>((p) => ({ label: p.label, value: p.value, color: PRIORITY_COLORS[p.label] ?? "#94a3b8" }))}
                center={
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{fmt(stats.researched)}</div>
                    <div className="text-[10px] text-muted-foreground">researched</div>
                  </div>
                }
              />
              {/* The legend IS the control. A legend above a matching row of
                  buttons says each grade twice and gives the reader two things
                  to look at where there is one idea. */}
              <ul className="min-w-0 max-w-[15rem] flex-1 space-y-0.5">
                {priority.map((p) => {
                  const share = stats.researched > 0 ? Math.round((p.value / stats.researched) * 100) : 0;
                  return (
                    <li key={p.label}>
                      <button
                        type="button"
                        onClick={() => onJump({ priority: p.label, limit: 100 }, `Priority ${p.label}`)}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        title={`Priority ${p.label}: ${fmt(p.value)} of ${fmt(stats.researched)} researched — click to filter`}
                      >
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p.label] ?? "#94a3b8" }} />
                        <span className="min-w-0 flex-1 truncate text-xs">Priority {p.label}</span>
                        <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                          {fmt(p.value)}
                          <span className="ml-1 text-muted-foreground/70">{share}%</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <ChartCard title="Where they are" hint={`${stats.byState.length} state${stats.byState.length === 1 ? "" : "s"}`}>
          {states.length === 0 ? (
            <Empty>No state recorded on any row yet.</Empty>
          ) : (
            <OrderedBars
              rows={states}
              total={stats.people}
              onPick={(key, label) => (key === "__other__" ? onTab("people") : onJump({ state: key, limit: 100 }, label))}
            />
          )}
        </ChartCard>

        <ChartCard title="Worth a look" hint="each one is a filter">
          <div className="space-y-2">
            <ActionRow
              label="Unassigned but researched"
              value={stats.unassigned}
              tone={stats.unassigned > 0 ? "warn" : "ok"}
              hint="ready to work, nobody owns them"
              onClick={() => onJump({ researched: true, owner: "unassigned", limit: 100 }, "Unassigned")}
            />
            <ActionRow
              label="Flagged duplicate"
              value={stats.duplicates}
              tone={stats.duplicates > 0 ? "warn" : "ok"}
              hint="the sheet's own duplicate flag"
              onClick={() => onJump({ limit: 100 }, "All people")}
            />
            <ActionRow
              label="No way to reach them"
              value={Math.max(0, stats.people - stats.contactable)}
              tone={stats.people - stats.contactable > 0 ? "warn" : "ok"}
              hint="no phone and no email"
              onClick={() => onTab("quality")}
            />
            <ActionRow label="Data-quality issues" value={qualityCount} tone={qualityCount > 0 ? "warn" : "ok"} hint="open the Quality tab" onClick={() => onTab("quality")} />
            <ActionRow label="In the research queue" value={queueCount} tone="neutral" hint="open the Queue tab" onClick={() => onTab("queue")} />
          </div>
        </ChartCard>
      </div>

      {/*
       * What the list is MADE OF, as opposed to how far along it is.
       *
       * This is the sheet's Summary tab, moved here and made complete. Summary
       * asked COUNTIF for seven named banks and six RVOs, so the eighth bank was
       * invisible and stayed invisible until somebody wrote another formula. The
       * grouping is the query now, and this decides what to show — the `hint`
       * carries the live count of values so the head of the list never implies
       * it is the whole of it.
       *
       * Most of these are reference rather than filters, and they say so by not
       * being buttons: `PeopleFilter` can express state and RVO, but not "on
       * PNB's panel" or "appears in two sources", because `empanelled_with` and
       * `source_count` are not on the projection. Widening it to serve one
       * report would put columns in the mirror that nothing else reads.
       */}
      <section>
        <SectionHeading>What the market looks like</SectionHeading>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <StatTile label="Firms" value={market.firms} sub={`${fmt(market.southIndiaFirms)} in South India`} />
          <StatTile
            label="South India"
            value={market.southIndiaPeople}
            sub={`${pct(market.southIndiaPeople)}% of the list`}
            meter={pct(market.southIndiaPeople)}
          />
          <StatTile
            label="IBBI-registered"
            value={market.ibbiRegistered}
            sub="the strongest qualification signal"
            meter={pct(market.ibbiRegistered)}
          />
          <StatTile label="Linked to a firm" value={market.linkedToFirm} sub="firm deals are larger than seats" />
        </div>

        <div className="mt-2 grid gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-2">
          <ChartCard title="Top empanelments" hint={`${market.byInstitution.length} institutions in all`}>
            {market.byInstitution.length ? (
              <OrderedBars rows={topWithOther(market.byInstitution, 8)} total={stats.people} />
            ) : (
              <Empty>No panel memberships recorded yet.</Empty>
            )}
          </ChartCard>
          <ChartCard title="Registered Valuer Organisation" hint={`${market.byRvo.length} RVOs in all`}>
            {market.byRvo.length ? (
              <OrderedBars
                rows={topWithOther(market.byRvo, 8)}
                total={stats.people}
                onPick={(key, label) =>
                  key === "__other__" ? onJump({ limit: 100 }, "All people") : onJump({ rvo: key, limit: 100 }, label)
                }
              />
            ) : (
              <Empty>No RVO recorded on any row yet.</Empty>
            )}
          </ChartCard>
        </div>

        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border bg-background p-3 text-xs sm:mt-3 sm:grid-cols-3">
          <Figure label="Appear in 2+ sources" value={market.multiSource} />
          <Figure label="On 2+ panels" value={market.empanelledTwoPlus} />
          <Figure label="On 3+ panels" value={market.empanelledThreePlus} />
          <Figure label="Matched to the IOV roll" value={market.iovMatched} />
          <Figure label="Firms with a named contact" value={market.firmsWithDecisionMaker} />
          <Figure
            label="Lender contacts"
            value={market.lenderContacts}
            sub={market.lenderContactsNamed ? `${fmt(market.lenderContactsNamed)} named` : undefined}
          />
        </dl>
      </section>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-IN");

/** A reference figure: a number and what it means, with nothing to click. */
function Figure({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/60 pb-1 last:border-0">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="whitespace-nowrap font-mono tabular-nums">
        {fmt(value)}
        {sub && <span className="ml-1 text-[10px] text-muted-foreground/70">{sub}</span>}
      </dd>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{children}</p>;
}

/** Top `n` by value, with the tail folded into one "Other" row rather than a 9th hue. */
function topWithOther(rows: { label: string; value: number }[], n: number) {
  const named = rows.filter((r) => r.label !== "—");
  const head = named.slice(0, n).map((r) => ({ key: r.label, label: r.label, value: r.value }));
  const tail = named.slice(n).reduce((s, r) => s + r.value, 0);
  return tail > 0 ? [...head, { key: "__other__", label: `Other (${named.length - n})`, value: tail }] : head;
}

/**
 * Horizontal bars for ordered magnitude: one hue, stepped light-to-dark by rank
 * so the eye reads the order, with the count and share labelled on every row.
 * The whole row is the hit target, not just the bar.
 */
function OrderedBars({
  rows,
  total,
  onPick,
}: {
  rows: { key: string; label: string; value: number }[];
  total: number;
  /**
   * Omitted where no filter can express the breakdown — `PeopleFilter` has no
   * `institution`, because `empanelled_with` is not on the projection. A row
   * that cannot act renders as a row, not as a button that swallows a click.
   */
  onPick?: (key: string, label: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => {
        const share = total > 0 ? Math.round((r.value / total) * 100) : 0;
        // Light-to-dark across the ordered set; floor keeps the last row visible.
        const alpha = 0.3 + 0.55 * (1 - i / Math.max(1, rows.length - 1));
        const grid =
          "grid w-full grid-cols-[minmax(5.5rem,8rem)_1fr_auto] items-center gap-2 rounded-md px-1 py-1 text-left sm:grid-cols-[10rem_1fr_auto]";
        const cells = (
          <>
              <span className="truncate text-xs">{r.label}</span>
              <span className="flex h-4 items-center">
                <span
                  className="h-2.5 rounded-[4px] transition-[width]"
                  style={{
                    width: `${Math.max(2, (r.value / max) * 100)}%`,
                    backgroundColor: `color-mix(in oklab, var(--brand) ${Math.round(alpha * 100)}%, transparent)`,
                  }}
                />
              </span>
            <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
              {fmt(r.value)}
              <span className="ml-1 hidden text-muted-foreground/70 sm:inline">{share}%</span>
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {onPick ? (
              <button
                type="button"
                onClick={() => onPick(r.key, r.label)}
                className={`group ${grid} transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`}
                title={`${r.label}: ${fmt(r.value)} (${share}%) — click to filter`}
              >
                {cells}
              </button>
            ) : (
              <div className={grid} title={`${r.label}: ${fmt(r.value)} (${share}%)`}>
                {cells}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StatTile({
  label,
  value,
  sub,
  meter,
  onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  /** 0–100. Drawn as a thin rule under the number, not as a second number. */
  meter?: number;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums sm:text-2xl">{fmt(value)}</div>
      {meter !== undefined && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
        </div>
      )}
      {sub && <div className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</div>}
    </>
  );
  // A button with no handler is focusable and does nothing, which is worse than
  // a plain figure: it promises an action the surface cannot perform.
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border bg-background p-3 text-left transition-colors hover:border-brand/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {body}
    </button>
  ) : (
    <div className="rounded-xl border bg-background p-3 text-left">{body}</div>
  );
}

function ActionRow({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "ok" | "warn" | "neutral";
  onClick: () => void;
}) {
  // Tone is carried by the count's weight and a word, never by colour alone.
  const toneCls = tone === "warn" && value > 0 ? "text-amber-700 dark:text-amber-500" : "text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <span className={"shrink-0 font-mono text-sm font-semibold tabular-nums " + toneCls}>{fmt(value)}</span>
    </button>
  );
}
