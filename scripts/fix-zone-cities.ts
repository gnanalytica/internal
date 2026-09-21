import { config } from "dotenv";
config({ path: ".env.local" });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { a1 } from "../src/lib/sheet-crm/mapping";
import { readTabs, writeCells } from "../src/lib/sheet-crm/sheets-api";
import { discoverLayouts } from "../src/lib/sheet-crm/sync";

/**
 * Repair `city` on rows where it holds a bank's ZONE rather than a place.
 *
 * A PNB panel harvest wrote its zone into `city`, so a valuer in Tanuku is
 * filed under Hyderabad, one in Katihar under Patna, and one Ferozepur address
 * appears under both Ludhiana AND Amritsar. 403 rows have `city` = `pnb_zone`;
 * on 218 of them that city appears nowhere in the person's own address.
 *
 * The repair is driven by the PINCODE in the address, never by parsing the
 * address for a place name. A pincode resolves unambiguously, and it
 * self-corrects in both directions: a row reading "Kol-700026" looks wrong to a
 * substring test but resolves to Kolkata and is left alone. Rows with no
 * pincode anywhere have their `city` CLEARED rather than guessed — the zone is
 * already preserved in `pnb_zone`, so nothing is lost, and an empty city is
 * honest where a wrong one silently misroutes territory assignment.
 *
 * `pnpm sheet:fix-zone-cities` prints the plan; `--apply` writes.
 */
const APPLY = process.argv.includes("--apply");
const CACHE = "tmp/pincode-cache.json";

type Resolved = { district: string; division: string; region: string; state: string } | null;

const cell = (v: unknown) => String(v ?? "").trim();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function loadCache(): Record<string, Resolved> {
  try {
    return existsSync(CACHE) ? (JSON.parse(readFileSync(CACHE, "utf8")) as Record<string, Resolved>) : {};
  } catch {
    return {};
  }
}

/**
 * One pincode can span several post offices. A district they do not agree on
 * is not an answer, so an ambiguous pincode resolves to null and its row is
 * left for a person rather than resolved to whichever office came back first.
 */
async function lookup(pin: string): Promise<Resolved> {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`pincode ${pin} → ${res.status}`);
  const body = (await res.json()) as { Status: string; PostOffice: { District: string; Division: string; Region: string; State: string }[] | null }[];
  const offices = body?.[0]?.PostOffice ?? [];
  if (body?.[0]?.Status !== "Success" || !offices.length) return null;
  const districts = new Set(offices.map((o) => norm(o.District)));
  if (districts.size !== 1) return null;
  const o = offices[0];
  return { district: o.District, division: o.Division, region: o.Region, state: o.State };
}

/**
 * Prefer whichever administrative name the row's OWN address already contains.
 * A pincode's district is correct but not always what a person would write:
 * 533103 is East Godavari district, Rajahmundry division, and the address says
 * Rajamahendravaram. Grounding the choice in the address keeps the sheet
 * reading the way a person wrote it, and falls back to the district.
 */
function pickCity(r: NonNullable<Resolved>, address: string): string {
  const a = norm(address);
  for (const candidate of [r.district, r.division, r.region]) if (candidate && a.includes(norm(candidate))) return candidate;
  return r.district;
}

