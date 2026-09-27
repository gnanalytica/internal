/**
 * Migrate the named officers and the institution desks into Contacts.
 *
 * Two sources, two shapes:
 *   Association Officers  128 rows, every one a named person, resolved to a body.
 *   Lender Contacts       378 rows over ~114 institutions — but only 179 name a
 *                         person. The other 199 are DEPARTMENT DESKS
 *                         ("Empanelment Cell", "Grievance Redressal") carrying a
 *                         real email or phone and no human.
 *
 * Those 199 are kept, as contact_kind "Desk". Dropping them to keep the tab
 * purely human would throw away a couple of hundred working addresses — which
 * are precisely how an empanelment application is sent — and folding them onto
 * the lender row cannot work at 1.7 desks per institution. contact_kind is what
 * stops a department being mistaken for a person by whoever writes the mail merge.
 *
 * org_id is RESOLVED against the live Lenders and RVOs tabs, never carried as
 * text. A contact whose institution cannot be matched is REPORTED AND DROPPED
 * rather than written with a blank org_id: a contact belonging to nothing is
 * invisible to every route the model has, so it would look like data while being
 * unreachable.
 *
 * `pnpm sheet:migrate-contacts` to see the plan, `--apply` to write it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { readRange } from "../src/lib/sheet-crm/sheets-api";
import { GTM_TABS, VOCAB } from "../src/lib/sheet-crm/gtm-model";

const APPLY = process.argv.includes("--apply");
const c = (v: unknown) => (v ?? "").toString().trim();
const SPEC = GTM_TABS.find((t) => t.title === "Contacts")!;

/** Drop the words that differ between two names for the same institution. */
const skel = (s: string) =>
  s.toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(the|ltd|limited|pvt|private|company|co|corporation|bank|india|indian|of|and|registered|valuers?|valuation|organisation|organization|foundation|association|rvo)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

