/**
 * Repair values sitting in the wrong column — only where the right answer is
 * provable from the cell itself.
 *
 * The audit (`pnpm sheet:audit-values`) finds 92. This fixes the ones that need
 * no guess: a case fold against a closed vocabulary, a URL missing its scheme,
 * and prose in a column that cannot hold prose. Prose is moved to `remarks`,
 * which rule 2 of SHEET-WRITER-RULES.md names as where a finding goes, rather
 * than to the column it probably came from — "probably" is how research ends up
 * one column further from where it belongs. Nothing is deleted: every move
 * appends, and the original grid is snapshotted first.
 *
 * Deliberately NOT touched:
 *   best_first_channel / research_status — free text by design. 19 of the 22
 *     channel values are real guidance ("WhatsApp first, then short founder
 *     call"); flattening them to an enum would lose the sequence for no
 *     consumer's benefit, since both render as plain text.
 *   remarks = "1" on rows 5609-5612, and iov_membership_no holding an
 *     associations string on 5606 — a human has to say what was meant.
 *
 * `pnpm sheet:repair-values`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { clearRanges, readRange, writeCells } from "../src/lib/sheet-crm/sheets-api";

const APPLY = process.argv.includes("--apply");
const c = (v: unknown) => (v ?? "").toString().trim();
const L = (i: number) => {
  let n = i, s = "";
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};

const CONFIDENCE = ["High", "Medium", "Low"];
const IOV_MATCH = ["high", "medium-ambiguous-name", "low-state-mismatch"];
const CHANNEL_WORDS = /whatsapp|e-?mail|call|phone|referral|visit|linkedin|introduction|association/i;

const hasUrl = (v: string) => /https?:\/\//i.test(v);
const looksLikeBareUrl = (v: string) => !hasUrl(v) && !/\s/.test(v) && /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(v);
const isProse = (v: string) => /\s/.test(v) && !hasUrl(v);

type Fix = { row: number; id: string; kind: string; col: string; from: string; to: string };

async function repair(tab: string, idCol: string) {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID!;
  const grid = await readRange(spreadsheetId, `'${tab}'!A1:BZ6200`);
  const headers = (grid[0] ?? []).map(c);
  const ix = (h: string) => headers.indexOf(h);

  const fixes: Fix[] = [];
  const writes: { range: string; value: string }[] = [];
  const clears: string[] = [];
  /** Remarks additions accumulate per row so two moves on one row do not race. */
  const remarksAdds = new Map<number, string[]>();

  const enrichmentAdds = new Map<number, string>();
  /** A list of nothing but URLs belongs in enrichment_sources, not in prose. */
  const isUrlList = (v: string) => v.split(/[;,]\s*/).filter(Boolean).every((t) => /^https?:\/\//i.test(t.trim()));

  const moveToRemarks = (row: number, id: string, col: string, value: string, kind: string) => {
    const urlList = isUrlList(value) && ix("enrichment_sources") >= 0 && !c(grid[row - 1]?.[ix("enrichment_sources")]);
    if (urlList) {
      enrichmentAdds.set(row, value);
      clears.push(`'${tab}'!${L(ix(col))}${row}`);
      fixes.push({ row, id, kind, col, from: value, to: "→ enrichment_sources, cell cleared" });
      return;
    }
    if (ix("remarks") < 0) return;
    if (!remarksAdds.has(row)) remarksAdds.set(row, []);
    remarksAdds.get(row)!.push(`${col}: ${value}`);
    clears.push(`'${tab}'!${L(ix(col))}${row}`);
    fixes.push({ row, id, kind, col, from: value, to: "→ remarks, cell cleared" });
  };
  const setCell = (row: number, id: string, col: string, from: string, to: string, kind: string) => {
    writes.push({ range: `'${tab}'!${L(ix(col))}${row}`, value: to });
    fixes.push({ row, id, kind, col, from, to });
  };

  grid.slice(1).forEach((r, i) => {
    const row = i + 2;
    const id = c(r[ix(idCol)]);
    if (!id) return;
    const get = (h: string) => (ix(h) >= 0 ? c(r[ix(h)]) : "");

    // A — a closed lowercase vocabulary, written with a capital.
    const iovm = get("iov_match_confidence");
    if (iovm && !IOV_MATCH.includes(iovm)) {
      const hit = IOV_MATCH.find((v) => v.toLowerCase() === iovm.toLowerCase());
      if (hit) setCell(row, id, "iov_match_confidence", iovm, hit, "case fold");
    }

    // B — URL columns.
    for (const col of ["website", "linkedin"]) {
      const v = get(col);
      if (!v || hasUrl(v)) continue;
      if (looksLikeBareUrl(v)) setCell(row, id, col, v, `https://${v}`, "URL missing its scheme");
      else if (isProse(v)) moveToRemarks(row, id, col, v, "prose in a URL column");
    }

    // C — a label column holding a paragraph.
    const dqf = get("data_quality_flag");
    if (dqf.length > 130) moveToRemarks(row, id, "data_quality_flag", dqf, "paragraph in a label column");
    const cls = get("company_link_source");
    if (cls.length > 40) moveToRemarks(row, id, "company_link_source", cls, "paragraph in a label column");

    // D — research_confidence, and the enum that landed next to it.
    const rc = get("research_confidence");
    if (rc && !CONFIDENCE.includes(rc)) {
      moveToRemarks(row, id, "research_confidence", rc, "prose in a High/Medium/Low column");
      const sa = get("sales_angle");
      if (CONFIDENCE.includes(sa)) {
        setCell(row, id, "research_confidence", "(empty)", sa, "confidence recovered from sales_angle");
        clears.push(`'${tab}'!${L(ix("sales_angle"))}${row}`);
        fixes.push({ row, id, kind: "confidence recovered from sales_angle", col: "sales_angle", from: sa, to: "cleared" });
      }
    }

    // E — Yes/No.
    const iav = get("iov_approved_valuer");
    if (iav && !["Yes", "No"].includes(iav)) {
      if (/^(Yes|No)\b/i.test(iav)) {
        const head = /^yes/i.test(iav) ? "Yes" : "No";
        moveToRemarks(row, id, "iov_approved_valuer", iav, "Yes/No column carrying its own footnote");
        setCell(row, id, "iov_approved_valuer", iav, head, "Yes/No column carrying its own footnote");
      } else {
        moveToRemarks(row, id, "iov_approved_valuer", iav, "a value from another column");
      }
    }

    // F — a channel column holding no channel at all. The other 19 stay.
    const bfc = get("best_first_channel");
    if (bfc && !CHANNEL_WORDS.test(bfc)) moveToRemarks(row, id, "best_first_channel", bfc, "pitch text in the channel column");
  });

  for (const [row, value] of enrichmentAdds) {
    writes.push({ range: `'${tab}'!${L(ix("enrichment_sources"))}${row}`, value });
  }

  // Fold the accumulated remarks additions into one write per row.
  for (const [row, adds] of remarksAdds) {
    const existing = c(grid[row - 1]?.[ix("remarks")]);
    const next = [existing, ...adds].filter(Boolean).join(" | ");
    writes.push({ range: `'${tab}'!${L(ix("remarks"))}${row}`, value: next });
  }

  console.log(`\n##### ${tab} — ${fixes.length} fix(es) on ${new Set(fixes.map((f) => f.row)).size} row(s)`);
  const byKind = new Map<string, Fix[]>();
  fixes.forEach((f) => { if (!byKind.has(f.kind)) byKind.set(f.kind, []); byKind.get(f.kind)!.push(f); });
  for (const [kind, fs] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${kind} — ${fs.length}`);
    fs.slice(0, 6).forEach((f) => console.log(`    r${String(f.row).padStart(5)} ${f.id.padEnd(8)} ${f.col.padEnd(20)} ${JSON.stringify(f.from.slice(0, 60))} ${f.to.startsWith("→") || f.to === "cleared" ? f.to : `→ ${JSON.stringify(f.to.slice(0, 40))}`}`));
    if (fs.length > 6) console.log(`    … and ${fs.length - 6} more`);
  }
  const written = new Set(writes.map((w) => w.range));
  const collided = clears.filter((r) => written.has(r));
  const safeClears = clears.filter((r) => !written.has(r));
  if (collided.length) console.log(`\n  ${collided.length} cell(s) both written and cleared — keeping the write: ${collided.join(", ")}`);
  console.log(`\n  ${writes.length} cell write(s), ${safeClears.length} clear(s)`);

  if (!APPLY) return { fixes: fixes.length, applied: false };

  mkdirSync("tmp", { recursive: true });
  const snap = `tmp/${tab.toLowerCase()}-before-value-repair-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(snap, JSON.stringify({ headers, rows: grid.slice(1).filter((r) => c(r[ix(idCol)])) }, null, 2));
  console.log(`  snapshot: ${snap}`);

  // Clear first: a cleared cell whose value has already been appended to remarks
  // is recoverable; the reverse order would leave a duplicate if the run died.
  for (let i = 0; i < writes.length; i += 200) await writeCells(spreadsheetId, writes.slice(i, i + 200), "RAW");
  for (let i = 0; i < safeClears.length; i += 200) await clearRanges(spreadsheetId, safeClears.slice(i, i + 200));
  console.log(`  wrote ${writes.length}, cleared ${safeClears.length}`);
  return { fixes: fixes.length, applied: true };
}

async function main() {
  if (!process.env.VALYTICA_CRM_SHEET_ID) throw new Error("VALYTICA_CRM_SHEET_ID is not set");
  await repair("People", "person_id");
  await repair("Companies", "company_id");
  if (!APPLY) console.log("\nDry run. Nothing written. Re-run with --apply.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
