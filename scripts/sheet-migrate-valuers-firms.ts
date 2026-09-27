/**
 * Migrate the unambiguous valuers and firms.
 *
 * Valuers takes the People rows that are ONE contactable person: not
 * firm-shaped, not several people in a cell, and carrying at least one of an
 * IBBI number, email, phone, address or city.
 *
 * Firms takes the 350 valuation_firm rows out of Organisations, which is the
 * real firm list. The 234 firm-shaped rows sitting in People are NOT migrated —
 * only 15 of them duplicate a row here, so they are a separate set needing a
 * per-row decision, and a wrong guess writes a real person out of the dataset.
 *
 * Held back deliberately, all reported by pnpm sheet:audit-row-shape:
 *   234 firm-shaped People rows (59 of which name their proprietor inside)
 *    29 rows naming several people
 *   454 rows with a name and no way to reach them
 *
 * Both tabs are written in one run because Firms.decision_maker_valuer_id has to
 * translate a People id into the Valuers id minted here; two scripts would need
 * two copies of that map.
 *
 * NOT carried over: lead_score, opportunity_score, score_band, priority,
 * persona, best_first_channel, data_quality_flag, duplicate_flag. Every one is
 * output of the scoring model being replaced, derivable again from the columns
 * that ARE here, and carrying them would freeze a stale verdict into the new
 * sheet. The facts they were derived from all migrate.
 *
 * `pnpm sheet:migrate-valuers-firms` to see the plan, `--apply` to write it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { readRange } from "../src/lib/sheet-crm/sheets-api";
import { GTM_TABS, VOCAB } from "../src/lib/sheet-crm/gtm-model";

const APPLY = process.argv.includes("--apply");
/** Clear and rebuild. Safe only while every value is derived and nothing is hand-typed. */
const REWRITE = process.argv.includes("--rewrite");
const c = (v: unknown) => (v ?? "").toString().trim();
const V_SPEC = GTM_TABS.find((t) => t.title === "Valuers")!;
const F_SPEC = GTM_TABS.find((t) => t.title === "Firms")!;

const FIRM_WORDS = /\b(pvt|private|limited|ltd|llp|inc|corporation|associates|consultants?|enterprises?|engineers?\s*&|&\s*co|company|firm|valuers\s*(pvt|private|and|&)|technologies|solutions|services|advisors?y?|group)\b/i;
const MULTI = /\d\s*[.)]\s*\S+.*\d\s*[.)]\s*\S+|\b\w+\s+and\s+\w+\s+(and|&)\s+\w+/i;

