/**
 * Migrate the lender institutions into the Lenders tab.
 *
 * Source is the `Organisations` tab, not `Lender Landscape`: Organisations is
 * already the normalised, kind-classified version of that list, so reading the
 * raw one would redo work and reintroduce the five multi-institution rows it
 * flagged.
 *
 * Nothing is invented. Every target column is either copied, derived from a
 * value already on the row, or left blank — and blank here means nobody has
 * looked, which is the honest state for panel_size_est, relationship_stage and
 * every touch column.
 *
 * `ownership` is derived from the source's own `org_type` text ("Public Sector
 * Bank", "District Central Co-operative Bank"), never from what the institution
 * is called. A name-based guess about who owns a bank is exactly the kind of
 * confident wrong value that reaches a decision unchallenged.
 *
 * Bank ids are re-prefixed B#### -> L####. That does not break the
 * never-renumber rule: `B` means a body (an RVO or association) in this model,
 * the bank ids were minted hours ago in a tab this one replaces, and nothing in
 * the workbook references them — asserted below before the write, not assumed.
 *
 * `pnpm sheet:migrate-lenders` to see the plan, `--apply` to write it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { readRange } from "../src/lib/sheet-crm/sheets-api";
import { GTM_TABS, VOCAB } from "../src/lib/sheet-crm/gtm-model";

const APPLY = process.argv.includes("--apply");
const c = (v: unknown) => (v ?? "").toString().trim();

const SPEC = GTM_TABS.find((t) => t.title === "Lenders")!;

/** The source's coarse kind -> our lender_type. */
const KIND: Record<string, string> = {
  bank: "Bank", hfc: "HFC", nbfc: "NBFC", arc: "ARC",
  cooperative_bank: "Co-operative bank", govt: "Government", other: "Other",
};

/** The institution's own words for what it is -> who owns it. */
function ownership(orgType: string): string {
  const s = orgType.toLowerCase();
  if (/public sector/.test(s)) return "PSU";
  if (/co-?operative/.test(s)) return "Co-operative";
  if (/private/.test(s)) return "Private";
  if (/state financial|government|regulator|development fi/.test(s)) return "Government";
  return "";
}

