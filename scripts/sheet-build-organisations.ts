/**
 * Build the Organisations tab: every organisation in one place.
 *
 * Replaces Companies + Lender Landscape + RVOs, and takes the INSTITUTION
 * dimension out of Lender Contacts. 350 valuation firms + 127 banks/FIs + 14
 * RVOs, with a `kind` column.
 *
 * Two decisions worth knowing:
 *
 * `organisation_id` KEEPS each firm's existing `company_id`. Those ids are
 * referenced by `Companies.linked_person_ids`, by `People.company_names`'
 * lookups and by the app's mirror; renumbering them would break every
 * reference for the sake of tidier ids. Banks get `B####` and RVOs `R##`,
 * which are new because those tabs never had an id.
 *
 * A bank's per-desk detail is NOT flattened onto its row. Lender Contacts has
 * 378 rows across 114 institutions — 1.7 desks each — so "the institution's
 * department" is not a single value. Picking the first row's would be
 * arbitrary, so the institution row carries only what belongs to the
 * institution, and every desk stays a contact. That is the Contacts tab's job.
 *
 * `pnpm sheet:build-organisations`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { clearRanges, readTabs, writeCells } from "../src/lib/sheet-crm/sheets-api";

const APPLY = process.argv.includes("--apply");
const TAB = "Organisations";
const c = (v: unknown) => (v ?? "").toString().trim();
const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

/** Column order: identity, then what it is, then how to reach it, then research. */
const COLUMNS = [
  "organisation_id", "kind", "name", "org_type", "acronym", "parent_body",
  "constitution", "ibbi_entity_reg_no", "ibbi_reg_date", "rvo", "asset_classes",
  "email", "phone", "website", "linkedin", "address", "city", "state", "pincode", "is_south_india",
  "key_people", "key_people_ibbi_reg_nos", "linked_person_ids", "num_linked_people", "num_valuers",
  "empanelled_with", "panel_zone", "panel_category",
  "relevance", "empanelment_route", "empanelment_page_url", "empanelment_open_window",
  "branch_offices", "service_lines", "decision_makers", "decision_maker_contacts",
  "volume_signal", "current_tooling_signal", "sales_angle", "outreach_channels",
  "research_confidence", "enrichment_sources", "sources", "source_url", "confidence",
  "remarks", "excluded", "exclusion_reason", "last_enriched_at", "enriched_by",
] as const;

type Row = Partial<Record<(typeof COLUMNS)[number], string>>;

/** A lender's own words for what it is -> a coarse, filterable kind. */
function lenderKind(orgType: string, name: string): string {
  const s = `${orgType} ${name}`;
  if (/asset reconstruction|\barc\b/i.test(s)) return "arc";
  if (/housing finance|\bhfc\b/i.test(s)) return "hfc";
  if (/\bnbfc\b|non-?banking/i.test(s)) return "nbfc";
  if (/co-?op/i.test(s)) return "cooperative_bank";
  if (/income tax|government|govt|state financial|department/i.test(s)) return "govt";
  if (/bank/i.test(s)) return "bank";
  return "other";
}