async function main() {
  const id = process.env.VALYTICA_CRM_SHEET_ID;
  if (!id) throw new Error("VALYTICA_CRM_SHEET_ID is not set.");
  const people = (await discoverLayouts(id)).layouts.get("people");
  if (!people) throw new Error("People tab not found by its header signature.");
  const headers = people.headers.map((h) => String(h ?? "").trim());
  const col = (n: string) => headers.indexOf(n);
  const [cCity, cZone, cAddr, cPin, cPid, cState] = ["city", "pnb_zone", "address", "pincode", "person_id", "state"].map(col);
  if ([cCity, cZone, cAddr, cPid].some((i) => i < 0)) throw new Error("People is missing one of person_id / city / pnb_zone / address.");
  if (people.formulaCols.has(cCity)) throw new Error("People.city carries a formula — refusing to write it.");

  const values = (await readTabs(id, [people.title])).get(people.title) ?? [];
  type Target = { row: number; pid: string; city: string; addr: string; pin: string | null };
  const targets: Target[] = [];
  for (let r = people.headerRow0 + 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const pid = cell(row[cPid]);
    const city = cell(row[cCity]);
    const zone = cell(row[cZone]);
    if (!pid || !city || !zone || city.toLowerCase() !== zone.toLowerCase()) continue;
    const addr = cell(row[cAddr]);
    // The city appearing in the person's own address is the row working as
    // intended — the zone and the town are simply the same place.
    if (addr && norm(addr).includes(norm(city))) continue;
    const pin = (addr.match(/\b(\d{6})\b/)?.[1] ?? cell(row[cPin]).match(/\b(\d{6})\b/)?.[1]) ?? null;
    targets.push({ row: r, pid, city, addr, pin });
  }

  const cache = loadCache();
  const pins = [...new Set(targets.map((t) => t.pin).filter((p): p is string => p !== null))];
  const unknown = pins.filter((p) => !(p in cache));
  console.log(`${targets.length} row(s) where city is the PNB zone and the address does not name it` +
    `\n  ${pins.length} distinct pincode(s), ${unknown.length} to look up, ${pins.length - unknown.length} cached`);

  for (let i = 0; i < unknown.length; i += 4) {
    await Promise.all(unknown.slice(i, i + 4).map(async (p) => {
      try {
        cache[p] = await lookup(p);
      } catch (err) {
        console.log(`  ! ${p}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }));
    if (i % 40 === 0 && i) process.stdout.write(`  …${i}/${unknown.length}\n`);
  }
  mkdirSync("tmp", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 2));

  const writes: { range: string; value: string }[] = [];
  let corrected = 0;
  let alreadyRight = 0;
  let cleared = 0;
  let ambiguous = 0;
  const stateMismatch: string[] = [];
  const samples: string[] = [];

  for (const t of targets) {
    const r = t.pin ? cache[t.pin] : null;
    if (t.pin && r) {
      const next = pickCity(r, t.addr);
      if (norm(next) === norm(t.city)) {
        alreadyRight++;
        continue;
      }
      const st = cell(values[t.row]?.[cState]);
      if (st && norm(st) !== norm(r.state)) stateMismatch.push(`${t.pid}: state "${st}", pincode ${t.pin} says "${r.state}"`);
      writes.push({ range: a1(people.title, t.row, cCity), value: next });
      corrected++;
      if (samples.length < 8) samples.push(`${t.pid}  "${t.city}" → "${next}"  (${t.pin})`);
      continue;
    }
    if (t.pin && !r) ambiguous++;
    // No usable pincode: clear it. `pnb_zone` still holds the zone, so the only
    // thing lost is a city that was never the person's.
    writes.push({ range: a1(people.title, t.row, cCity), value: "" });
    cleared++;
  }

  console.log(
    `\n${APPLY ? "→" : "would"} correct ${corrected}, clear ${cleared}${ambiguous ? ` (${ambiguous} of them a pincode spanning several districts)` : ""}` +
      `, leave ${alreadyRight} already right`,
  );
  for (const s of samples) console.log(`  ${s}`);
  if (stateMismatch.length) {
    console.log(`  ${stateMismatch.length} row(s) whose state disagrees with the pincode (reported, NOT written):`);
    for (const s of stateMismatch.slice(0, 6)) console.log(`    ${s}`);
  }
  if (!APPLY || !writes.length) return;

  for (let i = 0; i < writes.length; i += 200) await writeCells(id, writes.slice(i, i + 200), "RAW");
  const after = (await readTabs(id, [people.title])).get(people.title) ?? [];
  let stillZone = 0;
  for (let r = people.headerRow0 + 1; r < after.length; r++) {
    const row = after[r] ?? [];
    const city = cell(row[cCity]);
    const zone = cell(row[cZone]);
    if (!city || !zone || city.toLowerCase() !== zone.toLowerCase()) continue;
    const addr = cell(row[cAddr]);
    if (!addr || !norm(addr).includes(norm(city))) stillZone++;
  }
  console.log(`   ✓ ${writes.length} cells written; ${stillZone} row(s) still carry a zone as their city`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
