import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { eq, like, sql } from "drizzle-orm";
import { db } from "./index";
import { crmAccounts, crmActivities, crmContacts, users, workspaces } from "./schema";

/**
 * Add the CRM channel/referral/deck columns, then load the channel partners —
 * RVOs, lenders and valuer associations — as `partner` accounts with their
 * named contacts. Re-runnable. Neon HTTP: sequential, no transactions.
 */
const DATA = process.argv[2];
if (!DATA) throw new Error("usage: tsx load-valytica-partners.ts <partners.json>");

const SOURCE_PREFIX = "Lead DB · ";

async function main() {
  // 1. Columns (idempotent).
  for (const stmt of [
    sql`alter table crm_accounts add column if not exists channel text not null default 'direct'`,
    sql`alter table crm_accounts add column if not exists page_id uuid references pages(id) on delete set null`,
    sql`alter table crm_contacts add column if not exists channel text not null default 'direct'`,
    sql`alter table crm_contacts add column if not exists referred_by_id uuid`,
    sql`alter table crm_contacts add column if not exists page_id uuid references pages(id) on delete set null`,
  ])
    await db.execute(stmt);
  console.log("columns    channel · referred_by_id · page_id");

  const { accounts, contacts } = JSON.parse(readFileSync(DATA, "utf8")) as {
    accounts: { name: string; website: string | null; industry: string; channel: string; note: string }[];
    contacts: {
      name: string; account: string; channel: string; email: string | null;
      phone: string | null; title: string; source: string;
    }[];
  };

  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  const [owner] = await db.select().from(users).where(eq(users.email, "shravani@gnanalytica.com"));

  // 2. Clear a prior partner run (the valuer leads use different markers).
  await db.delete(crmContacts).where(like(crmContacts.source, `${SOURCE_PREFIX}lender%`));
  await db.delete(crmContacts).where(like(crmContacts.source, `${SOURCE_PREFIX}association%`));

  // 3. Partner accounts — created only if absent, so their research notes and
  //    any write-off survive a reload.
  const present = await db
    .select({ id: crmAccounts.id, name: crmAccounts.name })
    .from(crmAccounts)
    .where(eq(crmAccounts.workspaceId, ws.id));
  const accountId = new Map(present.map((a) => [a.name.toLowerCase(), a.id]));
  const fresh = accounts.filter((a) => !accountId.has(a.name.toLowerCase()));
  const madeAccounts = fresh.length
    ? await db
    .insert(crmAccounts)
    .values(
      fresh.map((a) => ({
        workspaceId: ws.id,
        name: a.name,
        website: a.website,
        industry: a.industry,
        type: "partner",
        channel: a.channel,
        entity: "India",
        ownerId: owner?.id ?? null,
      })),
    )
    .returning({ id: crmAccounts.id, name: crmAccounts.name })
    : [];
  for (const a of madeAccounts) accountId.set(a.name.toLowerCase(), a.id);
  console.log(`accounts   ${madeAccounts.length} partners created (${accounts.length - fresh.length} already present)`);

  // 4. Their people.
  const rows = contacts.map((c) => ({
    workspaceId: ws.id,
    accountId: accountId.get(c.account.toLowerCase()) ?? null,
    name: c.name,
    email: c.email,
    phone: c.phone,
    title: c.title,
    lifecycleStage: "lead",
    channel: c.channel,
    source: c.source,
    entity: "India",
    ownerId: owner?.id ?? null,
  }));
  for (let i = 0; i < rows.length; i += 50)
    await db.insert(crmContacts).values(rows.slice(i, i + 50));
  console.log(`contacts   ${rows.length} partner contacts`);

  // 5. Approach notes from the source sheets become account activities.
  const notes = accounts
    .filter((a) => a.note.trim() && accountId.has(a.name.toLowerCase()))
    .map((a) => ({
      workspaceId: ws.id,
      accountId: accountId.get(a.name.toLowerCase())!,
      type: "note",
      body: a.note.trim(),
      actorId: owner?.id ?? null,
    }));
  if (notes.length) await db.insert(crmActivities).values(notes);
  console.log(`notes      ${notes.length} approach notes attached`);

  // 6. Backfill the channel on the valuer leads loaded earlier.
  const upd = await db
    .update(crmContacts)
    .set({ channel: "direct" })
    .where(like(crmContacts.source, `${SOURCE_PREFIX}score%`))
    .returning({ id: crmContacts.id });
  console.log(`backfill   ${upd.length} valuer leads marked channel=direct`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
