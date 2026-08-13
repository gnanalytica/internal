import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { and, eq, like } from "drizzle-orm";
import { db } from "./index";
import { crmAccounts, crmContacts, users, workspaces } from "./schema";

/**
 * Load the top South India valuer leads into the shared CRM.
 * Re-runnable: drops anything a previous run created (contacts by `source`
 * prefix, accounts by industry) before inserting. Neon HTTP — sequential.
 *
 * Note: crmAccounts/crmContacts are WORKSPACE-wide, not project-scoped.
 */
const DATA = process.argv[2];
if (!DATA) throw new Error("usage: tsx load-valytica-leads.ts <leads.json>");

const INDUSTRY = "Property valuation";
const SOURCE_PREFIX = "Lead DB · ";

async function main() {
  const { leads, firms } = JSON.parse(readFileSync(DATA, "utf8")) as {
    leads: {
      name: string; email: string | null; phone: string | null; city: string;
      state: string; firm: string | null; ibbi: string; score: string;
      empanelments: string; source: string;
    }[];
    firms: { name: string; website: string | null; city: string; state: string }[];
  };

  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  const [owner] = await db.select().from(users).where(eq(users.email, "shravani@gnanalytica.com"));
  if (!owner) throw new Error("Shravani not found — leads need an owner");

  // Clear a prior run.
  await db.delete(crmContacts).where(like(crmContacts.source, `${SOURCE_PREFIX}%`));
  await db.delete(crmAccounts).where(eq(crmAccounts.industry, INDUSTRY));

  // Firms first, so contacts can point at them.
  const madeAccounts = await db
    .insert(crmAccounts)
    .values(
      firms.map((f) => ({
        workspaceId: ws.id,
        name: f.name,
        website: f.website,
        industry: INDUSTRY,
        type: "prospect",
        entity: "India",
        ownerId: owner.id,
      })),
    )
    .returning({ id: crmAccounts.id, name: crmAccounts.name });
  const accountId = new Map(madeAccounts.map((a) => [a.name.toLowerCase(), a.id]));
  console.log(`accounts  ${madeAccounts.length} valuation firms`);

  const rows = leads.map((l) => ({
    workspaceId: ws.id,
    accountId: l.firm ? (accountId.get(l.firm.toLowerCase()) ?? null) : null,
    name: l.name,
    email: l.email,
    phone: l.phone,
    // No notes field on a contact — the identifying detail goes in the title.
    title: [
      "Registered Valuer (L&B)",
      l.ibbi || null,
      [l.city, l.state].filter(Boolean).join(", ") || null,
      l.empanelments && l.empanelments !== "0" ? `${l.empanelments} empanelments` : null,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 240),
    lifecycleStage: "lead",
    source: l.source,
    entity: "India",
    ownerId: owner.id,
  }));
  for (let i = 0; i < rows.length; i += 50)
    await db.insert(crmContacts).values(rows.slice(i, i + 50));

  console.log(`contacts  ${rows.length} valuers · owner ${owner.name} · entity India`);
  console.log(`          ${rows.filter((r) => r.email).length} with email · ${rows.filter((r) => r.phone).length} with phone`);
  console.log(`          ${rows.filter((r) => r.accountId).length} linked to a firm`);
  void and;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
