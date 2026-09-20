import { config } from "dotenv";
config({ path: ".env.local" });
import { and, eq, isNull } from "drizzle-orm";

import { db } from "./index";
import { crmAccounts, crmActivities, crmContacts, deals, interactions, sheetRows, workspaces } from "./schema";
import { SHEET_SOURCE } from "../lib/sheet-crm/projection";
import { normalizedNameKey, splitMulti, toE164India } from "../lib/sheet-crm/parse";

/**
 * One-off: attach sheet ids to the contacts and accounts that the retired
 * JSON loaders created by name. Run AFTER the first `pullSheet` has filled
 * `sheet_rows` (the sync creates its own rows keyed by id; this links the
 * pre-existing, unkeyed ones so their activities and deals carry over).
 *
 * Match order for a person: IBBI number → primary email → phone → name+state.
 * For a firm: IBBI entity number → website host → normalised name.
 * Ambiguous or unmatched rows are left alone and listed, never guessed.
 *
 * Usage: pnpm exec tsx --env-file=.env.local src/db/reconcile-sheet-contacts.ts [--apply]
 */
const APPLY = process.argv.includes("--apply");

const host = (u: string | null) => (u ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

async function main() {
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  if (!ws) throw new Error("No workspace.");

  const people = await db
    .select({ key: sheetRows.rowKey, data: sheetRows.data })
    .from(sheetRows)
    .where(and(eq(sheetRows.workspaceId, ws.id), eq(sheetRows.tab, "people"), isNull(sheetRows.deletedAt)));
  if (!people.length) throw new Error("sheet_rows has no People rows — run a sync first.");
  const byIbbi = new Map<string, string>();
  const byEmail = new Map<string, string[]>();
  const byPhone = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const p of people) {
    const d = p.data;
    if (d.ibbi_reg_no?.trim()) byIbbi.set(d.ibbi_reg_no.trim().toUpperCase(), p.key);
    for (const e of splitMulti(d.email)) byEmail.set(e.toLowerCase(), [...(byEmail.get(e.toLowerCase()) ?? []), p.key]);
    const ph = toE164India(d.phone);
    if (ph) byPhone.set(ph, [...(byPhone.get(ph) ?? []), p.key]);
    const nk = `${normalizedNameKey(d.full_name)}|${(d.state ?? "").trim().toLowerCase()}`;
    byName.set(nk, [...(byName.get(nk) ?? []), p.key]);
  }

  // Which sheet ids are already claimed by a synced contact.
  const synced = await db
    .select({ id: crmContacts.id, externalId: crmContacts.externalId })
    .from(crmContacts)
    .where(and(eq(crmContacts.workspaceId, ws.id), eq(crmContacts.externalSource, SHEET_SOURCE)));
  const syncedByPid = new Map(synced.map((s) => [s.externalId!, s.id]));

  const legacy = await db
    .select({ id: crmContacts.id, name: crmContacts.name, email: crmContacts.email, phone: crmContacts.phone, source: crmContacts.source, entity: crmContacts.entity })
    .from(crmContacts)
    .where(and(eq(crmContacts.workspaceId, ws.id), isNull(crmContacts.externalSource)));

  const unique = (keys: string[] | undefined) => (keys && new Set(keys).size === 1 ? keys[0] : null);
  let linked = 0;
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  for (const c of legacy) {
    const ibbiInSource = c.source?.match(/IBBI\/RV\/\d{2}\/\d{4}\/\d{4,5}/)?.[0];
    let pid: string | null = null;
    if (ibbiInSource) pid = byIbbi.get(ibbiInSource.toUpperCase()) ?? null;
    if (!pid && c.email) pid = unique(byEmail.get(c.email.toLowerCase().split(";")[0].trim()));
    if (!pid && c.phone) pid = unique(byPhone.get(toE164India(c.phone) ?? "\u0000"));
    if (!pid) {
      const cands = [...byName.entries()].filter(([k]) => k.startsWith(`${normalizedNameKey(c.name)}|`)).flatMap(([, v]) => v);
      if (cands.length === 1) pid = cands[0];
      else if (cands.length > 1) ambiguous.push(`${c.name} → ${cands.join(", ")}`);
    }
    if (!pid) {
      unmatched.push(c.name);
      continue;
    }
    const syncedId = syncedByPid.get(pid);
    if (syncedId && syncedId !== c.id) {
      // The sync already created the id-keyed row: move the legacy row's
      // history onto it and retire the legacy row.
      if (APPLY) {
        await db.update(crmActivities).set({ contactId: syncedId }).where(eq(crmActivities.contactId, c.id));
        await db.update(deals).set({ contactId: syncedId }).where(eq(deals.contactId, c.id));
        await db.update(interactions).set({ contactId: syncedId }).where(eq(interactions.contactId, c.id));
        await db.delete(crmContacts).where(eq(crmContacts.id, c.id));
      }
      console.log(`merge    ${c.name} → ${pid} (into synced row)`);
    } else {
      if (APPLY) await db.update(crmContacts).set({ externalSource: SHEET_SOURCE, externalId: pid }).where(eq(crmContacts.id, c.id));
      console.log(`link     ${c.name} → ${pid}`);
    }
    linked++;
  }

  // Firms.
  const companies = await db
    .select({ key: sheetRows.rowKey, data: sheetRows.data })
    .from(sheetRows)
    .where(and(eq(sheetRows.workspaceId, ws.id), eq(sheetRows.tab, "companies"), isNull(sheetRows.deletedAt)));
  const cByEntity = new Map(companies.filter((c) => c.data.ibbi_entity_reg_no?.trim()).map((c) => [c.data.ibbi_entity_reg_no.trim().toUpperCase(), c.key]));
  const cByHost = new Map(companies.filter((c) => host(c.data.website)).map((c) => [host(c.data.website), c.key]));
  const cByName = new Map(companies.map((c) => [normalizedNameKey(c.data.company_name), c.key]));
  const legacyAccounts = await db
    .select({ id: crmAccounts.id, name: crmAccounts.name, website: crmAccounts.website })
    .from(crmAccounts)
    .where(and(eq(crmAccounts.workspaceId, ws.id), isNull(crmAccounts.externalSource)));
  let linkedFirms = 0;
  for (const a of legacyAccounts) {
    const cid = cByEntity.get(a.name.toUpperCase()) ?? (host(a.website) ? cByHost.get(host(a.website)) : undefined) ?? cByName.get(normalizedNameKey(a.name));
    if (!cid) {
      unmatched.push(`firm: ${a.name}`);
      continue;
    }
    if (APPLY) await db.update(crmAccounts).set({ externalSource: SHEET_SOURCE, externalId: cid }).where(eq(crmAccounts.id, a.id));
    console.log(`firm     ${a.name} → ${cid}`);
    linkedFirms++;
  }

  console.log(`\n${APPLY ? "applied" : "dry run"}: ${linked}/${legacy.length} contacts, ${linkedFirms}/${legacyAccounts.length} firms linked`);
  if (ambiguous.length) console.log(`ambiguous (${ambiguous.length}):\n  ${ambiguous.join("\n  ")}`);
  if (unmatched.length) console.log(`unmatched (${unmatched.length}):\n  ${unmatched.join("\n  ")}`);
  if (!APPLY) console.log("\nRe-run with --apply to write.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
