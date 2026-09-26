/**
 * Before retiring Prospect Intelligence / Deep Dive Dossiers / Research Queue:
 * prove that every column carrying data has somewhere to land.
 *
 * Three destinations are legitimate — a column on People (the #151 fold), a
 * column on the merged `Prospect Research` tab, or deliberately dropped as a
 * restatement of something People already holds. A fourth outcome, "carries
 * data and lands NOWHERE", is a blocker: retiring the tab would delete
 * hand-researched text.
 *
 * This exists because writing the source -> target map by hand found exactly
 * that. `people-fold-gtm.ts` mapped `next_action` from Research Queue's "Next
 * Research Task" alone, so Prospect Intelligence's and Deep Dive Dossiers' own
 * "Next Action" (22 and 27 populated rows) were never folded and would have
 * gone with the tabs. A prose map is not a proof; this is.
 *
 * `pnpm sheet:gtm-coverage`
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PROSPECT_RESEARCH } from "../src/lib/sheet-crm/mapping";
import { readRange, readTabs } from "../src/lib/sheet-crm/sheets-api";

const c = (v: unknown) => (v ?? "").toString().trim();

/** Columns whose content already lives on People after the #151 fold. */
const ON_PEOPLE: Record<string, string> = {
  "Research Status": "research_status",
  Status: "research_status",
  Priority: "priority",
  "Opportunity Score /100": "opportunity_score",
  "Score Band": "score_band",
  "Persona / GTM Role": "persona",
  "Lead Role": "persona",
  "Best First Channel": "best_first_channel",
  "Next Research Task": "next_action",
  "Why This Person Now": "why_now",
  "Pain Narrative": "pain",
  "Pain Point Hypothesis (Inferred)": "pain",
  "Full Name": "full_name",
  Name: "full_name",
  City: "city",
  State: "state",
  "Public Phone": "phone",
  "Public Email": "email",
  "IBBI Reg No": "ibbi_reg_no",
  RVO: "rvo",
  Website: "website",
  LinkedIn: "linkedin",
  "Practice / Firm": "company_names",
  "Organisation / Practice": "company_names",
  "Person ID": "person_id",
  "Prospect / Contact ID": "person_id",
};

/** Source header -> merged-tab column, where the name changes. */
const RENAMED: Record<string, string> = {
  "Verified Current Bank / Lender Relationships": "Verified Bank Relationships",
  "Relationship Evidence / Recency": "Relationship Evidence",
  "Bank-Side Contact / Decision Path": "Bank-Side Contacts",
  "Bank / Lender Contacts": "Bank-Side Contacts",
  "Warm Referral Path": "Warm Paths",
  "Relevant People / Warm Paths": "Warm Paths",
  "Evidence-Backed Workflow Signal": "Workflow Signal",
  "Primary Trigger": "Likely Trigger",
  "Primary Wedge": "Valytica Wedge",
  "Valytica Angle": "Valytica Wedge",
  "Personalized Opening Angle": "Opening Angle",
  "Next Action": "Next Outreach Action",
};

const SOURCES = ["Prospect Intelligence", "Deep Dive Dossiers", "Research Queue"] as const;

function headerRowOf(all: unknown[][]): number {
  let hi = 0, best = 0;
  all.slice(0, 8).forEach((r, i) => {
    const n = r.filter((x) => { const v = c(x); return v && v.length < 40; }).length;
    if (n > best) { best = n; hi = i; }
  });
  return hi;
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const merged = new Set(PROSPECT_RESEARCH.columns.map((col) => col.header));
  const peopleHeaders = new Set(((await readRange(spreadsheetId, "'People'!A1:BZ1"))[0] ?? []).map(c));
  const got = await readTabs(spreadsheetId, [...SOURCES]);

  const lost: { tab: string; header: string; filled: number }[] = [];
  let covered = 0;

  for (const tab of SOURCES) {
    const all = got.get(tab) ?? [];
    const hi = headerRowOf(all);
    const headers = (all[hi] ?? []).map(c);
    const rows = all.slice(hi + 1).filter((r) => r.some((x) => c(x)));
    console.log(`\n##### ${tab} — ${headers.filter(Boolean).length} columns, ${rows.length} rows`);

    headers.forEach((h, i) => {
      if (!h) return;
      const filled = rows.filter((r) => c(r[i])).length;
      const target = merged.has(h)
        ? `merged: ${h}`
        : RENAMED[h] && merged.has(RENAMED[h])
          ? `merged: ${RENAMED[h]}`
          : ON_PEOPLE[h] && peopleHeaders.has(ON_PEOPLE[h])
            ? `People.${ON_PEOPLE[h]}`
            : null;
      if (target) { covered++; console.log(`  ok    ${String(filled).padStart(3)}  ${h.padEnd(46)} → ${target}`); return; }
      if (filled === 0) { console.log(`  empty   0  ${h.padEnd(46)} → nothing to lose`); return; }
      lost.push({ tab, header: h, filled });
      console.log(`  LOST  ${String(filled).padStart(3)}  ${h.padEnd(46)} → *** NO DESTINATION ***`);
    });
  }

  console.log(`\n${covered} column(s) have a destination; ${lost.length} carry data and have none.`);
  if (lost.length) {
    console.log("\nRetiring the three tabs would delete these:");
    lost.forEach((l) => console.log(`  ${l.tab} / ${l.header} — ${l.filled} populated row(s)`));
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
