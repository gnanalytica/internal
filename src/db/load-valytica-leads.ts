import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { eq, like } from "drizzle-orm";
import { db } from "./index";
import { crmAccounts, crmContacts, users, workspaces } from "./schema";

/**
 * Load the top South India valuer leads into the shared CRM.
 * Re-runnable: clears only its own contacts (matched by `source` prefix) and
 * creates firms that are absent. It never deletes accounts — other loaders
 * create firms under the same industry. Neon HTTP — sequential.
 *
 * Note: crmAccounts/crmContacts are WORKSPACE-wide, not project-scoped.
 */
const DATA = process.argv[2];
if (!DATA) throw new Error("usage: tsx load-valytica-leads.ts <leads.json>");

const INDUSTRY = "Property valuation";
const SOURCE_PREFIX = "Lead DB · score";

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

  // Firms already written off stay written off. Their account is kept as a
  // tombstone precisely so a reload matches it here instead of resurrecting
  // the firm and everyone at it.
  const churned = await db
    .select({ name: crmAccounts.name })
    .from(crmAccounts)
    .where(eq(crmAccounts.type, "churned"));
  // The lead sheet spells a firm as a compound ("A Pvt Ltd / B Pvt Ltd") where
  // the company sheet spells it plainly, so an exact name match misses. Treat
  // either name containing the other as the same firm.
  const churnedNames = churned.map((c) => c.name.toLowerCase().trim());
  const isBlocked = (firm: string | null | undefined) => {
    if (!firm) return false;
    const f = firm.toLowerCase().trim();
    return churnedNames.some((c) => c.length > 8 && (f.includes(c) || c.includes(f)));
  };

  // Clear only this loader's own contacts — the scored valuers. The partner
  // loader writes contacts under the same 'Lead DB' banner, and a broader
  // match here would take those with it. Accounts are never cleared.
  await db.delete(crmContacts).where(like(crmContacts.source, `${SOURCE_PREFIX}%`));

  // Firms first, so contacts can point at them — created only if absent.
  const present = await db
    .select({ id: crmAccounts.id, name: crmAccounts.name })
    .from(crmAccounts)
    .where(eq(crmAccounts.workspaceId, ws.id));
  const accountId = new Map(present.map((a) => [a.name.toLowerCase(), a.id]));

  const liveFirms = firms.filter((f) => !isBlocked(f.name) && !accountId.has(f.name.toLowerCase()));
  const madeAccounts = liveFirms.length
    ? await db
        .insert(crmAccounts)
        .values(
          liveFirms.map((f) => ({
            workspaceId: ws.id,
            name: f.name,
            website: f.website,
            industry: INDUSTRY,
            type: "prospect",
            entity: "India",
            ownerId: owner.id,
          })),
        )
        .returning({ id: crmAccounts.id, name: crmAccounts.name })
    : [];
  for (const a of madeAccounts) accountId.set(a.name.toLowerCase(), a.id);
  const blockedFirms = firms.filter((f) => isBlocked(f.name)).length;
  console.log(`accounts  ${madeAccounts.length} firms created` + (blockedFirms ? ` (${blockedFirms} skipped: written off)` : ""));

  const liveLeads = leads.filter((l) => !isBlocked(l.firm));
  const rows = liveLeads.map((l) => ({
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

  console.log(`contacts  ${rows.length} valuers · owner ${owner.name} · entity India` + (leads.length - liveLeads.length ? ` (${leads.length - liveLeads.length} skipped: written-off firm)` : ""));
  console.log(`          ${rows.filter((r) => r.email).length} with email · ${rows.filter((r) => r.phone).length} with phone`);
  console.log(`          ${rows.filter((r) => r.accountId).length} linked to a firm`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