/** An insurer is a lender_type in its own right; the source filed it under org_type. */
function lenderType(kind: string, orgType: string): string {
  if (/insurance/i.test(orgType)) return "Insurance";
  return KIND[kind] ?? "Other";
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const target = ((await readRange(spreadsheetId, `'Lenders'!A1:BZ1`))[0] ?? []).map(c).filter(Boolean);
  if (target.join("|") !== SPEC.columns.join("|")) {
    throw new Error(`Lenders header does not match the schema — run pnpm sheet:sync-gtm-columns first.\n  sheet:  ${target.join(", ")}\n  schema: ${SPEC.columns.join(", ")}`);
  }
  const existing = (await readRange(spreadsheetId, `'Lenders'!A2:BZ50`)).filter((r) => r.some((v) => c(v) !== ""));
  if (existing.length) throw new Error(`Lenders already holds ${existing.length}+ row(s). Refusing to write over them.`);

  const rows = await readRange(spreadsheetId, "'Organisations'!A1:BZ600");
  const h = (rows[0] ?? []).map(c);
  const at = (r: unknown[], col: string) => { const i = h.indexOf(col); return i < 0 ? "" : c(r[i]); };
  const body = rows.slice(1).filter((r) => r.some((v) => c(v) !== ""));
  const src = body.filter((r) => KIND[at(r, "kind")] !== undefined);

  // A renumber is only safe if nothing points at the old ids. Check, don't assume.
  const oldIds = new Set(src.map((r) => at(r, "organisation_id")).filter(Boolean));
  const referrers: string[] = [];
  for (const [tab, range] of [["Organisations", "'Organisations'!A1:BZ600"], ["People", "'People'!A1:BZ5700"]] as const) {
    const all = await readRange(spreadsheetId, range);
    const hit = all.slice(1).some((r) => r.some((v) => {
      const s = c(v);
      return s.includes(";") ? s.split(/[;,]/).some((p) => oldIds.has(p.trim())) : false;
    }));
    if (hit) referrers.push(tab);
  }
  if (referrers.length) throw new Error(`bank ids are referenced as a list value in: ${referrers.join(", ")}. Re-prefixing would orphan them.`);

  const seen = new Set<string>();
  const out = src.map((r, i) => {
    const old = at(r, "organisation_id");
    const id = /^B\d+$/.test(old) ? `L${old.slice(1).padStart(4, "0")}` : `L${String(i + 1).padStart(4, "0")}`;
    if (seen.has(id)) throw new Error(`duplicate lender_id ${id} from source ${old}`);
    seen.add(id);
    const excluded = /^y/i.test(at(r, "excluded"));
    const remarks = [at(r, "remarks"), excluded ? at(r, "exclusion_reason") : ""].filter(Boolean).join(" | ");
    const row: Record<string, string> = {
      lender_id: id,
      lender_name: at(r, "name"),
      lender_type: lenderType(at(r, "kind"), at(r, "org_type")),
      ownership: ownership(at(r, "org_type")),
      state: at(r, "state"),
      priority: at(r, "relevance"),
      empanelment_route: at(r, "empanelment_route"),
      empanelment_window: at(r, "empanelment_open_window"),
      empanelment_page_url: at(r, "empanelment_page_url"),
      valuation_volume_signal: at(r, "volume_signal"),
      our_angle: at(r, "sales_angle"),
      do_not_contact: excluded ? "Yes" : "",
      source: at(r, "source_url") || at(r, "sources"),
      notes: remarks,
    };
    return SPEC.columns.map((col) => row[col] ?? "");
  });

  // Every value landing in a validated column must be in that column's vocabulary,
  // or the sheet shows a warning triangle on data we just wrote ourselves.
  const bad: string[] = [];
  for (const [header, key] of Object.entries(SPEC.validate ?? {})) {
    const col = SPEC.columns.indexOf(header);
    const allowed = new Set<string>(VOCAB[key] as readonly string[]);
    for (const row of out) {
      const v = row[col];
      if (v && !allowed.has(v)) bad.push(`${header}="${v}" (${row[0]})`);
    }
  }
  if (bad.length) throw new Error(`values outside their dropdown vocabulary:\n  ${[...new Set(bad)].join("\n  ")}`);

  const tally = (col: string) => {
    const i = SPEC.columns.indexOf(col);
    const m = new Map<string, number>();
    out.forEach((r) => { if (r[i]) m.set(r[i], (m.get(r[i]) ?? 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  ");
  };

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${out.length} lender rows\n`);
  console.log(`lender_type   ${tally("lender_type")}`);
  console.log(`ownership     ${tally("ownership")}   (blank on ${out.filter((r) => !r[SPEC.columns.indexOf("ownership")]).length})`);
  console.log(`priority      ${tally("priority")}`);
  console.log(`do_not_contact ${tally("do_not_contact") || "none"}`);
  console.log(`\nfilled per column:`);
  SPEC.columns.forEach((col, i) => {
    const n = out.filter((r) => r[i]).length;
    console.log(`  ${col.padEnd(26)} ${String(n).padStart(3)}/${out.length}${n === 0 ? "   (blank = nobody has looked)" : ""}`);
  });
  console.log(`\nid range: ${out[0][0]} … ${out[out.length - 1][0]}`);

  if (!APPLY) { console.log("\nRe-run with --apply."); return; }

  const letter = (n: number) => { let s = "", i = n; while (i >= 0) { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } return s; };
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'Lenders'!A2:${letter(SPEC.columns.length - 1)}${out.length + 1}`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: out }),
    },
  );
  if (!res.ok) throw new Error(`values.update ${res.status}: ${(await res.text()).slice(0, 400)}`);
  console.log(`\nwrote ${out.length} rows`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
