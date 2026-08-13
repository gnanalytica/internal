import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { crmAccounts, crmActivities, crmContacts, deals, users } from "./schema";

/**
 * INN Tech / Intech was approached before and did not work out. Remove its
 * people so nobody calls them again, and keep the account as a churned
 * tombstone carrying the reason — a deleted account would simply be recreated
 * by the next lead load, and with it the two top-ranked contacts.
 * Re-runnable. Neon HTTP: sequential.
 */
const MATCH = "%igvpl%";

async function main() {
  const accounts = await db
    .select()
    .from(crmAccounts)
    .where(sql`${crmAccounts.website} ilike ${MATCH} or ${crmAccounts.name} ilike '%inn tech%'`);
  if (accounts.length === 0) {
    console.log("no Intech account found — nothing to do");
    return;
  }
  const ids = accounts.map((a) => a.id);
  const [owner] = await db.select().from(users).where(eq(users.email, "sandeep@gnanalytica.com"));

  const contacts = await db
    .select({ id: crmContacts.id, name: crmContacts.name, score: crmContacts.leadScore })
    .from(crmContacts)
    .where(inArray(crmContacts.accountId, ids));

  // Deals first — a contact cannot be removed from under an open opportunity
  // without the pipeline quietly losing it.
  const openDeals = await db.select({ id: deals.id }).from(deals).where(inArray(deals.accountId, ids));
  if (openDeals.length) console.log(`⚠ ${openDeals.length} deals reference this account — left in place, review them`);

  if (contacts.length) {
    await db.delete(crmActivities).where(inArray(crmActivities.contactId, contacts.map((c) => c.id)));
    await db.delete(crmContacts).where(inArray(crmContacts.id, contacts.map((c) => c.id)));
  }
  for (const c of contacts) console.log(`  removed contact  [${c.score ?? "-"}] ${c.name}`);

  await db
    .update(crmAccounts)
    .set({ type: "churned", channel: "direct" })
    .where(inArray(crmAccounts.id, ids));

  // Replace any prior tombstone note so re-running does not stack them.
  const prior = await db
    .select({ id: crmActivities.id, body: crmActivities.body })
    .from(crmActivities)
    .where(inArray(crmActivities.accountId, ids));
  for (const p of prior)
    if (p.body?.startsWith("DO NOT CONTACT")) await db.delete(crmActivities).where(eq(crmActivities.id, p.id));

  await db.insert(crmActivities).values(
    accounts.map((a) => ({
      workspaceId: a.workspaceId,
      accountId: a.id,
      type: "note",
      body:
        "DO NOT CONTACT — approached previously and it did not work out. " +
        "Account kept as a tombstone so a future lead-database load matches it " +
        "instead of recreating the firm and its contacts.",
      actorId: owner?.id ?? null,
    })),
  );

  for (const a of accounts) console.log(`  account marked churned: ${a.name}`);
  console.log(`\n${contacts.length} contacts removed · ${accounts.length} account(s) tombstoned`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
