import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { and, eq, isNotNull, like } from "drizzle-orm";
import { db } from "./index";
import { crmActivities, crmContacts, users, workspaces } from "./schema";

/**
 * Attach the hand-researched intel for each top lead as a note on the contact:
 * sales angle, what they use today, which panels they sit on, their digital
 * footprint, and the database's own data-quality warning.
 * Re-runnable: clears the notes it previously wrote. Neon HTTP: sequential.
 */
const DATA = process.argv[2];
if (!DATA) throw new Error("usage: tsx load-valytica-lead-intel.ts <intel.json>");

const MARKER = "Sales angle —";

async function main() {
  const intel = JSON.parse(readFileSync(DATA, "utf8")) as
    { name: string; score: string; body: string }[];
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  const [owner] = await db.select().from(users).where(eq(users.email, "shravani@gnanalytica.com"));

  // Only the scored valuer leads carry this intel; match them by name.
  const contacts = await db
    .select({ id: crmContacts.id, name: crmContacts.name })
    .from(crmContacts)
    .where(and(isNotNull(crmContacts.leadScore), like(crmContacts.source, "Lead DB · score%")));
  const idByName = new Map(contacts.map((c) => [c.name.toLowerCase(), c.id]));

  // Clear a prior run — these notes are regenerated, not accumulated.
  const prior = await db
    .select({ id: crmActivities.id, body: crmActivities.body })
    .from(crmActivities)
    .where(isNotNull(crmActivities.contactId));
  for (const p of prior)
    if (p.body?.startsWith(MARKER)) await db.delete(crmActivities).where(eq(crmActivities.id, p.id));

  const rows = intel
    .filter((i) => idByName.has(i.name.toLowerCase()))
    .map((i) => ({
      workspaceId: ws.id,
      contactId: idByName.get(i.name.toLowerCase())!,
      type: "note",
      body: i.body,
      actorId: owner?.id ?? null,
    }));
  for (let k = 0; k < rows.length; k += 50)
    await db.insert(crmActivities).values(rows.slice(k, k + 50));

  const unmatched = intel.filter((i) => !idByName.has(i.name.toLowerCase())).map((i) => i.name);
  console.log(`notes      ${rows.length} lead-intel notes attached to contacts`);
  if (unmatched.length) console.log(`unmatched  ${unmatched.length}: ${unmatched.slice(0, 5).join(", ")}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
