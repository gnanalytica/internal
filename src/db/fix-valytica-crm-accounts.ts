import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { crmAccounts, crmActivities, crmContacts, users, workspaces } from "./schema";

/**
 * Two corrections after the lender/firm load:
 *   1. 53 lender institutions appear only in the contacts sheet, so they had no
 *      account and their empanelment mechanics had nowhere to attach.
 *   2. A few firms were created twice, once from each source sheet.
 * Re-runnable. Neon HTTP: sequential.
 */
const DATA = process.argv[2];
if (!DATA) throw new Error("usage: tsx fix-valytica-crm-accounts.ts <rest.json>");

async function main() {
  const { lenderNotes } = JSON.parse(readFileSync(DATA, "utf8")) as {
    lenderNotes: { account: string; body: string }[];
  };
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  const [owner] = await db.select().from(users).where(eq(users.email, "shravani@gnanalytica.com"));

  // ---- 1. Merge exact-duplicate accounts, keeping the richer row ----
  const dupes: { name: string }[] = (
    await db.execute(
      sql`select lower(name) as name from crm_accounts where workspace_id = ${ws.id}
          group by lower(name) having count(*) > 1`,
    )
  ).rows as never;
  let merged = 0;
  for (const d of dupes) {
    const rows = await db
      .select()
      .from(crmAccounts)
      .where(sql`${crmAccounts.workspaceId} = ${ws.id} and lower(${crmAccounts.name}) = ${d.name}`);
    // Keep whichever already carries research; otherwise the first.
    const counts = await Promise.all(
      rows.map(async (r) => {
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(crmActivities)
          .where(eq(crmActivities.accountId, r.id));
        return { row: r, n };
      }),
    );
    counts.sort((a, b) => b.n - a.n);
    const keep = counts[0].row;
    for (const { row } of counts.slice(1)) {
      await db.update(crmContacts).set({ accountId: keep.id }).where(eq(crmContacts.accountId, row.id));
      await db.update(crmActivities).set({ accountId: keep.id }).where(eq(crmActivities.accountId, row.id));
      await db.delete(crmAccounts).where(eq(crmAccounts.id, row.id));
      merged++;
    }
  }
  console.log(`merged     ${merged} duplicate accounts folded into their twin`);

  // ---- 2. Lender institutions that never got an account ----
  const have = new Set(
    (await db.select({ name: crmAccounts.name }).from(crmAccounts).where(eq(crmAccounts.workspaceId, ws.id)))
      .map((a) => a.name.toLowerCase()),
  );
  const missing = lenderNotes.filter((l) => !have.has(l.account.toLowerCase()));
  if (missing.length) {
    const made = await db
      .insert(crmAccounts)
      .values(
        missing.map((l) => ({
          workspaceId: ws.id,
          name: l.account,
          industry: "Lender",
          type: "partner",
          channel: "lender",
          entity: "India",
          ownerId: owner?.id ?? null,
        })),
      )
      .returning({ id: crmAccounts.id, name: crmAccounts.name });
    const byName = new Map(made.map((a) => [a.name.toLowerCase(), a.id]));
    const notes = missing
      .filter((l) => byName.has(l.account.toLowerCase()))
      .map((l) => ({
        workspaceId: ws.id,
        accountId: byName.get(l.account.toLowerCase())!,
        type: "note",
        body: l.body,
        actorId: owner?.id ?? null,
      }));
    for (let i = 0; i < notes.length; i += 50)
      await db.insert(crmActivities).values(notes.slice(i, i + 50));
    console.log(`lenders    ${made.length} institutions created, ${notes.length} with mechanics`);
  }

  const summary: { type: string; channel: string; n: number }[] = (
    await db.execute(
      sql`select type, channel, count(*)::int as n from crm_accounts
          where workspace_id = ${ws.id} group by 1,2 order by 3 desc`,
    )
  ).rows as never;
  console.log("\naccounts:");
  for (const s of summary) console.log(`  ${s.type.padEnd(9)} ${s.channel.padEnd(12)} ${s.n}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
