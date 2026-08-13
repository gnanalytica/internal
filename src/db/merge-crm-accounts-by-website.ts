import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { crmAccounts, crmActivities, crmContacts, deals, workspaces } from "./schema";

/**
 * Merge accounts that are the same firm under two spellings. Name matching is
 * unsafe here — two single-valuer proprietorships can share a name — so the
 * key is the normalised website, which only the same organisation publishes.
 *
 * The surviving row keeps the shortest name: the lead sheet carries compound
 * names ("A / B Pvt Ltd") where the company sheet carries the clean one.
 * Re-runnable. Neon HTTP: sequential.
 */

/**
 * Registry and association domains. A solo valuer often lists their RVO's site
 * as their own, so a shared domain here proves membership, not identity —
 * merging on it would fold unrelated practices together.
 */
const SHARED_DOMAINS = [
  "institutionofvaluers.net",
  "iovrvf.org",
  "ibbi.gov.in",
  "icairvo.in",
  "rvoicmai.in",
  "icsirvo.in",
  "cvsrtarva.org",
  "djfrvo.org",
  "pvaivpo.org",
];

const normalise = (url: string) =>
  url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .split(/[?#]/)[0];

async function main() {
  const dry = process.argv.includes("--dry");
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  const rows = await db.select().from(crmAccounts).where(eq(crmAccounts.workspaceId, ws.id));

  const groups = new Map<string, typeof rows>();
  for (const a of rows) {
    if (!a.website) continue;
    const key = normalise(a.website);
    if (!key || key.length < 4) continue;
    if (SHARED_DOMAINS.some((d) => key === d || key.startsWith(`${d}/`) || key.endsWith(`.${d}`)))
      continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(a);
  }

  let merged = 0;
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    // Keep the shortest name — compound "A / B" names come from the lead sheet.
    const sorted = [...group].sort((a, b) => a.name.length - b.name.length);
    const keep = sorted[0];
    const drop = sorted.slice(1);
    console.log(`  ${key}`);
    console.log(`    keep  ${keep.name}`);
    for (const d of drop) console.log(`    fold  ${d.name}`);
    if (dry) continue;
    for (const d of drop) {
      await db.update(crmContacts).set({ accountId: keep.id }).where(eq(crmContacts.accountId, d.id));
      await db.update(crmActivities).set({ accountId: keep.id }).where(eq(crmActivities.accountId, d.id));
      await db.update(deals).set({ accountId: keep.id }).where(eq(deals.accountId, d.id));
      await db.delete(crmAccounts).where(eq(crmAccounts.id, d.id));
      merged++;
    }
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(crmAccounts)
    .where(eq(crmAccounts.workspaceId, ws.id));
  console.log(`\n${dry ? "would merge" : "merged"} ${merged} accounts · ${n} remain`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
