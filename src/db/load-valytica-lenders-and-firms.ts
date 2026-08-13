import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { eq, isNotNull, like, sql } from "drizzle-orm";
import { db } from "./index";
import { crmAccounts, crmActivities, users, workspaces } from "./schema";

/**
 * The last two blocks of the lead database:
 *   lenders — how each institution actually empanels a valuer (window, method,
 *             application page, and which desks to call), attached to its account.
 *   firms   — every valuation firm, not just those linked to a top-200 lead,
 *             with the researched sales angle and decision makers as a note.
 * Re-runnable. Neon HTTP: sequential.
 */
const DATA = process.argv[2];
if (!DATA) throw new Error("usage: tsx load-valytica-lenders-and-firms.ts <rest.json>");

const FIRM_INDUSTRY = "Property valuation";
const LENDER_MARK = "Empanelment window —";
const FIRM_MARK = "Sales angle —";

async function main() {
  const { lenderNotes, firms } = JSON.parse(readFileSync(DATA, "utf8")) as {
    lenderNotes: { account: string; body: string }[];
    firms: {
      name: string; website: string | null; city: string; state: string;
      south: boolean; note: string; hasDecisionMaker: boolean;
    }[];
  };

  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  const [owner] = await db.select().from(users).where(eq(users.email, "shravani@gnanalytica.com"));

  const accounts = await db.select().from(crmAccounts).where(eq(crmAccounts.workspaceId, ws.id));
  const byName = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));

  // Clear prior runs of these two note families.
  const prior = await db
    .select({ id: crmActivities.id, body: crmActivities.body })
    .from(crmActivities)
    .where(isNotNull(crmActivities.accountId));
  for (const p of prior)
    if (p.body?.startsWith(LENDER_MARK) || p.body?.startsWith(FIRM_MARK))
      await db.delete(crmActivities).where(eq(crmActivities.id, p.id));

  // 1. Lender empanelment mechanics onto the institutions already loaded.
  const lenderRows = lenderNotes
    .filter((l) => byName.has(l.account.toLowerCase()))
    .map((l) => ({
      workspaceId: ws.id,
      accountId: byName.get(l.account.toLowerCase())!.id,
      type: "note",
      body: l.body,
      actorId: owner?.id ?? null,
    }));
  for (let i = 0; i < lenderRows.length; i += 50)
    await db.insert(crmActivities).values(lenderRows.slice(i, i + 50));
  const missedLenders = lenderNotes.length - lenderRows.length;
  console.log(`lenders    ${lenderRows.length} institutions now carry their empanelment mechanics`);
  if (missedLenders) console.log(`           ${missedLenders} had no matching account (not in Lender Landscape)`);

  // 2. Firms not already present.
  const fresh = firms.filter((f) => f.name && !byName.has(f.name.toLowerCase()));
  const made = fresh.length
    ? await db
        .insert(crmAccounts)
        .values(
          fresh.map((f) => ({
            workspaceId: ws.id,
            name: f.name,
            website: f.website,
            industry: FIRM_INDUSTRY,
            type: "prospect",
            channel: "direct",
            entity: "India",
            ownerId: owner?.id ?? null,
          })),
        )
        .returning({ id: crmAccounts.id, name: crmAccounts.name })
    : [];
  const freshId = new Map(made.map((a) => [a.name.toLowerCase(), a.id]));
  console.log(`firms      ${made.length} added (${firms.length - fresh.length} already present)`);

  // 3. Firm research as account notes — on new and existing firms alike.
  const firmRows = firms
    .filter((f) => f.note)
    .map((f) => ({
      id: freshId.get(f.name.toLowerCase()) ?? byName.get(f.name.toLowerCase())?.id,
      body: f.note,
    }))
    .filter((x): x is { id: string; body: string } => Boolean(x.id))
    .map((x) => ({
      workspaceId: ws.id,
      accountId: x.id,
      type: "note",
      body: x.body,
      actorId: owner?.id ?? null,
    }));
  for (let i = 0; i < firmRows.length; i += 50)
    await db.insert(crmActivities).values(firmRows.slice(i, i + 50));
  console.log(`notes      ${firmRows.length} firm research notes attached`);

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(crmAccounts)
    .where(eq(crmAccounts.workspaceId, ws.id));
  console.log(`\ntotal accounts: ${n}`);
  void like;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
