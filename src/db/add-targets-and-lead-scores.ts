import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, isNotNull, sql } from "drizzle-orm";
import { db } from "./index";
import { crmContacts, metrics, projects } from "./schema";

/**
 * Two backfills over data the tool already holds but cannot use:
 *   metrics  — the target is inside the name ("… (target ≥90%)"), so nothing
 *              can render progress. Parse it into `target` + direction.
 *   contacts — the lead score is inside `source` ("Lead DB · score 203 · …"),
 *              so the ranked list cannot be sorted. Parse it into `leadScore`.
 * Idempotent: parsing a cleaned name simply finds nothing. Neon HTTP: sequential.
 */

/** "(target ≥90%)" / "(target <30 sec)" / "(target 0)" → number + direction. */
function parseTarget(name: string): { value: number; direction: "above" | "below" } | null {
  const m = /\(target\s*([≥≤<>]?)\s*₹?([\d.,]+)\s*[^)]*\)/i.exec(name);
  if (!m) return null;
  const value = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  // "≥ 90%" and "100%" are floors; "< 30 sec" and "0 defects" are ceilings.
  const op = m[1];
  const direction = op === "<" || op === "≤" ? "below" : op ? "above" : value === 0 ? "below" : "above";
  return { value, direction };
}

const cleanName = (name: string) => name.replace(/\s*\(target[^)]*\)\s*$/i, "").trim();

async function main() {
  await db.execute(sql`alter table metrics add column if not exists target real`);
  await db.execute(
    sql`alter table metrics add column if not exists target_direction text not null default 'above'`,
  );
  await db.execute(sql`alter table crm_contacts add column if not exists lead_score integer`);
  console.log("columns   metrics.target · metrics.target_direction · crm_contacts.lead_score");

  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");

  // 1. Metric targets — lift out of the name, then tidy the name.
  const rows = await db.select().from(metrics).where(eq(metrics.projectId, project.id));
  let hit = 0;
  for (const m of rows) {
    const parsed = parseTarget(m.name);
    if (!parsed) continue;
    await db
      .update(metrics)
      .set({ target: parsed.value, targetDirection: parsed.direction, name: cleanName(m.name) })
      .where(eq(metrics.id, m.id));
    hit++;
  }
  console.log(`targets   ${hit}/${rows.length} metrics now carry a numeric target`);

  // 2. Lead scores — lift out of `source`, which keeps its provenance text.
  const contacts = await db
    .select({ id: crmContacts.id, source: crmContacts.source })
    .from(crmContacts)
    .where(isNotNull(crmContacts.source));
  let scored = 0;
  for (const c of contacts) {
    const m = /score\s+(\d+)/i.exec(c.source ?? "");
    if (!m) continue;
    await db
      .update(crmContacts)
      .set({ leadScore: Number(m[1]) })
      .where(eq(crmContacts.id, c.id));
    scored++;
  }
  console.log(`scores    ${scored} contacts now carry a numeric lead score`);

  const [top] = await db
    .select({ name: crmContacts.name, score: crmContacts.leadScore })
    .from(crmContacts)
    .where(isNotNull(crmContacts.leadScore))
    .orderBy(sql`lead_score desc`)
    .limit(1);
  if (top) console.log(`          top: ${top.name} (${top.score})`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