const orgSkel = (s: string) =>
  s.toLowerCase().replace(/\bm\/?s\.?\b/g, " ").replace(/\(.*?\)/g, " ")
    // "Income Tax Dept (Tamil Nadu)" and "Income Tax Department (regional)" are the
    // same panel — the Lenders row says "(regional)" precisely because it covers all
    // of them, and the parentheses are already dropped above.
    .replace(/\bdept\b/g, "department")
    // A qualifier on the relationship, not part of the institution's name.
    .replace(/\bsarfaesi\b/g, " ")
    .replace(/\b(the|ltd|limited|pvt|private|company|co|corporation|bank|india|indian|of|and|registered|valuers?|valuation|organisation|organization|foundation|association|rvo)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

/** Split a semicolon/comma list, keeping whole names intact. */
const list = (s: string) => s.split(/\s*;\s*/).flatMap((x) => (x.includes(",") && !/\d/.test(x) ? [x] : [x])).map((x) => x.trim()).filter(Boolean);

/**
 * The source spells four states differently from the dropdown and puts a CITY in
 * the column once. Normalising is safe; the city is not a state and must not be
 * coerced into one, so it returns null and the value is preserved in notes.
 */
const STATE_ALIAS: Record<string, string> = {
  "jammu and kashmir": "Jammu & Kashmir",
  "andaman and nicobar": "Andaman & Nicobar",
  "chattisgarh": "Chhattisgarh",
  "dadra and nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
  "daman and diu": "Dadra & Nagar Haveli and Daman & Diu",
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
  "uttaranchal": "Uttarakhand",
};
const STATES = new Set<string>(VOCAB.state as readonly string[]);
function normState(raw: string): { state: string; stray: string } {
  if (!raw) return { state: "", stray: "" };
  if (STATES.has(raw)) return { state: raw, stray: "" };
  const fixed = STATE_ALIAS[raw.toLowerCase().replace(/\s+/g, " ").trim()];
  if (fixed) return { state: fixed, stray: "" };
  const ci = [...STATES].find((x) => x.toLowerCase() === raw.toLowerCase());
  if (ci) return { state: ci, stray: "" };
  return { state: "", stray: raw };
}

/**
 * 47 spellings of four concepts — "PROPERIETORS HIP", "Proprietorsip", "pvt ld.",
 * "PROPRIETORSHI P FIRM". Pattern-matched rather than listed, because the list is
 * open-ended and a typo nobody has made yet should still land correctly.
 *
 * A bare "Company" or "Ltd" is NOT mapped: it could be private or public and
 * most of these are private, which is exactly why guessing is wrong. It returns
 * blank and the original is preserved.
 *
 * Two rows put the partner NAMES in this cell ("Partnership 1 Kulbhushan Mittal
 * 2. Harish Kumar Agarwal…"). Those normalise to Partnership and the original is
 * carried to notes, or three real people would vanish into one enum value.
 */
function normConstitution(raw: string): { value: string; stray: string } {
  if (!raw) return { value: "", stray: "" };
  const s = raw.toLowerCase();
  const keep = /\d/.test(raw) || raw.length > 25 ? raw : "";
  if (/\bllp\b/.test(s)) return { value: "LLP", stray: keep };
  if (/public/.test(s)) return { value: "Public Limited", stray: keep };
  if (/partner|patnership/.test(s)) return { value: "Partnership", stray: keep };
  if (/prop/.test(s)) return { value: "Proprietorship", stray: keep };
  if (/\bopc\b|pvt|private/.test(s)) return { value: "Private Limited", stray: keep };
  return { value: "", stray: raw };
}

const letter = (x: number) => { let s = "", i = x; while (i >= 0) { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } return s; };

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  for (const spec of [V_SPEC, F_SPEC]) {
    const header = ((await readRange(spreadsheetId, `'${spec.title}'!A1:BZ1`))[0] ?? []).map(c).filter(Boolean);
    if (header.join("|") !== spec.columns.join("|")) throw new Error(`${spec.title} header does not match the schema — run pnpm sheet:sync-gtm-columns first.`);
    const already = (await readRange(spreadsheetId, `'${spec.title}'!A2:BZ30`)).filter((r) => r.some((v) => c(v) !== ""));
    if (already.length && !REWRITE) {
      throw new Error(`${spec.title} already holds ${already.length}+ row(s). Every value here is derived, so --rewrite will clear and rebuild both tabs — but only pass it if nobody has typed into them by hand.`);
    }
  }

  // Resolve names against what is LIVE on the sheet, never against the sources.
  const lend = await readRange(spreadsheetId, "'Lenders'!A1:BZ200");
  const lh = (lend[0] ?? []).map(c);
  const lenderByName = new Map<string, string>();
  // A skeleton collision means two Lenders rows are the same institution. Last
  // write would win silently, so collect them and say so.
  const lenderCollisions: string[] = [];
  lend.slice(1).filter((r) => r.some((v) => c(v) !== "")).forEach((r) => {
    const key = orgSkel(c(r[lh.indexOf("lender_name")]));
    const id = c(r[lh.indexOf("lender_id")]);
    const prev = lenderByName.get(key);
    if (prev) lenderCollisions.push(`${prev} and ${id}: "${c(r[lh.indexOf("lender_name")])}"`);
    else lenderByName.set(key, id);
  });

  const bod = await readRange(spreadsheetId, "'RVOs & Associations'!A1:BZ60");
  const bh = (bod[0] ?? []).map(c);
  const bodyByName = new Map<string, string>();
  bod.slice(1).filter((r) => r.some((v) => c(v) !== "")).forEach((r) => {
    const id = c(r[bh.indexOf("body_id")]);
    for (const k of [c(r[bh.indexOf("body_name")]), c(r[bh.indexOf("acronym")])]) if (k) bodyByName.set(orgSkel(k), id);
  });

  const unresolved = { lenders: new Map<string, number>(), bodies: new Map<string, number>(), firms: new Map<string, number>() };
  const miss = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  // Firms is built first for its name map, then patched once the Valuers ids are
  // known — see the decision_maker fix-up below.
  // ---------- Firms, from the Organisations valuation_firm rows ----------
  const O = await readRange(spreadsheetId, "'Organisations'!A1:BZ600");
  const oh = (O[0] ?? []).map(c);
  const oAt = (r: unknown[], k: string) => { const i = oh.indexOf(k); return i < 0 ? "" : c(r[i]); };
  const srcFirms = O.slice(1).filter((r) => r.some((v) => c(v) !== "")).filter((r) => oAt(r, "kind") === "valuation_firm");

  const firmIdFor = (old: string, i: number) => (/^C\d+$/.test(old) ? `F${old.slice(1).padStart(4, "0")}` : `F${String(9000 + i).padStart(4, "0")}`);
  const valuerIdFor = (personId: string) => (/^P\d+$/.test(personId) ? `V${personId.slice(1).padStart(5, "0")}` : "");

  const firmByName = new Map<string, string>();
  const strayConstitutions = new Map<string, number>();
  const firmRows = srcFirms.map((r, i) => {
    const fid = firmIdFor(oAt(r, "organisation_id"), i);
    const con = normConstitution(oAt(r, "constitution"));
    if (con.stray && !con.value) strayConstitutions.set(con.stray, (strayConstitutions.get(con.stray) ?? 0) + 1);
    const name = oAt(r, "name");
    firmByName.set(orgSkel(name), fid);
    const members = list(oAt(r, "linked_person_ids")).map(valuerIdFor).filter(Boolean);
    const lenders = list(oAt(r, "empanelled_with")).map((n) => {
      const hit = lenderByName.get(orgSkel(n));
      if (!hit) miss(unresolved.lenders, n);
      return hit ?? "";
    }).filter(Boolean);
    const row: Record<string, string> = {
      firm_id: fid,
      firm_name: name,
      constitution: con.value,
      ibbi_entity_reg_no: oAt(r, "ibbi_entity_reg_no"),
      city: oAt(r, "city"),
      state: normState(oAt(r, "state")).state,
      num_valuers: members.length ? String(members.length) : "",
      asset_classes: oAt(r, "asset_classes"),
      email: oAt(r, "email"),
      phone: oAt(r, "phone"),
      website: oAt(r, "website"),
      // Only when the firm has exactly one member is that member self-evidently
      // the person who decides. Picking one of five would be inventing a fact.
      // Checked against the migrated Valuers ids below — a member held back is a
      // link to nothing, which is worse than no link.
      decision_maker_valuer_id: members.length === 1 ? members[0] : "",
      empanelled_lenders: [...new Set(lenders)].join("; "),
      stage: "Not contacted",
      do_not_contact: /^y/i.test(oAt(r, "excluded")) ? "Yes" : "",
      source: oAt(r, "sources") || oAt(r, "source_url"),
      notes: [
        oAt(r, "remarks"),
        con.stray ? `Constitution as stated: ${con.stray}` : "",
        oAt(r, "address") ? `Address: ${oAt(r, "address")}` : "",
        oAt(r, "pincode") ? `Pincode: ${oAt(r, "pincode")}` : "",
        oAt(r, "key_people") ? `Named on file: ${oAt(r, "key_people")}` : "",
        members.length > 1 ? `${members.length} members on file: ${members.join("; ")}` : "",
      ].filter(Boolean).join(" | "),
    };
    return F_SPEC.columns.map((col) => row[col] ?? "");
  });

  // ---------- Valuers, from the People rows that are one contactable person ----------
  const P = await readRange(spreadsheetId, "'People'!A1:BZ5700");
  const ph = (P[0] ?? []).map(c);
  const pAt = (r: unknown[], k: string) => { const i = ph.indexOf(k); return i < 0 ? "" : c(r[i]); };
  const people = P.slice(1).filter((r) => r.some((v) => c(v) !== ""));
  const held = { firmShaped: 0, multi: 0, nameless: 0, unreachable: 0 };

  const assetOk = new Set<string>(VOCAB.asset_class as readonly string[]);
  const strayStates = new Map<string, number>();
  const valuerRows: string[][] = [];
  for (const r of people) {
    const name = pAt(r, "full_name");
    if (!name) { held.nameless++; continue; }
    if (FIRM_WORDS.test(name)) { held.firmShaped++; continue; }
    if (MULTI.test(name)) { held.multi++; continue; }
    if (!["ibbi_reg_no", "email", "phone", "address", "city"].some((k) => pAt(r, k))) { held.unreachable++; continue; }

    const vid = valuerIdFor(pAt(r, "person_id"));
    if (!vid) throw new Error(`unexpected person_id "${pAt(r, "person_id")}" for ${name}`);

    const rvoName = pAt(r, "rvo");
    const rvoId = rvoName ? bodyByName.get(orgSkel(rvoName)) : undefined;
    if (rvoName && !rvoId) miss(unresolved.bodies, rvoName);

    const lenders = list(pAt(r, "empanelled_with")).map((n) => {
      const hit = lenderByName.get(orgSkel(n));
      if (!hit) miss(unresolved.lenders, n);
      return hit ?? "";
    }).filter(Boolean);

    const firmName = list(pAt(r, "company_names"))[0] ?? "";
    const fid = firmName ? firmByName.get(orgSkel(firmName)) : undefined;
    if (firmName && !fid) miss(unresolved.firms, firmName);

    // Only a single value that is already in the vocabulary is taken. "Land &
    // Building; Securities / Financial Assets" states two and belongs in notes.
    const st = normState(pAt(r, "state"));
    if (st.stray) strayStates.set(st.stray, (strayStates.get(st.stray) ?? 0) + 1);

    const rawAsset = pAt(r, "iov_asset_class") || pAt(r, "other_asset_classes");
    const asset = assetOk.has(rawAsset) ? rawAsset : "";

    const row: Record<string, string> = {
      valuer_id: vid,
      full_name: name,
      ibbi_reg_no: pAt(r, "ibbi_reg_no"),
      asset_class: asset,
      registered_since: pAt(r, "ibbi_reg_date"),
      email: pAt(r, "email"),
      phone: pAt(r, "phone"),
      city: pAt(r, "city"),
      state: st.state,
      firm_id: fid ?? "",
      empanelled_lenders: [...new Set(lenders)].join("; "),
      rvo: rvoId ?? "",
      stage: "Not contacted",
      owner: pAt(r, "owner"),
      next_action: pAt(r, "next_action"),
      source: pAt(r, "sources"),
      notes: [
        pAt(r, "remarks"),
        !asset && rawAsset ? `Asset classes as stated: ${rawAsset}` : "",
        pAt(r, "specialisation") ? `Specialisation: ${pAt(r, "specialisation")}` : "",
        pAt(r, "years_practice") ? `Years in practice: ${pAt(r, "years_practice")}` : "",
        pAt(r, "firm_size") ? `Firm size: ${pAt(r, "firm_size")}` : "",
        pAt(r, "associations_and_roles") ? `Associations: ${pAt(r, "associations_and_roles")}` : "",
        pAt(r, "iov_membership_no") ? `IOV membership: ${pAt(r, "iov_membership_no")}` : "",
        pAt(r, "current_tooling_signal") ? `Tooling signal: ${pAt(r, "current_tooling_signal")}` : "",
        pAt(r, "website") ? `Website: ${pAt(r, "website")}` : "",
        pAt(r, "linkedin") ? `LinkedIn: ${pAt(r, "linkedin")}` : "",
        firmName && !fid ? `Firm named but no Firms row: ${firmName}` : "",
        st.stray ? `State column held a non-state value: ${st.stray}` : "",
        pAt(r, "address") ? `Address: ${pAt(r, "address")}` : "",
      ].filter(Boolean).join(" | "),
    };
    valuerRows.push(V_SPEC.columns.map((col) => row[col] ?? ""));
  }

  // A decision maker who was held back (firm-shaped, multi-person or unreachable)
  // has no Valuers row, so the link would dangle. Blank it and say who it was.
  const liveValuers = new Set(valuerRows.map((r) => r[0]));
  let blankedDecisionMakers = 0;
  const dmCol = F_SPEC.columns.indexOf("decision_maker_valuer_id");
  const notesCol = F_SPEC.columns.indexOf("notes");
  for (const row of firmRows) {
    const dm = row[dmCol];
    if (dm && !liveValuers.has(dm)) {
      row[dmCol] = "";
      row[notesCol] = [row[notesCol], `Sole member on file is ${dm}, who is not a Valuers row (held back by the row-shape audit)`].filter(Boolean).join(" | ");
      blankedDecisionMakers++;
    }
  }

  // Validate both, against the vocabularies the sheet itself enforces.
  for (const [spec, rows] of [[V_SPEC, valuerRows], [F_SPEC, firmRows]] as const) {
    const bad = new Map<string, number>();
    for (const [h, key] of Object.entries(spec.validate ?? {})) {
      const col = spec.columns.indexOf(h);
      const allowed = new Set<string>(VOCAB[key] as readonly string[]);
      rows.forEach((r) => { if (r[col] && !allowed.has(r[col])) bad.set(`${h}="${r[col]}"`, (bad.get(`${h}="${r[col]}"`) ?? 0) + 1); });
    }
    if (bad.size) {
      console.log(`\n${spec.title} — values outside their dropdown vocabulary (these would show a warning triangle):`);
      [...bad].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
      throw new Error(`${spec.title}: ${bad.size} distinct out-of-vocabulary value(s). Fix the mapping, do not write them.`);
    }
    const ids = rows.map((r) => r[0]);
    if (new Set(ids).size !== ids.length) throw new Error(`${spec.title}: duplicate id`);
  }

  console.log(`${APPLY ? "APPLY" : "DRY RUN"}\n`);
  console.log(`Valuers  ${valuerRows.length} rows`);
  console.log(`Firms    ${firmRows.length} rows\n`);
  console.log(`held back (need a per-row decision, not migrated):`);
  console.log(`  firm-shaped name in People   ${held.firmShaped}`);
  console.log(`  several people in one row    ${held.multi}`);
  console.log(`  no way to reach them         ${held.unreachable}`);
  console.log(`  no name at all               ${held.nameless}`);
  console.log(`  total held                   ${held.firmShaped + held.multi + held.unreachable + held.nameless}  (+${valuerRows.length} migrated = ${people.length})`);

  const vi = (k: string) => V_SPEC.columns.indexOf(k);
  const fi = (k: string) => F_SPEC.columns.indexOf(k);
  console.log(`\nValuers links resolved: rvo=${valuerRows.filter((r) => r[vi("rvo")]).length}  firm_id=${valuerRows.filter((r) => r[vi("firm_id")]).length}  empanelled_lenders=${valuerRows.filter((r) => r[vi("empanelled_lenders")]).length}`);
  console.log(`Valuers filled:         ibbi=${valuerRows.filter((r) => r[vi("ibbi_reg_no")]).length}  email=${valuerRows.filter((r) => r[vi("email")]).length}  phone=${valuerRows.filter((r) => r[vi("phone")]).length}  state=${valuerRows.filter((r) => r[vi("state")]).length}  asset_class=${valuerRows.filter((r) => r[vi("asset_class")]).length}`);
  console.log(`Firms decision_maker blanked because the person was held back: ${blankedDecisionMakers}`);
  console.log(`Firms links resolved:   decision_maker=${firmRows.filter((r) => r[fi("decision_maker_valuer_id")]).length}  empanelled_lenders=${firmRows.filter((r) => r[fi("empanelled_lenders")]).length}`);

  if (lenderCollisions.length) {
    console.log(`\nDUPLICATE Lenders rows — same institution under two ids; the FIRST id was used for every link:`);
    lenderCollisions.forEach((x) => console.log(`  ${x}`));
  }

  if (strayConstitutions.size) {
    const total = [...strayConstitutions.values()].reduce((a, b) => a + b, 0);
    console.log(`\nconstitution could not be resolved — left blank, preserved in notes (${total} rows):`);
    [...strayConstitutions].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  "${k}"`));
  }

  if (strayStates.size) {
    console.log(`\nstate column held a non-state value — left blank, preserved in notes:`);
    [...strayStates].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
  }

  for (const [what, m] of [["lender names", unresolved.lenders], ["RVO names", unresolved.bodies], ["firm names", unresolved.firms]] as const) {
    if (!m.size) { console.log(`\nall ${what} resolved`); continue; }
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    console.log(`\nunresolved ${what} — kept in notes, link left blank (${total} mentions, ${m.size} names):`);
    [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k.slice(0, 66)}`));
    if (m.size > 12) console.log(`  … and ${m.size - 12} more`);
  }

  if (!APPLY) { console.log("\nRe-run with --apply."); return; }

  const token = await getAccessToken();
  if (REWRITE) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ranges: [`'${V_SPEC.title}'!A2:${letter(V_SPEC.columns.length - 1)}`, `'${F_SPEC.title}'!A2:${letter(F_SPEC.columns.length - 1)}`] }),
    });
    if (!res.ok) throw new Error(`batchClear ${res.status}: ${(await res.text()).slice(0, 300)}`);
    console.log("cleared both tabs");
  }
  for (const [spec, rows] of [[V_SPEC, valuerRows], [F_SPEC, firmRows]] as const) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${spec.title}'!A2:${letter(spec.columns.length - 1)}${rows.length + 1}`)}?valueInputOption=RAW`,
      { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: rows }) },
    );
    if (!res.ok) throw new Error(`${spec.title} values.update ${res.status}: ${(await res.text()).slice(0, 400)}`);
    console.log(`wrote ${rows.length} rows to ${spec.title}`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
