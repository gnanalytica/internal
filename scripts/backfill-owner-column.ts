import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "../src/db";
import { crmAccounts, crmContacts, sheetCellWrites, users } from "../src/db/schema";
import { SHEET_SOURCE } from "../src/lib/sheet-crm/projection";
import { a1, columnLetter } from "../src/lib/sheet-crm/mapping";
import { discoverLayouts } from "../src/lib/sheet-crm/sync";
import { readRange, writeCells } from "../src/lib/sheet-crm/sheets-api";

/**
 * Backfill the masters' `owner` column from the owners already set in Internal.
 *
 * Going forward `mirrorInternalColumns` writes this cell on every assignment;
 * this is the one-off for the assignments made before the column existed.
 *
 * It does NOT go through `writeSheetCells`, which locates each row by its id
 * at write time — correct for one edit, but one read per row here, and the
 * Sheets read quota is already carrying a 15-minute cron. Instead the key
 * column is read ONCE into a person_id → row map, and the write is a single
 * batch. The row is still located by its id, never by a remembered number.
 *
 * Only blank cells are filled: a cell someone has typed in is left alone and
 * reported. `pnpm sheet:backfill-owner` prints the plan; `--apply` runs it.
 */
const APPLY = process.argv.includes("--apply");
const CHUNK = 200;

type Target = {
  tab: "people" | "companies";
  keyColumn: string;
  /** rowKey (person_id / company_id) → owner name, from Internal. */
  owners: Map<string, { name: string; workspaceId: string }>;
};

async function loadOwners(): Promise<Target[]> {
  const people = await db
    .select({ key: crmContacts.externalId, owner: users.name, workspaceId: crmContacts.workspaceId })
    .from(crmContacts)
    .innerJoin(users, eq(users.id, crmContacts.ownerId))
    .where(and(eq(crmContacts.externalSource, SHEET_SOURCE), isNotNull(crmContacts.externalId)));
  const companies = await db
    .select({ key: crmAccounts.externalId, owner: users.name, workspaceId: crmAccounts.workspaceId })
    .from(crmAccounts)
    .innerJoin(users, eq(users.id, crmAccounts.ownerId))
    .where(and(eq(crmAccounts.externalSource, SHEET_SOURCE), isNotNull(crmAccounts.externalId)));
  const toMap = (rows: { key: string | null; owner: string; workspaceId: string }[]) =>
    new Map(rows.filter((r) => r.key?.trim()).map((r) => [r.key!.trim(), { name: r.owner, workspaceId: r.workspaceId }]));
  return [
    { tab: "people", keyColumn: "person_id", owners: toMap(people) },
    { tab: "companies", keyColumn: "company_id", owners: toMap(companies) },
  ];
}

const colOf = (title: string, i: number) => `'${title.replace(/'/g, "''")}'!${columnLetter(i)}:${columnLetter(i)}`;
const cell = (v: unknown) => String(v ?? "").trim();

async function main() {
  const id = process.env.VALYTICA_CRM_SHEET_ID;
  if (!id) throw new Error("VALYTICA_CRM_SHEET_ID is not set.");
  const { layouts } = await discoverLayouts(id);

  for (const target of await loadOwners()) {
    const l = layouts.get(target.tab);
    if (!l) {
      console.log(`✗ ${target.tab}: tab not found`);
      continue;
    }
    if (!target.owners.size) {
      console.log(`· ${target.tab} ("${l.title}"): nothing assigned in Internal — nothing to backfill`);
      continue;
    }
    const ownerCol = l.headers.findIndex((h) => String(h ?? "").trim().toLowerCase() === "owner");
    if (ownerCol < 0) {
      console.log(`✗ ${target.tab} ("${l.title}"): no "owner" column — run \`pnpm sheet:add-owner --apply\` first`);
      continue;
    }
    if (l.formulaCols.has(ownerCol)) {
      console.log(`✗ ${target.tab} ("${l.title}"): ${columnLetter(ownerCol)} carries a formula — refusing to write`);
      continue;
    }
    const keyCol = l.headers.indexOf(target.keyColumn);
    if (keyCol < 0) {
      console.log(`✗ ${target.tab} ("${l.title}"): no "${target.keyColumn}" column`);
      continue;
    }

    // Two reads for the whole tab, not two per row.
    const keys = await readRange(id, colOf(l.title, keyCol));
    const current = await readRange(id, colOf(l.title, ownerCol));
    const rowOf = new Map<string, number>();
    for (let r = l.headerRow0 + 1; r < keys.length; r++) {
      const k = cell(keys[r]?.[0]);
      if (k && !rowOf.has(k)) rowOf.set(k, r);
    }

    const writes: { range: string; value: string }[] = [];
    const audit: (typeof sheetCellWrites.$inferInsert)[] = [];
    const missing: string[] = [];
    const occupied: string[] = [];
    let already = 0;
    for (const [key, { name, workspaceId }] of target.owners) {
      const row = rowOf.get(key);
      if (row === undefined) {
        missing.push(key);
        continue;
      }
      const have = cell(current[row]?.[0]);
      if (have === name) {
        already++;
        continue;
      }
      if (have) {
        occupied.push(`${key} holds "${have}", Internal says "${name}"`);
        continue;
      }
      writes.push({ range: a1(l.title, row, ownerCol), value: name });
      audit.push({ workspaceId, tab: target.tab, rowKey: key, column: "owner", oldValue: null, newValue: name, status: "ok", detail: "owner column backfill" });
    }

    console.log(
      `${APPLY ? "→" : "would"} ${target.tab} ("${l.title}"): ${target.owners.size} assigned in Internal · ` +
        `${writes.length} to write into ${columnLetter(ownerCol)} · ${already} already correct · ${occupied.length} occupied · ${missing.length} not in the sheet`,
    );
    for (const o of occupied.slice(0, 10)) console.log(`  · left alone: ${o}`);
    if (occupied.length > 10) console.log(`  · …and ${occupied.length - 10} more`);
    if (missing.length) console.log(`  · no row for: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ` …and ${missing.length - 10} more` : ""}`);
    if (!APPLY || !writes.length) continue;

    for (let i = 0; i < writes.length; i += CHUNK) await writeCells(id, writes.slice(i, i + CHUNK), "RAW");
    for (let i = 0; i < audit.length; i += 100) await db.insert(sheetCellWrites).values(audit.slice(i, i + 100));

    const after = await readRange(id, colOf(l.title, ownerCol));
    let ok = 0;
    for (const [key, { name }] of target.owners) {
      const row = rowOf.get(key);
      if (row !== undefined && cell(after[row]?.[0]) === name) ok++;
    }
    console.log(`  ✓ ${ok}/${target.owners.size - missing.length} rows in the sheet now name their owner`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
