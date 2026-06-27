/**
 * Backfill the People & HR directory fields on workspace_members from the real
 * roles already defined in the seeds. Reporting lines are a sensible functional
 * default (founders at the top) — adjust in the Directory as needed.
 * Idempotent.
 */
import { and, eq } from "drizzle-orm";

import { db } from "./index";
import { users, workspaceMembers, workspaces } from "./schema";

const FOUNDER = "sandeep@gnanalytica.com";
const PRODUCT = "jayasaagar@gnanalytica.com";

// email → { title, employment, entity, managerEmail | null }
const PEOPLE: Record<string, { title: string; employment: string; entity: string; manager: string | null }> = {
  "sandeep@gnanalytica.com": { title: "CEO / CTO / HR / Head of AI", employment: "employee", entity: "Global", manager: null },
  "jayasaagar@gnanalytica.com": { title: "Chief Marketing & Product", employment: "employee", entity: "Global", manager: null },
  "aparna@gnanalytica.com": { title: "Business Analyst & Product Owner — Valytica", employment: "employee", entity: "India", manager: PRODUCT },
  "sanjana@gnanalytica.com": { title: "AI Engineer", employment: "employee", entity: "India", manager: FOUNDER },
  "raunak@gnanalytica.com": { title: "Full Stack Engineer", employment: "employee", entity: "India", manager: FOUNDER },
  "harshith@gnanalytica.com": { title: "Infrastructure & Backend Engineer", employment: "employee", entity: "India", manager: FOUNDER },
  "shravani@gnanalytica.com": { title: "Marketing & Social Media Outreach", employment: "employee", entity: "Global", manager: PRODUCT },
  "gpranavaditya@gmail.com": { title: "Data Security Consultant", employment: "contractor", entity: "Global", manager: FOUNDER },
  "shraddhabollapragada@gmail.com": { title: "AI Consultant", employment: "contractor", entity: "Global", manager: FOUNDER },
  "ksnmanjusha1804@gmail.com": { title: "Lawyer & Legal Specialist", employment: "contractor", entity: "Global", manager: FOUNDER },
  "bsairam.2002@gmail.com": { title: "Delivery & Technology Transformation Consultant", employment: "contractor", entity: "Global", manager: FOUNDER },
};

async function main() {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, "gnanalytica")).limit(1);
  if (!ws) throw new Error("workspace not found");

  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const idByEmail = new Map(allUsers.map((u) => [u.email, u.id]));

  let n = 0;
  for (const [email, p] of Object.entries(PEOPLE)) {
    const userId = idByEmail.get(email);
    if (!userId) {
      console.log(`· ${email} not found, skipping`);
      continue;
    }
    const managerId = p.manager ? idByEmail.get(p.manager) ?? null : null;
    await db
      .update(workspaceMembers)
      .set({ title: p.title, employment: p.employment, entity: p.entity, managerId })
      .where(and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, userId)));
    n++;
  }
  console.log(`✓ backfilled ${n} people`);
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