function headerRowOf(all: unknown[][], marker: RegExp): number {
  const i = all.findIndex((r) => r.map(c).some((x) => marker.test(x)));
  return i < 0 ? 0 : i;
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const src = await readTabs(spreadsheetId, ["Companies", "Lender Landscape", "Lender Contacts", "RVOs", "Exclusions"]);
  const table = (name: string, marker: RegExp) => {
    const all = src.get(name) ?? [];
    const hi = headerRowOf(all, marker);
    const headers = (all[hi] ?? []).map(c);
    return {
      headers,
      rows: all.slice(hi + 1).filter((r) => r.some((x) => c(x))),
      at: (r: unknown[], h: string) => (headers.indexOf(h) >= 0 ? c(r[headers.indexOf(h)]) : ""),
    };
  };

  const co = table("Companies", /^company_id$/);
  const ll = table("Lender Landscape", /^institution$/);
  const lc = table("Lender Contacts", /^institution$/);
  const rv = table("RVOs", /^rvo_name$/);
  const ex = table("Exclusions", /^Entity \/ Person$/);

  const out: Row[] = [];

  // --- 1. Valuation firms keep their company_id.
  for (const r of co.rows) {
    if (!co.at(r, "company_id")) continue;
    out.push({
      organisation_id: co.at(r, "company_id"),
      kind: "valuation_firm",
      name: co.at(r, "company_name"),
      org_type: co.at(r, "constitution"),
      constitution: co.at(r, "constitution"),
      ibbi_entity_reg_no: co.at(r, "ibbi_entity_reg_no"),
      ibbi_reg_date: co.at(r, "ibbi_reg_date"),
      rvo: co.at(r, "rvo"),
      asset_classes: co.at(r, "asset_classes"),
      email: co.at(r, "email"),
      phone: co.at(r, "phone"),
      website: co.at(r, "website"),
      linkedin: co.at(r, "linkedin"),
      address: co.at(r, "address"),
      city: co.at(r, "city"),
      state: co.at(r, "state"),
      pincode: co.at(r, "pincode"),
      key_people: co.at(r, "key_people"),
      key_people_ibbi_reg_nos: co.at(r, "key_people_ibbi_reg_nos"),
      linked_person_ids: co.at(r, "linked_person_ids"),
      num_valuers: co.at(r, "num_valuers"),
      empanelled_with: co.at(r, "empanelled_with"),
      panel_zone: co.at(r, "pnb_zone"),
      panel_category: co.at(r, "pnb_category"),
      branch_offices: co.at(r, "branch_offices"),
      service_lines: co.at(r, "service_lines"),
      decision_makers: co.at(r, "decision_makers"),
      decision_maker_contacts: co.at(r, "decision_maker_contacts"),
      volume_signal: co.at(r, "volume_signal"),
      current_tooling_signal: co.at(r, "current_tooling_signal"),
      sales_angle: co.at(r, "sales_angle"),
      research_confidence: co.at(r, "research_confidence"),
      enrichment_sources: co.at(r, "enrichment_sources"),
      sources: co.at(r, "sources"),
      remarks: co.at(r, "remarks"),
    });
  }

  // --- 2. Banks / FIs: the union of Lender Landscape and Lender Contacts'
  //        institutions, deduplicated on the name's skeleton.
  const banks = new Map<string, Row>();
  let seq = 1;
  const nextBankId = () => `B${String(seq++).padStart(4, "0")}`;
  for (const r of ll.rows) {
    const name = ll.at(r, "institution");
    if (!name) continue;
    const k = norm(name);
    banks.set(k, {
      organisation_id: nextBankId(),
      kind: lenderKind(ll.at(r, "institution_type"), name),
      name,
      org_type: ll.at(r, "institution_type"),
      relevance: ll.at(r, "relevance_to_valytica"),
      remarks: ll.at(r, "notes"),
    });
  }
  // Lender Contacts contributes institutions Landscape does not name, and fills
  // the institution-level fields where a row genuinely carries them.
  for (const r of lc.rows) {
    const name = lc.at(r, "institution");
    if (!name) continue;
    const k = norm(name);
    const existing = banks.get(k);
    const inst: Row = existing ?? {
      organisation_id: nextBankId(),
      kind: lenderKind(lc.at(r, "institution_type"), name),
      name,
      org_type: lc.at(r, "institution_type"),
    };
    // First non-empty wins; these are institution-level, not desk-level.
    inst.website ||= lc.at(r, "website_url");
    inst.empanelment_page_url ||= lc.at(r, "empanelment_page_url");
    inst.empanelment_open_window ||= lc.at(r, "empanelment_open_window");
    inst.empanelment_route ||= lc.at(r, "method_of_contact");
    inst.state ||= lc.at(r, "state");
    inst.confidence ||= lc.at(r, "confidence");
    inst.source_url ||= lc.at(r, "source_url");
    banks.set(k, inst);
  }
  out.push(...banks.values());

  // --- 3. RVOs.
  let rseq = 1;
  for (const r of rv.rows) {
    const name = rv.at(r, "rvo_name");
    if (!name) continue;
    out.push({
      organisation_id: `R${String(rseq++).padStart(2, "0")}`,
      kind: "rvo",
      name,
      org_type: "Registered Valuer Organisation",
      acronym: rv.at(r, "acronym"),
      parent_body: rv.at(r, "parent_body"),
      address: rv.at(r, "address"),
      phone: rv.at(r, "phone"),
      email: rv.at(r, "email"),
      website: rv.at(r, "website"),
      key_people: rv.at(r, "key_people"),
      asset_classes: rv.at(r, "asset_classes"),
      num_valuers: rv.at(r, "lb_valuer_count"),
      outreach_channels: rv.at(r, "outreach_channels"),
      remarks: rv.at(r, "approach_notes"),
    });
  }

  // --- 4. Exclusions that are organisations become a flag, not a lost row.
  let flagged = 0, added = 0;
  for (const r of ex.rows) {
    if (!/organisation/i.test(ex.at(r, "Type"))) continue;
    const name = ex.at(r, "Entity / Person");
    const reason = [ex.at(r, "Action"), ex.at(r, "Reason"), ex.at(r, "Notes")].filter(Boolean).join(" — ");
    const hit = out.find((o) => norm(o.name ?? "") === norm(name));
    if (hit) {
      hit.excluded = "Yes";
      hit.exclusion_reason = reason;
      flagged++;
    } else {
      out.push({ organisation_id: nextBankId(), kind: "other", name, excluded: "Yes", exclusion_reason: reason, remarks: ex.at(r, "Aliases / Related Names") });
      added++;
    }
  }

  // Lender Landscape has rows naming SEVERAL institutions at once
  // ("NARCL / ARCIL / Edelweiss ARC", "Co-operative banks (Saraswat, SVC,
  // TJSB…)") — the organisation equivalent of the multi-person People rows.
  // They are kept verbatim and flagged, never split on a guess: which of three
  // ARCs a note refers to is not derivable from the cell.
  const MULTI_ENTITY = /\s\/\s|\b(and|&)\b.*\b(and|&)\b|\([^)]*,[^)]*,/;
  const multiEntity = out.filter((o) => o.kind !== "valuation_firm" && MULTI_ENTITY.test(o.name ?? ""));
  multiEntity.forEach((o) => {
    o.exclusion_reason ||= "";
    o.remarks = [o.remarks, "REVIEW: this row names more than one institution; split before using it as a validation value."].filter(Boolean).join(" | ");
  });

  const byKind = new Map<string, number>();
  out.forEach((o) => byKind.set(o.kind ?? "?", (byKind.get(o.kind ?? "?") ?? 0) + 1));
  console.log(`${TAB}: ${out.length} rows, ${COLUMNS.length} columns\n`);
  [...byKind.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
  console.log(`\nexclusions: ${flagged} matched an existing row, ${added} added as new`);
  console.log(`multi-institution rows flagged for review: ${multiEntity.length}`);
  multiEntity.slice(0, 6).forEach((o) => console.log(`   ${o.organisation_id}  ${(o.name ?? "").slice(0, 70)}`));
  console.log(`\nsample:`);
  for (const k of [...byKind.keys()]) {
    const s = out.find((o) => o.kind === k)!;
    console.log(`  ${(s.organisation_id ?? "").padEnd(7)} ${(s.kind ?? "").padEnd(16)} ${(s.name ?? "").slice(0, 46).padEnd(48)} ${(s.org_type ?? "").slice(0, 28)}`);
  }
  const fill = COLUMNS.map((h) => ({ h, n: out.filter((o) => c(o[h])).length }));
  console.log(`\nempty columns: ${fill.filter((f) => f.n === 0).map((f) => f.h).join(", ") || "none"}`);

  if (!APPLY) { console.log(`\nDry run. Nothing written. Re-run with --apply.`); return; }

  mkdirSync("tmp", { recursive: true });
  const snap = `tmp/organisations-built-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(snap, JSON.stringify({ columns: COLUMNS, rows: out }, null, 2));
  console.log(`\nsnapshot: ${snap}`);

  const token = await getAccessToken();
  const api = async (body: unknown) => {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`batchUpdate ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  };

  const meta = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const exists = meta.sheets.find((s: { properties: { title: string } }) => s.properties.title === TAB);
  if (exists) throw new Error(`"${TAB}" already exists. Delete it first if you mean to rebuild.`);

  await api({
    requests: [
      {
        addSheet: {
          properties: {
            title: TAB,
            index: 2,
            gridProperties: { rowCount: out.length + 50, columnCount: COLUMNS.length, frozenRowCount: 1, frozenColumnCount: 3 },
            tabColorStyle: { rgbColor: { red: 0.06, green: 0.53, blue: 0.42 } },
          },
        },
      },
    ],
  });
  console.log(`created "${TAB}"`);

  const letter = (i: number) => { let n = i, s = ""; while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } return s; };
  const last = letter(COLUMNS.length - 1);
  await writeCells(spreadsheetId, [{ range: `'${TAB}'!A1:${last}1`, value: "" }], "RAW"); // ensure the range exists
  // Values go in one shot per block of 500 rows.
  const body = out.map((o) => COLUMNS.map((h) => c(o[h])));
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${TAB}'!A1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[...COLUMNS], ...body] }),
    },
  );
  if (!res.ok) throw new Error(`values.update ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log(`wrote ${out.length} row(s) + header`);

  // Both were `d()` on Companies and must stay computed here: a stored count
  // disagreed with the list beside it on 75 People rows, which is the whole
  // reason those columns became formulas in the first place.
  //
  // The two columns must be CLEARED before the formula goes in. The values
  // write above sends "" for them, and an empty STRING is not an empty cell —
  // an ARRAYFORMULA refuses to expand over anything, and reports it as
  // `#REF! (Array result was not expanded because it would overwrite data in
  // T3.)`, naming only the first blocker. This is the same failure the nine
  // hand-typed cells caused on People, which is why `clearRanges` exists.
  const colOf = (h: (typeof COLUMNS)[number]) => letter(COLUMNS.indexOf(h));
  const A = colOf("organisation_id");
  const ST = colOf("state");
  const LP = colOf("linked_person_ids");
  await clearRanges(spreadsheetId, [
    `'${TAB}'!${colOf("is_south_india")}2:${colOf("is_south_india")}`,
    `'${TAB}'!${colOf("num_linked_people")}2:${colOf("num_linked_people")}`,
  ]);
  await writeCells(
    spreadsheetId,
    [
      {
        range: `'${TAB}'!${colOf("is_south_india")}2`,
        value: `=ARRAYFORMULA(IF(${A}2:${A}="","",IF(REGEXMATCH(LOWER(TRIM(${ST}2:${ST})),"^(andhra pradesh|telangana|karnataka|tamil nadu|kerala|puducherry|pondicherry)$"),"Yes","No")))`,
      },
      {
        range: `'${TAB}'!${colOf("num_linked_people")}2`,
        value: `=ARRAYFORMULA(IF(${A}2:${A}="","",IF(TRIM(${LP}2:${LP})="",0,LEN(TRIM(${LP}2:${LP}))-LEN(SUBSTITUTE(TRIM(${LP}2:${LP}),";",""))+1)))`,
      },
    ],
    "USER_ENTERED",
  );
  console.log(`wrote 2 derived column formula(s): is_south_india, num_linked_people`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
