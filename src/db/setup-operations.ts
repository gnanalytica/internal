/**
 * Set up the Operations bucket (kind='operation', flat/no departments):
 *   People & HR  ← folds Hiring
 *   Finance      ← folds India Payroll Setup
 *   Legal & Compliance
 *   IT & Tools
 * Idempotent: safe to re-run.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { projects, workspaces } from "./schema";

async function rename(ws: string, from: string, to: { name: string; key: string; color: string; description: string }) {
  const [existing] = await db.select().from(projects)
    .where(and(eq(projects.workspaceId, ws), eq(projects.name, from))).limit(1);
  if (!existing) { console.log(`· "${from}" not found (already folded?)`); return; }
  await db.update(projects)
    .set({ name: to.name, key: to.key, color: to.color, description: to.description, kind: "operation" })
    .where(eq(projects.id, existing.id));
  console.log(`✓ "${from}" → "${to.name}" (${to.key})`);
}

async function ensure(ws: string, p: { name: string; key: string; color: string; description: string }) {
  const [existing] = await db.select().from(projects)
    .where(and(eq(projects.workspaceId, ws), eq(projects.name, p.name))).limit(1);
  if (existing) { console.log(`· "${p.name}" already exists`); return; }
  await db.insert(projects).values({ workspaceId: ws, kind: "operation", ...p });
  console.log(`✓ created "${p.name}" (${p.key})`);
}

async function main() {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, "gnanalytica")).limit(1);
  if (!ws) throw new Error("workspace 'gnanalytica' not found");

  await rename(ws.id, "Hiring", {
    name: "People & HR", key: "PPL", color: "#ec4899",
    description: "Hiring, onboarding, the team roster and HR. Confidential.",
  });
  await rename(ws.id, "India Payroll Setup", {
    name: "Finance", key: "FIN", color: "#22c55e",
    description: "Company finance: payroll, expenses, runway across entities (NL via Odoo). Confidential.",
  });
  await ensure(ws.id, {
    name: "Legal & Compliance", key: "LGL", color: "#f59e0b",
    description: "Contracts, entity compliance and filings across India and the Netherlands.",
  });
  await ensure(ws.id, {
    name: "IT & Tools", key: "IT", color: "#0ea5e9",
    description: "SaaS subscriptions, accounts and access. Backed by the Tools & Subscriptions database.",
  });

  const ops = await db.select().from(projects).where(and(eq(projects.workspaceId, ws.id), eq(projects.kind, "operation")));
  console.log("\nOperations now:", ops.map((o) => o.name).sort().join(" · "));
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