/** A designation that names a decision, an influence, or a door. */
function decisionRole(title: string): string {
  const s = title.toLowerCase();
  if (/chairman|chairperson|president|managing director|\bmd\b|\bceo\b|\bcgm\b|general manager|director|proprietor|partner|head\b/.test(s)) return "Decider";
  if (/secretary|treasurer|coordinator|convenor|convener|vice|joint|dy\.?|deputy|manager|officer|committee/.test(s)) return "Influencer";
  if (/reception|front desk|customer care|grievance|helpline|call centre|call center|enquiry|support/.test(s)) return "Gatekeeper";
  return "";
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const header = ((await readRange(spreadsheetId, `'Contacts'!A1:BZ1`))[0] ?? []).map(c).filter(Boolean);
  if (header.join("|") !== SPEC.columns.join("|")) throw new Error("Contacts header does not match the schema — run pnpm sheet:sync-gtm-columns first.");
  const already = (await readRange(spreadsheetId, `'Contacts'!A2:BZ50`)).filter((r) => r.some((v) => c(v) !== ""));
  if (already.length) throw new Error(`Contacts already holds ${already.length}+ row(s). Refusing to write over them.`);

  // Resolve against what is actually on the sheet, not against the source tabs.
  const lend = await readRange(spreadsheetId, "'Lenders'!A1:BZ200");
  const lh = (lend[0] ?? []).map(c);
  const lookup = new Map<string, { id: string; type: string }>();
  lend.slice(1).filter((r) => r.some((v) => c(v) !== "")).forEach((r) => {
    lookup.set(skel(c(r[lh.indexOf("lender_name")])), { id: c(r[lh.indexOf("lender_id")]), type: "Lender" });
  });
  const bod = await readRange(spreadsheetId, "'RVOs & Associations'!A1:BZ60");
  const bh = (bod[0] ?? []).map(c);
  bod.slice(1).filter((r) => r.some((v) => c(v) !== "")).forEach((r) => {
    const id = c(r[bh.indexOf("body_id")]);
    const type = c(r[bh.indexOf("type")]) === "Association" ? "Association" : "RVO";
    for (const k of [c(r[bh.indexOf("body_name")]), c(r[bh.indexOf("acronym")])]) if (k) lookup.set(skel(k), { id, type });
  });

  type Row = Record<string, string>;
  const out: Row[] = [];
  const unmatched = new Map<string, number>();
  let n = 0;
  const nextId = () => `C${String(++n).padStart(4, "0")}`;

  // --- Association officers: all named people.
  const ao = await readRange(spreadsheetId, "'Association Officers'!A1:Z200");
  const ah = (ao[1] ?? []).map(c);
  const aAt = (r: unknown[], k: string) => { const i = ah.indexOf(k); return i < 0 ? "" : c(r[i]); };
  for (const r of ao.slice(2).filter((x) => x.some((v) => c(v) !== ""))) {
    const org = aAt(r, "organisation");
    const hit = lookup.get(skel(org));
    if (!hit) { unmatched.set(org, (unmatched.get(org) ?? 0) + 1); continue; }
    const title = aAt(r, "designation");
    out.push({
      contact_id: nextId(),
      name: aAt(r, "person_name"),
      contact_kind: "Person",
      org_id: hit.id,
      org_type: hit.type,
      title,
      decision_role: decisionRole(title),
      email: aAt(r, "email"),
      phone: [aAt(r, "mobile"), aAt(r, "alt_phone")].filter(Boolean).join("; "),
      city: aAt(r, "city"),
      source: aAt(r, "source_url"),
      notes: [aAt(r, "branch") ? `Branch: ${aAt(r, "branch")}` : "", aAt(r, "notes")].filter(Boolean).join(" | "),
    });
  }

  // --- Lender contacts: 179 named people, the rest department desks.
  const lc = await readRange(spreadsheetId, "'Lender Contacts'!A1:Z420");
  const ch = (lc[1] ?? []).map(c);
  const cAt = (r: unknown[], k: string) => { const i = ch.indexOf(k); return i < 0 ? "" : c(r[i]); };
  for (const r of lc.slice(2).filter((x) => x.some((v) => c(v) !== ""))) {
    const inst = cAt(r, "institution");
    const hit = lookup.get(skel(inst));
    if (!hit) { unmatched.set(inst, (unmatched.get(inst) ?? 0) + 1); continue; }
    const person = cAt(r, "contact_person_name");
    const dept = cAt(r, "department");
    const title = cAt(r, "designation") || cAt(r, "office_level");
    out.push({
      contact_id: nextId(),
      // A desk has no name of its own, so the department IS its name. Never invent
      // a person here: contact_kind is what keeps the two apart downstream.
      name: person || dept,
      contact_kind: person ? "Person" : "Desk",
      org_id: hit.id,
      org_type: hit.type,
      title,
      decision_role: decisionRole(person ? title : dept),
      email: cAt(r, "email"),
      phone: cAt(r, "phone"),
      city: cAt(r, "city"),
      source: cAt(r, "source_url"),
      notes: [
        person && dept ? `Department: ${dept}` : "",
        cAt(r, "office_level") && cAt(r, "office_level") !== title ? `Office level: ${cAt(r, "office_level")}` : "",
        cAt(r, "method_of_contact") ? `Contact by: ${cAt(r, "method_of_contact")}` : "",
        cAt(r, "approach_notes"),
        cAt(r, "confidence") ? `Source confidence: ${cAt(r, "confidence")}` : "",
      ].filter(Boolean).join(" | "),
    });
  }

  const rows = out.map((r) => SPEC.columns.map((col) => r[col] ?? ""));

  const bad: string[] = [];
  for (const [h, key] of Object.entries(SPEC.validate ?? {})) {
    const col = SPEC.columns.indexOf(h);
    const allowed = new Set<string>(VOCAB[key] as readonly string[]);
    rows.forEach((r) => { if (r[col] && !allowed.has(r[col])) bad.push(`${h}="${r[col]}"`); });
  }
  if (bad.length) throw new Error(`values outside their dropdown vocabulary:\n  ${[...new Set(bad)].join("\n  ")}`);

  const ci = (k: string) => SPEC.columns.indexOf(k);
  const nameless = rows.filter((r) => !r[ci("name")]);
  if (nameless.length) throw new Error(`${nameless.length} row(s) would have no name at all`);
  const orphan = rows.filter((r) => !r[ci("org_id")]);
  if (orphan.length) throw new Error(`${orphan.length} row(s) would have no org_id`);

  const tally = (k: string) => {
    const i = ci(k); const m = new Map<string, number>();
    rows.forEach((r) => { if (r[i]) m.set(r[i], (m.get(r[i]) ?? 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]).map(([x, y]) => `${x}=${y}`).join("  ");
  };

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${rows.length} contacts\n`);
  console.log(`contact_kind    ${tally("contact_kind")}`);
  console.log(`org_type        ${tally("org_type")}`);
  console.log(`decision_role   ${tally("decision_role")}   (blank on ${rows.filter((r) => !r[ci("decision_role")]).length})`);
  console.log(`reachable       email=${rows.filter((r) => r[ci("email")]).length}  phone=${rows.filter((r) => r[ci("phone")]).length}  neither=${rows.filter((r) => !r[ci("email")] && !r[ci("phone")]).length}`);
  if (unmatched.size) {
    const total = [...unmatched.values()].reduce((a, b) => a + b, 0);
    console.log(`\nDROPPED — institution could not be matched to a Lenders or Bodies row (${total} row(s), ${unmatched.size} names):`);
    [...unmatched].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k.slice(0, 70)}`));
    if (unmatched.size > 25) console.log(`  … and ${unmatched.size - 25} more`);
  }
  console.log(`\nid range: ${rows[0][0]} … ${rows[rows.length - 1][0]}`);

  if (!APPLY) { console.log("\nRe-run with --apply."); return; }

  const letter = (x: number) => { let s = "", i = x; while (i >= 0) { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } return s; };
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'Contacts'!A2:${letter(SPEC.columns.length - 1)}${rows.length + 1}`)}?valueInputOption=RAW`,
    { method: "PUT", headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: rows }) },
  );
  if (!res.ok) throw new Error(`values.update ${res.status}: ${(await res.text()).slice(0, 400)}`);
  console.log(`\nwrote ${rows.length} rows`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
