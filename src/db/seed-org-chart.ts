import { config } from "dotenv";

config({ path: ".env.local" });

import { eq, inArray } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the gnanalytica org chart (positions/roles), grounded in the live team.
 * One person can hold several positions, so Sandeep appears as both CEO and
 * CTO / HR. The structure:
 *
 *   CEO — Sandeep
 *     ├─ CTO / HR — Sandeep
 *     │    ├─ AI Engineer — Sanjana
 *     │    ├─ Full Stack Engineer — Raunak
 *     │    └─ Infrastructure & Backend Engineer — Harshith
 *     ├─ CMO / CPO — Jayasaagar
 *     │    ├─ Marketing & Social Media Outreach — Shravani
 *     │    └─ Business Analyst & Product Owner · Valytica — Aparna
 *     ├─ Data Security Consultant — Pranav Aditya
 *     ├─ AI Consultant — Shraddha BLS
 *     ├─ Lawyer & Legal Specialist — Manjusha Ksn
 *     └─ Delivery & Tech Transformation Consultant — Sairam
 *
 * Consultants report directly to the CEO (not embedded in a delivery line).
 *
 * Idempotent: clears the workspace's org_roles and rebuilds the tree.
 * Run: npm run db:seed-org-chart
 */

type Role = { title: string; email: string | null; reports?: Role[] };

const TREE: Role = {
  title: "CEO",
  email: "sandeep@gnanalytica.com",
  reports: [
    {
      title: "CTO / HR",
      email: "sandeep@gnanalytica.com",
      reports: [
        { title: "AI Engineer", email: "sanjana@gnanalytica.com" },
        { title: "Full Stack Engineer", email: "raunak@gnanalytica.com" },
        { title: "Infrastructure & Backend Engineer", email: "harshith@gnanalytica.com" },
      ],
    },
    {
      title: "CMO / CPO",
      email: "jayasaagar@gnanalytica.com",
      reports: [
        { title: "Marketing & Social Media Outreach", email: "shravani@gnanalytica.com" },
        { title: "Business Analyst & Product Owner · Valytica", email: "aparna@gnanalytica.com" },
      ],
    },
    // Consultants report directly to the CEO.
    { title: "Data Security Consultant", email: "gpranavaditya@gmail.com" },
    { title: "AI Consultant", email: "shraddhabollapragada@gmail.com" },
    { title: "Lawyer & Legal Specialist", email: "ksnmanjusha1804@gmail.com" },
    { title: "Delivery & Technology Transformation Consultant", email: "bsairam.2002@gmail.com" },
  ],
};

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) return console.log("No gnanalytica workspace.");

  // Resolve users by email.
  const emails = new Set<string>();
  const collect = (r: Role) => {
    if (r.email) emails.add(r.email);
    r.reports?.forEach(collect);
  };
  collect(TREE);
  const userRows = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.email, [...emails]));
  const idByEmail = new Map(userRows.map((u) => [u.email, u.id]));

  // Wipe and rebuild this workspace's org chart.
  await db.delete(schema.orgRoles).where(eq(schema.orgRoles.workspaceId, ws.id));

  let seq = 0;
  let inserted = 0;
  let unmatched = 0;

  async function insert(role: Role, parentId: string | null): Promise<void> {
    const userId = role.email ? idByEmail.get(role.email) ?? null : null;
    if (role.email && !userId) {
      unmatched++;
      console.log(`  ! no user for ${role.email} (${role.title}) — left as open seat`);
    }
    const [created] = await db
      .insert(schema.orgRoles)
      .values({
        workspaceId: ws.id,
        title: role.title,
        userId,
        parentId,
        sortKey: `a${String(seq++).padStart(3, "0")}`,
      })
      .returning({ id: schema.orgRoles.id });
    inserted++;
    for (const child of role.reports ?? []) await insert(child, created.id);
  }

  await insert(TREE, null);

  console.log(`Org roles seeded: ${inserted} (${unmatched} open seats).`);
  console.log("Done — gnanalytica org chart seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
