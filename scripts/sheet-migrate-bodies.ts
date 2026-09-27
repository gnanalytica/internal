/**
 * Migrate the RVOs and associations into the `RVOs & Associations` tab.
 *
 * Source is the legacy `RVOs` tab for the body facts and `Organisations` for the
 * ids: the legacy tab kept `approach_notes` and `asset_classes`, which the
 * Organisations build dropped, and those are the two fields that say whether a
 * body is a channel worth having at all.
 *
 * It also CREATES two rows nothing had: the Institution of Valuers and PVAI.
 * 88 of the 128 officers in `Association Officers` belong to those two — IOV
 * alone has 82 — and neither existed as a row, so those officers had no body to
 * hang off and the largest association in the dataset was invisible. They are
 * typed `Association` and carry only what is evidenced: a name, an acronym, and
 * the fact that they are the parent of a row we do have.
 *
 * `parent_body` becomes a body_id or nothing. Most of what the source called a
 * parent was a constitution and a city ("Independent (Section 8 co.), Pune"),
 * which is not a parent — that text moves to notes rather than being lost or
 * left masquerading as a link.
 *
 * `member_count` takes the leading figure where the source states one
 * ("~1760 individual RVs enrolled (2022…)" -> 1760) so the column can be sorted,
 * which is the whole point of it; the full sentence stays in notes, because
 * "Very small RV count (2022)" has no number to take and must not become a zero.
 *
 * `pnpm sheet:migrate-bodies` to see the plan, `--apply` to write it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { readRange } from "../src/lib/sheet-crm/sheets-api";
import { GTM_TABS, VOCAB } from "../src/lib/sheet-crm/gtm-model";

const APPLY = process.argv.includes("--apply");
const c = (v: unknown) => (v ?? "").toString().trim();
const SPEC = GTM_TABS.find((t) => t.title === "RVOs & Associations")!;

const skel = (s: string) =>
  s.toLowerCase().replace(/\b(registered|valuers?|valuation|organisation|organization|foundation|association|of|the|india|indian|rvo)\b/g, "").replace(/[^a-z0-9]/g, "");

/** The two associations the officer list proves exist, and the row each parents. */
const PARENTS: { name: string; acronym: string; childAcronym: string; note: string }[] = [
  {
    name: "Institution of Valuers",
    acronym: "IOV",
    childAcronym: "IOVRVF",
    note: "Parent body of IOV RVF. 82 of the officers on file belong to IOV itself rather than to its RVO arm — the largest association in the dataset and the widest single route to L&B valuers.",
  },
  {
    name: "Practising Valuers Association of India",
    acronym: "PVAI",
    childAcronym: "PVAI-VPO",
    note: "Parent body of PVAI Valuation Professional Organisation. 6 officers on file are PVAI's rather than the RVO's.",
  },
];

