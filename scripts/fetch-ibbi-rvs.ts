/**
 * INCOMPLETE — DO NOT RUN. Committed for the findings in this header, not because
 * it works. It stops at 1,499 of 3,237 rows: `parse` drops any row with fewer
 * than 8 cells, and a CANCELLED registration is exactly that shape, which also
 * makes the loop mistake a full page for the last one. The fix is to capture
 * cancelled rows with a status rather than skip them, and to end the crawl on
 * the HTML row count instead of the parsed count.
 *
 * Fetch the IBBI register of registered valuers for one asset class.
 *
 * This is the authoritative list of who is licensed — IBBI publishes it because
 * the law requires the register be public, which is also why it is a legitimate
 * source rather than a scrape of somebody's private list.
 *
 * Two things about the endpoint, both found by probing rather than guessing:
 *
 *   Pagination ONLY works on the bare link form, `?valassets=X&page=N`. Adding
 *   the empty `reg_no=&name_ip=&location=` params that the site's own filter form
 *   submits makes every page return page 1 — silently, with a 200 and twenty
 *   plausible rows. That is the failure this script guards against below.
 *
 *   `page` is 1-based: page=2 is rows 21-40.
 *
 * The register also lists CANCELLED registrations, and their row collapses the
 * address / email / RVO / date / asset columns into a single "Registration
 * Cancelled w.e.f. …" cell — four cells instead of nine. Those people are no
 * longer licensed and must never be targeted, so they are captured with
 * status "cancelled" rather than skipped. Skipping them is what the first run
 * did, and it also made the loop mistake a full page for the last one.
 *
 * Emails are published obfuscated (`name[at]host[dot]com`) and are restored, because
 * the obfuscation is presentational, not a restriction — the register exists to
 * let people contact a valuer to verify them.
 *
 * `pnpm ibbi:fetch` (defaults to Land and Building), `--asset="Plant and Machinery"`,
 * `--out=path.json`.
 */
import { writeFileSync } from "node:fs";

const asset = (process.argv.find((a) => a.startsWith("--asset="))?.split("=")[1] ?? "Land and Building").replace(/^"|"$/g, "");
const out = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? `tmp/ibbi-${asset.toLowerCase().replace(/\W+/g, "-")}.json`;
const DELAY_MS = 700;
const UA = "Mozilla/5.0 (compatible; gnanalytica-research/1.0)";

type Row = {
  srNo: number; regNo: string; name: string; address: string; email: string;
  rvo: string; registeredOn: string; assetClass: string; remarks: string;
  status: "active" | "cancelled";
};

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const deobfuscate = (s: string) => s.replace(/\[at\]/gi, "@").replace(/\[dot\]/gi, ".").trim();

/** Data rows only — the header uses <th>, so a row with no <td> is not one. */
const dataRows = (html: string) =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]).filter((tr) => /<td/.test(tr));

function parse(html: string): Row[] {
  const rows: Row[] = [];
  for (const tr of dataRows(html)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    const srNo = Number((cells[0] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(srNo)) continue;

    // A cancelled registration collapses five columns into one cell.
    if (cells.length < 8) {
      rows.push({
        srNo, regNo: cells[1] ?? "", name: cells[2] ?? "", address: "", email: "",
        rvo: "", registeredOn: "", assetClass: asset,
        remarks: cells.slice(3).filter(Boolean).join(" "), status: "cancelled",
      });
      continue;
    }
    rows.push({
      srNo, regNo: cells[1], name: cells[2], address: cells[3],
      email: deobfuscate(cells[4]), rvo: cells[5], registeredOn: cells[6],
      assetClass: cells[7], remarks: cells[8] ?? "",
      status: /cancell?ed|surrender|suspend/i.test(cells[8] ?? "") ? "cancelled" : "active",
    });
  }
  return rows;
}

async function page(n: number): Promise<{ rows: Row[]; htmlRows: number }> {
  // Bare form only — see the header.
  const url = `https://ibbi.gov.in/service-provider/rvs?valassets=${encodeURIComponent(asset).replace(/%20/g, "+")}&page=${n}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(45_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      // htmlRows, not rows.length: a page can be full yet parse to fewer, which is
      // exactly how the cancelled-row bug ended the crawl 1,738 rows early.
      return { rows: parse(html), htmlRows: dataRows(html).length };
    } catch (e) {
      if (attempt === 3) throw new Error(`page ${n}: ${e instanceof Error ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  console.log(`asset class: ${asset}`);
  const all: Row[] = [];
  let n = 1;
  for (;;) {
    const { rows, htmlRows } = await page(n);
    if (!htmlRows) break;

    // The silent-reset guard: page N must start at (N-1)*20+1. Without this, a
    // dropped page param yields 162 copies of page 1 and a confident wrong answer.
    const expected = (n - 1) * 20 + 1;
    if (rows[0].srNo !== expected) {
      throw new Error(`page ${n} starts at Sr.No ${rows[0].srNo}, expected ${expected} — pagination is being ignored, refusing to continue`);
    }

    if (rows.length !== htmlRows) throw new Error(`page ${n}: ${htmlRows} row(s) in the html but ${rows.length} parsed — a row shape this script does not handle`);
    all.push(...rows);
    if (n % 25 === 0 || htmlRows < 20) console.log(`  page ${n}: ${all.length} rows so far`);
    if (htmlRows < 20) break;
    n++;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const srNos = all.map((r) => r.srNo);
  const gaps = srNos.filter((x, i) => i > 0 && x !== srNos[i - 1] + 1);
  const dupRegs = all.length - new Set(all.map((r) => r.regNo)).size;
  const wrongAsset = all.filter((r) => r.status === "active" && r.assetClass.toLowerCase() !== asset.toLowerCase()).length;

  console.log(`\nfetched ${all.length} rows over ${n} page(s)`);
  console.log(`Sr.No runs 1..${srNos[srNos.length - 1]}, ${gaps.length} discontinuit(ies)`);
  console.log(`duplicate registration numbers: ${dupRegs}`);
  console.log(`rows whose asset class is not "${asset}": ${wrongAsset}`);
  const cancelled = all.filter((r) => r.status === "cancelled");
  console.log(`cancelled registrations (NOT targetable): ${cancelled.length}`);
  console.log(`active: ${all.length - cancelled.length}`);
  console.log(`active with an email: ${all.filter((r) => r.status === "active" && r.email.includes("@")).length}`);
  if (gaps.length || dupRegs || wrongAsset) throw new Error("integrity check failed — not writing the file");

  writeFileSync(out, JSON.stringify({ asset, fetchedAt: new Date().toISOString(), count: all.length, rows: all }, null, 2));
  console.log(`\nwrote ${out}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