/** A stated figure, or nothing. "Very small RV count" must never become a 0. */
function memberCount(text: string): string {
  const m = text.match(/~?\s*([\d,]{2,7})\s*(?:individual\s+)?(?:RVs?|members?|valuers?)/i) ?? text.match(/^~?\s*([\d,]{2,7})\b/);
  if (!m) return "";
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const header = ((await readRange(spreadsheetId, `'${SPEC.title}'!A1:BZ1`))[0] ?? []).map(c).filter(Boolean);
  if (header.join("|") !== SPEC.columns.join("|")) {
    throw new Error(`${SPEC.title} header does not match the schema — run pnpm sheet:sync-gtm-columns first.`);
  }
  const already = (await readRange(spreadsheetId, `'${SPEC.title}'!A2:BZ50`)).filter((r) => r.some((v) => c(v) !== ""));
  if (already.length) throw new Error(`${SPEC.title} already holds ${already.length}+ row(s). Refusing to write over them.`);

  const org = await readRange(spreadsheetId, "'Organisations'!A1:BZ600");
  const oh = (org[0] ?? []).map(c);
  const oAt = (r: unknown[], k: string) => { const i = oh.indexOf(k); return i < 0 ? "" : c(r[i]); };
  const rvoRows = org.slice(1).filter((r) => r.some((v) => c(v) !== "")).filter((r) => oAt(r, "kind") === "rvo");

  const leg = await readRange(spreadsheetId, "'RVOs'!A1:Z40");
  const lh = (leg[0] ?? []).map(c);
  const lAt = (r: unknown[], k: string) => { const i = lh.indexOf(k); return i < 0 ? "" : c(r[i]); };
  const legBy = new Map(leg.slice(1).filter((r) => r.some((v) => c(v) !== "")).map((r) => [skel(lAt(r, "rvo_name")), r]));

  const oldIds = new Set(rvoRows.map((r) => oAt(r, "organisation_id")).filter(Boolean));
  const all = await readRange(spreadsheetId, "'Organisations'!A1:BZ600");
  const referenced = all.slice(1).some((r) => r.some((v) => {
    const s = c(v);
    return s.includes(";") ? s.split(/[;,]/).some((p) => oldIds.has(p.trim())) : false;
  }));
  if (referenced) throw new Error("RVO ids are referenced as a list value in Organisations. Re-prefixing would orphan them.");

  const id = (n: number) => `B${String(n).padStart(4, "0")}`;
  const byAcronym = new Map<string, string>();

  type Row = Record<string, string>;
  const out: Row[] = [];

  rvoRows.forEach((r, i) => {
    const old = oAt(r, "organisation_id");
    const bid = /^R\d+$/.test(old) ? id(Number(old.slice(1))) : id(rvoRows.length + i + 1);
    const name = oAt(r, "name");
    const acronym = oAt(r, "acronym");
    byAcronym.set(acronym, bid);
    const l = legBy.get(skel(name));
    const countText = oAt(r, "num_valuers") || (l ? lAt(l, "lb_valuer_count") : "");
    const parentText = oAt(r, "parent_body");
    out.push({
      body_id: bid,
      body_name: name,
      acronym,
      type: "RVO",
      member_count: memberCount(countText),
      asset_classes: l ? lAt(l, "asset_classes") : "",
      states_covered: oAt(r, "state"),
      website: oAt(r, "website") || (l ? lAt(l, "website") : ""),
      email: oAt(r, "email") || (l ? lAt(l, "email") : ""),
      phone: oAt(r, "phone") || (l ? lAt(l, "phone") : ""),
      cpe_event_cadence: oAt(r, "outreach_channels") || (l ? lAt(l, "outreach_channels") : ""),
      our_angle: l ? lAt(l, "approach_notes") : "",
      source: oAt(r, "source_url") || oAt(r, "sources"),
      notes: [
        oAt(r, "remarks"),
        countText && !memberCount(countText) ? `Size as stated: ${countText}` : countText ? `Size as stated: ${countText}` : "",
        parentText ? `Source recorded parent/constitution as: ${parentText}` : "",
        oAt(r, "address") ? `Address: ${oAt(r, "address")}` : "",
        oAt(r, "key_people") ? `Named on file (to become Contacts rows): ${oAt(r, "key_people")}` : "",
      ].filter(Boolean).join(" | "),
      __parentAcronym: "",
    });
  });

  PARENTS.forEach((p, i) => {
    const bid = id(rvoRows.length + i + 1);
    byAcronym.set(p.acronym, bid);
    out.push({
      body_id: bid, body_name: p.name, acronym: p.acronym, type: "Association",
      member_count: "", asset_classes: "", states_covered: "", website: "", email: "", phone: "",
      cpe_event_cadence: "", our_angle: "", source: "Association Officers tab", notes: p.note,
      __parentAcronym: "",
    });
  });

  // Now that every row has an id, resolve the two real parent links.
  for (const p of PARENTS) {
    const child = out.find((r) => r.acronym === p.childAcronym);
    const parentId = byAcronym.get(p.acronym);
    if (!child) throw new Error(`expected a row with acronym ${p.childAcronym} to parent under ${p.acronym}`);
    if (!parentId) throw new Error(`no id minted for ${p.acronym}`);
    child.parent_body = parentId;
  }

  const rows = out.map((r) => SPEC.columns.map((col) => r[col] ?? ""));

  const bad: string[] = [];
  for (const [h, key] of Object.entries(SPEC.validate ?? {})) {
    const col = SPEC.columns.indexOf(h);
    const allowed = new Set<string>(VOCAB[key] as readonly string[]);
    rows.forEach((r) => { if (r[col] && !allowed.has(r[col])) bad.push(`${h}="${r[col]}" (${r[0]})`); });
  }
  if (bad.length) throw new Error(`values outside their dropdown vocabulary:\n  ${[...new Set(bad)].join("\n  ")}`);

  const ids = rows.map((r) => r[0]);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate body_id");

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${rows.length} bodies (${out.filter((r) => r.type === "RVO").length} RVO, ${out.filter((r) => r.type === "Association").length} Association)\n`);
  const ci = (k: string) => SPEC.columns.indexOf(k);
  rows.forEach((r) => console.log(`  ${r[0]}  ${(r[ci("acronym")] || "-").padEnd(15)} ${r[ci("body_name")].slice(0, 44).padEnd(45)} members=${r[ci("member_count")] || "-"}  parent=${r[ci("parent_body")] || "-"}`));
  console.log(`\nfilled per column:`);
  SPEC.columns.forEach((col, i) => {
    const n = rows.filter((r) => r[i]).length;
    console.log(`  ${col.padEnd(24)} ${String(n).padStart(2)}/${rows.length}${n === 0 ? "   (blank = nobody has looked)" : ""}`);
  });

  if (!APPLY) { console.log("\nRe-run with --apply."); return; }

  const letter = (n: number) => { let s = "", i = n; while (i >= 0) { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } return s; };
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${SPEC.title}'!A2:${letter(SPEC.columns.length - 1)}${rows.length + 1}`)}?valueInputOption=RAW`,
    { method: "PUT", headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: rows }) },
  );
  if (!res.ok) throw new Error(`values.update ${res.status}: ${(await res.text()).slice(0, 400)}`);
  console.log(`\nwrote ${rows.length} rows`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
